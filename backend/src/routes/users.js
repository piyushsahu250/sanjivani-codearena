const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { sendMail, wrapBranded } = require("../utils/mailer");
const { computeStudentPerformance } = require("../utils/studentPerformance");
const { generatePerformancePdf } = require("../utils/reportPdf");
const { generateTempPassword } = require("../utils/password");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const FRONTEND_URL = process.env.FRONTEND_URL || "https://sanjivani-codearena.vercel.app";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_FIELDS = {
  id: true, name: true, email: true, role: true, rollNumber: true, department: true,
  mobile: true, program: true, batchYear: true, section: true, createdAt: true,
  mustChangePassword: true,
  institute: { select: { id: true, name: true } },
  class: { select: { id: true, name: true, batchYear: true } },
};


// Maps flexible spreadsheet header text -> our field names
const FIELD_ALIASES = {
  name: ["student name", "name", "full name"],
  rollNumber: ["roll number", "roll no", "rollno", "roll no."],
  email: ["official email id", "email", "email id", "official email"],
  mobile: ["mobile number", "mobile", "phone", "phone number"],
  department: ["department", "dept"],
  program: ["program", "course"],
  batchYear: ["batch/year", "batch year", "batch", "year"],
  section: ["section"],
  instituteName: ["institute", "institute name", "college", "college name"],
  className: ["class", "class name", "program/class"],
};

function normalizeHeader(str) {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildHeaderMap(headers) {
  const map = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (!map[field] && aliases.includes(norm)) map[field] = header;
    }
  }
  return map;
}

const TEMPLATE_HEADERS = ["Student Name", "Roll Number", "Official Email ID", "Institute", "Class", "Mobile Number", "Department", "Program", "Batch/Year", "Section"];

// Any authenticated user: change their own email and/or password
router.patch("/me", authenticate, async (req, res) => {
  try {
    const { currentPassword, newEmail, newPassword } = req.body;
    if (!currentPassword) {
      return res.status(400).json({ error: "currentPassword is required" });
    }
    if (!newEmail && !newPassword) {
      return res.status(400).json({ error: "Provide newEmail and/or newPassword" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Current password is incorrect" });

    const data = {};
    if (newEmail && newEmail !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email: newEmail } });
      if (existing) return res.status(409).json({ error: "Email already in use" });
      data.email = newEmail;
    }
    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ error: "New password must be at least 6 characters" });
      data.passwordHash = await bcrypt.hash(newPassword, 10);
      data.mustChangePassword = false;
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data, select: SELECT_FIELDS });

    const token = jwt.sign(
      { id: updated.id, role: updated.role, email: updated.email, name: updated.name },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

// ADMIN: list all users
router.get("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  const users = await prisma.user.findMany({ select: SELECT_FIELDS, orderBy: { createdAt: "desc" } });
  res.json(users);
});

// ADMIN: create a Staff, Admin, or Student account directly (no self-registration needed).
// Password is a unique, randomly generated temporary one — the admin never types one — and the
// account is flagged to force a password change on first login.
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, email, role, rollNumber, department, mobile, program, batchYear, section, instituteId, classId } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email, and role are required" });
    }
    if (!["STUDENT", "STAFF", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "role must be STUDENT, STAFF, or ADMIN" });
    }
    if (!instituteId) return res.status(400).json({ error: "An institute is required" });
    if (role === "STUDENT" && !classId) return res.status(400).json({ error: "A class is required for students" });

    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) return res.status(404).json({ error: "Institute not found" });

    if (classId) {
      const cls = await prisma.class.findUnique({ where: { id: classId } });
      if (!cls || cls.instituteId !== instituteId) {
        return res.status(400).json({ error: "Selected class does not belong to the selected institute" });
      }
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const generatedPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(generatedPassword, 10);
    const user = await prisma.user.create({
      data: {
        name, email, passwordHash, role, rollNumber, department, mobile, program, batchYear, section,
        instituteId, classId: classId || null, mustChangePassword: true,
      },
      select: SELECT_FIELDS,
    });

    sendMail({
      to: user.email,
      subject: "Your CodeArena account",
      html: wrapBranded(`<p>Hi ${user.name},</p><p>Your account has been created.</p><p><strong>Login email:</strong> ${user.email}<br/><strong>Temporary password:</strong> ${generatedPassword}</p><p>Sign in at <a href="${FRONTEND_URL}/login">${FRONTEND_URL}/login</a> — you'll be asked to set a new password on first login.</p>`),
    }).catch(() => {});

    res.json({ ...user, generatedPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ADMIN: download a sample .xlsx template for bulk student upload
router.get("/bulk-template", authenticate, requireRole("ADMIN"), (req, res) => {
  const sampleRow = ["John Doe", "MCA2024001", "john.doe@codearena.edu.in", "CodeArena University", "MCA", "9876543210", "Computer Applications", "MCA", "2024-26", "A"];
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=student-upload-template.xlsx");
  res.send(buffer);
});

// ADMIN: bulk-create student accounts from an uploaded .xlsx/.csv file.
// Each row must name an existing Institute and, under it, an existing Class — both are validated
// against the database. Each row gets its own unique, randomly generated password (not shared
// with any other row), and the account is flagged to force a password change on first login.
router.post("/bulk-upload", authenticate, requireRole("ADMIN"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      return res.status(400).json({ error: "Could not read this file. Please upload a valid .xlsx or .csv file." });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
    if (rows.length === 0) return res.status(400).json({ error: "The uploaded file has no data rows." });

    const headerMap = buildHeaderMap(Object.keys(rows[0]));
    if (!headerMap.name || !headerMap.rollNumber || !headerMap.email) {
      return res.status(400).json({
        error: "Missing required columns. The file must include Student Name, Roll Number, and Official Email ID.",
      });
    }
    if (!headerMap.instituteName || !headerMap.className) {
      return res.status(400).json({
        error: "Missing required columns. The file must include Institute and Class.",
      });
    }

    const sendCredentials = req.body.sendCredentials === "true";

    const [existingUsers, institutes, classes] = await Promise.all([
      prisma.user.findMany({ select: { email: true, rollNumber: true } }),
      prisma.institute.findMany(),
      prisma.class.findMany(),
    ]);
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingRolls = new Set(existingUsers.filter((u) => u.rollNumber).map((u) => u.rollNumber.toLowerCase()));
    const seenEmails = new Set();
    const seenRolls = new Set();
    const instituteByName = new Map(institutes.map((i) => [i.name.toLowerCase(), i]));

    const created = [];
    const duplicates = [];
    const errors = [];

    const field = (row, key) => (headerMap[key] ? String(row[headerMap[key]] ?? "").trim() : "");

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2; // +1 for header row, +1 for 1-indexing
      const row = rows[i];
      const name = field(row, "name");
      const rollNumber = field(row, "rollNumber");
      const email = field(row, "email").toLowerCase();
      const mobile = field(row, "mobile");
      const department = field(row, "department");
      const program = field(row, "program");
      const batchYear = field(row, "batchYear");
      const section = field(row, "section");
      const instituteName = field(row, "instituteName");
      const className = field(row, "className");

      if (!name && !rollNumber && !email) continue; // blank row

      if (!name || !rollNumber || !email || !instituteName || !className) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Missing required field (name, roll number, email, institute, or class)" });
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Invalid email format" });
        continue;
      }

      const institute = instituteByName.get(instituteName.toLowerCase());
      if (!institute) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: `Institute "${instituteName}" was not found. Create it first in Institute Management.` });
        continue;
      }
      const cls = classes.find((c) => c.instituteId === institute.id && c.name.toLowerCase() === className.toLowerCase());
      if (!cls) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: `Class "${className}" was not found under institute "${instituteName}". Create it first in Class Management.` });
        continue;
      }

      const rollKey = rollNumber.toLowerCase();
      if (existingEmails.has(email) || seenEmails.has(email)) {
        duplicates.push({ row: rowNum, name, email, rollNumber, reason: "Email already exists" });
        continue;
      }
      if (existingRolls.has(rollKey) || seenRolls.has(rollKey)) {
        duplicates.push({ row: rowNum, name, email, rollNumber, reason: "Roll number already exists" });
        continue;
      }

      seenEmails.add(email);
      seenRolls.add(rollKey);

      const generatedPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(generatedPassword, 10);

      try {
        const user = await prisma.user.create({
          data: {
            name, email, rollNumber, passwordHash, role: "STUDENT",
            mobile: mobile || null,
            department: department || null,
            program: program || null,
            batchYear: batchYear || null,
            section: section || null,
            instituteId: institute.id,
            classId: cls.id,
            mustChangePassword: true,
          },
        });
        created.push({ ...user, generatedPassword });
      } catch (err) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Failed to create account" });
      }
    }

    if (sendCredentials && created.length > 0) {
      for (const u of created) {
        sendMail({
          to: u.email,
          subject: "Your CodeArena account",
          html: wrapBranded(`<p>Hi ${u.name},</p><p>Your student account has been created.</p><p><strong>Login email:</strong> ${u.email}<br/><strong>Temporary password:</strong> ${u.generatedPassword}</p><p>Sign in at <a href="${FRONTEND_URL}/login">${FRONTEND_URL}/login</a> — you'll be asked to set a new password on first login.</p>`),
        }).catch(() => {});
      }
    }

    res.json({
      total: rows.length,
      createdCount: created.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      created: created.map((u) => ({ name: u.name, email: u.email, rollNumber: u.rollNumber, generatedPassword: u.generatedPassword })),
      duplicates,
      errors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk upload failed" });
  }
});

// ADMIN: look up a student by roll number and see which tests they've completed
router.get("/lookup/:query", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const q = req.params.query;
    const user = await prisma.user.findFirst({
      where: {
        role: "STUDENT",
        OR: [{ rollNumber: q }, { email: q }, { id: q }],
        ...(req.requesterInstituteId ? { instituteId: req.requesterInstituteId } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        attempts: {
          select: {
            status: true,
            totalScore: true,
            startedAt: true,
            submittedAt: true,
            tabSwitchCount: true,
            test: { select: { id: true, title: true, isPublished: true } },
          },
          orderBy: { startedAt: "desc" },
        },
      },
    });
    if (!user) return res.status(404).json({ error: "No student found with that roll number, email, or ID" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lookup failed" });
  }
});

// ADMIN/STAFF: search students by ID, roll number, name, or official email — institute-scoped
// accounts only ever match students under their own institute. Powers the Student Performance
// Dashboard's search box; results are capped and meant for picking one student, not browsing.
router.get("/search", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) return res.json([]);
    const students = await prisma.user.findMany({
      where: {
        role: "STUDENT",
        ...(req.requesterInstituteId ? { instituteId: req.requesterInstituteId } : {}),
        OR: [
          { id: q },
          { rollNumber: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true, name: true, email: true, rollNumber: true,
        institute: { select: { name: true } },
        class: { select: { name: true, batchYear: true } },
      },
      orderBy: { name: "asc" },
      take: 20,
    });
    res.json(students);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Search failed" });
  }
});

// Shared access check for the performance dashboard + both report exports: ADMIN/STAFF can view
// any student under their own institute (platform-level accounts see everyone); a STUDENT may
// only view their own. Returns the student's own institute-scope-relevant fields on success, or
// sends the appropriate error response and returns null.
async function authorizeStudentPerformanceAccess(req, res) {
  const targetId = req.params.id;
  if (req.user.role === "STUDENT" && req.user.id !== targetId) {
    res.status(403).json({ error: "You can only view your own performance dashboard" });
    return null;
  }
  const target = await prisma.user.findUnique({ where: { id: targetId }, select: { id: true, role: true, instituteId: true } });
  if (!target || target.role !== "STUDENT") {
    res.status(404).json({ error: "Student not found" });
    return null;
  }
  if (req.user.role !== "STUDENT") {
    const requester = await prisma.user.findUnique({ where: { id: req.user.id }, select: { instituteId: true } });
    if (requester?.instituteId && target.instituteId !== requester.instituteId) {
      res.status(403).json({ error: "You can only view students under your own institute" });
      return null;
    }
  }
  return target;
}

// ADMIN/STAFF/STUDENT(self): full performance dashboard — summary stats, test history, and
// chart-ready analytics. A student's own view masks scores for any test whose results aren't
// published yet, same principle as the single-test result page.
router.get("/:id/performance", authenticate, requireRole("ADMIN", "STAFF", "STUDENT"), async (req, res) => {
  try {
    const target = await authorizeStudentPerformanceAccess(req, res);
    if (!target) return;
    const data = await computeStudentPerformance(target.id, { maskUnpublished: req.user.role === "STUDENT" });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load performance data" });
  }
});

// Same access rule as above: downloadable Excel report.
router.get("/:id/performance/report.xlsx", authenticate, requireRole("ADMIN", "STAFF", "STUDENT"), async (req, res) => {
  try {
    const target = await authorizeStudentPerformanceAccess(req, res);
    if (!target) return;
    const data = await computeStudentPerformance(target.id, { maskUnpublished: req.user.role === "STUDENT" });

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.aoa_to_sheet([
      ["Student Performance Report"],
      [],
      ["Name", data.student.name],
      ["Roll Number", data.student.rollNumber || "—"],
      ["Official Email", data.student.email],
      ["Mobile", data.student.mobile || "—"],
      ["Institute", data.student.institute?.name || "—"],
      ["Class", data.student.class?.name || "—"],
      ["Batch Year", data.student.class?.batchYear || data.student.batchYear || "—"],
      [],
      ["Total Tests Assigned", data.summary.totalTestsAssigned],
      ["Total Tests Attempted", data.summary.totalTestsAttempted],
      ["Total Tests Completed", data.summary.totalTestsCompleted],
      ["Total Tests Pending", data.summary.totalTestsPending],
      ["Average Score (%)", data.summary.averageScorePercent],
      ["Overall Percentage", data.summary.overallPercentage],
      ["Highest Score (%)", data.summary.highest?.percentage ?? "—"],
      ["Lowest Score (%)", data.summary.lowest?.percentage ?? "—"],
      ["Total Coding Questions Solved", data.summary.totalCodingSolved],
      ["Total MCQs Attempted", data.summary.totalMcqAttempted],
      ["Total MCQs Answered Correctly", data.summary.totalMcqCorrect],
      ["Total Time Spent (minutes)", data.summary.totalTimeSpentMin],
      ["Last Test Attempt Date", data.summary.lastAttemptDate ? new Date(data.summary.lastAttemptDate).toLocaleString() : "—"],
    ]);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");

    const historySheet = XLSX.utils.json_to_sheet(
      data.testHistory.map((h) => ({
        "Test Name": h.testName,
        "Date": new Date(h.date).toLocaleDateString(),
        "Score": h.resultsPending ? "Pending" : h.score,
        "Max Score": h.maxScore,
        "Percentage": h.resultsPending ? "Pending" : `${h.percentage}%`,
        "Time Taken (min)": h.timeTakenMin ?? "—",
        "Status": h.status,
      }))
    );
    XLSX.utils.book_append_sheet(wb, historySheet, "Test History");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${(data.student.rollNumber || data.student.id)}-performance-report.xlsx"`);
    res.send(buffer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate Excel report" });
  }
});

// Same access rule as above: downloadable PDF report.
router.get("/:id/performance/report.pdf", authenticate, requireRole("ADMIN", "STAFF", "STUDENT"), async (req, res) => {
  try {
    const target = await authorizeStudentPerformanceAccess(req, res);
    if (!target) return;
    const data = await computeStudentPerformance(target.id, { maskUnpublished: req.user.role === "STUDENT" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${(data.student.rollNumber || data.student.id)}-performance-report.pdf"`);
    generatePerformancePdf(data, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF report" });
  }
});

// ADMIN: reset a student's (or any account's) password to a new, unique random temporary one.
// The account is flagged to force a password change on next login, same as any other reset.
router.post("/:id/reset-password", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const newPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash, mustChangePassword: true },
    });
    res.json({ success: true, defaultPassword: newPassword });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// ADMIN: delete a user. Deleting a student also removes their own test attempts/submissions
// (scoped only to that student — nothing anyone else can see is affected). Deleting a staff/
// admin account that has created tests is blocked instead of cascading, since that would
// delete a shared Test (and every student's attempts on it), not just this one account's data.
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role !== "STUDENT") {
      const createdTestCount = await prisma.test.count({ where: { createdById: req.params.id } });
      if (createdTestCount > 0) {
        return res.status(409).json({
          error: `This account has created ${createdTestCount} test${createdTestCount === 1 ? "" : "s"}. Reassign or delete ${createdTestCount === 1 ? "it" : "them"} first, then delete the account.`,
        });
      }
      await prisma.user.delete({ where: { id: req.params.id } });
    } else {
      await prisma.$transaction([
        prisma.submission.deleteMany({ where: { studentId: req.params.id } }),
        prisma.testAttempt.deleteMany({ where: { studentId: req.params.id } }),
        prisma.user.delete({ where: { id: req.params.id } }),
      ]);
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;

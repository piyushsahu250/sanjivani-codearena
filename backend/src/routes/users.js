const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { sendMail } = require("../utils/mailer");

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const FRONTEND_URL = process.env.FRONTEND_URL || "https://sanjivani-codearena.vercel.app";
const DEFAULT_STUDENT_PASSWORD = "Sanjivani@1";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT_FIELDS = {
  id: true, name: true, email: true, role: true, rollNumber: true, department: true,
  mobile: true, program: true, batchYear: true, section: true, createdAt: true,
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

const TEMPLATE_HEADERS = ["Student Name", "Roll Number", "Official Email ID", "Mobile Number", "Department", "Program", "Batch/Year", "Section"];

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

// ADMIN: create a Staff, Admin, or Student account directly (no self-registration needed)
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department, mobile, program, batchYear, section } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "name, email, password, and role are required" });
    }
    if (!["STUDENT", "STAFF", "ADMIN"].includes(role)) {
      return res.status(400).json({ error: "role must be STUDENT, STAFF, or ADMIN" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, role, rollNumber, department, mobile, program, batchYear, section },
      select: SELECT_FIELDS,
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
  }
});

// ADMIN: download a sample .xlsx template for bulk student upload
router.get("/bulk-template", authenticate, requireRole("ADMIN"), (req, res) => {
  const sampleRow = ["John Doe", "MCA2024001", "john.doe@sanjivani.edu.in", "9876543210", "Computer Applications", "MCA", "2024-26", "A"];
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, sampleRow]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Students");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=student-upload-template.xlsx");
  res.send(buffer);
});

// ADMIN: bulk-create student accounts from an uploaded .xlsx/.csv file.
// All accounts get the default password Sanjivani@1 (hashed before storage).
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

    const sendCredentials = req.body.sendCredentials === "true";

    const existingUsers = await prisma.user.findMany({ select: { email: true, rollNumber: true } });
    const existingEmails = new Set(existingUsers.map((u) => u.email.toLowerCase()));
    const existingRolls = new Set(existingUsers.filter((u) => u.rollNumber).map((u) => u.rollNumber.toLowerCase()));
    const seenEmails = new Set();
    const seenRolls = new Set();

    const passwordHash = await bcrypt.hash(DEFAULT_STUDENT_PASSWORD, 10);
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

      if (!name && !rollNumber && !email) continue; // blank row

      if (!name || !rollNumber || !email) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Missing required field (name, roll number, or email)" });
        continue;
      }
      if (!EMAIL_RE.test(email)) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Invalid email format" });
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

      try {
        const user = await prisma.user.create({
          data: {
            name, email, rollNumber, passwordHash, role: "STUDENT",
            mobile: mobile || null,
            department: department || null,
            program: program || null,
            batchYear: batchYear || null,
            section: section || null,
          },
        });
        created.push(user);
      } catch (err) {
        errors.push({ row: rowNum, name, email, rollNumber, reason: "Failed to create account" });
      }
    }

    if (sendCredentials && created.length > 0) {
      for (const u of created) {
        sendMail({
          to: u.email,
          subject: "Your Sanjivani CodeArena account",
          html: `<p>Hi ${u.name},</p><p>Your student account has been created.</p><p><strong>Login email:</strong> ${u.email}<br/><strong>Temporary password:</strong> ${DEFAULT_STUDENT_PASSWORD}</p><p>Sign in at <a href="${FRONTEND_URL}/login">${FRONTEND_URL}/login</a> and change your password from Account settings after logging in.</p>`,
        }).catch(() => {});
      }
    }

    res.json({
      total: rows.length,
      createdCount: created.length,
      duplicateCount: duplicates.length,
      errorCount: errors.length,
      duplicates,
      errors,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk upload failed" });
  }
});

// ADMIN: look up a student by roll number and see which tests they've completed
router.get("/by-roll/:rollNumber", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const user = await prisma.user.findFirst({
      where: { rollNumber: req.params.rollNumber, role: "STUDENT" },
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
    if (!user) return res.status(404).json({ error: "No student found with that roll number" });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lookup failed" });
  }
});

// ADMIN: delete a user
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own account" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

module.exports = router;

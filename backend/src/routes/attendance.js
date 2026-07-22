const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { logAudit, AUDIT_ACTIONS } = require("../utils/auditLog");
const { sendExport } = require("../utils/exportFile");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const LECTURE_TYPES = ["REGULAR", "PRACTICE_TEST", "EXAM"];
const LECTURE_TYPE_LABELS = { REGULAR: "Regular Class", PRACTICE_TEST: "Practice Test", EXAM: "Exam" };

const SLOTS = [
  { label: "Slot 1", startTime: "09:50", endTime: "10:45" },
  { label: "Slot 2", startTime: "10:45", endTime: "11:40" },
  { label: "Slot 3", startTime: "11:40", endTime: "12:35" },
  { label: "Slot 4", startTime: "13:15", endTime: "14:10" },
  { label: "Slot 5", startTime: "14:10", endTime: "15:05" },
  { label: "Slot 6", startTime: "15:25", endTime: "16:20" },
  { label: "Slot 7", startTime: "16:20", endTime: "17:15" },
];
const SLOT_LABEL_SET = new Set([...SLOTS.map((s) => s.label), "Other"]);

// "YYYY-MM-DD" -> Date at UTC midnight, so the same calendar date always compares equal
// regardless of the caller's local timezone offset. Returns null for anything unparseable.
function normalizeDate(input) {
  if (!input) return null;
  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeHeader(str) {
  return String(str || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const LECTURE_TYPE_ALIASES = {
  "regular class": "REGULAR", regular: "REGULAR",
  "practice test": "PRACTICE_TEST", practicetest: "PRACTICE_TEST",
  exam: "EXAM",
};

// One of the 7 fixed slots (always resolves to its fixed start/end), or "Other" with a
// caller-supplied custom start/end. Returns null on anything invalid.
function resolveSlot(slotLabel, customStart, customEnd) {
  if (slotLabel === "Other") {
    const startTime = String(customStart || "").trim();
    const endTime = String(customEnd || "").trim();
    if (!startTime || !endTime) return null;
    return { slotLabel: "Other", startTime, endTime };
  }
  const preset = SLOTS.find((s) => s.label === slotLabel);
  return preset ? { slotLabel: preset.label, startTime: preset.startTime, endTime: preset.endTime } : null;
}

function validatePlanInput(body) {
  const topic = String(body.topic || "").trim();
  const scheduleDate = typeof body.scheduleDate === "string" ? normalizeDate(body.scheduleDate) : body.scheduleDate;
  const lectureNumber = Number(body.lectureNumber);
  const lectureType = LECTURE_TYPES.includes(body.lectureType) ? body.lectureType : null;
  const slot = resolveSlot(body.slotLabel, body.startTime, body.endTime);

  if (!topic) return { error: "A topic is required" };
  if (!scheduleDate) return { error: "A valid schedule date is required" };
  if (!lectureNumber || lectureNumber < 1) return { error: "A valid lecture number is required" };
  if (!lectureType) return { error: "A valid lecture type is required" };
  if (!slot) return { error: body.slotLabel === "Other" ? "Start and end time are required for a custom slot" : "A valid slot is required" };

  return { data: { topic, scheduleDate, lectureNumber, lectureType, ...slot } };
}

// Central access gate for every assignment-scoped attendance route. ADMIN: institute-scoped (same
// convention as attachRequesterInstitute everywhere else on this platform). STAFF: must own this
// exact StaffClassAssignment — this is the enforcement point for "staff must not access another
// staff member's (or another subject's) attendance." Returns the assignment (with class/division/
// department joined) on success, or null after already sending the appropriate 403/404 itself.
async function resolveAssignmentAccess(req, res, assignmentId) {
  const assignment = await prisma.staffClassAssignment.findUnique({
    where: { id: assignmentId },
    include: {
      staff: { select: { id: true, name: true, email: true } },
      class: { include: { institute: { select: { id: true, name: true } }, division: { include: { department: true } } } },
    },
  });
  if (!assignment) {
    res.status(404).json({ error: "Assignment not found" });
    return null;
  }
  if (req.user.role === "STAFF") {
    if (assignment.staffId !== req.user.id) {
      res.status(403).json({ error: "You are not assigned to this class" });
      return null;
    }
    return assignment;
  }
  // ADMIN
  if (req.requesterInstituteId && assignment.class.instituteId !== req.requesterInstituteId) {
    res.status(403).json({ error: "You can only manage attendance under your own institute" });
    return null;
  }
  return assignment;
}

// ===================== Admin: Department CRUD =====================

router.get("/admin/departments", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.requesterInstituteId) where.instituteId = req.requesterInstituteId;
  else if (req.query.instituteId) where.instituteId = req.query.instituteId;
  const departments = await prisma.department.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { divisions: true } } },
  });
  res.json(departments);
});

router.post("/admin/departments", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Department name is required" });
    if (req.requesterInstituteId && req.body.instituteId && req.body.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only add departments under your own institute" });
    }
    const instituteId = req.requesterInstituteId || req.body.instituteId;
    if (!instituteId) return res.status(400).json({ error: "An institute is required" });

    const existing = await prisma.department.findFirst({ where: { instituteId, name: name.trim() } });
    if (existing) return res.status(409).json({ error: "A department with this name already exists for this institute" });

    const dept = await prisma.department.create({ data: { name: name.trim(), instituteId } });
    res.json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create department" });
  }
});

router.patch("/admin/departments/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Department not found" });
    if (req.requesterInstituteId && existing.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage departments under your own institute" });
    }
    const { name, isActive } = req.body;
    const nextName = name?.trim() || existing.name;
    if (name && nextName !== existing.name) {
      const dup = await prisma.department.findFirst({ where: { instituteId: existing.instituteId, name: nextName, NOT: { id: existing.id } } });
      if (dup) return res.status(409).json({ error: "A department with this name already exists for this institute" });
    }
    const dept = await prisma.department.update({
      where: { id: req.params.id },
      data: { name: nextName, isActive: isActive ?? existing.isActive },
    });
    res.json(dept);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update department" });
  }
});

router.delete("/admin/departments/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.department.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Department not found" });
    if (req.requesterInstituteId && existing.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage departments under your own institute" });
    }
    await prisma.department.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2003" || err.code === "P2014") {
      return res.status(409).json({ error: "This department has divisions under it and can't be deleted. Delete or move its divisions first." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete department" });
  }
});

// ===================== Admin: Division CRUD =====================

router.get("/admin/divisions", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.query.departmentId) where.departmentId = req.query.departmentId;
  const divisions = await prisma.division.findMany({
    where,
    orderBy: { name: "asc" },
    include: { department: { select: { id: true, name: true, instituteId: true } }, _count: { select: { classes: true } } },
  });
  const scoped = req.requesterInstituteId
    ? divisions.filter((d) => d.department.instituteId === req.requesterInstituteId)
    : divisions;
  res.json(scoped);
});

router.post("/admin/divisions", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { name, departmentId } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Division name is required" });
    if (!departmentId) return res.status(400).json({ error: "A department is required" });

    const department = await prisma.department.findUnique({ where: { id: departmentId } });
    if (!department) return res.status(404).json({ error: "Department not found" });
    if (req.requesterInstituteId && department.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only add divisions under your own institute" });
    }

    const existing = await prisma.division.findFirst({ where: { departmentId, name: name.trim() } });
    if (existing) return res.status(409).json({ error: "A division with this name already exists in this department" });

    const division = await prisma.division.create({ data: { name: name.trim(), departmentId } });
    res.json(division);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create division" });
  }
});

router.patch("/admin/divisions/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.division.findUnique({ where: { id: req.params.id }, include: { department: true } });
    if (!existing) return res.status(404).json({ error: "Division not found" });
    if (req.requesterInstituteId && existing.department.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage divisions under your own institute" });
    }
    const { name, isActive } = req.body;
    const nextName = name?.trim() || existing.name;
    if (name && nextName !== existing.name) {
      const dup = await prisma.division.findFirst({ where: { departmentId: existing.departmentId, name: nextName, NOT: { id: existing.id } } });
      if (dup) return res.status(409).json({ error: "A division with this name already exists in this department" });
    }
    const division = await prisma.division.update({
      where: { id: req.params.id },
      data: { name: nextName, isActive: isActive ?? existing.isActive },
    });
    res.json(division);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update division" });
  }
});

router.delete("/admin/divisions/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.division.findUnique({ where: { id: req.params.id }, include: { department: true } });
    if (!existing) return res.status(404).json({ error: "Division not found" });
    if (req.requesterInstituteId && existing.department.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage divisions under your own institute" });
    }
    await prisma.division.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2003" || err.code === "P2014") {
      return res.status(409).json({ error: "This division has classes assigned to it and can't be deleted. Unassign its classes first." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete division" });
  }
});

// ===================== Admin: assign existing Classes into Divisions =====================

// Reuses the existing Class table — this never creates a new class, just sets/clears its
// (new, optional) divisionId, so Attendance never duplicates class/student data.
router.get("/admin/classes", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.requesterInstituteId) where.instituteId = req.requesterInstituteId;
  else if (req.query.instituteId) where.instituteId = req.query.instituteId;
  const classes = await prisma.class.findMany({
    where,
    orderBy: [{ name: "asc" }, { batchYear: "asc" }],
    include: {
      institute: { select: { id: true, name: true } },
      division: { include: { department: true } },
      staffAssignments: { include: { staff: { select: { id: true, name: true, email: true } } } },
      _count: { select: { users: true } },
    },
  });
  res.json(classes);
});

router.patch("/admin/classes/:classId/division", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.classId } });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && cls.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage classes under your own institute" });
    }
    const { divisionId } = req.body;
    if (divisionId) {
      const division = await prisma.division.findUnique({ where: { id: divisionId }, include: { department: true } });
      if (!division) return res.status(404).json({ error: "Division not found" });
      if (division.department.instituteId !== cls.instituteId) {
        return res.status(400).json({ error: "That division belongs to a different institute than this class" });
      }
    }
    const updated = await prisma.class.update({
      where: { id: req.params.classId },
      data: { divisionId: divisionId || null },
      include: { division: { include: { department: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update class's division" });
  }
});

// ===================== Admin: Staff ↔ Class↔Subject assignments =====================

router.get("/admin/staff", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  const where = { role: "STAFF", isActive: true };
  if (req.requesterInstituteId) where.instituteId = req.requesterInstituteId;
  else if (req.query.instituteId) where.instituteId = req.query.instituteId;
  const staff = await prisma.user.findMany({ where, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } });
  res.json(staff);
});

router.post("/admin/staff-assignments", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { staffId, classId } = req.body;
    const subject = String(req.body.subject || "").trim();
    const semester = String(req.body.semester || "").trim();
    if (!staffId || !classId) return res.status(400).json({ error: "Both a staff member and a class are required" });
    if (!subject) return res.status(400).json({ error: "A subject is required" });
    if (!semester) return res.status(400).json({ error: "A semester is required" });

    const [staff, cls] = await Promise.all([
      prisma.user.findUnique({ where: { id: staffId } }),
      prisma.class.findUnique({ where: { id: classId } }),
    ]);
    if (!staff || staff.role !== "STAFF") return res.status(404).json({ error: "Staff member not found" });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && (staff.instituteId !== req.requesterInstituteId || cls.instituteId !== req.requesterInstituteId)) {
      return res.status(403).json({ error: "You can only assign staff and classes under your own institute" });
    }

    const assignment = await prisma.staffClassAssignment.upsert({
      where: { staffId_classId_subject: { staffId, classId, subject } },
      update: { semester },
      create: { staffId, classId, subject, semester },
      include: { staff: { select: { id: true, name: true, email: true } }, class: { select: { id: true, name: true } } },
    });

    logAudit({
      req, action: AUDIT_ACTIONS.STAFF_CLASS_ASSIGNMENT_CHANGED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
      instituteId: req.requesterInstituteId, details: { change: "assigned", staffId, staffName: staff.name, classId, className: cls.name, subject, semester },
    });

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign staff to class" });
  }
});

router.patch("/admin/staff-assignments/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.staffClassAssignment.findUnique({ where: { id: req.params.id }, include: { class: true } });
    if (!existing) return res.status(404).json({ error: "Assignment not found" });
    if (req.requesterInstituteId && existing.class.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage assignments under your own institute" });
    }
    const nextSubject = req.body.subject?.trim() || existing.subject;
    const nextSemester = req.body.semester?.trim() || existing.semester;
    if (nextSubject !== existing.subject) {
      const dup = await prisma.staffClassAssignment.findFirst({
        where: { staffId: existing.staffId, classId: existing.classId, subject: nextSubject, NOT: { id: existing.id } },
      });
      if (dup) return res.status(409).json({ error: "This staff member already has an assignment for this class and subject" });
    }
    const updated = await prisma.staffClassAssignment.update({
      where: { id: req.params.id },
      data: { subject: nextSubject, semester: nextSemester },
      include: { staff: { select: { id: true, name: true, email: true } }, class: { select: { id: true, name: true } } },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update assignment" });
  }
});

router.delete("/admin/staff-assignments/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await prisma.staffClassAssignment.findUnique({
      where: { id: req.params.id },
      include: { staff: true, class: true },
    });
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (req.requesterInstituteId && assignment.class.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage assignments under your own institute" });
    }
    await prisma.staffClassAssignment.delete({ where: { id: req.params.id } });

    logAudit({
      req, action: AUDIT_ACTIONS.STAFF_CLASS_ASSIGNMENT_CHANGED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
      instituteId: req.requesterInstituteId, details: { change: "unassigned", staffId: assignment.staffId, staffName: assignment.staff.name, classId: assignment.classId, className: assignment.class.name, subject: assignment.subject },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

// ===================== Shared: which staff-class-subject assignments does this requester see =====================

// STAFF: only their own assignments (powers the "Attendance" landing page cards). ADMIN: every
// assignment in their institute scope (so the same card-grid page works for both roles).
router.get("/my-assignments", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const include = {
      staff: { select: { id: true, name: true } },
      class: { include: { institute: { select: { id: true, name: true } }, division: { include: { department: true } } } },
    };
    let assignments;
    if (req.user.role === "STAFF") {
      assignments = await prisma.staffClassAssignment.findMany({
        where: { staffId: req.user.id },
        include,
        orderBy: [{ class: { name: "asc" } }, { subject: "asc" }],
      });
    } else {
      const where = {};
      if (req.requesterInstituteId) where.class = { instituteId: req.requesterInstituteId };
      assignments = await prisma.staffClassAssignment.findMany({ where, include, orderBy: [{ class: { name: "asc" } }, { subject: "asc" }] });
    }
    res.json(assignments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load your assignments" });
  }
});

router.get("/assignments/:assignmentId", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
  if (!assignment) return;
  res.json(assignment);
});

// ===================== Lecture Plans =====================

router.get("/assignments/:assignmentId/plans", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const plans = await prisma.lecturePlan.findMany({
      where: { assignmentId: assignment.id },
      orderBy: [{ scheduleDate: "desc" }, { lectureNumber: "desc" }],
      include: { session: { select: { id: true } } },
    });
    res.json(plans);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load lecture plans" });
  }
});

router.post("/assignments/:assignmentId/plans", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const { data, error } = validatePlanInput(req.body);
    if (error) return res.status(400).json({ error });

    const dup = await prisma.lecturePlan.findUnique({
      where: { assignmentId_lectureNumber: { assignmentId: assignment.id, lectureNumber: data.lectureNumber } },
    });
    if (dup) return res.status(409).json({ error: `Lecture number ${data.lectureNumber} already exists for this subject` });

    const plan = await prisma.lecturePlan.create({ data: { ...data, assignmentId: assignment.id, createdById: req.user.id } });
    res.json(plan);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create lecture plan" });
  }
});

router.get("/assignments/:assignmentId/plans/template", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
  if (!assignment) return;
  const rows = [
    {
      "Lecture Number": 1, Topic: "Introduction to Arrays", "Schedule Date": "2026-07-25", Slot: "Slot 1",
      "Lecture Type": "Regular Class", "Start Time (if Slot is Other)": "", "End Time (if Slot is Other)": "",
    },
  ];
  sendExport(res, { rows, filenameBase: "lecture-plan-template", format: "xlsx" });
});

router.post("/assignments/:assignmentId/plans/bulk-upload", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, upload.single("file"), async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
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

    const existingPlans = await prisma.lecturePlan.findMany({ where: { assignmentId: assignment.id }, select: { lectureNumber: true } });
    const usedNumbers = new Set(existingPlans.map((p) => p.lectureNumber));

    const errors = [];
    const toCreate = [];
    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const lectureNumber = Number(row["Lecture Number"]);
      const topic = String(row["Topic"] || "").trim();
      const scheduleDate = normalizeDate(row["Schedule Date"]);
      const slotRaw = String(row["Slot"] || "").trim();
      const lectureTypeRaw = String(row["Lecture Type"] || "").trim();

      if (!lectureNumber && !topic && !slotRaw && !lectureTypeRaw) continue; // blank row

      if (!lectureNumber || lectureNumber < 1) { errors.push({ row: rowNum, reason: "Missing or invalid Lecture Number" }); continue; }
      if (usedNumbers.has(lectureNumber)) { errors.push({ row: rowNum, reason: `Lecture number ${lectureNumber} already exists` }); continue; }
      if (!topic) { errors.push({ row: rowNum, reason: "Missing Topic" }); continue; }
      if (!scheduleDate) { errors.push({ row: rowNum, reason: "Missing or invalid Schedule Date (use YYYY-MM-DD)" }); continue; }
      if (!SLOT_LABEL_SET.has(slotRaw)) { errors.push({ row: rowNum, reason: `Unrecognized Slot "${slotRaw}"` }); continue; }
      const lectureType = LECTURE_TYPE_ALIASES[normalizeHeader(lectureTypeRaw)];
      if (!lectureType) { errors.push({ row: rowNum, reason: `Unrecognized Lecture Type "${lectureTypeRaw}"` }); continue; }

      let slot;
      if (slotRaw === "Other") {
        const startTime = String(row["Start Time (if Slot is Other)"] || "").trim();
        const endTime = String(row["End Time (if Slot is Other)"] || "").trim();
        if (!startTime || !endTime) { errors.push({ row: rowNum, reason: 'Start Time and End Time are required when Slot is "Other"' }); continue; }
        slot = { slotLabel: "Other", startTime, endTime };
      } else {
        const preset = SLOTS.find((s) => s.label === slotRaw);
        slot = { slotLabel: preset.label, startTime: preset.startTime, endTime: preset.endTime };
      }

      usedNumbers.add(lectureNumber);
      toCreate.push({ assignmentId: assignment.id, createdById: req.user.id, lectureNumber, topic, scheduleDate, lectureType, ...slot });
    }

    let createdCount = 0;
    for (const data of toCreate) {
      try {
        await prisma.lecturePlan.create({ data });
        createdCount++;
      } catch (err) {
        errors.push({ row: "-", reason: `Failed to save lecture ${data.lectureNumber}: ${err.message || "unknown error"}` });
      }
    }

    res.json({ total: rows.length, createdCount, errorCount: errors.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk upload failed" });
  }
});

router.patch("/assignments/:assignmentId/plans/:planId", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const existing = await prisma.lecturePlan.findUnique({ where: { id: req.params.planId } });
    if (!existing || existing.assignmentId !== assignment.id) return res.status(404).json({ error: "Lecture plan not found" });

    const merged = {
      topic: req.body.topic ?? existing.topic,
      scheduleDate: req.body.scheduleDate ?? existing.scheduleDate.toISOString().slice(0, 10),
      lectureNumber: req.body.lectureNumber ?? existing.lectureNumber,
      lectureType: req.body.lectureType ?? existing.lectureType,
      slotLabel: req.body.slotLabel ?? existing.slotLabel,
      startTime: req.body.startTime ?? existing.startTime,
      endTime: req.body.endTime ?? existing.endTime,
    };
    const { data, error } = validatePlanInput(merged);
    if (error) return res.status(400).json({ error });

    if (data.lectureNumber !== existing.lectureNumber) {
      const dup = await prisma.lecturePlan.findUnique({
        where: { assignmentId_lectureNumber: { assignmentId: assignment.id, lectureNumber: data.lectureNumber } },
      });
      if (dup) return res.status(409).json({ error: `Lecture number ${data.lectureNumber} already exists for this subject` });
    }

    const updated = await prisma.lecturePlan.update({ where: { id: existing.id }, data });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update lecture plan" });
  }
});

router.delete("/assignments/:assignmentId/plans/:planId", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const existing = await prisma.lecturePlan.findUnique({ where: { id: req.params.planId } });
    if (!existing || existing.assignmentId !== assignment.id) return res.status(404).json({ error: "Lecture plan not found" });
    await prisma.lecturePlan.delete({ where: { id: existing.id } }); // cascades its AttendanceSession/records, if any
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete lecture plan" });
  }
});

// ===================== Execute / edit attendance for a plan =====================

router.get("/assignments/:assignmentId/plans/:planId/execute", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const plan = await prisma.lecturePlan.findUnique({
      where: { id: req.params.planId },
      include: {
        session: {
          include: {
            records: { select: { studentId: true, status: true } },
            test: { select: { id: true, title: true } },
            markedBy: { select: { name: true } },
            updatedBy: { select: { name: true } },
          },
        },
      },
    });
    if (!plan || plan.assignmentId !== assignment.id) return res.status(404).json({ error: "Lecture plan not found" });

    const now = new Date();
    const [roster, eligibleTests] = await Promise.all([
      prisma.user.findMany({
        where: { classId: assignment.classId, role: "STUDENT" },
        select: { id: true, name: true, rollNumber: true },
        orderBy: { name: "asc" },
      }),
      plan.lectureType === "REGULAR"
        ? Promise.resolve([])
        : prisma.test.findMany({
            where: {
              isPublished: true,
              attendanceMandatory: true,
              startTime: { lte: now },
              endTime: { gte: now },
              OR: [{ classes: { none: {} } }, { classes: { some: { classId: assignment.classId } } }],
            },
            select: { id: true, title: true },
            orderBy: { title: "asc" },
          }),
    ]);

    res.json({ plan, roster, eligibleTests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load attendance execution context" });
  }
});

router.post("/assignments/:assignmentId/plans/:planId/attendance", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const assignment = await resolveAssignmentAccess(req, res, req.params.assignmentId);
    if (!assignment) return;
    const plan = await prisma.lecturePlan.findUnique({ where: { id: req.params.planId } });
    if (!plan || plan.assignmentId !== assignment.id) return res.status(404).json({ error: "Lecture plan not found" });

    const records = Array.isArray(req.body.records) ? req.body.records : [];

    // Practice Test / Exam lectures must be linked to a real, currently-eligible test — re-derived
    // server-side (never trusts the client's already-filtered dropdown) so a stale/expired/
    // non-mandatory test id can't be slipped through.
    let testId = null;
    if (plan.lectureType !== "REGULAR") {
      const now = new Date();
      const eligible = await prisma.test.findMany({
        where: {
          isPublished: true,
          attendanceMandatory: true,
          startTime: { lte: now },
          endTime: { gte: now },
          OR: [{ classes: { none: {} } }, { classes: { some: { classId: assignment.classId } } }],
        },
        select: { id: true },
      });
      if (!req.body.testId || !eligible.some((t) => t.id === req.body.testId)) {
        return res.status(400).json({ error: "A currently-active, attendance-mandatory test must be selected for this lecture" });
      }
      testId = req.body.testId;
    }

    // Only accept records for students who actually belong to this class — defensive against a
    // stale roster on the client (a student transferred out between load and save) rather than
    // failing the whole save over it.
    const roster = await prisma.user.findMany({ where: { classId: assignment.classId, role: "STUDENT" }, select: { id: true } });
    const rosterIds = new Set(roster.map((s) => s.id));
    const cleanRecords = records
      .filter((r) => r && rosterIds.has(r.studentId))
      .map((r) => ({ studentId: r.studentId, status: r.status === "ABSENT" ? "ABSENT" : "PRESENT" }));

    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceSession.findUnique({ where: { planId: plan.id } });
      const saved = existing
        ? await tx.attendanceSession.update({ where: { id: existing.id }, data: { testId, updatedById: req.user.id } })
        : await tx.attendanceSession.create({ data: { planId: plan.id, testId, markedById: req.user.id } });
      // Full replace on every save — simplest correct way to handle edits (added/removed
      // students, changed statuses) without reconciling a partial diff.
      await tx.attendanceRecord.deleteMany({ where: { sessionId: saved.id } });
      if (cleanRecords.length > 0) {
        await tx.attendanceRecord.createMany({
          data: cleanRecords.map((r) => ({ sessionId: saved.id, studentId: r.studentId, status: r.status })),
        });
      }
      return saved;
    });

    logAudit({
      req, action: AUDIT_ACTIONS.ATTENDANCE_MARKED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
      instituteId: req.requesterInstituteId,
      details: {
        classId: assignment.classId, subject: assignment.subject, lectureNumber: plan.lectureNumber,
        presentCount: cleanRecords.filter((r) => r.status === "PRESENT").length,
        absentCount: cleanRecords.filter((r) => r.status === "ABSENT").length,
      },
    });

    const full = await prisma.attendanceSession.findUnique({
      where: { id: session.id },
      include: {
        records: { select: { studentId: true, status: true } },
        test: { select: { id: true, title: true } },
        markedBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    });
    res.json(full);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save attendance" });
  }
});

// ===================== Reports (+ CSV/XLSX export) =====================

router.get("/reports", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const {
      date, dateFrom, dateTo, academicYear, departmentId, divisionId, classId,
      subject, semester, facultyId, lectureType, status, studentId,
    } = req.query;

    // Resolve the STAFF scope (their own assignment IDs) separately from any narrowing filter the
    // caller asked for, then reconcile the two explicitly below — building both into the same
    // `assignmentWhere.id` key one after another would let a later assignment silently clobber the
    // earlier one, exactly the shape of bug that already bit this module once.
    const assignmentWhere = {};
    let staffAssignedIds = null;
    if (req.user.role === "STAFF") {
      const own = await prisma.staffClassAssignment.findMany({ where: { staffId: req.user.id }, select: { id: true } });
      staffAssignedIds = own.map((a) => a.id);
    } else if (req.requesterInstituteId) {
      assignmentWhere.class = { instituteId: req.requesterInstituteId };
    }

    if (facultyId) {
      if (staffAssignedIds) {
        // A STAFF user has no legitimate reason to filter by a different faculty's id — their own
        // scope already is exactly one faculty.
        if (facultyId !== req.user.id) return res.status(403).json({ error: "You can only view your own attendance records" });
      } else {
        assignmentWhere.staffId = facultyId;
      }
    }
    if (subject) assignmentWhere.subject = subject;
    if (semester) assignmentWhere.semester = semester;
    if (classId || divisionId || departmentId || academicYear) {
      assignmentWhere.class = { ...(assignmentWhere.class || {}) };
      if (classId) assignmentWhere.class.id = classId;
      if (divisionId) assignmentWhere.class.divisionId = divisionId;
      if (departmentId) assignmentWhere.class.division = { departmentId };
      if (academicYear) assignmentWhere.class.batchYear = academicYear;
    }

    if (staffAssignedIds) {
      assignmentWhere.id = { in: staffAssignedIds };
    }

    const planWhere = { assignment: assignmentWhere };
    if (date) {
      const d = normalizeDate(date);
      if (d) planWhere.scheduleDate = d;
    } else if (dateFrom || dateTo) {
      planWhere.scheduleDate = {};
      if (dateFrom) planWhere.scheduleDate.gte = normalizeDate(dateFrom);
      if (dateTo) planWhere.scheduleDate.lte = normalizeDate(dateTo);
    }
    if (lectureType && LECTURE_TYPES.includes(lectureType)) planWhere.lectureType = lectureType;

    const recordWhere = { session: { plan: planWhere } };
    if (studentId) recordWhere.studentId = studentId;
    if (status && ["PRESENT", "ABSENT"].includes(status)) recordWhere.status = status;

    const records = await prisma.attendanceRecord.findMany({
      where: recordWhere,
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
        session: {
          include: {
            test: { select: { title: true } },
            plan: {
              include: {
                assignment: {
                  include: { staff: { select: { name: true } }, class: { include: { division: { include: { department: true } } } } },
                },
              },
            },
          },
        },
      },
      orderBy: [{ session: { plan: { scheduleDate: "desc" } } }, { session: { plan: { lectureNumber: "asc" } } }],
      take: 10000, // hard ceiling — export/report views, not a paginated feed
    });

    const rows = records.map((r) => {
      const plan = r.session.plan;
      const assignment = plan.assignment;
      return {
        Date: plan.scheduleDate.toISOString().slice(0, 10),
        "Academic Year": assignment.class.batchYear || "",
        Department: assignment.class.division?.department?.name || "",
        Division: assignment.class.division?.name || "",
        Class: assignment.class.name,
        Subject: assignment.subject,
        Semester: assignment.semester,
        Faculty: assignment.staff.name,
        "Lecture #": plan.lectureNumber,
        "Lecture Type": LECTURE_TYPE_LABELS[plan.lectureType] || plan.lectureType,
        Test: r.session.test?.title || "",
        "Roll Number": r.student.rollNumber || "",
        "Student Name": r.student.name,
        Status: r.status,
      };
    });

    if (req.query.format) {
      logAudit({
        req, action: AUDIT_ACTIONS.DATA_EXPORTED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
        instituteId: req.requesterInstituteId, details: { entity: "attendance", format: req.query.format, rowCount: rows.length },
      });
      return sendExport(res, { rows, filenameBase: `attendance-report-${new Date().toISOString().slice(0, 10)}`, format: req.query.format });
    }

    res.json({ rows, total: rows.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load attendance report" });
  }
});

module.exports = router;

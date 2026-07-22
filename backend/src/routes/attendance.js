const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { logAudit, AUDIT_ACTIONS } = require("../utils/auditLog");
const { sendExport } = require("../utils/exportFile");

const router = express.Router();

const LECTURE_TYPES = ["REGULAR", "PRACTICE_TEST", "EXAM"];

// "YYYY-MM-DD" -> Date at UTC midnight, so the same calendar date always compares equal
// regardless of the caller's local timezone offset. Returns null for anything unparseable.
function normalizeDate(input) {
  if (!input) return null;
  const match = String(input).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;
  const d = new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Central access gate for every class-scoped attendance route. ADMIN: institute-scoped (same
// convention as attachRequesterInstitute everywhere else on this platform) — a platform-level
// admin (no instituteId) sees every institute's classes. STAFF: must have an explicit
// StaffClassAssignment row for this exact class — this is the enforcement point for "staff must
// not be able to access attendance for unassigned classes." Returns the Class (with
// division/department/institute joined) on success, or null after already sending the
// appropriate 403/404 itself.
async function resolveClassAccess(req, res, classId) {
  const cls = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      institute: { select: { id: true, name: true } },
      division: { include: { department: true } },
    },
  });
  if (!cls) {
    res.status(404).json({ error: "Class not found" });
    return null;
  }
  if (req.user.role === "STAFF") {
    const assignment = await prisma.staffClassAssignment.findUnique({
      where: { staffId_classId: { staffId: req.user.id, classId } },
    });
    if (!assignment) {
      res.status(403).json({ error: "You are not assigned to this class" });
      return null;
    }
    return cls;
  }
  // ADMIN
  if (req.requesterInstituteId && cls.instituteId !== req.requesterInstituteId) {
    res.status(403).json({ error: "You can only manage attendance under your own institute" });
    return null;
  }
  return cls;
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

// ===================== Admin: Staff ↔ Class assignments =====================

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
    if (!staffId || !classId) return res.status(400).json({ error: "Both a staff member and a class are required" });

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
      where: { staffId_classId: { staffId, classId } },
      update: {},
      create: { staffId, classId },
      include: { staff: { select: { id: true, name: true, email: true } }, class: { select: { id: true, name: true } } },
    });

    logAudit({
      req, action: AUDIT_ACTIONS.STAFF_CLASS_ASSIGNMENT_CHANGED, actorId: req.user.id, actorName: req.user.name, actorRole: req.user.role,
      instituteId: req.requesterInstituteId, details: { change: "assigned", staffId, staffName: staff.name, classId, className: cls.name },
    });

    res.json(assignment);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to assign staff to class" });
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
      instituteId: req.requesterInstituteId, details: { change: "unassigned", staffId: assignment.staffId, staffName: assignment.staff.name, classId: assignment.classId, className: assignment.class.name },
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove assignment" });
  }
});

// ===================== Shared: which classes can this requester take attendance for =====================

// STAFF: only classes they've been explicitly assigned. ADMIN: every attendance-eligible class
// (has a division set) in their institute scope. Powers the Department/Division/Class dropdown
// chain on the marking form — staff never sees a department or division they aren't assigned
// into, since it's derived entirely from their own assigned classes' relations, not a separate
// "list all departments" call.
router.get("/my-classes", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const include = {
      institute: { select: { id: true, name: true } },
      division: { include: { department: true } },
    };
    let classes;
    if (req.user.role === "STAFF") {
      const assignments = await prisma.staffClassAssignment.findMany({
        where: { staffId: req.user.id },
        include: { class: { include } },
      });
      classes = assignments.map((a) => a.class);
    } else {
      const where = { divisionId: { not: null } };
      if (req.requesterInstituteId) where.instituteId = req.requesterInstituteId;
      classes = await prisma.class.findMany({ where, include, orderBy: [{ name: "asc" }, { batchYear: "asc" }] });
    }
    res.json(classes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load your classes" });
  }
});

// ===================== Shared: marking-form context (roster, suggested lecture #, active tests) =====================

router.get("/classes/:classId/context", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await resolveClassAccess(req, res, req.params.classId);
    if (!cls) return;

    const now = new Date();
    const [roster, sessionCount, activeTests] = await Promise.all([
      prisma.user.findMany({
        where: { classId: cls.id, role: "STUDENT" },
        select: { id: true, name: true, rollNumber: true },
        orderBy: { name: "asc" },
      }),
      prisma.attendanceSession.count({ where: { classId: cls.id } }),
      prisma.test.findMany({
        where: {
          isPublished: true,
          startTime: { lte: now },
          endTime: { gte: now },
          OR: [{ classes: { none: {} } }, { classes: { some: { classId: cls.id } } }],
        },
        select: { id: true, title: true },
        orderBy: { title: "asc" },
      }),
    ]);

    res.json({ class: cls, roster, suggestedLectureNumber: sessionCount + 1, activeTests });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load attendance context" });
  }
});

// ===================== Shared: retrieve an existing session (for the edit flow) =====================

router.get("/classes/:classId/session", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await resolveClassAccess(req, res, req.params.classId);
    if (!cls) return;

    const date = normalizeDate(req.query.date);
    const lectureNumber = Number(req.query.lectureNumber);
    if (!date || !lectureNumber) return res.status(400).json({ error: "A date and lecture number are required" });

    const session = await prisma.attendanceSession.findUnique({
      where: { classId_date_lectureNumber: { classId: cls.id, date, lectureNumber } },
      include: { records: { select: { studentId: true, status: true } }, test: { select: { id: true, title: true } } },
    });
    res.json({ session: session || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to look up attendance session" });
  }
});

// ===================== Shared: mark or edit attendance (upsert) =====================

router.post("/classes/:classId/session", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await resolveClassAccess(req, res, req.params.classId);
    if (!cls) return;

    const date = normalizeDate(req.body.date);
    const lectureNumber = Number(req.body.lectureNumber);
    const lectureType = LECTURE_TYPES.includes(req.body.lectureType) ? req.body.lectureType : "REGULAR";
    const semester = req.body.semester ? String(req.body.semester).trim() || null : null;
    const records = Array.isArray(req.body.records) ? req.body.records : [];

    if (!date) return res.status(400).json({ error: "A valid date is required" });
    if (!lectureNumber || lectureNumber < 1) return res.status(400).json({ error: "A valid lecture number is required" });

    let testId = null;
    if (lectureType === "EXAM") {
      if (!req.body.testId) return res.status(400).json({ error: "An active test must be selected for an Exam lecture" });
      const test = await prisma.test.findUnique({ where: { id: req.body.testId } });
      if (!test) return res.status(404).json({ error: "Selected test not found" });
      testId = test.id;
    }

    // Only accept records for students who actually belong to this class — defensive against a
    // stale roster on the client (a student transferred out between load and save) rather than
    // failing the whole save over it.
    const roster = await prisma.user.findMany({ where: { classId: cls.id, role: "STUDENT" }, select: { id: true } });
    const rosterIds = new Set(roster.map((s) => s.id));
    const cleanRecords = records
      .filter((r) => r && rosterIds.has(r.studentId))
      .map((r) => ({ studentId: r.studentId, status: r.status === "ABSENT" ? "ABSENT" : "PRESENT" }));

    const session = await prisma.$transaction(async (tx) => {
      const existing = await tx.attendanceSession.findUnique({
        where: { classId_date_lectureNumber: { classId: cls.id, date, lectureNumber } },
      });
      const saved = existing
        ? await tx.attendanceSession.update({
            where: { id: existing.id },
            data: { lectureType, testId, semester, markedById: req.user.id },
          })
        : await tx.attendanceSession.create({
            data: { classId: cls.id, date, lectureNumber, lectureType, testId, semester, markedById: req.user.id },
          });
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

    const full = await prisma.attendanceSession.findUnique({
      where: { id: session.id },
      include: { records: { select: { studentId: true, status: true } }, test: { select: { id: true, title: true } } },
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
    const { date, dateFrom, dateTo, departmentId, divisionId, classId, lectureType, testId, studentId } = req.query;

    // Resolve the STAFF scope (their assigned class IDs) separately from any classId the caller
    // asked to narrow by, then reconcile the two explicitly below — building both into the same
    // `classWhere.id` key one after another would let a later assignment silently clobber the
    // earlier one, which is exactly the shape of bug that would let a staff member request a
    // class they aren't assigned to just by passing its ID.
    const classWhere = {};
    let staffAssignedClassIds = null;
    if (req.user.role === "STAFF") {
      const assignments = await prisma.staffClassAssignment.findMany({ where: { staffId: req.user.id }, select: { classId: true } });
      staffAssignedClassIds = assignments.map((a) => a.classId);
    } else if (req.requesterInstituteId) {
      classWhere.instituteId = req.requesterInstituteId;
    }

    if (classId) {
      if (staffAssignedClassIds && !staffAssignedClassIds.includes(classId)) {
        return res.status(403).json({ error: "You are not assigned to this class" });
      }
      classWhere.id = classId;
    } else if (staffAssignedClassIds) {
      classWhere.id = { in: staffAssignedClassIds };
    }
    if (divisionId) classWhere.divisionId = divisionId;
    if (departmentId) classWhere.division = { departmentId };

    const sessionWhere = { class: classWhere };
    if (date) {
      const d = normalizeDate(date);
      if (d) sessionWhere.date = d;
    } else if (dateFrom || dateTo) {
      sessionWhere.date = {};
      if (dateFrom) sessionWhere.date.gte = normalizeDate(dateFrom);
      if (dateTo) sessionWhere.date.lte = normalizeDate(dateTo);
    }
    if (lectureType && LECTURE_TYPES.includes(lectureType)) sessionWhere.lectureType = lectureType;
    if (testId) sessionWhere.testId = testId;

    const recordWhere = { session: sessionWhere };
    if (studentId) recordWhere.studentId = studentId;

    const records = await prisma.attendanceRecord.findMany({
      where: recordWhere,
      include: {
        student: { select: { id: true, name: true, rollNumber: true } },
        session: {
          include: {
            class: { include: { division: { include: { department: true } } } },
            test: { select: { title: true } },
          },
        },
      },
      orderBy: [{ session: { date: "desc" } }, { session: { lectureNumber: "asc" } }],
      take: 10000, // hard ceiling — export/report views, not a paginated feed
    });

    const rows = records.map((r) => ({
      Date: r.session.date.toISOString().slice(0, 10),
      Department: r.session.class.division?.department?.name || "",
      Division: r.session.class.division?.name || "",
      Class: r.session.class.name,
      Semester: r.session.semester || "",
      "Lecture #": r.session.lectureNumber,
      "Lecture Type": r.session.lectureType,
      Test: r.session.test?.title || "",
      "Roll Number": r.student.rollNumber || "",
      "Student Name": r.student.name,
      Status: r.status,
    }));

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

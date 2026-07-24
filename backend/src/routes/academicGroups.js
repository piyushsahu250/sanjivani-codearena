const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { generateTempPassword, recordPasswordChange } = require("../utils/password");
const { cached } = require("../utils/cache");

const router = express.Router();

// Read-only by design: academic groups (Institute -> Batch -> Department -> Section) are
// auto-derived from registered students (Bulk Upload/Registration, or the one-time migration) —
// there is no manual create/edit/delete here, mirroring the Attendance module's already-validated
// "no standalone entity" principle. Typo'd Department/Section names get corrected via the
// per-student edit form (PATCH /users/:id), which re-resolves the group.
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.requesterInstituteId) where.instituteId = req.requesterInstituteId;
  else if (req.query.instituteId) where.instituteId = req.query.instituteId;
  const cacheKey = `academic-groups:list:${req.requesterInstituteId || req.query.instituteId || "all"}`;
  const groups = await cached(cacheKey, 2 * 60 * 1000, () =>
    prisma.academicGroup.findMany({
      where,
      orderBy: [{ batch: "desc" }, { department: { name: "asc" } }, { section: "asc" }],
      include: {
        institute: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        _count: { select: { users: true } },
      },
    })
  );
  res.json(groups);
});

// ADMIN/STAFF: full student roster for one academic group (roll number, name, email, mobile).
router.get("/:id/students", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const group = await prisma.academicGroup.findUnique({
      where: { id: req.params.id },
      include: { institute: { select: { id: true, name: true } }, department: { select: { id: true, name: true } } },
    });
    if (!group) return res.status(404).json({ error: "Academic group not found" });
    if (req.requesterInstituteId && group.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only view groups under your own institute" });
    }

    const students = await prisma.user.findMany({
      where: { academicGroupId: req.params.id, role: "STUDENT" },
      select: { id: true, name: true, email: true, rollNumber: true, mobile: true },
      orderBy: { name: "asc" },
    });
    res.json({ group, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load group roster" });
  }
});

// ADMIN: reset every student in a group to their own new, unique random temporary password — NOT
// the same password for the whole group (a shared reset password would be exactly the kind of
// reused-across-many-accounts secret that gets a group collectively compromised if any one
// student's password leaks). Each account is flagged to force a password change on next login.
// Individual per-row updates (not a single updateMany) since each student needs a distinct hash.
router.post("/:id/bulk-reset-password", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const group = await prisma.academicGroup.findUnique({ where: { id: req.params.id } });
    if (!group) return res.status(404).json({ error: "Academic group not found" });
    if (req.requesterInstituteId && group.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage groups under your own institute" });
    }

    const students = await prisma.user.findMany({
      where: { academicGroupId: req.params.id, role: "STUDENT" },
      select: { id: true, name: true, email: true, rollNumber: true },
    });

    const reset = [];
    for (const student of students) {
      const newPassword = generateTempPassword();
      const passwordHash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id: student.id }, data: { passwordHash, mustChangePassword: true } });
      await recordPasswordChange(prisma, student.id, passwordHash, null);
      reset.push({ id: student.id, name: student.name, email: student.email, rollNumber: student.rollNumber, newPassword });
    }

    res.json({ resetCount: reset.length, students: reset });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk-reset passwords" });
  }
});

module.exports = router;

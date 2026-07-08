const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const DEFAULT_RESET_PASSWORD = "Sanjivani@1";

// Fetches the requester's own instituteId so ADMIN/STAFF accounts tied to a specific
// institute only ever see/manage classes under it. Accounts with no instituteId (e.g. the
// seeded "Platform Admin") are platform-level and stay unscoped, seeing every institute.
async function attachRequesterInstitute(req, res, next) {
  try {
    const requester = await prisma.user.findUnique({ where: { id: req.user.id }, select: { instituteId: true } });
    req.requesterInstituteId = requester?.instituteId || null;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to verify institute scope" });
  }
}

// ADMIN/STAFF: list classes/programs, with a student headcount per class. Institute-scoped
// accounts always see only their own institute; platform-level accounts (no instituteId)
// may optionally filter via ?instituteId=.
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.requesterInstituteId) {
    where.instituteId = req.requesterInstituteId;
  } else if (req.query.instituteId) {
    where.instituteId = req.query.instituteId;
  }
  const classes = await prisma.class.findMany({
    where,
    orderBy: [{ name: "asc" }, { batchYear: "asc" }],
    include: {
      institute: { select: { id: true, name: true } },
      _count: { select: { users: true } },
    },
  });
  res.json(classes);
});

// ADMIN: add a class/program + batch year under an institute. Institute-scoped admins can
// only add classes under their own institute (their instituteId wins over anything in the
// body). A class is uniquely identified by institute + name + batch year, so the same
// program name can recur across batches (e.g. MCA 2025, MCA 2026).
router.post("/", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { name, code, batchYear } = req.body;
    if (req.requesterInstituteId && req.body.instituteId && req.body.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only add classes under your own institute" });
    }
    const instituteId = req.requesterInstituteId || req.body.instituteId;
    if (!name || !name.trim()) return res.status(400).json({ error: "Class name is required" });
    if (!batchYear || !String(batchYear).trim()) return res.status(400).json({ error: "Batch year is required" });
    if (!instituteId) return res.status(400).json({ error: "An institute is required" });

    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) return res.status(404).json({ error: "Institute not found" });

    const existing = await prisma.class.findFirst({
      where: { instituteId, name: name.trim(), batchYear: String(batchYear).trim() },
    });
    if (existing) return res.status(409).json({ error: "This class already exists for this institute and batch year" });

    const cls = await prisma.class.create({
      data: { name: name.trim(), code: code?.trim() || null, batchYear: String(batchYear).trim(), instituteId },
      include: { institute: { select: { id: true, name: true } }, _count: { select: { users: true } } },
    });
    res.json(cls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create class" });
  }
});

// ADMIN: edit name/code/batchYear/institute, or toggle active/inactive. Institute-scoped
// admins can only touch classes already under their own institute, and can't move a class
// elsewhere.
router.patch("/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && existing.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage classes under your own institute" });
    }

    const { name, code, isActive, instituteId, batchYear } = req.body;
    if (req.requesterInstituteId && instituteId && instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only assign classes to your own institute" });
    }
    if (batchYear !== undefined && !String(batchYear).trim()) {
      return res.status(400).json({ error: "Batch year is required" });
    }

    const nextInstituteId = instituteId ?? existing.instituteId;
    const nextName = name?.trim() ?? existing.name;
    const nextBatchYear = batchYear !== undefined ? String(batchYear).trim() : existing.batchYear;
    if (
      (name && name.trim() !== existing.name) ||
      (instituteId && instituteId !== existing.instituteId) ||
      (batchYear !== undefined && String(batchYear).trim() !== existing.batchYear)
    ) {
      const dup = await prisma.class.findFirst({
        where: { instituteId: nextInstituteId, name: nextName, batchYear: nextBatchYear, NOT: { id: existing.id } },
      });
      if (dup) return res.status(409).json({ error: "This class already exists for this institute and batch year" });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name: nextName,
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        batchYear: nextBatchYear,
        isActive: isActive ?? existing.isActive,
        instituteId: nextInstituteId,
      },
      include: { institute: { select: { id: true, name: true } }, _count: { select: { users: true } } },
    });
    res.json(cls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update class" });
  }
});

// ADMIN: delete a class. Institute-scoped admins can only delete classes under their own institute.
router.delete("/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && existing.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage classes under your own institute" });
    }

    await prisma.class.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2003" || err.code === "P2014") {
      return res.status(409).json({ error: "This class has students or tests linked to it and can't be deleted." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

// ADMIN/STAFF: full student roster for one class (roll number, name, email, mobile).
router.get("/:id/students", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id }, include: { institute: { select: { id: true, name: true } } } });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && cls.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only view classes under your own institute" });
    }

    const students = await prisma.user.findMany({
      where: { classId: req.params.id, role: "STUDENT" },
      select: { id: true, name: true, email: true, rollNumber: true, mobile: true },
      orderBy: { name: "asc" },
    });
    res.json({ class: cls, students });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load class roster" });
  }
});

// ADMIN: reset every student in a class back to the default password. Each account is
// flagged to force a password change on next login, same as any other reset.
router.post("/:id/bulk-reset-password", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const cls = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!cls) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && cls.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage classes under your own institute" });
    }

    const passwordHash = await bcrypt.hash(DEFAULT_RESET_PASSWORD, 10);
    const result = await prisma.user.updateMany({
      where: { classId: req.params.id, role: "STUDENT" },
      data: { passwordHash, mustChangePassword: true },
    });
    res.json({ resetCount: result.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to bulk-reset passwords" });
  }
});

module.exports = router;

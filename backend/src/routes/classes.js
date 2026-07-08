const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

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

// ADMIN/STAFF: list classes/programs. Institute-scoped accounts always see only their own
// institute; platform-level accounts (no instituteId) may optionally filter via ?instituteId=.
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const where = {};
  if (req.requesterInstituteId) {
    where.instituteId = req.requesterInstituteId;
  } else if (req.query.instituteId) {
    where.instituteId = req.query.instituteId;
  }
  const classes = await prisma.class.findMany({
    where,
    orderBy: { name: "asc" },
    include: { institute: { select: { id: true, name: true } } },
  });
  res.json(classes);
});

// ADMIN: add a class/program under an institute. Institute-scoped admins can only add
// classes under their own institute (their instituteId wins over anything in the body).
router.post("/", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { name, code } = req.body;
    if (req.requesterInstituteId && req.body.instituteId && req.body.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only add classes under your own institute" });
    }
    const instituteId = req.requesterInstituteId || req.body.instituteId;
    if (!name || !name.trim()) return res.status(400).json({ error: "Class name is required" });
    if (!instituteId) return res.status(400).json({ error: "An institute is required" });

    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    if (!institute) return res.status(404).json({ error: "Institute not found" });

    const existing = await prisma.class.findFirst({ where: { instituteId, name: name.trim() } });
    if (existing) return res.status(409).json({ error: "A class with this name already exists under this institute" });

    const cls = await prisma.class.create({
      data: { name: name.trim(), code: code?.trim() || null, instituteId },
      include: { institute: { select: { id: true, name: true } } },
    });
    res.json(cls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create class" });
  }
});

// ADMIN: edit name/code/institute, or toggle active/inactive. Institute-scoped admins can
// only touch classes already under their own institute, and can't move a class elsewhere.
router.patch("/:id", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Class not found" });
    if (req.requesterInstituteId && existing.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage classes under your own institute" });
    }

    const { name, code, isActive, instituteId } = req.body;
    if (req.requesterInstituteId && instituteId && instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only assign classes to your own institute" });
    }

    const nextInstituteId = instituteId ?? existing.instituteId;
    const nextName = name?.trim() ?? existing.name;
    if ((name && name.trim() !== existing.name) || (instituteId && instituteId !== existing.instituteId)) {
      const dup = await prisma.class.findFirst({ where: { instituteId: nextInstituteId, name: nextName, NOT: { id: existing.id } } });
      if (dup) return res.status(409).json({ error: "A class with this name already exists under this institute" });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name: nextName,
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        isActive: isActive ?? existing.isActive,
        instituteId: nextInstituteId,
      },
      include: { institute: { select: { id: true, name: true } } },
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
      return res.status(409).json({ error: "This class has users or tests linked to it and can't be deleted." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

module.exports = router;

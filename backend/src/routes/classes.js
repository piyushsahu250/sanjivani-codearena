const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ADMIN/STAFF: list classes/programs — optionally scoped to one institute
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const where = {};
  if (req.query.instituteId) where.instituteId = req.query.instituteId;
  const classes = await prisma.class.findMany({
    where,
    orderBy: { name: "asc" },
    include: { institute: { select: { id: true, name: true } } },
  });
  res.json(classes);
});

// ADMIN: add a class/program under an institute
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, code, instituteId } = req.body;
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

// ADMIN: edit name/code/institute, or toggle active/inactive
router.patch("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Class not found" });

    const { name, code, isActive, instituteId } = req.body;
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

// ADMIN: delete a class
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
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

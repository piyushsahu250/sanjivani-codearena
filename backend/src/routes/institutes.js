const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();

// ADMIN/STAFF: list all institutes
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const institutes = await prisma.institute.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { classes: true, users: true } } },
  });
  res.json(institutes);
});

// ADMIN: create an institute
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, code, address, contact } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Institute name is required" });

    const existing = await prisma.institute.findUnique({ where: { name: name.trim() } });
    if (existing) return res.status(409).json({ error: "An institute with this name already exists" });

    const institute = await prisma.institute.create({
      data: { name: name.trim(), code: code?.trim() || null, address: address?.trim() || null, contact: contact?.trim() || null },
    });
    res.json(institute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create institute" });
  }
});

// ADMIN: edit details, or toggle active/inactive
router.patch("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.institute.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Institute not found" });

    const { name, code, address, contact, isActive } = req.body;
    if (name && name.trim() !== existing.name) {
      const dup = await prisma.institute.findUnique({ where: { name: name.trim() } });
      if (dup) return res.status(409).json({ error: "An institute with this name already exists" });
    }

    const institute = await prisma.institute.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        address: address !== undefined ? (address?.trim() || null) : existing.address,
        contact: contact !== undefined ? (contact?.trim() || null) : existing.contact,
        isActive: isActive ?? existing.isActive,
      },
    });
    res.json(institute);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update institute" });
  }
});

// ADMIN: delete an institute — only if no dependent classes or users exist
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const [classCount, userCount] = await Promise.all([
      prisma.class.count({ where: { instituteId: req.params.id } }),
      prisma.user.count({ where: { instituteId: req.params.id } }),
    ]);
    if (classCount > 0 || userCount > 0) {
      return res.status(409).json({ error: "This institute has classes or users linked to it and can't be deleted. Remove or reassign them first." });
    }
    await prisma.institute.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete institute" });
  }
});

module.exports = router;

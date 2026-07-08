const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// ADMIN/STAFF: list all classes/programs
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const classes = await prisma.class.findMany({ orderBy: { name: "asc" } });
  res.json(classes);
});

// ADMIN: add a class/program
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, code } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: "Class name is required" });

    const existing = await prisma.class.findUnique({ where: { name: name.trim() } });
    if (existing) return res.status(409).json({ error: "A class with this name already exists" });

    const cls = await prisma.class.create({ data: { name: name.trim(), code: code?.trim() || null } });
    res.json(cls);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create class" });
  }
});

// ADMIN: edit name/code, or toggle active/inactive
router.patch("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const existing = await prisma.class.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Class not found" });

    const { name, code, isActive } = req.body;
    if (name && name.trim() !== existing.name) {
      const dup = await prisma.class.findUnique({ where: { name: name.trim() } });
      if (dup) return res.status(409).json({ error: "A class with this name already exists" });
    }

    const cls = await prisma.class.update({
      where: { id: req.params.id },
      data: {
        name: name?.trim() ?? existing.name,
        code: code !== undefined ? (code?.trim() || null) : existing.code,
        isActive: isActive ?? existing.isActive,
      },
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
    console.error(err);
    res.status(500).json({ error: "Failed to delete class" });
  }
});

module.exports = router;

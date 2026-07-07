const express = require("express");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const SELECT_FIELDS = { id: true, name: true, email: true, role: true, rollNumber: true, department: true, createdAt: true };

// ADMIN: list all users
router.get("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  const users = await prisma.user.findMany({ select: SELECT_FIELDS, orderBy: { createdAt: "desc" } });
  res.json(users);
});

// ADMIN: create a Staff, Admin, or Student account directly (no self-registration needed)
router.post("/", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { name, email, password, role, rollNumber, department } = req.body;
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
      data: { name, email, passwordHash, role, rollNumber, department },
      select: SELECT_FIELDS,
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create user" });
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

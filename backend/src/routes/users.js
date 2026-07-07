const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

const SELECT_FIELDS = { id: true, name: true, email: true, role: true, rollNumber: true, department: true, createdAt: true };

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

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const { sendMail } = require("../utils/mailer");

const router = express.Router();
const prisma = new PrismaClient();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://sanjivani-codearena.vercel.app";
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

// Register — role defaults to STUDENT; STAFF/ADMIN accounts are created by an existing admin (see POST /api/users)
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, rollNumber, department } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: "name, email, and password are required" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, rollNumber, department, role: "STUDENT" },
    });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Registration failed" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: "Email not found." });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: "Incorrect password." });

    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: "12h" }
    );

    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Login failed" });
  }
});

// Request a password reset — always responds the same way whether or not the
// email exists, so this endpoint itself doesn't leak account existence (the
// login endpoint already does, per product requirement, but no need to widen
// that surface here too).
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: hashToken(token), resetTokenExpiry: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
      });

      const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;
      await sendMail({
        to: user.email,
        subject: "Reset your Sanjivani CodeArena password",
        html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetLink}">${resetLink}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
      });
    }

    res.json({ message: "If that email is registered, a reset link has been sent." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process request" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ error: "token and newPassword are required" });
    if (newPassword.length < 6) return res.status(400).json({ error: "Password must be at least 6 characters" });

    const user = await prisma.user.findFirst({ where: { resetTokenHash: hashToken(token) } });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({ error: "This reset link is invalid or has expired" });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, resetTokenHash: null, resetTokenExpiry: null },
    });

    res.json({ message: "Password updated. You can now sign in." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reset password" });
  }
});

module.exports = router;

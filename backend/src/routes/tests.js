const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// --- ADMIN/FACULTY: create a test ---
router.post("/", authenticate, requireRole("ADMIN", "FACULTY"), async (req, res) => {
  try {
    const { title, description, durationMin, startTime, endTime, questionIds } = req.body;
    const test = await prisma.test.create({
      data: {
        title,
        description,
        durationMin: durationMin || 60,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdById: req.user.id,
        questions: {
          create: (questionIds || []).map((qId, idx) => ({ questionId: qId, order: idx })),
        },
      },
      include: { questions: true },
    });
    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create test" });
  }
});

// --- ADMIN/FACULTY: publish/unpublish ---
router.patch("/:id/publish", authenticate, requireRole("ADMIN", "FACULTY"), async (req, res) => {
  const test = await prisma.test.update({
    where: { id: req.params.id },
    data: { isPublished: !!req.body.isPublished },
  });
  res.json(test);
});

// --- Everyone authenticated: list tests (students see only published, active/upcoming) ---
router.get("/", authenticate, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "FACULTY";
  const tests = await prisma.test.findMany({
    where: isStaff ? {} : { isPublished: true },
    orderBy: { startTime: "asc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });
  res.json(tests);
});

// --- Get single test detail (questions without hidden test cases for students) ---
router.get("/:id", authenticate, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "FACULTY";
  const test = await prisma.test.findUnique({
    where: { id: req.params.id },
    include: {
      questions: {
        include: {
          question: {
            include: { testCases: isStaff ? true : { where: { isHidden: false } } },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

// --- STUDENT: start/attend a test attempt ---
router.post("/:id/start", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || !test.isPublished) return res.status(404).json({ error: "Test not available" });

    const now = new Date();
    if (now < test.startTime) return res.status(403).json({ error: "Test has not started yet" });
    if (now > test.endTime) return res.status(403).json({ error: "Test window has closed" });

    const attempt = await prisma.testAttempt.upsert({
      where: { testId_studentId: { testId, studentId: req.user.id } },
      update: {},
      create: { testId, studentId: req.user.id },
    });
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start test" });
  }
});

// --- ADMIN/FACULTY: leaderboard / results for a test ---
router.get("/:id/results", authenticate, requireRole("ADMIN", "FACULTY"), async (req, res) => {
  const attempts = await prisma.testAttempt.findMany({
    where: { testId: req.params.id },
    include: { student: { select: { name: true, email: true, rollNumber: true } } },
    orderBy: { totalScore: "desc" },
  });
  res.json(attempts);
});

module.exports = router;

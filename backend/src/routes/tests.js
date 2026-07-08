const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");

const router = express.Router();
const prisma = new PrismaClient();

// --- ADMIN/STAFF: create a test ---
// questionIds: string[]  |  questionTimeLimits: { [questionId]: seconds } (optional, defaults to 900s/15min each)
router.post("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, description, durationMin, startTime, endTime, questionIds, questionTimeLimits } = req.body;
    const test = await prisma.test.create({
      data: {
        title,
        description,
        durationMin: durationMin || 60,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdById: req.user.id,
        questions: {
          create: (questionIds || []).map((qId, idx) => ({
            questionId: qId,
            order: idx,
            timeLimitSec: Number(questionTimeLimits?.[qId]) || 900,
          })),
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

// --- ADMIN: permanently delete a test (and its attempts/submissions) ---
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.test.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// --- ADMIN/STAFF: publish/unpublish ---
router.patch("/:id/publish", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const test = await prisma.test.update({
    where: { id: req.params.id },
    data: { isPublished: !!req.body.isPublished },
  });
  res.json(test);
});

// --- Everyone authenticated: list tests (students see only published, active/upcoming) ---
router.get("/", authenticate, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "STAFF";
  const tests = await prisma.test.findMany({
    where: isStaff ? {} : { isPublished: true },
    orderBy: { startTime: "asc" },
    include: { _count: { select: { questions: true, attempts: true } } },
  });
  res.json(tests);
});

// --- Get single test detail (questions without hidden test cases, and without
// correctAnswer/explanation, for students — those would leak the answer key) ---
router.get("/:id", authenticate, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "STAFF";
  const test = await prisma.test.findUnique({
    where: { id: req.params.id },
    include: {
      questions: {
        include: {
          question: {
            select: {
              id: true,
              questionNumber: true,
              title: true,
              description: true,
              subject: true,
              topic: true,
              questionType: true,
              difficulty: true,
              points: true,
              timeLimitMs: true,
              starterCode: true,
              options: true,
              correctAnswer: isStaff,
              explanation: isStaff,
              testCases: { where: isStaff ? {} : { isHidden: false } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!test) return res.status(404).json({ error: "Test not found" });
  res.json(test);
});

// --- STUDENT: start/attend a test attempt (one attempt per student, ever) ---
router.post("/:id/start", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || !test.isPublished) return res.status(404).json({ error: "Test not available" });

    const existing = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId, studentId: req.user.id } },
    });
    if (existing && existing.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "Thank you. You have already completed this assessment." });
    }

    const now = new Date();
    if (now < test.startTime) return res.status(403).json({ error: "Test has not started yet" });
    if (now > test.endTime) return res.status(403).json({ error: "Test window has closed" });

    const attempt = existing || (await prisma.testAttempt.create({ data: { testId, studentId: req.user.id } }));
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start test" });
  }
});

// --- STUDENT: report a tab-switch / focus-loss violation during an attempt.
// After MAX_VIOLATIONS, the attempt is auto-submitted server-side. ---
const MAX_TAB_VIOLATIONS = 3;
router.post("/attempts/:attemptId/violation", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({ where: { id: req.params.attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.json({ tabSwitchCount: attempt.tabSwitchCount, autoSubmitted: true });
    }

    const tabSwitchCount = attempt.tabSwitchCount + 1;
    const autoSubmitted = tabSwitchCount >= MAX_TAB_VIOLATIONS;

    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount,
        ...(autoSubmitted ? { status: "AUTO_SUBMITTED", submittedAt: new Date() } : {}),
      },
    });
    res.json({ tabSwitchCount: updated.tabSwitchCount, autoSubmitted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record violation" });
  }
});

// --- ADMIN/STAFF: leaderboard / results for a test ---
router.get("/:id/results", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const attempts = await prisma.testAttempt.findMany({
    where: { testId: req.params.id },
    include: { student: { select: { name: true, email: true, rollNumber: true } } },
    orderBy: { totalScore: "desc" },
  });
  res.json(attempts);
});

module.exports = router;

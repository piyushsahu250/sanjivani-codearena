const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { judgeSubmission } = require("../utils/judge");
const { runQueued } = require("../utils/queue");
const { processGamification } = require("../utils/gamification");

const router = express.Router();

const runLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: (req) => req.user.id });

function dayStart(d) {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x;
}

// Monday (UTC) of the ISO week containing d — matches WeeklyChallenge.weekStart's stated
// convention regardless of which day of that week an admin happens to pick in the scheduler.
function isoWeekStart(d) {
  const x = dayStart(d);
  const day = x.getUTCDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + diff);
  return x;
}

// Same shape moduleCoding.js's sanitizeQuestion uses (Daily/Weekly Challenges reuse the exact
// same Question model, hidden test cases, and judge) plus evaluationType/functionSignature so
// the student page can show a "Function-based" badge same as CreateQuestion.jsx's own preview.
function sanitizeQuestion(q) {
  return {
    id: q.id,
    title: q.title,
    description: q.description,
    difficulty: q.difficulty,
    tags: q.tags || null,
    estimatedTimeMin: q.estimatedTimeMin ?? null,
    realWorldScenario: q.realWorldScenario || null,
    constraints: q.constraints || null,
    inputFormat: q.inputFormat || null,
    outputFormat: q.outputFormat || null,
    notes: q.notes || null,
    edgeCases: q.edgeCases || null,
    problemExplanation: q.problemExplanation || null,
    starterCode: q.starterCode,
    starterCodeByLanguage: q.starterCodeByLanguage || null,
    evaluationType: q.evaluationType || "STDIO",
    functionSignature: q.functionSignature || null,
    testCases: (q.testCases || []).filter((tc) => !tc.isHidden).map((tc) => ({ input: tc.input, expected: tc.expected, explanation: tc.explanation || null })),
  };
}

async function runAgainstVisible(question, language, code) {
  const visible = question.testCases.filter((tc) => !tc.isHidden);
  return runQueued(() =>
    judgeSubmission({
      language, code, testCases: visible, timeLimitMs: question.timeLimitMs,
      memoryLimitKb: question.memoryLimitKb || undefined, evaluationType: question.evaluationType, functionSignature: question.functionSignature,
    })
  );
}

async function gradeAgainstHidden(question, language, code) {
  const hidden = question.testCases.filter((tc) => tc.isHidden);
  const gradingCases = hidden.length > 0 ? hidden : question.testCases.filter((tc) => !tc.isHidden);
  return runQueued(() =>
    judgeSubmission({
      language, code, testCases: gradingCases, timeLimitMs: question.timeLimitMs,
      memoryLimitKb: question.memoryLimitKb || undefined, evaluationType: question.evaluationType, functionSignature: question.functionSignature,
    })
  );
}

// =============================== STUDENT: Daily Challenge ===============================

router.get("/daily/today", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const dc = await prisma.dailyChallenge.findUnique({
      where: { date: dayStart(new Date()) },
      include: { question: { include: { testCases: true } } },
    });
    if (!dc) return res.json({ challenge: null });

    const submission = await prisma.dailyChallengeSubmission.findUnique({
      where: { dailyChallengeId_studentId: { dailyChallengeId: dc.id, studentId: req.user.id } },
    });
    res.json({
      challenge: { id: dc.id, date: dc.date },
      question: sanitizeQuestion(dc.question),
      submission: submission
        ? { language: submission.language, code: submission.code, verdict: submission.verdict, passedCases: submission.passedCases, totalCases: submission.totalCases, timeMs: submission.timeMs, memoryKb: submission.memoryKb, solvedAt: submission.solvedAt }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load today's challenge" });
  }
});

// Last 30 days: which days had a challenge and whether this student solved it — powers a
// GitHub-style calendar strip on the Daily Challenge page.
router.get("/daily/history", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const since = dayStart(new Date());
    since.setUTCDate(since.getUTCDate() - 29);
    const challenges = await prisma.dailyChallenge.findMany({
      where: { date: { gte: since } },
      orderBy: { date: "asc" },
      include: { submissions: { where: { studentId: req.user.id }, select: { solvedAt: true } } },
    });
    res.json(challenges.map((c) => ({ date: c.date, solved: c.submissions.some((s) => s.solvedAt) })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load challenge history" });
  }
});

router.post("/daily/:id/run", authenticate, requireRole("STUDENT"), runLimiter, async (req, res) => {
  try {
    const dc = await prisma.dailyChallenge.findUnique({ where: { id: req.params.id }, include: { question: { include: { testCases: true } } } });
    if (!dc) return res.status(404).json({ error: "Challenge not found" });
    const { language, code } = req.body;
    const result = await runAgainstVisible(dc.question, language, code);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

router.post("/daily/:id/submit", authenticate, requireRole("STUDENT"), runLimiter, async (req, res) => {
  try {
    const dc = await prisma.dailyChallenge.findUnique({ where: { id: req.params.id }, include: { question: { include: { testCases: true } } } });
    if (!dc) return res.status(404).json({ error: "Challenge not found" });
    const { language, code } = req.body;
    const result = await gradeAgainstHidden(dc.question, language, code);

    const existing = await prisma.dailyChallengeSubmission.findUnique({
      where: { dailyChallengeId_studentId: { dailyChallengeId: dc.id, studentId: req.user.id } },
    });
    const wasAlreadySolved = !!existing?.solvedAt;
    const nowSolved = result.verdict === "ACCEPTED";
    const fields = {
      language, code, verdict: result.verdict, passedCases: result.passedCases, totalCases: result.totalCases,
      timeMs: result.maxTimeMs ?? null, memoryKb: result.maxMemoryKb ?? null,
    };
    await prisma.dailyChallengeSubmission.upsert({
      where: { dailyChallengeId_studentId: { dailyChallengeId: dc.id, studentId: req.user.id } },
      update: { ...fields, ...(nowSolved && !wasAlreadySolved ? { solvedAt: new Date() } : {}) },
      create: { dailyChallengeId: dc.id, studentId: req.user.id, ...fields, solvedAt: nowSolved ? new Date() : null },
    });

    let gamification = null;
    if (nowSolved && !wasAlreadySolved) {
      try {
        gamification = await processGamification(req.user.id, { xpActivities: ["DAILY_CHALLENGE"], xpMeta: { dailyChallengeId: dc.id }, streakEligible: true });
      } catch (e) {
        console.error("gamification failed", e);
      }
    }

    const { details, ...safeResult } = result;
    res.json({ ...safeResult, alreadySolved: wasAlreadySolved, gamification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// =============================== STUDENT: Weekly Challenge ===============================

router.get("/weekly/current", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const wc = await prisma.weeklyChallenge.findUnique({
      where: { weekStart: isoWeekStart(new Date()) },
      include: { question: { include: { testCases: true } } },
    });
    if (!wc) return res.json({ challenge: null });

    const submission = await prisma.weeklyChallengeSubmission.findUnique({
      where: { weeklyChallengeId_studentId: { weeklyChallengeId: wc.id, studentId: req.user.id } },
    });
    res.json({
      challenge: { id: wc.id, weekStart: wc.weekStart },
      question: sanitizeQuestion(wc.question),
      submission: submission
        ? { language: submission.language, code: submission.code, verdict: submission.verdict, passedCases: submission.passedCases, totalCases: submission.totalCases, timeMs: submission.timeMs, memoryKb: submission.memoryKb, solvedAt: submission.solvedAt }
        : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load this week's challenge" });
  }
});

router.post("/weekly/:id/run", authenticate, requireRole("STUDENT"), runLimiter, async (req, res) => {
  try {
    const wc = await prisma.weeklyChallenge.findUnique({ where: { id: req.params.id }, include: { question: { include: { testCases: true } } } });
    if (!wc) return res.status(404).json({ error: "Challenge not found" });
    const { language, code } = req.body;
    const result = await runAgainstVisible(wc.question, language, code);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

router.post("/weekly/:id/submit", authenticate, requireRole("STUDENT"), runLimiter, async (req, res) => {
  try {
    const wc = await prisma.weeklyChallenge.findUnique({ where: { id: req.params.id }, include: { question: { include: { testCases: true } } } });
    if (!wc) return res.status(404).json({ error: "Challenge not found" });
    const { language, code } = req.body;
    const result = await gradeAgainstHidden(wc.question, language, code);

    const existing = await prisma.weeklyChallengeSubmission.findUnique({
      where: { weeklyChallengeId_studentId: { weeklyChallengeId: wc.id, studentId: req.user.id } },
    });
    const wasAlreadySolved = !!existing?.solvedAt;
    const nowSolved = result.verdict === "ACCEPTED";
    const fields = {
      language, code, verdict: result.verdict, passedCases: result.passedCases, totalCases: result.totalCases,
      timeMs: result.maxTimeMs ?? null, memoryKb: result.maxMemoryKb ?? null,
    };
    await prisma.weeklyChallengeSubmission.upsert({
      where: { weeklyChallengeId_studentId: { weeklyChallengeId: wc.id, studentId: req.user.id } },
      update: { ...fields, ...(nowSolved && !wasAlreadySolved ? { solvedAt: new Date() } : {}) },
      create: { weeklyChallengeId: wc.id, studentId: req.user.id, ...fields, solvedAt: nowSolved ? new Date() : null },
    });

    let gamification = null;
    if (nowSolved && !wasAlreadySolved) {
      try {
        gamification = await processGamification(req.user.id, { xpActivities: ["WEEKLY_CHALLENGE"], xpMeta: { weeklyChallengeId: wc.id }, streakEligible: true });
      } catch (e) {
        console.error("gamification failed", e);
      }
    }

    const { details, ...safeResult } = result;
    res.json({ ...safeResult, alreadySolved: wasAlreadySolved, gamification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// =============================== ADMIN: scheduling ===============================
// Platform-wide (no institute scoping on these models, same as the underlying Question bank
// they schedule from) — write access is ADMIN-only, matching the convention already used for
// other global content (gamification.js's XP-rule/badge admin routes); STAFF gets read access.

router.get("/admin/daily", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const rows = await prisma.dailyChallenge.findMany({
      orderBy: { date: "desc" },
      include: { question: { select: { id: true, title: true, description: true, difficulty: true } }, _count: { select: { submissions: true } } },
      take: 90,
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load daily challenge schedule" });
  }
});

router.post("/admin/daily", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { date, questionId } = req.body;
    if (!date || !questionId) return res.status(400).json({ error: "date and questionId are required" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, questionType: true } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType !== "CODING") return res.status(400).json({ error: "Only coding questions can be scheduled as a challenge" });

    const dc = await prisma.dailyChallenge.upsert({
      where: { date: dayStart(date) },
      update: { questionId },
      create: { date: dayStart(date), questionId },
    });
    res.json(dc);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to schedule daily challenge" });
  }
});

router.delete("/admin/daily/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.dailyChallenge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove scheduled challenge" });
  }
});

router.get("/admin/weekly", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const rows = await prisma.weeklyChallenge.findMany({
      orderBy: { weekStart: "desc" },
      include: { question: { select: { id: true, title: true, description: true, difficulty: true } }, _count: { select: { submissions: true } } },
      take: 90,
    });
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load weekly challenge schedule" });
  }
});

router.post("/admin/weekly", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { weekStart, questionId } = req.body;
    if (!weekStart || !questionId) return res.status(400).json({ error: "weekStart and questionId are required" });
    const question = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true, questionType: true } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType !== "CODING") return res.status(400).json({ error: "Only coding questions can be scheduled as a challenge" });

    const wc = await prisma.weeklyChallenge.upsert({
      where: { weekStart: isoWeekStart(weekStart) },
      update: { questionId },
      create: { weekStart: isoWeekStart(weekStart), questionId },
    });
    res.json(wc);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to schedule weekly challenge" });
  }
});

router.delete("/admin/weekly/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.weeklyChallenge.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to remove scheduled challenge" });
  }
});

module.exports = router;

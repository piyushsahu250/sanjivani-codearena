const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { authenticate, requireRole } = require("../middleware/auth");
const { judgeSubmission } = require("../utils/judge");
const { runQueued } = require("../utils/queue");

const router = express.Router();
const prisma = new PrismaClient();

// STUDENT: run code against sample (non-hidden) test cases only — for self-check, doesn't save score
router.post("/run", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const { questionId, language, code } = req.body;
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { testCases: { where: { isHidden: false } } },
    });
    if (!question) return res.status(404).json({ error: "Question not found" });

    const result = await runQueued(() =>
      judgeSubmission({ language, code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

// STUDENT: submit final answer for a question — judged against ALL test cases, saved & scored
router.post("/submit", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const { attemptId, questionId, language, code } = req.body;

    const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "This test attempt is already finalized" });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { testCases: true },
    });
    if (!question) return res.status(404).json({ error: "Question not found" });

    const result = await runQueued(() =>
      judgeSubmission({ language, code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
    );

    const score =
      result.verdict === "ACCEPTED"
        ? question.points
        : Math.round((result.passedCases / result.totalCases) * question.points);

    const submission = await prisma.submission.create({
      data: {
        attemptId,
        questionId,
        studentId: req.user.id,
        language,
        code,
        score,
        passedCases: result.passedCases,
        totalCases: result.totalCases,
        verdict: result.verdict,
      },
    });

    // Recompute attempt total score (sum of best submission per question)
    const allSubs = await prisma.submission.findMany({ where: { attemptId } });
    const bestByQuestion = {};
    for (const s of allSubs) {
      if (!bestByQuestion[s.questionId] || s.score > bestByQuestion[s.questionId]) {
        bestByQuestion[s.questionId] = s.score;
      }
    }
    const totalScore = Object.values(bestByQuestion).reduce((a, b) => a + b, 0);
    await prisma.testAttempt.update({ where: { id: attemptId }, data: { totalScore } });

    res.json({ submission, result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// STUDENT: finalize the whole test attempt
router.post("/finalize/:attemptId", authenticate, requireRole("STUDENT"), async (req, res) => {
  const attempt = await prisma.testAttempt.findUnique({ where: { id: req.params.attemptId } });
  if (!attempt || attempt.studentId !== req.user.id) {
    return res.status(403).json({ error: "Invalid attempt" });
  }
  const updated = await prisma.testAttempt.update({
    where: { id: req.params.attemptId },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });
  res.json(updated);
});

module.exports = router;

const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { judgeSubmission } = require("../utils/judge");
const { runQueued, getQueueStatus } = require("../utils/queue");

const router = express.Router();

// Per-student (not per-IP) throttling on code execution. Keying by IP would let a single
// shared campus/lab network IP — which many students behind one router/NAT genuinely share
// during an exam — collectively exhaust one shared budget, effectively rate-limiting the
// whole classroom instead of each abusive individual. Runs after `authenticate`, so
// req.user.id is always populated here.
const execLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user.id,
});

// Any authenticated user: how busy the judge is right now. Polled by the frontend while a
// Run/Submit is pending so a slow response under heavy concurrent load reads as "N students
// ahead of you" instead of a silent, seemingly-frozen spinner.
router.get("/queue-status", authenticate, (req, res) => {
  res.json(getQueueStatus());
});

// Exact-match grading for MCQ / TRUE_FALSE / MULTISELECT: the selected set of
// option indices must equal the correct set exactly (no partial credit).
function gradeQuizAnswer(question, selectedOptions) {
  const correct = Array.isArray(question.correctAnswer) ? [...question.correctAnswer].sort() : [];
  const selected = Array.isArray(selectedOptions) ? [...new Set(selectedOptions)].sort() : [];
  const isMatch = correct.length === selected.length && correct.every((v, i) => v === selected[i]);
  return {
    passedCases: isMatch ? 1 : 0,
    totalCases: 1,
    verdict: isMatch ? "ACCEPTED" : "WRONG_ANSWER",
    details: [{ verdict: isMatch ? "PASSED" : "WRONG_ANSWER" }],
  };
}

// STUDENT: run code against sample (non-hidden) test cases only — for self-check, doesn't save score
router.post("/run", authenticate, requireRole("STUDENT"), execLimiter, async (req, res) => {
  try {
    const { questionId, language, code } = req.body;
    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: { testCases: { where: { isHidden: false } } },
    });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType !== "CODING") {
      return res.status(400).json({ error: "Run is only available for coding questions" });
    }

    const result = await runQueued(() =>
      judgeSubmission({ language, code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

// STUDENT: submit final answer for a question — judged/graded and scored.
// Coding: language + code, judged against ALL test cases.
// MCQ / TRUE_FALSE / MULTISELECT: selectedOptions (array of option indices).
router.post("/submit", authenticate, requireRole("STUDENT"), execLimiter, async (req, res) => {
  try {
    const { attemptId, questionId, language, code, selectedOptions } = req.body;

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

    let result;
    let submissionLanguage = language || "";
    let submissionCode = code || "";

    if (question.questionType === "CODING") {
      result = await runQueued(() =>
        judgeSubmission({ language, code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
      );
    } else {
      result = gradeQuizAnswer(question, selectedOptions);
      submissionLanguage = question.questionType;
      submissionCode = JSON.stringify(selectedOptions || []);
    }

    const score =
      result.verdict === "ACCEPTED"
        ? question.points
        : Math.round((result.passedCases / result.totalCases) * question.points);

    const submission = await prisma.submission.create({
      data: {
        attemptId,
        questionId,
        studentId: req.user.id,
        language: submissionLanguage,
        code: submissionCode,
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

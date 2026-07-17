const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { judgeSubmission } = require("../utils/judge");
const { runQueued, getQueueStatus } = require("../utils/queue");
const { gradePendingCodingSubmissions, gradeCodingSubmission, recomputeAttemptScore } = require("../utils/gradeAttempt");
const { processGamification } = require("../utils/gamification");

const router = express.Router();

// Per-student (not per-IP) throttling on code EXECUTION specifically. Keying by IP would let a
// single shared campus/lab network IP — which many students behind one router/NAT genuinely
// share during an exam — collectively exhaust one shared budget. Only applied to routes that
// actually invoke the judge (/run, /submit for quiz grading) — /autosave is a plain DB write
// with no compute cost, so it isn't throttled here.
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

// Withholds the actual verdict/score from the submit response — students only see it after
// the test ends (via GET /tests/:id/my-result, gated on Test.showResults), same principle as
// hiding the answer key before a test. Only technical execution status (compiled/ran fine vs.
// a genuine compile/runtime/timeout error) is surfaced during the test itself; whether the
// answer was actually correct is not, even though the real verdict/score are still stored on
// the Submission row for later grading.
function sanitizeSubmitResponse(question, result) {
  if (question.questionType !== "CODING") {
    return { status: "SUBMITTED" };
  }
  if (result.verdict === "COMPILE_ERROR" || result.verdict === "TLE" || result.verdict === "MLE") {
    return { status: result.verdict, error: result.errorSummary };
  }
  if (result.errorSummary) {
    return { status: "RUNTIME_ERROR", error: result.errorSummary };
  }
  return { status: "SUBMITTED" };
}

// When Test.shuffleOptions is on, the student saw and clicked options in a per-attempt shuffled
// display order (see GET /tests/:id), so `selectedOptions` arrives as positions in THAT shuffled
// array, not the original Question.options/correctAnswer indices grading compares against.
// attempt.optionOrder[questionId] is the permutation used to build the display order (position i
// shows original option optionOrder[i]) — invert it back to original indices before grading. A
// question with no entry in optionOrder (shuffleOptions off, or a legacy attempt from before this
// feature) passes through untouched.
function toOriginalIndices(selectedOptions, order) {
  if (!order) return selectedOptions;
  return (Array.isArray(selectedOptions) ? selectedOptions : []).map((pos) => order[pos]).filter((v) => v !== undefined);
}

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
      judgeSubmission({ language, code, testCases: question.testCases, timeLimitMs: question.timeLimitMs, memoryLimitKb: question.memoryLimitKb || undefined, evaluationType: question.evaluationType, functionSignature: question.functionSignature })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

// STUDENT: auto-save a coding draft (language + code) with no judging — coding is no longer
// graded per-question mid-test; the candidate can edit freely until the test ends, and the
// final saved draft is judged once at finalize time (or on a violation-triggered auto-submit).
// Stores/overwrites a single PENDING Submission row per attempt+question, same "latest answer
// wins" principle as quiz auto-save, just without running the compiler on every keystroke.
router.post("/autosave", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const { attemptId, questionId, language, code } = req.body;

    const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "This test attempt is already finalized" });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType !== "CODING") {
      return res.status(400).json({ error: "Autosave is only for coding questions" });
    }

    // Atomic upsert on the (attemptId, questionId) unique constraint — a plain findFirst-then-
    // create/update here would race under concurrent autosave triggers (10s interval tick vs.
    // question-switch flush vs. beforeunload flush all firing close together) and could create
    // two rows for the same question, leaving grading to pick between them arbitrarily.
    await prisma.submission.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { language: language || "", code: code || "", verdict: "PENDING", score: 0, passedCases: 0, totalCases: 0, timeMs: null, memoryKb: null },
      create: { attemptId, questionId, studentId: req.user.id, language: language || "", code: code || "", verdict: "PENDING" },
    });

    res.json({ status: "SAVED" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Autosave failed" });
  }
});

// STUDENT: explicit per-question Submit — saves the current code and immediately grades it
// against the HIDDEN test cases (never the sample cases the student already checked via /run),
// unlike /autosave which never judges anything. The response still withholds pass/fail (same
// sanitizeSubmitResponse used by the quiz /submit route below) — exam integrity doesn't change
// just because grading now happens the moment the student asks for it instead of only at
// finalize; the real score is fully computed and stored, it just isn't shown until results
// publish. A student can Submit as many times as the test allows re-submission; recomputeAttemptScore
// always keeps each question's BEST scoring submission.
router.post("/submit-code", authenticate, requireRole("STUDENT"), execLimiter, async (req, res) => {
  try {
    const { attemptId, questionId, language, code } = req.body;

    const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "This test attempt is already finalized" });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId }, include: { testCases: true } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType !== "CODING") {
      return res.status(400).json({ error: "Submit is only for coding questions" });
    }

    const sub = await prisma.submission.upsert({
      where: { attemptId_questionId: { attemptId, questionId } },
      update: { language: language || "", code: code || "", verdict: "PENDING", score: 0, passedCases: 0, totalCases: 0, timeMs: null, memoryKb: null },
      create: { attemptId, questionId, studentId: req.user.id, language: language || "", code: code || "", verdict: "PENDING" },
    });

    const result = await gradeCodingSubmission(sub, question);
    await recomputeAttemptScore(attemptId);

    res.json(sanitizeSubmitResponse(question, result));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// STUDENT: auto-save/record an MCQ / TRUE_FALSE / MULTISELECT answer — graded instantly since
// exact-match grading is free (no compiler involved), but the response withholds correctness
// until results are published. A resubmission replaces the prior one for this question, so the
// most recently selected option is always what counts.
router.post("/submit", authenticate, requireRole("STUDENT"), execLimiter, async (req, res) => {
  try {
    const { attemptId, questionId, selectedOptions } = req.body;

    const attempt = await prisma.testAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "This test attempt is already finalized" });
    }

    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: "Question not found" });
    if (question.questionType === "CODING") {
      return res.status(400).json({ error: "Coding questions are auto-saved via /autosave, not /submit" });
    }

    const originalIndices = toOriginalIndices(selectedOptions, attempt.optionOrder?.[questionId]);
    const result = gradeQuizAnswer(question, originalIndices);
    const score =
      result.verdict === "ACCEPTED"
        ? question.points
        : Math.round((result.passedCases / result.totalCases) * question.points);

    // A re-submission replaces the prior one for this question — otherwise changing your
    // answer just added another row, and scoring picked whichever of the two scored higher,
    // which meant an earlier, since-changed answer could still silently win.
    await prisma.submission.deleteMany({ where: { attemptId, questionId } });
    const submission = await prisma.submission.create({
      data: {
        attemptId,
        questionId,
        studentId: req.user.id,
        language: question.questionType,
        code: JSON.stringify(selectedOptions || []),
        score,
        passedCases: result.passedCases,
        totalCases: result.totalCases,
        verdict: result.verdict,
      },
    });

    const allSubs = await prisma.submission.findMany({ where: { attemptId } });
    const bestByQuestion = {};
    for (const s of allSubs) {
      if (!bestByQuestion[s.questionId] || s.score > bestByQuestion[s.questionId]) {
        bestByQuestion[s.questionId] = s.score;
      }
    }
    const totalScore = Object.values(bestByQuestion).reduce((a, b) => a + b, 0);
    await prisma.testAttempt.update({ where: { id: attemptId }, data: { totalScore } });

    res.json({ submissionId: submission.id, execution: sanitizeSubmitResponse(question, result) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Submission failed" });
  }
});

// STUDENT: finalize the whole test attempt — grades every still-PENDING coding draft (the
// final saved version of each) before marking the attempt SUBMITTED. Idempotent: calling it
// again on an already-finalized attempt just returns the current state.
router.post("/finalize/:attemptId", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({ where: { id: req.params.attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }

    if (attempt.status !== "IN_PROGRESS") {
      return res.json(attempt);
    }

    await gradePendingCodingSubmissions(attempt.id);

    const updated = await prisma.testAttempt.update({
      where: { id: req.params.attemptId },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });

    let gamification = null;
    try {
      gamification = await processGamification(req.user.id, {
        xpActivities: ["TEST_COMPLETE"], xpMeta: { attemptId: attempt.id }, streakEligible: true,
      });
    } catch (e) {
      console.error("gamification failed", e);
    }

    res.json({ ...updated, gamification });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit test" });
  }
});

module.exports = router;

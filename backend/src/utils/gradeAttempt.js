const prisma = require("../prisma");
const { judgeSubmission } = require("./judge");
const { runQueued } = require("./queue");

// Grades one coding Submission row against its question's hidden test cases (falling back to the
// full case set for a legacy question created before the admin CMS started requiring >=2 hidden
// cases, so a pre-existing all-visible question doesn't silently start scoring 0 for everyone),
// writes the result back onto that row, and returns the judge result. Shared by both the explicit
// per-question Submit button (routes/submissions.js) and the bulk end-of-attempt grading pass
// below — same grading policy either way, just a different trigger.
async function gradeCodingSubmission(sub, question) {
  const hiddenCases = question.testCases.filter((tc) => tc.isHidden);
  const gradingCases = hiddenCases.length > 0 ? hiddenCases : question.testCases;
  const result = await runQueued(() =>
    judgeSubmission({
      language: sub.language, code: sub.code, testCases: gradingCases, timeLimitMs: question.timeLimitMs,
      memoryLimitKb: question.memoryLimitKb || undefined, evaluationType: question.evaluationType, functionSignature: question.functionSignature,
      sqlSchema: question.sqlSchema,
    })
  );
  const score =
    result.totalCases === 0
      ? 0
      : result.verdict === "ACCEPTED"
      ? question.points
      : Math.round((result.passedCases / result.totalCases) * question.points);
  await prisma.submission.update({
    where: { id: sub.id },
    data: {
      score, passedCases: result.passedCases, totalCases: result.totalCases, verdict: result.verdict,
      timeMs: result.maxTimeMs ?? null, memoryKb: result.maxMemoryKb ?? null,
    },
  });
  return result;
}

// An attempt's totalScore is the sum of each question's BEST scoring submission — a student can
// click Submit again after improving their code, and their best attempt (not just the latest)
// counts, same as re-submitting always worked here.
async function recomputeAttemptScore(attemptId) {
  const allSubs = await prisma.submission.findMany({ where: { attemptId } });
  const bestByQuestion = {};
  for (const s of allSubs) {
    if (!bestByQuestion[s.questionId] || s.score > bestByQuestion[s.questionId]) bestByQuestion[s.questionId] = s.score;
  }
  const totalScore = Object.values(bestByQuestion).reduce((a, b) => a + b, 0);
  await prisma.testAttempt.update({ where: { id: attemptId }, data: { totalScore } });
  return totalScore;
}

// Coding questions can also go ungraded if the candidate never clicks Submit for one (they're
// allowed to skip questions) — this grades every still-PENDING coding submission for an attempt
// (whatever the last autosaved draft was) and recomputes the total score. Called from the
// finalize flow and the 3-strike violation auto-submit path, so nothing is left permanently
// ungraded. Idempotent: safe to call on an attempt with nothing pending.
async function gradePendingCodingSubmissions(attemptId) {
  const pending = await prisma.submission.findMany({ where: { attemptId, verdict: "PENDING" } });

  await Promise.all(
    pending.map(async (sub) => {
      const question = await prisma.question.findUnique({ where: { id: sub.questionId }, include: { testCases: true } });
      if (!question) return;
      await gradeCodingSubmission(sub, question);
    })
  );

  await recomputeAttemptScore(attemptId);
}

module.exports = { gradePendingCodingSubmissions, gradeCodingSubmission, recomputeAttemptScore };

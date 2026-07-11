const prisma = require("../prisma");
const { judgeSubmission } = require("./judge");
const { runQueued } = require("./queue");

// Grades every still-PENDING coding submission for a module-coding attempt against ALL of its
// test cases (public + hidden — unlike the student-facing /run endpoint, which only runs public
// ones). Mirrors utils/gradeAttempt.js (the exam-side equivalent) but scores by simple average of
// per-question pass percentage rather than points, since these questions don't carry a points
// field the way exam Questions do. A question the student never touched (no submission row at
// all) counts as 0% — still included in the denominator, so skipping questions can't inflate
// the average. Idempotent: safe to call on an attempt with nothing pending.
async function gradeModuleCodingAttempt(attemptId, { reason } = {}) {
  const attempt = await prisma.moduleCodingAttempt.findUnique({
    where: { id: attemptId },
    include: {
      moduleCodingTest: true,
      questions: { include: { question: { include: { testCases: true } } } },
      submissions: true,
    },
  });
  if (!attempt) return null;

  const submissionByQuestion = new Map(attempt.submissions.map((s) => [s.questionId, s]));

  await Promise.all(
    attempt.questions.map(async ({ question }) => {
      const sub = submissionByQuestion.get(question.id);
      if (!sub || sub.verdict !== "PENDING") return;
      const result = await runQueued(() =>
        judgeSubmission({ language: sub.language, code: sub.code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
      );
      await prisma.moduleCodingSubmission.update({
        where: { id: sub.id },
        data: { passedCases: result.passedCases, totalCases: result.totalCases, verdict: result.verdict },
      });
    })
  );

  const freshSubmissions = await prisma.moduleCodingSubmission.findMany({ where: { attemptId } });
  const submissionByQuestion2 = new Map(freshSubmissions.map((s) => [s.questionId, s]));

  const totalQuestions = attempt.questions.length;
  let sumPercent = 0;
  for (const { question } of attempt.questions) {
    const sub = submissionByQuestion2.get(question.id);
    if (!sub || sub.totalCases === 0) continue; // no submission, or judged but had 0 test cases — counts as 0%
    sumPercent += Math.round((sub.passedCases / sub.totalCases) * 100);
  }
  const score = totalQuestions > 0 ? Math.round(sumPercent / totalQuestions) : 0;
  const passed = score >= attempt.moduleCodingTest.passingPercent;

  const updated = await prisma.moduleCodingAttempt.update({
    where: { id: attemptId },
    data: {
      status: reason ? "AUTO_SUBMITTED" : "SUBMITTED",
      score,
      passed,
      submittedAt: new Date(),
      autoSubmitReason: reason || null,
    },
  });
  return updated;
}

module.exports = { gradeModuleCodingAttempt };

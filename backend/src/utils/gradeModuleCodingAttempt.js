const prisma = require("../prisma");
const { judgeSubmission } = require("./judge");
const { runQueued } = require("./queue");

// Grades every still-PENDING coding submission for a module-coding attempt against its HIDDEN
// test cases only (unlike the student-facing /run endpoint, which only runs the public/visible
// ones for self-check) — falls back to the full set for any legacy question that predates the
// admin CMS's >=2-hidden-cases requirement, so it never silently scores 0 for everyone. Mirrors
// utils/gradeAttempt.js (the exam-side equivalent) but scores by simple average of per-question
// pass percentage rather than points, since these questions don't carry a points field the way
// exam Questions do. A question the student never touched (no submission row at all) counts as
// 0% — still included in the denominator, so skipping questions can't inflate the average.
// Idempotent: safe to call on an attempt with nothing pending.
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
      const hiddenCases = question.testCases.filter((tc) => tc.isHidden);
      const gradingCases = hiddenCases.length > 0 ? hiddenCases : question.testCases;
      const result = await runQueued(() =>
        judgeSubmission({ language: sub.language, code: sub.code, testCases: gradingCases, timeLimitMs: question.timeLimitMs })
      );
      await prisma.moduleCodingSubmission.update({
        where: { id: sub.id },
        data: {
          passedCases: result.passedCases, totalCases: result.totalCases, verdict: result.verdict,
          timeMs: result.maxTimeMs ?? null, memoryKb: result.maxMemoryKb ?? null,
        },
      });
    })
  );

  const freshSubmissions = await prisma.moduleCodingSubmission.findMany({ where: { attemptId } });
  const submissionByQuestion2 = new Map(freshSubmissions.map((s) => [s.questionId, s]));

  const totalQuestions = attempt.questions.length;
  let sumPercent = 0;
  // Per-question detail for the post-submit result view — never includes hidden test case
  // input/expected/actual, just the aggregate counts/score/perf already safe to show (same
  // shape the student's own Run button already exposes for visible cases).
  const questionBreakdown = [];
  attempt.questions.forEach(({ question, order }, idx) => {
    const sub = submissionByQuestion2.get(question.id);
    const percent = sub && sub.totalCases > 0 ? Math.round((sub.passedCases / sub.totalCases) * 100) : 0;
    if (sub && sub.totalCases > 0) sumPercent += percent;
    questionBreakdown.push({
      questionId: question.id,
      order: order ?? idx,
      title: question.title || `Question ${idx + 1}`,
      passedCases: sub?.passedCases ?? 0,
      totalCases: sub?.totalCases ?? 0,
      score: percent,
      verdict: sub?.verdict ?? "PENDING",
      timeMs: sub?.timeMs ?? null,
      memoryKb: sub?.memoryKb ?? null,
    });
  });
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
  return { ...updated, questionBreakdown };
}

module.exports = { gradeModuleCodingAttempt };

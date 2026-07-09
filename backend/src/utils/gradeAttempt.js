const prisma = require("../prisma");
const { judgeSubmission } = require("./judge");
const { runQueued } = require("./queue");

// Coding questions are no longer graded per-question mid-test — the candidate can edit freely
// until the test ends, so their code is just auto-saved as a PENDING draft. This grades every
// still-PENDING coding submission for an attempt (the final saved draft, whatever it was at the
// moment the test ended) and recomputes the attempt's total score. Called from both the normal
// finalize flow and the 3-strike violation auto-submit path — otherwise an attempt that gets
// auto-submitted via violations would leave its coding answers ungraded forever. Idempotent:
// safe to call on an attempt with nothing pending.
async function gradePendingCodingSubmissions(attemptId) {
  const pending = await prisma.submission.findMany({ where: { attemptId, verdict: "PENDING" } });

  await Promise.all(
    pending.map(async (sub) => {
      const question = await prisma.question.findUnique({ where: { id: sub.questionId }, include: { testCases: true } });
      if (!question) return;
      const result = await runQueued(() =>
        judgeSubmission({ language: sub.language, code: sub.code, testCases: question.testCases, timeLimitMs: question.timeLimitMs })
      );
      const score =
        result.verdict === "ACCEPTED"
          ? question.points
          : Math.round((result.passedCases / result.totalCases) * question.points);
      await prisma.submission.update({
        where: { id: sub.id },
        data: { score, passedCases: result.passedCases, totalCases: result.totalCases, verdict: result.verdict },
      });
    })
  );

  const allSubs = await prisma.submission.findMany({ where: { attemptId } });
  const bestByQuestion = {};
  for (const s of allSubs) {
    if (!bestByQuestion[s.questionId] || s.score > bestByQuestion[s.questionId]) bestByQuestion[s.questionId] = s.score;
  }
  const totalScore = Object.values(bestByQuestion).reduce((a, b) => a + b, 0);
  await prisma.testAttempt.update({ where: { id: attemptId }, data: { totalScore } });
}

module.exports = { gradePendingCodingSubmissions };

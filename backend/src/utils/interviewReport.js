// Builds the persisted InterviewReport snapshot from a session's answers. `answersWithQuestions`
// is [{ ...InterviewAnswer, question: { category, subject, aptitudeCategory } }].
function buildInterviewReport(answersWithQuestions) {
  const answered = answersWithQuestions.filter((a) => !a.skipped);
  const skippedCount = answersWithQuestions.length - answered.length;

  if (answered.length === 0) {
    return {
      overallScore: 0,
      scoreBreakdown: {},
      strongAreas: [],
      weakAreas: [],
      recommendations: ["No questions were answered — attempt at least a few questions to get a meaningful report."],
    };
  }

  const overallScore = Math.max(0, Math.round(answered.reduce((s, a) => s + a.score, 0) / answered.length));

  const subScoreSums = {}, subScoreCounts = {};
  for (const a of answered) {
    for (const [k, v] of Object.entries(a.breakdown || {})) {
      if (typeof v !== "number") continue;
      subScoreSums[k] = (subScoreSums[k] || 0) + v;
      subScoreCounts[k] = (subScoreCounts[k] || 0) + 1;
    }
  }
  const scoreBreakdown = {};
  for (const k of Object.keys(subScoreSums)) scoreBreakdown[k] = Math.round(subScoreSums[k] / subScoreCounts[k]);

  const groupScores = new Map();
  for (const a of answered) {
    const label = a.question.subject || a.question.aptitudeCategory || a.question.category;
    if (!label) continue;
    if (!groupScores.has(label)) groupScores.set(label, []);
    groupScores.get(label).push(a.score);
  }
  const groupAverages = [...groupScores.entries()].map(([label, scores]) => ({
    label, avg: Math.round(scores.reduce((s, v) => s + v, 0) / scores.length),
  }));
  const strongAreas = groupAverages.filter((g) => g.avg >= 75).sort((a, b) => b.avg - a.avg).map((g) => g.label);
  const weakAreas = groupAverages.filter((g) => g.avg < 50).sort((a, b) => a.avg - b.avg).map((g) => g.label);

  const recommendations = [];
  if (weakAreas.length > 0) recommendations.push(`Focus more practice on: ${weakAreas.join(", ")}.`);
  if (skippedCount > 0) recommendations.push(`You skipped ${skippedCount} question${skippedCount === 1 ? "" : "s"} — attempting every question (even partially) gives a fuller picture of your readiness.`);
  if (scoreBreakdown.confidence !== undefined && scoreBreakdown.confidence < 60) recommendations.push('Reduce hedging language ("maybe", "I think", "probably") — answer assertively even when unsure.');
  if (scoreBreakdown.communication !== undefined && scoreBreakdown.communication < 60) recommendations.push('Watch filler words ("um", "like", "actually") and aim for clear, moderate-length sentences.');
  if (scoreBreakdown.completeness !== undefined && scoreBreakdown.completeness < 60) recommendations.push("Expand your answers — aim for at least 60 words covering context, action, and outcome (the STAR method).");
  if (scoreBreakdown.codeQuality !== undefined && scoreBreakdown.codeQuality < 60) recommendations.push("Add comments and keep functions focused — code quality matters to interviewers beyond just passing tests.");
  if (overallScore >= 80) recommendations.push("Strong performance — keep practicing to maintain consistency across topics.");
  if (recommendations.length === 0) recommendations.push("Solid all-around performance. Keep practicing regularly to stay sharp.");

  return { overallScore, scoreBreakdown, strongAreas, weakAreas, recommendations: recommendations.slice(0, 6) };
}

module.exports = { buildInterviewReport };

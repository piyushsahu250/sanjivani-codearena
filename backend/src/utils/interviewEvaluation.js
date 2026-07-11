// Rule-based (not AI/LLM) evaluation for the Interview Prep module. This platform has no LLM
// integration anywhere — the Resume Builder's ATS scorer was built the same way for the same
// reason (transparent, reproducible, free, and honest about not being real AI). "Confidence",
// "communication", etc. below are linguistic heuristics on the answer text, not genuine
// sentiment/audio analysis — a student sees exactly what signals drove their score, which a
// black-box model wouldn't offer anyway.

const FILLER_WORDS = ["um", "uh", "like", "actually", "basically", "you know", "sort of", "kind of"];
const HEDGE_PHRASES = ["maybe", "probably", "i think", "i guess", "not sure", "might be", "perhaps", "kind of feel"];
const INFORMAL_WORDS = ["gonna", "wanna", "yeah", "stuff", "kinda", "dunno", "lol"];

function tokenize(text) {
  return (text || "").toLowerCase().match(/[a-z']+/g) || [];
}

function countOccurrences(lowerText, phrases) {
  return phrases.reduce((sum, p) => sum + (lowerText.split(p).length - 1), 0);
}

// HR: free-text answer, no single "correct" answer — graded on how well-formed, complete,
// assertive, and professional the response reads.
function evaluateHrAnswer(text, expectedKeywords = []) {
  const trimmed = (text || "").trim();
  if (!trimmed) {
    return { score: 0, breakdown: { completeness: 0, vocabulary: 0, communication: 0, confidence: 0, professionalism: 0 } };
  }

  const lower = trimmed.toLowerCase();
  const words = tokenize(trimmed);
  const wordCount = words.length;
  const sentences = trimmed.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const sentenceCount = sentences.length || 1;
  const avgSentenceLen = wordCount / sentenceCount;
  const distinctWords = new Set(words).size;
  const lexicalDiversity = wordCount > 0 ? distinctWords / wordCount : 0;

  const fillerCount = countOccurrences(lower, FILLER_WORDS);
  const hedgeCount = countOccurrences(lower, HEDGE_PHRASES);
  const informalCount = countOccurrences(lower, INFORMAL_WORDS);
  const keywordMatches = expectedKeywords.filter((k) => lower.includes(k.toLowerCase())).length;

  const completeness = Math.max(0, Math.min(100, Math.round((wordCount / 60) * 100)));

  let vocabulary = Math.min(100, Math.round(lexicalDiversity * 130));
  if (expectedKeywords.length > 0) {
    vocabulary = Math.round(vocabulary * 0.6 + (keywordMatches / expectedKeywords.length) * 100 * 0.4);
  }

  const sentenceLenScore = avgSentenceLen >= 8 && avgSentenceLen <= 25
    ? 100
    : avgSentenceLen < 8
      ? Math.round((avgSentenceLen / 8) * 100)
      : Math.max(40, Math.round(100 - (avgSentenceLen - 25) * 3));
  const communication = Math.max(0, Math.round(sentenceLenScore - Math.min(40, fillerCount * 8)));

  const confidence = Math.max(0, Math.round(100 - Math.min(50, hedgeCount * 12) - (wordCount < 20 ? 30 : 0)));

  const professionalism = Math.max(0, 100 - Math.min(60, informalCount * 15));

  const score = Math.round((completeness + vocabulary + communication + confidence + professionalism) / 5);
  return { score, breakdown: { completeness, vocabulary, communication, confidence, professionalism } };
}

// Technical: free-text answer graded by how many expected concepts/keywords it mentions —
// a keyword-coverage proxy for correctness, same mechanism as the ATS scorer's keyword match.
function evaluateTechnicalAnswer(text, expectedKeywords = []) {
  const trimmed = (text || "").trim();
  if (!trimmed) return { score: 0, breakdown: { correctness: 0, keywordsMatched: 0, keywordsTotal: expectedKeywords.length, matchedKeywords: [] } };

  const lower = trimmed.toLowerCase();
  const matched = expectedKeywords.filter((k) => lower.includes(k.toLowerCase()));
  const correctness = expectedKeywords.length > 0
    ? Math.round((matched.length / expectedKeywords.length) * 100)
    : (trimmed.length > 20 ? 60 : 20); // no keyword list configured — fall back to a length-based floor
  return { score: correctness, breakdown: { correctness, keywordsMatched: matched.length, keywordsTotal: expectedKeywords.length, matchedKeywords: matched } };
}

// Aptitude: exact-match MCQ, same grading rule the Learning Module practice tests use.
// negativeMarking, when enabled, deducts 25% of the question's value for a wrong (non-skipped)
// answer — skipped questions are simply worth 0, never negative.
function evaluateAptitudeAnswer(selectedIndex, correctAnswer, negativeMarking) {
  const skipped = selectedIndex === null || selectedIndex === undefined || selectedIndex === "";
  if (skipped) return { score: 0, correct: false, skipped: true };
  const correct = Number(selectedIndex) === Number(correctAnswer);
  const score = correct ? 100 : negativeMarking ? -25 : 0;
  return { score, correct, skipped: false };
}

// Coding: real correctness from the judge (existing infra, actual code execution) plus a small,
// transparent code-quality heuristic. Time/space complexity is NOT auto-detected — reliably
// inferring Big-O from arbitrary source is a genuinely hard static-analysis problem, well beyond
// a heuristic; the student self-reports it in a free-text field instead (shown in the report,
// never scored).
function evaluateCodingAnswer(judgeResult, code) {
  const correctness = judgeResult.totalCases > 0 ? Math.round((judgeResult.passedCases / judgeResult.totalCases) * 100) : 0;

  const lines = (code || "").split("\n").filter((l) => l.trim().length > 0);
  const hasComments = /\/\/|\/\*|#/.test(code || "");
  const avgLineLen = lines.length ? lines.reduce((s, l) => s + l.length, 0) / lines.length : 0;
  let codeQuality = 50;
  if (hasComments) codeQuality += 15;
  if (lines.length >= 3 && lines.length <= 200) codeQuality += 20;
  if (avgLineLen < 100) codeQuality += 15;
  codeQuality = Math.min(100, codeQuality);

  const score = Math.round(correctness * 0.75 + codeQuality * 0.25);
  return {
    score,
    breakdown: { correctness, codeQuality, passedCases: judgeResult.passedCases, totalCases: judgeResult.totalCases, verdict: judgeResult.verdict },
  };
}

module.exports = { evaluateHrAnswer, evaluateTechnicalAnswer, evaluateAptitudeAnswer, evaluateCodingAnswer };

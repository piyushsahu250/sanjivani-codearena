const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { judgeSubmission } = require("../utils/judge");
const { runQueued } = require("../utils/queue");
const { evaluateHrAnswer, evaluateTechnicalAnswer, evaluateAptitudeAnswer, evaluateCodingAnswer } = require("../utils/interviewEvaluation");
const { buildInterviewReport } = require("../utils/interviewReport");
const { buildRecommendations } = require("../utils/interviewRecommendations");
const { generateResumeQuestions } = require("../utils/resumeInterviewQuestions");
const { generateInterviewCertificatePdf } = require("../utils/interviewCertificatePdf");
const { generateInterviewReportPdf } = require("../utils/interviewReportPdf");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });
const FRONTEND_URL = process.env.FRONTEND_URL || "https://sanjivani-codearena.vercel.app";
const CERT_THRESHOLD = 80;

const SESSION_QUESTION_COUNT = { HR: 6, TECHNICAL: 6, APTITUDE: 10, CODING: 3, SYSTEM_DESIGN: 3, BEHAVIORAL: 6, MANAGERIAL: 5 };
const MOCK_DURATION_MIN = 30;
const COMPANY_ROUND_DURATION_MIN = 45;
const MAX_INTERVIEW_VIOLATIONS = 3;
const VALID_CATEGORIES = ["HR", "TECHNICAL", "CODING", "APTITUDE", "SYSTEM_DESIGN", "BEHAVIORAL", "MANAGERIAL"];
// Free-text categories (as opposed to APTITUDE's MCQ or CODING's editor) — these get voice
// input and the short-answer depth-probe follow-up.
const FREE_TEXT_CATEGORIES = ["HR", "TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "MANAGERIAL"];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

function sanitizeQuestion(q) {
  return {
    id: q.id, category: q.category, subject: q.subject, company: q.company, aptitudeCategory: q.aptitudeCategory,
    difficulty: q.difficulty, prompt: q.prompt, options: q.options,
    starterCode: q.starterCode, language: q.language,
  };
}

async function pickQuestions(category, config, count) {
  const where = { category, isActive: true, generatedForStudentId: null };
  if (config.subject) where.subject = config.subject;
  if (config.difficulty) where.difficulty = config.difficulty;
  if (config.aptitudeCategory) where.aptitudeCategory = config.aptitudeCategory;
  if (config.company) where.company = config.company;
  let pool = await prisma.interviewQuestion.findMany({ where });
  // A company filter that turns up nothing (a category/company combination that hasn't been
  // seeded yet) falls back to the general pool rather than a hard error — company-specific
  // banks are seeded modestly on purpose and grown via the admin CMS over time.
  if (pool.length === 0 && config.company) {
    const { company, ...rest } = where;
    pool = await prisma.interviewQuestion.findMany({ where: rest });
  }
  return shuffle(pool).slice(0, count || SESSION_QUESTION_COUNT[category] || 6);
}

// =========================== Student: dashboard summary ===========================

router.get("/summary", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const sessions = await prisma.interviewSession.findMany({
      where: { studentId: req.user.id, status: { in: ["COMPLETED", "TERMINATED"] } },
      include: { report: true },
    });
    const totalAttempted = sessions.length;
    const withReport = sessions.filter((s) => s.report);
    const averageScore = withReport.length
      ? Math.round(withReport.reduce((s, x) => s + x.report.overallScore, 0) / withReport.length)
      : 0;

    const strongCounts = new Map(), weakCounts = new Map();
    for (const s of withReport) {
      for (const a of s.report.strongAreas || []) strongCounts.set(a, (strongCounts.get(a) || 0) + 1);
      for (const a of s.report.weakAreas || []) weakCounts.set(a, (weakCounts.get(a) || 0) + 1);
    }
    const strongAreas = [...strongCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
    const weakAreas = [...weakCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);

    const recentRecs = withReport
      .slice(-3)
      .flatMap((s) => s.report.recommendations || [])
      .slice(0, 5);

    const byCategory = {};
    for (const cat of VALID_CATEGORIES) {
      const catSessions = sessions.filter((s) => s.category === cat && !s.isMock && !s.isResumeBased);
      byCategory[cat] = catSessions.length;
    }
    const mockCount = sessions.filter((s) => s.isMock).length;
    const resumeBasedCount = sessions.filter((s) => s.isResumeBased).length;

    res.json({ totalAttempted, averageScore, strongAreas, weakAreas, improvementSuggestions: recentRecs, byCategory: { ...byCategory, MOCK: mockCount, RESUME_BASED: resumeBasedCount } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load interview summary" });
  }
});

// =========================== Student: sessions ===========================

// STUDENT: start (or resume, if one's already in progress with the same shape) a session.
router.post("/sessions", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const { category, isMock, isResumeBased, isCompanyRound, config } = req.body;
    if (!isMock && !isResumeBased && !isCompanyRound && !VALID_CATEGORIES.includes(category)) {
      return res.status(400).json({ error: "Invalid category" });
    }
    if (isCompanyRound && !config?.company) {
      return res.status(400).json({ error: "A company must be selected for a Company Round interview" });
    }

    const existing = await prisma.interviewSession.findFirst({
      where: {
        studentId: req.user.id, status: "IN_PROGRESS",
        category: isMock || isResumeBased || isCompanyRound ? null : category,
        isMock: !!isMock, isResumeBased: !!isResumeBased, isCompanyRound: !!isCompanyRound,
      },
      include: { answers: true },
    });
    if (existing) {
      const questions = await prisma.interviewQuestion.findMany({ where: { id: { in: existing.answers.map((a) => a.questionId) } } });
      // In-progress sessions store their question order as answer rows created up front (see below),
      // so this reconstructs the original order via createdAt.
      const ordered = existing.answers
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map((a) => questions.find((q) => q.id === a.questionId))
        .filter(Boolean);
      return res.json({ session: existing, questions: ordered.map(sanitizeQuestion), resumed: true });
    }

    let questions = [];
    let sessionData = { studentId: req.user.id, config: config || {} };

    if (isResumeBased) {
      const resume = await prisma.resume.findUnique({ where: { studentId: req.user.id } });
      const generated = generateResumeQuestions(resume);
      if (generated.length === 0) {
        return res.status(400).json({ error: "Add skills, projects, or experience to your resume first — there's nothing to generate questions from yet." });
      }
      questions = await Promise.all(
        generated.map((g) =>
          prisma.interviewQuestion.create({
            data: { category: "TECHNICAL", subject: g.subject, prompt: g.prompt, expectedKeywords: g.expectedKeywords, generatedForStudentId: req.user.id },
          })
        )
      );
      sessionData = { ...sessionData, isResumeBased: true, category: null };
    } else if (isMock) {
      const difficultyCfg = { difficulty: config?.difficulty };
      const [hr, tech, coding] = await Promise.all([
        pickQuestions("HR", difficultyCfg, 3), pickQuestions("TECHNICAL", difficultyCfg, 3), pickQuestions("CODING", difficultyCfg, 2),
      ]);
      questions = [...hr, ...tech, ...coding];
      if (questions.length === 0) return res.status(400).json({ error: "No interview questions available yet — ask an admin to add some." });
      sessionData = { ...sessionData, isMock: true, category: null, config: { ...config, durationMin: MOCK_DURATION_MIN } };
    } else if (isCompanyRound) {
      // "Student selects TCS -> HR + Technical + Coding + Managerial questions, all scoped to
      // that company (falling back to the general pool per-category if that company doesn't
      // have questions in a given category yet — see pickQuestions)."
      const roundCfg = { company: config.company, difficulty: config?.difficulty };
      const [hr, tech, coding, managerial] = await Promise.all([
        pickQuestions("HR", roundCfg, 2), pickQuestions("TECHNICAL", roundCfg, 3),
        pickQuestions("CODING", roundCfg, 2), pickQuestions("MANAGERIAL", roundCfg, 2),
      ]);
      questions = [...hr, ...tech, ...coding, ...managerial];
      if (questions.length === 0) return res.status(400).json({ error: "No interview questions available yet — ask an admin to add some." });
      sessionData = { ...sessionData, isCompanyRound: true, category: null, config: { ...config, durationMin: COMPANY_ROUND_DURATION_MIN } };
    } else {
      questions = await pickQuestions(category, config || {});
      if (questions.length === 0) return res.status(400).json({ error: "No questions available for this selection yet — try a different subject/difficulty or ask an admin to add more." });
      sessionData = { ...sessionData, category };
    }

    const session = await prisma.interviewSession.create({ data: sessionData });
    // Pre-create empty answer rows in question order so /sessions/:id/answer is a plain
    // upsert-by-unique-key, and resuming later can reconstruct the original order from them.
    await prisma.interviewAnswer.createMany({
      data: questions.map((q) => ({ sessionId: session.id, questionId: q.id, skipped: true })),
    });

    res.json({ session, questions: questions.map(sanitizeQuestion), resumed: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start interview session" });
  }
});

router.get("/sessions", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = 10;
    const [sessions, total] = await Promise.all([
      prisma.interviewSession.findMany({
        where: { studentId: req.user.id, status: { in: ["COMPLETED", "TERMINATED"] } },
        include: { report: true },
        orderBy: { submittedAt: "desc" },
        skip: (page - 1) * pageSize, take: pageSize,
      }),
      prisma.interviewSession.count({ where: { studentId: req.user.id, status: { in: ["COMPLETED", "TERMINATED"] } } }),
    ]);
    res.json({ sessions, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load session history" });
  }
});

router.get("/sessions/:id", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: { answers: { orderBy: { createdAt: "asc" } }, report: true },
    });
    if (!session || session.studentId !== req.user.id) return res.status(404).json({ error: "Session not found" });
    const questions = await prisma.interviewQuestion.findMany({ where: { id: { in: session.answers.map((a) => a.questionId) } } });
    const ordered = session.answers.map((a) => ({ ...sanitizeQuestion(questions.find((q) => q.id === a.questionId) || {}), answer: a }));
    const recommendedLearning = session.report ? await buildRecommendations(session.report.weakAreas) : [];
    res.json({ session, questions: ordered, recommendedLearning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load session" });
  }
});

// Rule-based "adaptive" follow-up — NOT a real NLU model generating a question from the
// semantic content of the answer (that's a genuine LLM capability this platform doesn't have).
// Two mechanisms: (1) an admin-configured link on the question itself (e.g. "Explain JVM" ->
// "How does JVM differ from JRE?"), deterministic and transparent; (2) a generic depth-probe,
// at most once per session, when a free-text answer is very short — honestly framed as "that
// was brief, elaborate," not a claim of having understood the answer's content.
async function maybeInsertFollowUp(session, question, answerText, skipped) {
  if (skipped) return null;

  if (question.followUpQuestionId) {
    const alreadyAsked = await prisma.interviewAnswer.findUnique({
      where: { sessionId_questionId: { sessionId: session.id, questionId: question.followUpQuestionId } },
    });
    if (alreadyAsked) return null;
    const followUpQ = await prisma.interviewQuestion.findUnique({ where: { id: question.followUpQuestionId } });
    return followUpQ && followUpQ.isActive ? followUpQ : null;
  }

  if (FREE_TEXT_CATEGORIES.includes(question.category) && answerText && answerText.trim().split(/\s+/).filter(Boolean).length < 15) {
    const probeAlreadyUsed = await prisma.interviewAnswer.count({
      where: { sessionId: session.id, question: { prompt: { startsWith: "[Follow-up]" } } },
    });
    if (probeAlreadyUsed === 0) {
      return prisma.interviewQuestion.create({
        data: {
          category: question.category, subject: question.subject,
          prompt: "[Follow-up] Can you elaborate further and give a specific example?",
          expectedKeywords: question.expectedKeywords || [],
          generatedForStudentId: session.studentId,
        },
      });
    }
  }
  return null;
}

// STUDENT: submit/update one answer. Coding gets immediate pass/fail feedback (like Run); HR/
// Technical/Aptitude are graded silently — the full picture only shows up in the final report,
// matching "AI evaluates after submission" (of the whole interview, not each question). May
// return a `followUpQuestion` when this answer triggers one (see maybeInsertFollowUp) — the
// frontend appends it to the live question list rather than the session needing to be re-fetched.
router.post("/sessions/:id/answer", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.studentId !== req.user.id) return res.status(403).json({ error: "Invalid session" });
    if (session.status !== "IN_PROGRESS") return res.status(400).json({ error: "This session is already finalized" });

    const { questionId, answerText, code, language, skipped, timeTakenSec } = req.body;
    const question = await prisma.interviewQuestion.findUnique({ where: { id: questionId } });
    if (!question) return res.status(404).json({ error: "Question not found" });

    let score = 0, breakdown = null, immediateResult = null;
    if (skipped) {
      score = 0; breakdown = null;
    } else if (question.category === "HR" || question.category === "BEHAVIORAL" || question.category === "MANAGERIAL") {
      // Managerial questions (leadership, prioritization, conflict resolution) are free-text/
      // speech, same shape as HR/Behavioral — the same linguistic heuristics apply.
      const r = evaluateHrAnswer(answerText, question.expectedKeywords || []);
      score = r.score; breakdown = r.breakdown;
    } else if (question.category === "TECHNICAL" || question.category === "SYSTEM_DESIGN") {
      // System Design answers are free-text explanations graded the same way as a technical
      // concept answer: keyword coverage against the expected-concepts list an admin sets on
      // the question (e.g. "load balancer", "caching", "sharding", "CAP theorem").
      const r = evaluateTechnicalAnswer(answerText, question.expectedKeywords || []);
      score = r.score; breakdown = r.breakdown;
    } else if (question.category === "APTITUDE") {
      const r = evaluateAptitudeAnswer(answerText, question.correctAnswer, session.config?.negativeMarking);
      score = r.score; breakdown = { correct: r.correct };
    } else if (question.category === "CODING") {
      const testCases = Array.isArray(question.testCases) ? question.testCases : [];
      const judgeResult = await runQueued(() => judgeSubmission({ language, code, testCases, timeLimitMs: 3000 }));
      const r = evaluateCodingAnswer(judgeResult, code);
      score = r.score; breakdown = r.breakdown;
      immediateResult = judgeResult;
    }

    const answer = await prisma.interviewAnswer.upsert({
      where: { sessionId_questionId: { sessionId: session.id, questionId } },
      update: { answerText: answerText ?? null, code: code ?? null, language: language ?? null, skipped: !!skipped, timeTakenSec: timeTakenSec ?? null, score, breakdown: breakdown ?? undefined },
      create: { sessionId: session.id, questionId, answerText: answerText ?? null, code: code ?? null, language: language ?? null, skipped: !!skipped, timeTakenSec: timeTakenSec ?? null, score, breakdown: breakdown ?? undefined },
    });

    let followUpQuestion = null;
    try {
      const followUpQ = await maybeInsertFollowUp(session, question, answerText, skipped);
      if (followUpQ) {
        await prisma.interviewAnswer.create({ data: { sessionId: session.id, questionId: followUpQ.id, skipped: true } });
        followUpQuestion = sanitizeQuestion(followUpQ);
      }
    } catch (e) {
      console.error("follow-up insertion failed", e);
    }

    res.json({ saved: true, answer, immediateResult, followUpQuestion });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save answer" });
  }
});

// Shared by the normal finalize flow and the proctoring-violation auto-terminate path — a
// terminated session still gets a real report built from whatever was genuinely answered before
// termination (partial credit), not an empty/blank one.
async function finalizeSession(session, { status = "COMPLETED", terminationReason = null } = {}) {
  const answers = await prisma.interviewAnswer.findMany({ where: { sessionId: session.id } });
  const questions = await prisma.interviewQuestion.findMany({ where: { id: { in: answers.map((a) => a.questionId) } } });
  const answersWithQuestions = answers.map((a) => ({ ...a, question: questions.find((q) => q.id === a.questionId) || {} }));
  const built = buildInterviewReport(answersWithQuestions);

  const [updated, report] = await prisma.$transaction([
    prisma.interviewSession.update({ where: { id: session.id }, data: { status, submittedAt: new Date(), terminationReason } }),
    prisma.interviewReport.upsert({
      where: { sessionId: session.id }, update: built, create: { sessionId: session.id, studentId: session.studentId, ...built },
    }),
  ]);
  return { session: updated, report };
}

router.post("/sessions/:id/finalize", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id }, include: { report: true } });
    if (!session || session.studentId !== req.user.id) return res.status(403).json({ error: "Invalid session" });
    if (session.status !== "IN_PROGRESS") {
      return res.json({ session, report: session.report });
    }

    const { session: updated, report } = await finalizeSession(session);
    const recommendedLearning = await buildRecommendations(report.weakAreas);
    res.json({ session: updated, report, recommendedLearning });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to finalize interview" });
  }
});

// STUDENT: report a proctoring violation. `type` distinguishes what happened; `penalized`
// (client-supplied, cross-checked against a fixed server-side set below — never trust the
// client's own penalized flag) determines whether it counts toward the 3-strike auto-terminate
// threshold or is only logged for review (face missing briefly, multiple faces detected — per
// spec, "future ready, log don't penalize"). Noise/silent-environment reminders never reach this
// endpoint at all — they're pure client-side UI state, not a proctoring concern.
const PENALIZED_VIOLATION_TYPES = new Set(["TAB_SWITCH", "FULLSCREEN_EXIT", "CAMERA_DROPPED", "MIC_DROPPED"]);
router.post("/sessions/:id/violation", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.id } });
    if (!session || session.studentId !== req.user.id) return res.status(403).json({ error: "Invalid session" });
    if (session.status !== "IN_PROGRESS") {
      return res.json({ violationCount: session.violationCount, maxViolations: MAX_INTERVIEW_VIOLATIONS, terminated: session.status === "TERMINATED" });
    }

    const type = String(req.body.type || "UNKNOWN").toUpperCase().slice(0, 40);
    const penalized = PENALIZED_VIOLATION_TYPES.has(type);
    await prisma.interviewViolation.create({ data: { sessionId: session.id, type, penalized } });

    const violationCount = penalized ? session.violationCount + 1 : session.violationCount;
    if (penalized) await prisma.interviewSession.update({ where: { id: session.id }, data: { violationCount } });

    const terminated = penalized && violationCount >= MAX_INTERVIEW_VIOLATIONS;
    if (terminated) {
      await finalizeSession({ ...session, violationCount }, { status: "TERMINATED", terminationReason: "MAX_VIOLATIONS" });
    }

    res.json({ violationCount, maxViolations: MAX_INTERVIEW_VIOLATIONS, penalized, terminated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record violation" });
  }
});

// STUDENT: download the full detailed report as a PDF (questions, answers/code, per-question
// score, overall breakdown, strengths/weaknesses, improvement plan) — distinct from the
// platform-wide "Interview Ready" certificate PDF, which is a single summary document, not a
// per-session report.
router.get("/sessions/:id/report/pdf", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: req.params.id },
      include: { answers: { orderBy: { createdAt: "asc" } }, report: true },
    });
    if (!session || session.studentId !== req.user.id) return res.status(404).json({ error: "Session not found" });
    if (!session.report) return res.status(400).json({ error: "This interview hasn't been submitted yet" });

    const questions = await prisma.interviewQuestion.findMany({ where: { id: { in: session.answers.map((a) => a.questionId) } } });
    const ordered = session.answers.map((a) => ({ ...sanitizeQuestion(questions.find((q) => q.id === a.questionId) || {}), answer: a }));
    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="interview-report-${session.id.slice(0, 8)}.pdf"`);
    generateInterviewReportPdf({ studentName: student.name, session, questions: ordered, report: session.report }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate report PDF" });
  }
});

// =========================== Student: leaderboard + progress ===========================

router.get("/leaderboard", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.user.id } });
    const scope = req.query.scope || "class";
    let studentIds;
    if (scope === "institute" && student.instituteId) {
      studentIds = (await prisma.user.findMany({ where: { instituteId: student.instituteId, role: "STUDENT" }, select: { id: true } })).map((u) => u.id);
    } else if (scope === "overall") {
      studentIds = (await prisma.user.findMany({ where: { role: "STUDENT" }, select: { id: true } })).map((u) => u.id);
    } else if (student.classId) {
      studentIds = (await prisma.user.findMany({ where: { classId: student.classId, role: "STUDENT" }, select: { id: true } })).map((u) => u.id);
    } else {
      return res.json([]);
    }

    const reports = await prisma.interviewReport.findMany({
      where: { studentId: { in: studentIds }, session: { category: "APTITUDE" } },
      select: { studentId: true, overallScore: true },
    });
    const sums = new Map(), counts = new Map();
    for (const r of reports) {
      sums.set(r.studentId, (sums.get(r.studentId) || 0) + r.overallScore);
      counts.set(r.studentId, (counts.get(r.studentId) || 0) + 1);
    }
    const students = await prisma.user.findMany({ where: { id: { in: [...sums.keys()] } }, select: { id: true, name: true } });
    const nameMap = new Map(students.map((s) => [s.id, s.name]));

    const rows = [...sums.entries()]
      .map(([id, sum]) => ({ studentId: id, name: nameMap.get(id) || "—", averageScore: Math.round(sum / counts.get(id)), attempts: counts.get(id) }))
      .sort((a, b) => b.averageScore - a.averageScore)
      .slice(0, 50)
      .map((r, i) => ({ rank: i + 1, ...r }));

    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

router.get("/progress", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const reports = await prisma.interviewReport.findMany({
      where: { studentId: req.user.id },
      include: { session: { select: { category: true, isMock: true, submittedAt: true } } },
      orderBy: { createdAt: "asc" },
    });

    const weekly = new Map(), monthly = new Map();
    for (const r of reports) {
      const d = new Date(r.createdAt);
      const weekKey = `${d.getFullYear()}-W${String(Math.ceil(d.getDate() / 7)).padStart(2, "0")}-${d.getMonth() + 1}`;
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      for (const [map, key] of [[weekly, weekKey], [monthly, monthKey]]) {
        if (!map.has(key)) map.set(key, { sum: 0, count: 0 });
        const cur = map.get(key);
        cur.sum += r.overallScore; cur.count++;
      }
    }
    const toSeries = (map) => [...map.entries()].map(([period, { sum, count }]) => ({ period, averageScore: Math.round(sum / count), count }));

    res.json({
      weekly: toSeries(weekly),
      monthly: toSeries(monthly),
      history: reports.map((r) => ({ date: r.createdAt, score: r.overallScore, category: r.session?.category, isMock: r.session?.isMock })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load progress" });
  }
});

// =========================== Question bank (read, any authenticated) ===========================

router.get("/subjects", authenticate, async (req, res) => {
  const rows = await prisma.interviewQuestion.groupBy({ by: ["category", "subject"], where: { isActive: true, generatedForStudentId: null } });
  const bySubject = {};
  for (const r of rows) {
    if (!r.subject) continue;
    (bySubject[r.category] = bySubject[r.category] || []).push(r.subject);
  }
  res.json(bySubject);
});

// Companies with at least one seeded question — the hub only offers a company as a filter
// option once real content exists for it, rather than listing all 12 named in the spec
// regardless of whether any have been seeded/added yet.
router.get("/companies", authenticate, async (req, res) => {
  const rows = await prisma.interviewQuestion.groupBy({
    by: ["company"], where: { isActive: true, generatedForStudentId: null, company: { not: null } },
    _count: { _all: true },
  });
  res.json(rows.map((r) => ({ company: r.company, questionCount: r._count._all })).sort((a, b) => a.company.localeCompare(b.company)));
});

// =========================== Certificate ===========================

async function computeAverageInterviewScore(studentId) {
  const reports = await prisma.interviewReport.findMany({ where: { studentId }, select: { overallScore: true } });
  if (reports.length === 0) return null;
  return Math.round(reports.reduce((s, r) => s + r.overallScore, 0) / reports.length);
}

async function issueOrFetchCertificate(studentId, avg) {
  let cert = await prisma.interviewCertificate.findUnique({ where: { studentId } });
  if (!cert) {
    const code = `CA-INTERVIEW-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    cert = await prisma.interviewCertificate.create({ data: { certificateCode: code, studentId, averageScore: avg } });
  }
  return cert;
}

router.get("/certificate", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const avg = await computeAverageInterviewScore(req.user.id);
    if (avg === null || avg < CERT_THRESHOLD) {
      return res.status(400).json({ error: `Complete more interviews and reach an average score of ${CERT_THRESHOLD}% to earn this certificate`, currentAverage: avg });
    }
    const cert = await issueOrFetchCertificate(req.user.id, avg);
    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    res.json({ ...cert, studentName: student.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load certificate" });
  }
});

router.get("/certificate/pdf", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const avg = await computeAverageInterviewScore(req.user.id);
    if (avg === null || avg < CERT_THRESHOLD) return res.status(400).json({ error: "Certificate not yet earned" });
    const cert = await issueOrFetchCertificate(req.user.id, avg);
    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="interview-ready-certificate.pdf"`);
    await generateInterviewCertificatePdf({
      studentName: student.name, averageScore: cert.averageScore, certificateCode: cert.certificateCode,
      issuedAt: cert.issuedAt, verifyUrl: `${FRONTEND_URL}/interview/verify/${cert.certificateCode}`,
    }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate certificate" });
  }
});

// PUBLIC (no auth) — scanned via the certificate's QR code to confirm authenticity.
router.get("/certificate/verify/:code", async (req, res) => {
  try {
    const cert = await prisma.interviewCertificate.findUnique({
      where: { certificateCode: req.params.code },
      include: { student: { select: { name: true } } },
    });
    if (!cert) return res.status(404).json({ valid: false });
    res.json({ valid: true, studentName: cert.student.name, averageScore: cert.averageScore, issuedAt: cert.issuedAt, certificateCode: cert.certificateCode });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, error: "Verification failed" });
  }
});

// =========================== Admin/Staff: question bank CMS ===========================

router.get("/admin/questions", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const where = { generatedForStudentId: null };
  if (req.query.category) where.category = req.query.category;
  if (req.query.subject) where.subject = req.query.subject;
  const questions = await prisma.interviewQuestion.findMany({ where, orderBy: { createdAt: "desc" } });
  res.json(questions);
});

router.post("/admin/questions", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { category, subject, company, aptitudeCategory, difficulty, prompt, expectedKeywords, modelAnswer, options, correctAnswer, explanation, starterCode, testCases, language, followUpQuestionId } = req.body;
    if (!category || !prompt) return res.status(400).json({ error: "category and prompt are required" });
    const q = await prisma.interviewQuestion.create({
      data: {
        category, subject: subject || null, company: company || null, aptitudeCategory: aptitudeCategory || null, difficulty: difficulty || "EASY",
        prompt, expectedKeywords: expectedKeywords ?? undefined, modelAnswer: modelAnswer || null,
        options: options ?? undefined, correctAnswer: correctAnswer ?? undefined, explanation: explanation || null,
        starterCode: starterCode || null, testCases: testCases ?? undefined, language: language || null,
        followUpQuestionId: followUpQuestionId || null,
      },
    });
    res.json(q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create question" });
  }
});

router.patch("/admin/questions/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const fields = ["category", "subject", "company", "aptitudeCategory", "difficulty", "prompt", "expectedKeywords", "modelAnswer", "options", "correctAnswer", "explanation", "starterCode", "testCases", "language", "isActive", "followUpQuestionId"];
    const data = {};
    for (const f of fields) if (req.body[f] !== undefined) data[f] = f === "isActive" ? !!req.body[f] : req.body[f];
    const q = await prisma.interviewQuestion.update({ where: { id: req.params.id }, data });
    res.json(q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update question" });
  }
});

router.delete("/admin/questions/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    await prisma.interviewQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete question" });
  }
});

router.get("/admin/questions/export", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const where = { generatedForStudentId: null };
  if (req.query.category) where.category = req.query.category;
  const questions = await prisma.interviewQuestion.findMany({ where });
  const rows = questions.map((q) => ({
    category: q.category, subject: q.subject || "", company: q.company || "", aptitudeCategory: q.aptitudeCategory || "", difficulty: q.difficulty,
    prompt: q.prompt, expectedKeywords: Array.isArray(q.expectedKeywords) ? q.expectedKeywords.join("|") : "",
    modelAnswer: q.modelAnswer || "", options: Array.isArray(q.options) ? q.options.join("|") : "",
    correctAnswer: q.correctAnswer ?? "", explanation: q.explanation || "", starterCode: q.starterCode || "",
    testCases: Array.isArray(q.testCases) ? JSON.stringify(q.testCases) : "", language: q.language || "",
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(sheet);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="interview-questions${req.query.category ? `-${req.query.category}` : ""}.csv"`);
  res.send(csv);
});

// ADMIN/STAFF: bulk-import questions from a .csv/.xlsx file. expectedKeywords/options are
// pipe-separated ("java|jvm|bytecode"); testCases is a JSON array string.
router.post("/admin/questions/import", authenticate, requireRole("ADMIN", "STAFF"), upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      return res.status(400).json({ error: "Could not read this file. Please upload a valid .csv or .xlsx file." });
    }
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
    if (rows.length === 0) return res.status(400).json({ error: "The uploaded file has no data rows." });

    let created = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2;
      const category = String(row.category || "").trim().toUpperCase();
      if (!VALID_CATEGORIES.includes(category)) {
        errors.push({ row: rowNum, reason: `Invalid category "${row.category}"` });
        continue;
      }
      if (!row.prompt) {
        errors.push({ row: rowNum, reason: "Missing prompt" });
        continue;
      }
      try {
        await prisma.interviewQuestion.create({
          data: {
            category, subject: row.subject || null, company: row.company || null, aptitudeCategory: row.aptitudeCategory || null,
            difficulty: ["EASY", "MEDIUM", "HARD"].includes(String(row.difficulty || "").toUpperCase()) ? String(row.difficulty).toUpperCase() : "EASY",
            prompt: row.prompt,
            expectedKeywords: row.expectedKeywords ? String(row.expectedKeywords).split("|").map((s) => s.trim()).filter(Boolean) : undefined,
            modelAnswer: row.modelAnswer || null,
            options: row.options ? String(row.options).split("|").map((s) => s.trim()).filter(Boolean) : undefined,
            correctAnswer: row.correctAnswer !== "" && row.correctAnswer !== undefined ? Number(row.correctAnswer) : undefined,
            explanation: row.explanation || null, starterCode: row.starterCode || null,
            testCases: row.testCases ? (() => { try { return JSON.parse(row.testCases); } catch { return undefined; } })() : undefined,
            language: row.language || null,
          },
        });
        created++;
      } catch {
        errors.push({ row: rowNum, reason: "Failed to create" });
      }
    }
    res.json({ total: rows.length, created, errorCount: errors.length, errors });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Import failed" });
  }
});

// =========================== Admin/Staff: reports + analytics ===========================

router.get("/admin/stats", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const where = req.requesterInstituteId ? { instituteId: req.requesterInstituteId, role: "STUDENT" } : { role: "STUDENT" };
    const students = await prisma.user.findMany({ where, select: { id: true } });
    const ids = students.map((s) => s.id);
    if (ids.length === 0) return res.json({ totalStudents: 0, studentsParticipated: 0, completionPercent: 0, totalSessions: 0, completedSessions: 0, averageScore: 0, totalQuestions: 0 });

    const [totalSessions, completedSessions, avgAgg, questionCount, participated] = await Promise.all([
      prisma.interviewSession.count({ where: { studentId: { in: ids } } }),
      prisma.interviewSession.count({ where: { studentId: { in: ids }, status: "COMPLETED" } }),
      prisma.interviewReport.aggregate({ where: { studentId: { in: ids } }, _avg: { overallScore: true } }),
      prisma.interviewQuestion.count({ where: { generatedForStudentId: null } }),
      prisma.interviewSession.findMany({ where: { studentId: { in: ids } }, select: { studentId: true }, distinct: ["studentId"] }),
    ]);

    res.json({
      totalStudents: ids.length,
      studentsParticipated: participated.length,
      completionPercent: Math.round((participated.length / ids.length) * 100),
      totalSessions, completedSessions,
      averageScore: Math.round(avgAgg._avg.overallScore || 0),
      totalQuestions: questionCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load interview stats" });
  }
});

router.get("/admin/students", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const where = req.requesterInstituteId ? { instituteId: req.requesterInstituteId, role: "STUDENT" } : { role: "STUDENT" };
    const students = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, rollNumber: true } });
    const reports = students.length
      ? await prisma.interviewReport.findMany({ where: { studentId: { in: students.map((s) => s.id) } }, select: { studentId: true, overallScore: true } })
      : [];
    const sums = new Map(), counts = new Map();
    for (const r of reports) {
      sums.set(r.studentId, (sums.get(r.studentId) || 0) + r.overallScore);
      counts.set(r.studentId, (counts.get(r.studentId) || 0) + 1);
    }
    const rows = students
      .map((s) => ({
        studentId: s.id, name: s.name, email: s.email, rollNumber: s.rollNumber,
        sessionsCompleted: counts.get(s.id) || 0,
        averageScore: counts.has(s.id) ? Math.round(sums.get(s.id) / counts.get(s.id)) : 0,
      }))
      .sort((a, b) => b.averageScore - a.averageScore);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load student list" });
  }
});

// ADMIN/STAFF: which topics show up as "weak areas" most often across all reports — the
// signal an admin actually needs to decide what to update in the question bank next.
router.get("/admin/weak-topics", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const where = req.requesterInstituteId ? { instituteId: req.requesterInstituteId, role: "STUDENT" } : { role: "STUDENT" };
    const students = await prisma.user.findMany({ where, select: { id: true } });
    const ids = students.map((s) => s.id);
    const reports = ids.length ? await prisma.interviewReport.findMany({ where: { studentId: { in: ids } }, select: { weakAreas: true, strongAreas: true } }) : [];

    const weakCounts = new Map();
    for (const r of reports) {
      for (const area of r.weakAreas || []) weakCounts.set(area, (weakCounts.get(area) || 0) + 1);
    }
    const topics = [...weakCounts.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    res.json({ totalReports: reports.length, topics });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load weak-topic analytics" });
  }
});

router.get("/admin/students/:studentId/sessions", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const target = await prisma.user.findUnique({ where: { id: req.params.studentId } });
    if (!target || target.role !== "STUDENT") return res.status(404).json({ error: "Student not found" });
    if (req.requesterInstituteId && target.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only view students under your own institute" });
    }
    const sessions = await prisma.interviewSession.findMany({
      where: { studentId: req.params.studentId, status: { in: ["COMPLETED", "TERMINATED"] } },
      include: { report: true },
      orderBy: { submittedAt: "desc" },
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load student sessions" });
  }
});

// ADMIN/STAFF: event-level proctoring log for one session — for reviewing exactly what
// happened during a TERMINATED (or any) interview, not just the final violation count.
router.get("/admin/sessions/:sessionId/violations", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const session = await prisma.interviewSession.findUnique({ where: { id: req.params.sessionId }, include: { student: true } });
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (req.requesterInstituteId && session.student.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only view students under your own institute" });
    }
    const violations = await prisma.interviewViolation.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: "asc" } });
    res.json(violations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load violation log" });
  }
});

module.exports = router;

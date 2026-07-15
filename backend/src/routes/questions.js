const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// null requesterInstituteId (the seeded platform-level Super Admin) sees every institute's
// questions/folders unfiltered. An institute-scoped requester sees their own institute's rows
// PLUS legacy/shared rows (instituteId: null) — see the schema comment on Question.instituteId
// for why nulls stay visible rather than becoming invisible to everyone but the Super Admin.
function instituteVisibilityWhere(requesterInstituteId) {
  return requesterInstituteId ? { OR: [{ instituteId: requesterInstituteId }, { instituteId: null }] } : {};
}

// Ownership check for writes: a null requesterInstituteId (Super Admin) may edit anything; an
// institute-scoped requester may only touch rows already scoped to their own institute (not even
// legacy null-instituteId rows — editing/deleting shared legacy content is Super Admin-only, to
// avoid one institute silently mutating content every other institute currently sees).
function ownsRow(requesterInstituteId, row) {
  return !requesterInstituteId || row.instituteId === requesterInstituteId;
}

const QUESTION_TYPES = ["CODING", "MCQ", "TRUE_FALSE", "MULTISELECT"];
const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"];

const TEMPLATE_HEADERS = [
  "Question Name", "Subject", "Topic", "Question Text", "Question Type",
  "Options", "Correct Answer", "Marks", "Difficulty Level", "Explanation",
];

// Normalizes/validates the type-specific fields (options + correctAnswer) for
// MCQ / TRUE_FALSE / MULTISELECT questions. Returns { options, correctAnswer }
// or throws a descriptive error.
function normalizeOptions(questionType, rawOptions, rawCorrectAnswer) {
  if (questionType === "TRUE_FALSE") {
    const options = ["True", "False"];
    const idx = normalizeCorrectIndices(rawCorrectAnswer, options, false)[0];
    if (idx === undefined) throw new Error("True/False questions need a correct answer of True or False");
    return { options, correctAnswer: [idx] };
  }

  const options = (Array.isArray(rawOptions) ? rawOptions : [])
    .map((o) => String(o ?? "").trim())
    .filter(Boolean);
  if (options.length < 2) throw new Error("Provide at least 2 options");

  const isMulti = questionType === "MULTISELECT";
  const correctAnswer = normalizeCorrectIndices(rawCorrectAnswer, options, isMulti);
  if (correctAnswer.length === 0) throw new Error("Select at least one correct answer");
  if (!isMulti && correctAnswer.length > 1) throw new Error("Multiple Choice questions can only have one correct answer");

  return { options, correctAnswer };
}

// Accepts correctAnswer as an array of 0-based indices (from the app UI) or
// as text (from spreadsheet import: option text or 1-based numbers, comma/pipe separated).
function normalizeCorrectIndices(raw, options, isMulti) {
  let tokens;
  if (Array.isArray(raw)) {
    tokens = raw;
  } else {
    tokens = String(raw ?? "").split(/[,|]/).map((s) => s.trim()).filter(Boolean);
  }

  const indices = tokens
    .map((t) => {
      if (typeof t === "number") return t;
      const s = String(t).trim();
      if (/^\d+$/.test(s)) {
        const n = Number(s);
        // Heuristic: treat as a 1-based option number if in range, else 0-based index
        if (n >= 1 && n <= options.length) return n - 1;
        if (n >= 0 && n < options.length) return n;
        return -1;
      }
      return options.findIndex((o) => o.trim().toLowerCase() === s.toLowerCase());
    })
    .filter((i) => i >= 0 && i < options.length);

  const unique = [...new Set(indices)];
  return isMulti ? unique : unique.slice(0, 1);
}

function buildWhere(query, requesterInstituteId) {
  const where = { AND: [instituteVisibilityWhere(requesterInstituteId)] };
  if (query.subject) where.subject = query.subject;
  if (query.topic) where.topic = query.topic;
  if (query.difficulty && DIFFICULTIES.includes(query.difficulty)) where.difficulty = query.difficulty;
  if (query.questionType && QUESTION_TYPES.includes(query.questionType)) where.questionType = query.questionType;
  if (query.folderId === "__none__") where.folderId = null;
  else if (query.folderId) where.folderId = query.folderId;
  if (query.createdById) where.createdById = query.createdById;
  if (query.q) {
    where.AND.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { subject: { contains: query.q, mode: "insensitive" } },
        { topic: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  return where;
}

// Create a question (any type)
router.post("/", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const {
      title, description, subject, topic, questionType, difficulty, points, explanation,
      timeLimitMs, starterCode, testCases, options, correctAnswer, folderId,
    } = req.body;

    if (!description) return res.status(400).json({ error: "Question text is required" });
    const type = QUESTION_TYPES.includes(questionType) ? questionType : "CODING";

    if (folderId) {
      const folder = await prisma.questionFolder.findUnique({ where: { id: folderId } });
      if (!folder || !ownsRow(req.requesterInstituteId, folder)) {
        return res.status(403).json({ error: "That folder isn't in your institute's question bank" });
      }
    }

    const data = {
      title: title || null,
      description,
      subject: subject || null,
      topic: topic || null,
      questionType: type,
      difficulty: difficulty || "EASY",
      points: points ?? 10,
      explanation: explanation || null,
      instituteId: req.requesterInstituteId,
      folderId: folderId || null,
      createdById: req.user.id,
    };

    if (type === "CODING") {
      const cases = testCases || [];
      // Every coding question needs both — visible samples for the student-facing Run button,
      // and hidden cases the final Submit score is actually based on (see gradeAttempt.js /
      // gradeModuleCodingAttempt.js). Mirrors the same requirement already enforced on
      // Module Coding Test questions in moduleCoding.js.
      if (cases.filter((tc) => !tc.isHidden).length < 2) {
        return res.status(400).json({ error: "Each coding question needs at least 2 visible sample test cases" });
      }
      if (cases.filter((tc) => tc.isHidden).length < 2) {
        return res.status(400).json({ error: "Each coding question needs at least 2 hidden test cases for final evaluation" });
      }
      data.timeLimitMs = timeLimitMs ?? 2000;
      data.starterCode = starterCode || "";
      data.testCases = {
        create: cases.map((tc) => ({
          input: tc.input,
          expected: tc.expected,
          isHidden: tc.isHidden ?? true,
        })),
      };
    } else {
      const normalized = normalizeOptions(type, options, correctAnswer);
      data.options = normalized.options;
      data.correctAnswer = normalized.correctAnswer;
    }

    const question = await prisma.question.create({ data, include: { testCases: true } });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to create question" });
  }
});

// Question Bank: list with search + filters. Paginated — an institute's bank can run into the
// thousands of questions, and rendering/transferring the whole thing on every load doesn't scale.
router.get("/", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const where = buildWhere(req.query, req.requesterInstituteId);
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(500, Math.max(1, Number(req.query.pageSize) || 100));
  const [questions, total] = await Promise.all([
    prisma.question.findMany({
      where,
      include: { _count: { select: { testCases: true } }, createdBy: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.question.count({ where }),
  ]);
  res.json({ rows: questions, page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
});

// Distinct subjects/topics/creators — powers the filter dropdowns. Scoped the same way the list
// is, so the dropdowns never surface a value that only exists in another institute's bank.
router.get("/meta/filters", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const visible = instituteVisibilityWhere(req.requesterInstituteId);
  const [subjects, topics, creatorIds] = await Promise.all([
    prisma.question.findMany({ where: { ...visible, subject: { not: null } }, select: { subject: true }, distinct: ["subject"] }),
    prisma.question.findMany({ where: { ...visible, topic: { not: null } }, select: { topic: true }, distinct: ["topic"] }),
    prisma.question.findMany({ where: { ...visible, createdById: { not: null } }, select: { createdById: true }, distinct: ["createdById"] }),
  ]);
  const creators = creatorIds.length
    ? await prisma.user.findMany({ where: { id: { in: creatorIds.map((c) => c.createdById) } }, select: { id: true, name: true } })
    : [];
  res.json({
    subjects: subjects.map((s) => s.subject).filter(Boolean).sort(),
    topics: topics.map((t) => t.topic).filter(Boolean).sort(),
    creators: creators.sort((a, b) => a.name.localeCompare(b.name)),
  });
});

// =========================== Question Bank folders ===========================
// Defined before the generic "/:id" route below so Express doesn't match "/folders" as an id.
// Folders nest via parentId (e.g. "Fox Solutions" > "Aptitude" > "Percentages") — the frontend
// builds the tree client-side from this flat list plus each row's parentId.

router.get("/folders", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const folders = await prisma.questionFolder.findMany({
    where: instituteVisibilityWhere(req.requesterInstituteId),
    include: { _count: { select: { questions: true, children: true } } },
    orderBy: { name: "asc" },
  });
  res.json(folders);
});

router.post("/folders", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (!name) return res.status(400).json({ error: "Folder name is required" });
  const { category, description, parentId } = req.body;
  if (parentId) {
    const parent = await prisma.questionFolder.findUnique({ where: { id: parentId } });
    if (!parent || !ownsRow(req.requesterInstituteId, parent)) {
      return res.status(403).json({ error: "That parent folder isn't in your institute's question bank" });
    }
  }
  try {
    const folder = await prisma.questionFolder.create({
      data: { name, category: category || null, description: description || null, parentId: parentId || null, instituteId: req.requesterInstituteId },
    });
    res.json(folder);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A folder with this name already exists" });
    console.error(err);
    res.status(500).json({ error: "Failed to create folder" });
  }
});

router.patch("/folders/:id", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const folder = await prisma.questionFolder.findUnique({ where: { id: req.params.id } });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  if (!ownsRow(req.requesterInstituteId, folder)) return res.status(403).json({ error: "Not your institute's folder" });
  const data = {};
  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim();
    if (!name) return res.status(400).json({ error: "Folder name is required" });
    data.name = name;
  }
  if (req.body.category !== undefined) data.category = req.body.category || null;
  if (req.body.description !== undefined) data.description = req.body.description || null;
  if (req.body.parentId !== undefined) {
    if (req.body.parentId === folder.id) return res.status(400).json({ error: "A folder can't be its own parent" });
    data.parentId = req.body.parentId || null;
  }
  try {
    const updated = await prisma.questionFolder.update({ where: { id: folder.id }, data });
    res.json(updated);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A folder with this name already exists" });
    console.error(err);
    res.status(500).json({ error: "Failed to update folder" });
  }
});

// Requires the folder to be empty (no questions, no child folders) — admins move or merge its
// contents out first. Replaces the earlier "un-file everything on delete" behavior: a silent
// cascade is surprising for a management action explicitly scoped to "delete EMPTY banks."
router.delete("/folders/:id", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const folder = await prisma.questionFolder.findUnique({
    where: { id: req.params.id },
    include: { _count: { select: { questions: true, children: true } } },
  });
  if (!folder) return res.status(404).json({ error: "Folder not found" });
  if (!ownsRow(req.requesterInstituteId, folder)) return res.status(403).json({ error: "Not your institute's folder" });
  if (folder._count.questions > 0 || folder._count.children > 0) {
    return res.status(409).json({ error: "This folder isn't empty — move or merge its questions and sub-folders first." });
  }
  await prisma.questionFolder.delete({ where: { id: folder.id } });
  res.json({ success: true });
});

// Merge :id (source) into targetId — reassigns all of source's questions and direct child
// folders to the target, then deletes source. Used to consolidate near-duplicate banks
// (e.g. two folders both named roughly "Java Basics" created by different staff).
router.post("/folders/:id/merge", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const sourceId = req.params.id;
  const targetId = req.body.targetId;
  if (!targetId || targetId === sourceId) return res.status(400).json({ error: "Choose a different target folder to merge into" });
  const [source, target] = await Promise.all([
    prisma.questionFolder.findUnique({ where: { id: sourceId } }),
    prisma.questionFolder.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) return res.status(404).json({ error: "Folder not found" });
  if (!ownsRow(req.requesterInstituteId, source) || !ownsRow(req.requesterInstituteId, target)) {
    return res.status(403).json({ error: "Not your institute's folder" });
  }
  await prisma.$transaction([
    prisma.question.updateMany({ where: { folderId: sourceId }, data: { folderId: targetId } }),
    prisma.questionFolder.updateMany({ where: { parentId: sourceId }, data: { parentId: targetId } }),
    prisma.questionFolder.delete({ where: { id: sourceId } }),
  ]);
  res.json({ success: true });
});

// Bulk-move: file multiple existing questions into a folder (or clear to Uncategorized) in one
// call — the running-list counterpart to per-question folderId edits via PATCH /questions/:id.
router.post("/bulk-move", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const questionIds = Array.isArray(req.body.questionIds) ? req.body.questionIds : [];
  if (questionIds.length === 0) return res.status(400).json({ error: "No questions selected" });
  const folderId = req.body.folderId || null;
  if (folderId) {
    const folder = await prisma.questionFolder.findUnique({ where: { id: folderId } });
    if (!folder || !ownsRow(req.requesterInstituteId, folder)) {
      return res.status(403).json({ error: "That folder isn't in your institute's question bank" });
    }
  }
  const owned = await prisma.question.findMany({ where: { id: { in: questionIds } } });
  const movableIds = owned.filter((q) => ownsRow(req.requesterInstituteId, q)).map((q) => q.id);
  if (movableIds.length === 0) return res.status(403).json({ error: "None of the selected questions are in your institute's question bank" });
  await prisma.question.updateMany({ where: { id: { in: movableIds } }, data: { folderId } });
  res.json({ movedCount: movableIds.length, skippedCount: questionIds.length - movableIds.length });
});

// Download a sample .xlsx template for bulk question import (quiz types only)
router.get("/bulk-template", authenticate, requireRole("ADMIN", "STAFF"), (req, res) => {
  const sampleRows = [
    ["Capital of France", "Geography", "Europe", "What is the capital of France?", "Multiple Choice", "Paris|London|Berlin|Madrid", "Paris", 5, "Easy", "Paris has been the capital since 987 AD."],
    ["Water boils at 100C", "Science", "Physics", "Water boils at 100°C at sea level.", "True/False", "", "True", 2, "Easy", ""],
    ["Prime numbers", "Math", "Number Theory", "Which of the following are prime numbers?", "Multiple Select", "2|3|4|9", "2,3", 5, "Medium", "2 and 3 are prime; 4 and 9 are not."],
  ];
  const sheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...sampleRows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Questions");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=question-bank-template.xlsx");
  res.send(buffer);
});

// Export the current (optionally filtered) question bank to .xlsx
router.get("/export", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const questions = await prisma.question.findMany({ where: buildWhere(req.query, req.requesterInstituteId), orderBy: { questionNumber: "asc" } });

  const rows = questions.map((q) => {
    const options = Array.isArray(q.options) ? q.options : [];
    const correctAnswer = Array.isArray(q.correctAnswer) ? q.correctAnswer : [];
    return [
      `Q${q.questionNumber}`,
      q.title || "",
      q.subject || "",
      q.topic || "",
      q.description,
      TYPE_LABELS[q.questionType] || q.questionType,
      options.join("|"),
      correctAnswer.map((i) => options[i]).filter(Boolean).join(","),
      q.points,
      DIFFICULTY_LABELS[q.difficulty] || q.difficulty,
      q.explanation || "",
    ];
  });

  const sheet = XLSX.utils.aoa_to_sheet([["Question ID", ...TEMPLATE_HEADERS], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Questions");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=question-bank-export.xlsx");
  res.send(buffer);
});

const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };
const DIFFICULTY_LABELS = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const TYPE_ALIASES = {
  "multiple choice": "MCQ", mcq: "MCQ",
  "true false": "TRUE_FALSE", "true/false": "TRUE_FALSE", truefalse: "TRUE_FALSE",
  "multiple select": "MULTISELECT", "multi select": "MULTISELECT", multiselect: "MULTISELECT",
  coding: "CODING",
};
const DIFFICULTY_ALIASES = { easy: "EASY", medium: "MEDIUM", hard: "HARD" };

const IMPORT_HEADER_ALIASES = {
  title: ["question name", "name"],
  subject: ["subject"],
  topic: ["topic"],
  description: ["question text", "question", "text"],
  questionType: ["question type", "type"],
  options: ["options"],
  correctAnswer: ["correct answer", "answer"],
  points: ["marks", "points"],
  difficulty: ["difficulty level", "difficulty"],
  explanation: ["explanation"],
};

function normalizeHeader(str) {
  return String(str || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function buildHeaderMap(headers) {
  const map = {};
  for (const header of headers) {
    const norm = normalizeHeader(header);
    for (const [field, aliases] of Object.entries(IMPORT_HEADER_ALIASES)) {
      if (!map[field] && aliases.includes(norm)) map[field] = header;
    }
  }
  return map;
}

// Bulk-import quiz questions (MCQ / True-False / Multiple Select) from .xlsx/.csv.
// Coding questions aren't supported via spreadsheet import — their test cases
// don't map cleanly to flat rows — use the question form for those.
//
// Optional `folderId` in the request body files every created question into that folder (the
// "Save uploaded questions to Question Bank" checkbox on the test-creation page) — the questions
// are always persisted as real rows either way (they have to exist to be attachable to a test),
// omitting folderId just leaves them unfiled rather than skipping creation.
router.post("/bulk-import", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const folderId = req.body.folderId || null;
    if (folderId) {
      const folder = await prisma.questionFolder.findUnique({ where: { id: folderId } });
      if (!folder || !ownsRow(req.requesterInstituteId, folder)) {
        return res.status(403).json({ error: "That folder isn't in your institute's question bank" });
      }
    }

    let workbook;
    try {
      workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    } catch {
      return res.status(400).json({ error: "Could not read this file. Please upload a valid .xlsx or .csv file." });
    }

    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = sheet ? XLSX.utils.sheet_to_json(sheet, { defval: "" }) : [];
    if (rows.length === 0) return res.status(400).json({ error: "The uploaded file has no data rows." });

    const headerMap = buildHeaderMap(Object.keys(rows[0]));
    if (!headerMap.description || !headerMap.questionType) {
      return res.status(400).json({ error: "Missing required columns. The file must include Question Text and Question Type." });
    }

    const field = (row, key) => (headerMap[key] ? String(row[headerMap[key]] ?? "").trim() : "");
    const created = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const rowNum = i + 2;
      const row = rows[i];
      const title = field(row, "title");
      const description = field(row, "description");
      const typeRaw = field(row, "questionType");

      if (!title && !description && !typeRaw) continue; // blank row

      if (!description) {
        errors.push({ row: rowNum, reason: "Missing Question Text" });
        continue;
      }
      const questionType = TYPE_ALIASES[normalizeHeader(typeRaw)];
      if (!questionType) {
        errors.push({ row: rowNum, reason: `Unrecognized Question Type "${typeRaw}"` });
        continue;
      }
      if (questionType === "CODING") {
        errors.push({ row: rowNum, reason: "Coding questions can't be bulk-imported — use the question form" });
        continue;
      }

      const subject = field(row, "subject");
      const topic = field(row, "topic");
      const optionsRaw = field(row, "options").split("|").map((s) => s.trim()).filter(Boolean);
      const correctAnswerRaw = field(row, "correctAnswer");
      const pointsRaw = field(row, "points");
      const difficultyRaw = field(row, "difficulty");
      const explanation = field(row, "explanation");

      try {
        const normalized = normalizeOptions(questionType, optionsRaw, correctAnswerRaw);
        const question = await prisma.question.create({
          data: {
            title: title || null,
            description,
            subject: subject || null,
            topic: topic || null,
            questionType,
            difficulty: DIFFICULTY_ALIASES[normalizeHeader(difficultyRaw)] || "EASY",
            points: Number(pointsRaw) || 10,
            explanation: explanation || null,
            options: normalized.options,
            correctAnswer: normalized.correctAnswer,
            instituteId: req.requesterInstituteId,
            folderId,
            createdById: req.user.id,
          },
        });
        created.push(question);
      } catch (err) {
        errors.push({ row: rowNum, reason: err.message || "Failed to create question" });
      }
    }

    res.json({ total: rows.length, createdCount: created.length, errorCount: errors.length, errors, created });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Bulk import failed" });
  }
});

router.get("/:id", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  const question = await prisma.question.findUnique({
    where: { id: req.params.id },
    include: { testCases: true },
  });
  // 404 (not 403) on a cross-institute id — doesn't confirm whether the id exists at all,
  // consistent with how the list endpoint already just omits rows it can't show.
  if (!question || !ownsRow(req.requesterInstituteId, question)) return res.status(404).json({ error: "Question not found" });
  res.json(question);
});

// Edit a question (any type)
router.patch("/:id", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing || !ownsRow(req.requesterInstituteId, existing)) return res.status(404).json({ error: "Question not found" });

    const {
      title, description, subject, topic, questionType, difficulty, points, explanation,
      timeLimitMs, starterCode, testCases, options, correctAnswer, folderId,
    } = req.body;

    if (folderId !== undefined && folderId !== null && folderId !== existing.folderId) {
      const folder = await prisma.questionFolder.findUnique({ where: { id: folderId } });
      if (!folder || !ownsRow(req.requesterInstituteId, folder)) {
        return res.status(403).json({ error: "That folder isn't in your institute's question bank" });
      }
    }

    const type = QUESTION_TYPES.includes(questionType) ? questionType : existing.questionType;

    const data = {
      title: title ?? existing.title,
      description: description ?? existing.description,
      subject: subject ?? existing.subject,
      topic: topic ?? existing.topic,
      questionType: type,
      difficulty: difficulty || existing.difficulty,
      points: points ?? existing.points,
      explanation: explanation ?? existing.explanation,
      folderId: folderId !== undefined ? folderId : existing.folderId,
    };

    if (type === "CODING") {
      data.timeLimitMs = timeLimitMs ?? existing.timeLimitMs;
      data.starterCode = starterCode ?? existing.starterCode;
      data.options = null;
      data.correctAnswer = null;
      if (testCases) {
        if (testCases.filter((tc) => !tc.isHidden).length < 2) {
          return res.status(400).json({ error: "Each coding question needs at least 2 visible sample test cases" });
        }
        if (testCases.filter((tc) => tc.isHidden).length < 2) {
          return res.status(400).json({ error: "Each coding question needs at least 2 hidden test cases for final evaluation" });
        }
        await prisma.testCase.deleteMany({ where: { questionId: existing.id } });
        data.testCases = {
          create: testCases.map((tc) => ({ input: tc.input, expected: tc.expected, isHidden: tc.isHidden ?? true })),
        };
      }
    } else {
      const normalized = normalizeOptions(type, options ?? existing.options, correctAnswer ?? existing.correctAnswer);
      data.options = normalized.options;
      data.correctAnswer = normalized.correctAnswer;
    }

    const question = await prisma.question.update({ where: { id: existing.id }, data, include: { testCases: true } });
    res.json(question);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || "Failed to update question" });
  }
});

router.delete("/:id", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const existing = await prisma.question.findUnique({ where: { id: req.params.id } });
    if (!existing || !ownsRow(req.requesterInstituteId, existing)) return res.status(404).json({ error: "Question not found" });
    await prisma.question.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2003" || err.code === "P2014") {
      return res.status(409).json({ error: "This question is used in one or more tests and can't be deleted." });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to delete question" });
  }
});

module.exports = router;

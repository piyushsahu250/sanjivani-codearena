const express = require("express");
const rateLimit = require("express-rate-limit");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { judgeSubmission } = require("../utils/judge");
const { runQueued } = require("../utils/queue");
const { generateCertificatePdf } = require("../utils/certificatePdf");

const router = express.Router();

const runLimiter = rateLimit({ windowMs: 60 * 1000, max: 20, keyGenerator: (req) => req.user.id });

// Strips answer-revealing fields from a practice question before sending it to a student.
function sanitizeQuestion(q) {
  return {
    id: q.id, type: q.type, prompt: q.prompt, options: q.options,
    starterCode: q.starterCode, language: q.language, order: q.order,
  };
}

const PASS_THRESHOLD = 70; // % correct required on a module's practice test to unlock the next module

// Sequential module locking: module N is locked unless every lesson in module N-1 is
// COMPLETED (which, for that module's practice-test lesson, only happens once it's been
// passed — see POST /lessons/:id/test-submit). Once one module is locked, everything after
// it stays locked, regardless of that module's own lesson state.
async function getModuleLockMap(prisma, studentId, courseId) {
  const modules = await prisma.courseModule.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: { lessons: { select: { id: true } } },
  });
  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const progress = allLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { studentId, lessonId: { in: allLessonIds }, status: "COMPLETED" },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(progress.map((p) => p.lessonId));

  const map = new Map();
  let prevSatisfied = true; // nothing is required before the first module
  for (const m of modules) {
    const locked = !prevSatisfied;
    const moduleComplete = m.lessons.length > 0 && m.lessons.every((l) => completedSet.has(l.id));
    map.set(m.id, { locked, completed: !locked && moduleComplete });
    prevSatisfied = !locked && moduleComplete;
  }
  return map;
}

// =========================== Student-facing (read) ===========================

// Any authenticated user: list all courses (inactive ones show as "coming soon" — the
// frontend greys them out rather than hiding them, so the roadmap itself is visible).
router.get("/courses", authenticate, async (req, res) => {
  const courses = await prisma.course.findMany({ orderBy: { order: "asc" } });
  res.json(courses);
});

// Any authenticated user: one course's full module/lesson tree. For a STUDENT, each lesson
// carries their own progress status/bookmark and each module + the course carry completion
// counts, so the dashboard can render progress bars without a second round trip.
router.get("/courses/:slug", authenticate, async (req, res) => {
  const course = await prisma.course.findUnique({
    where: { slug: req.params.slug },
    include: {
      modules: {
        orderBy: { order: "asc" },
        include: { lessons: { orderBy: { order: "asc" } } },
      },
    },
  });
  if (!course) return res.status(404).json({ error: "Course not found" });

  let progressByLesson = new Map();
  let lockMap = new Map();
  let resumeLessonId = null;
  if (req.user.role === "STUDENT") {
    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const progress = await prisma.lessonProgress.findMany({
      where: { studentId: req.user.id, lessonId: { in: allLessonIds } },
    });
    progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));
    lockMap = await getModuleLockMap(prisma, req.user.id, course.id);

    // Resume pointer: the most recently touched lesson still in progress, or otherwise the
    // first lesson of the first module that isn't fully completed yet.
    const inProgress = progress
      .filter((p) => p.status === "IN_PROGRESS")
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))[0];
    if (inProgress) {
      resumeLessonId = inProgress.lessonId;
    } else {
      for (const m of course.modules) {
        const lock = lockMap.get(m.id);
        if (lock?.locked) break;
        if (!lock?.completed && m.lessons.length > 0) { resumeLessonId = m.lessons[0].id; break; }
      }
    }
  }

  let totalLessons = 0, completedLessons = 0;
  const modules = course.modules.map((m) => {
    const lock = lockMap.get(m.id) || { locked: false, completed: false };
    const lessons = m.lessons.map((l) => {
      const p = progressByLesson.get(l.id);
      totalLessons++;
      if (p?.status === "COMPLETED") completedLessons++;
      return {
        id: l.id, title: l.title, order: l.order, estimatedMinutes: l.estimatedMinutes,
        isModuleTest: l.isModuleTest,
        status: p?.status || "NOT_STARTED", bookmarked: p?.bookmarked || false,
      };
    });
    const moduleCompleted = lessons.filter((l) => l.status === "COMPLETED").length;
    return {
      id: m.id, title: m.title, description: m.description, order: m.order, lessons,
      completedCount: moduleCompleted, totalCount: lessons.length,
      locked: lock.locked, completed: lock.completed,
    };
  });

  res.json({
    course: { id: course.id, slug: course.slug, name: course.name, description: course.description, isActive: course.isActive },
    modules,
    overall: { totalLessons, completedLessons, percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0 },
    resumeLessonId,
  });
});

// Any authenticated user: single lesson detail, with prev/next lesson ids for in-course
// navigation and (for a STUDENT) their own progress record.
router.get("/lessons/:id", authenticate, async (req, res) => {
  const lesson = await prisma.lesson.findUnique({
    where: { id: req.params.id },
    include: {
      module: { include: { course: true, lessons: { orderBy: { order: "asc" } } } },
      questions: { orderBy: { order: "asc" } },
    },
  });
  if (!lesson) return res.status(404).json({ error: "Lesson not found" });

  if (req.user.role === "STUDENT") {
    const lockMap = await getModuleLockMap(prisma, req.user.id, lesson.module.courseId);
    if (lockMap.get(lesson.module.id)?.locked) {
      return res.status(403).json({ error: "This module is locked. Complete the previous module's practice test to unlock it." });
    }
  }

  const allModules = await prisma.courseModule.findMany({
    where: { courseId: lesson.module.courseId },
    orderBy: { order: "asc" },
    include: { lessons: { orderBy: { order: "asc" } } },
  });
  const flat = allModules.flatMap((m) => m.lessons.map((l) => l.id));
  const idx = flat.indexOf(lesson.id);
  const prevLessonId = idx > 0 ? flat[idx - 1] : null;
  const nextLessonId = idx >= 0 && idx < flat.length - 1 ? flat[idx + 1] : null;

  let progress = null;
  if (req.user.role === "STUDENT") {
    progress = await prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: req.user.id, lessonId: lesson.id } },
    });
    // First view: silently mark IN_PROGRESS so the course page reflects "started" without
    // requiring an explicit action.
    if (!progress) {
      progress = await prisma.lessonProgress.create({
        data: { studentId: req.user.id, lessonId: lesson.id, status: "IN_PROGRESS" },
      });
    }
  }

  res.json({
    lesson: {
      id: lesson.id, title: lesson.title, content: lesson.content,
      videoUrl: lesson.videoUrl, pdfUrl: lesson.pdfUrl, externalLinks: lesson.externalLinks,
      estimatedMinutes: lesson.estimatedMinutes, isModuleTest: lesson.isModuleTest,
    },
    module: { id: lesson.module.id, title: lesson.module.title },
    course: { id: lesson.module.course.id, slug: lesson.module.course.slug, name: lesson.module.course.name },
    prevLessonId, nextLessonId,
    progress: progress ? { status: progress.status, bookmarked: progress.bookmarked } : null,
    // Admin/Staff get full question data (correctAnswer/explanation/testCases) for the CMS
    // edit form; a Student only ever sees the sanitized, answer-free shape.
    questions: req.user.role === "STUDENT" ? lesson.questions.map(sanitizeQuestion) : lesson.questions,
  });
});

// =========================== Student progress + practice ===========================

// STUDENT: mark a lesson's status and/or bookmark. Upserts so the first call (even before
// GET /lessons/:id auto-creates an IN_PROGRESS row) still works.
router.post("/lessons/:id/progress", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const { status, bookmarked } = req.body;
    if (status && !["NOT_STARTED", "IN_PROGRESS", "COMPLETED"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    // A module's practice test can only be marked COMPLETED by passing it (POST
    // /lessons/:id/test-submit) — allowing a manual complete here would bypass the gate
    // that unlocks the next module.
    if (status === "COMPLETED" && lesson.isModuleTest) {
      return res.status(400).json({ error: "Submit the practice test to complete this lesson" });
    }

    const data = {};
    if (status) {
      data.status = status;
      data.completedAt = status === "COMPLETED" ? new Date() : null;
    }
    if (bookmarked !== undefined) data.bookmarked = !!bookmarked;

    const progress = await prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: req.user.id, lessonId: lesson.id } },
      update: data,
      create: { studentId: req.user.id, lessonId: lesson.id, status: status || "IN_PROGRESS", bookmarked: !!bookmarked },
    });
    res.json(progress);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update progress" });
  }
});

// STUDENT: submit a module's practice test as a batch — every non-CODING practice question on
// an isModuleTest lesson, answered together in one go, rather than checked one at a time.
// Passing (>= PASS_THRESHOLD%) marks the lesson COMPLETED, which is what the module-lock check
// (getModuleLockMap) looks for to unlock the next module. Failing leaves it IN_PROGRESS so the
// student can retry — there's no attempt cap or cooldown, this is learning, not an exam.
// Response includes the full per-question review (selected answer, correct/incorrect, the
// correct answer, and its explanation) — deliberately answer-revealing, since that's the whole
// point of a learning-module practice test, unlike the exam submission flow.
router.post("/lessons/:id/test-submit", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const lesson = await prisma.lesson.findUnique({ where: { id: req.params.id } });
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });
    if (!lesson.isModuleTest) return res.status(400).json({ error: "This lesson is not a practice test" });

    const questions = await prisma.practiceQuestion.findMany({
      where: { lessonId: lesson.id, type: { not: "CODING" } },
      orderBy: { order: "asc" },
    });
    if (questions.length === 0) return res.status(400).json({ error: "This practice test has no questions yet" });

    const answers = req.body.answers || {};
    let correctCount = 0;
    const results = questions.map((q) => {
      const selected = answers[q.id];
      let correct;
      if (q.type === "FILL_BLANK") {
        correct = String(selected ?? "").trim().toLowerCase() === String(q.correctAnswer ?? "").trim().toLowerCase();
      } else {
        correct = selected !== undefined && selected !== null && Number(selected) === Number(q.correctAnswer);
      }
      if (correct) correctCount++;
      return {
        questionId: q.id, type: q.type, prompt: q.prompt, options: q.options,
        selected: selected ?? null, correct, correctAnswer: q.correctAnswer, explanation: q.explanation || null,
      };
    });

    const score = Math.round((correctCount / questions.length) * 100);
    const passed = score >= PASS_THRESHOLD;

    // A test already passed can be retaken for practice — a weaker score on a retake must
    // never downgrade COMPLETED back to IN_PROGRESS, or it would re-lock every module after
    // this one even though the student already earned the unlock.
    const existing = await prisma.lessonProgress.findUnique({
      where: { studentId_lessonId: { studentId: req.user.id, lessonId: lesson.id } },
    });
    const alreadyPassed = existing?.status === "COMPLETED";
    const nextStatus = passed || alreadyPassed ? "COMPLETED" : "IN_PROGRESS";

    await prisma.lessonProgress.upsert({
      where: { studentId_lessonId: { studentId: req.user.id, lessonId: lesson.id } },
      update: { status: nextStatus, completedAt: nextStatus === "COMPLETED" ? existing?.completedAt || new Date() : null },
      create: { studentId: req.user.id, lessonId: lesson.id, status: nextStatus, completedAt: nextStatus === "COMPLETED" ? new Date() : null },
    });

    res.json({ passed, score, correctCount, totalCount: questions.length, passThreshold: PASS_THRESHOLD, results });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to submit practice test" });
  }
});

// STUDENT: check an MCQ/FILL_BLANK/DEBUG/OUTPUT_PREDICTION practice answer. Unlike exam
// submissions, learning-mode feedback is immediate and reveals the correct answer + explanation
// right away — that's the point of practice, not a leak.
router.post("/practice/:id/check", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const q = await prisma.practiceQuestion.findUnique({ where: { id: req.params.id } });
    if (!q) return res.status(404).json({ error: "Question not found" });
    if (q.type === "CODING") return res.status(400).json({ error: "Use /run for coding questions" });

    let correct;
    if (q.type === "FILL_BLANK") {
      correct = String(req.body.answer ?? "").trim().toLowerCase() === String(q.correctAnswer ?? "").trim().toLowerCase();
    } else {
      correct = Number(req.body.answer) === Number(q.correctAnswer);
    }
    res.json({ correct, correctAnswer: q.correctAnswer, explanation: q.explanation || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to check answer" });
  }
});

// STUDENT: run a coding practice question against its test cases. Full pass/fail detail is
// returned — this is a learning aid, not a proctored exam, so there's no reason to hide it.
router.post("/practice/:id/run", authenticate, requireRole("STUDENT"), runLimiter, async (req, res) => {
  try {
    const q = await prisma.practiceQuestion.findUnique({ where: { id: req.params.id } });
    if (!q || q.type !== "CODING") return res.status(400).json({ error: "Not a coding question" });

    const { language, code } = req.body;
    const testCases = Array.isArray(q.testCases) ? q.testCases : [];
    const result = await runQueued(() => judgeSubmission({ language, code, testCases, timeLimitMs: 3000 }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Execution failed" });
  }
});

// =========================== Certificates ===========================

async function checkCourseCompletion(studentId, course) {
  const totalLessons = await prisma.lesson.count({ where: { module: { courseId: course.id } } });
  const completedLessons = await prisma.lessonProgress.count({
    where: { studentId, status: "COMPLETED", lesson: { module: { courseId: course.id } } },
  });
  return { totalLessons, completedLessons, complete: totalLessons > 0 && completedLessons >= totalLessons };
}

// STUDENT: fetch (auto-issuing on first call) the certificate for a fully-completed course.
router.get("/courses/:slug/certificate", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { slug: req.params.slug } });
    if (!course) return res.status(404).json({ error: "Course not found" });

    const { totalLessons, completedLessons, complete } = await checkCourseCompletion(req.user.id, course);
    if (!complete) {
      return res.status(400).json({ error: "Course not yet completed", totalLessons, completedLessons });
    }

    let cert = await prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId: req.user.id, courseId: course.id } },
    });
    if (!cert) {
      const code = `SJU-${course.slug.toUpperCase()}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      cert = await prisma.certificate.create({ data: { certificateCode: code, studentId: req.user.id, courseId: course.id } });
    }

    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    res.json({ ...cert, studentName: student.name, courseName: course.name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load certificate" });
  }
});

// STUDENT: download the certificate as a PDF (must already be eligible/issued).
router.get("/courses/:slug/certificate/download", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const course = await prisma.course.findUnique({ where: { slug: req.params.slug } });
    if (!course) return res.status(404).json({ error: "Course not found" });

    const { complete } = await checkCourseCompletion(req.user.id, course);
    if (!complete) return res.status(400).json({ error: "Course not yet completed" });

    let cert = await prisma.certificate.findUnique({
      where: { studentId_courseId: { studentId: req.user.id, courseId: course.id } },
    });
    if (!cert) {
      const code = `SJU-${course.slug.toUpperCase()}-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      cert = await prisma.certificate.create({ data: { certificateCode: code, studentId: req.user.id, courseId: course.id } });
    }

    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${course.slug}-certificate.pdf"`);
    generateCertificatePdf({ studentName: student.name, courseName: course.name, certificateCode: cert.certificateCode, issuedAt: cert.issuedAt }, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate certificate" });
  }
});

// =========================== Admin/Staff content management (CMS) ===========================

router.post("/courses", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { slug, name, description, order, isActive } = req.body;
    if (!slug || !name) return res.status(400).json({ error: "slug and name are required" });
    const course = await prisma.course.create({
      data: { slug, name, description: description || null, order: Number(order) || 0, isActive: !!isActive },
    });
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(err.code === "P2002" ? 409 : 500).json({ error: err.code === "P2002" ? "A course with this slug already exists" : "Failed to create course" });
  }
});

router.patch("/courses/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { name, description, order, isActive } = req.body;
    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
      },
    });
    res.json(course);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update course" });
  }
});

router.delete("/courses/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.course.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete course" });
  }
});

router.post("/courses/:id/modules", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, description, order } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const mod = await prisma.courseModule.create({
      data: { courseId: req.params.id, title, description: description || null, order: Number(order) || 0 },
    });
    res.json(mod);
  } catch (err) {
    console.error(err);
    res.status(err.code === "P2002" ? 409 : 500).json({ error: err.code === "P2002" ? "A module with this title already exists in this course" : "Failed to create module" });
  }
});

router.patch("/modules/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, description, order } = req.body;
    const mod = await prisma.courseModule.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    });
    res.json(mod);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update module" });
  }
});

router.delete("/modules/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    await prisma.courseModule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete module" });
  }
});

router.post("/modules/:id/lessons", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, content, videoUrl, pdfUrl, externalLinks, order, estimatedMinutes, isModuleTest } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: req.params.id, title,
        content: content || null, videoUrl: videoUrl || null, pdfUrl: pdfUrl || null,
        externalLinks: externalLinks || undefined, order: Number(order) || 0,
        estimatedMinutes: Number(estimatedMinutes) || 10, isModuleTest: !!isModuleTest,
      },
    });
    res.json(lesson);
  } catch (err) {
    console.error(err);
    res.status(err.code === "P2002" ? 409 : 500).json({ error: err.code === "P2002" ? "A lesson with this title already exists in this module" : "Failed to create lesson" });
  }
});

router.patch("/lessons/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { title, content, videoUrl, pdfUrl, externalLinks, order, estimatedMinutes, isModuleTest } = req.body;
    const lesson = await prisma.lesson.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined ? { title } : {}),
        ...(content !== undefined ? { content } : {}),
        ...(videoUrl !== undefined ? { videoUrl } : {}),
        ...(pdfUrl !== undefined ? { pdfUrl } : {}),
        ...(externalLinks !== undefined ? { externalLinks } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
        ...(estimatedMinutes !== undefined ? { estimatedMinutes: Number(estimatedMinutes) } : {}),
        ...(isModuleTest !== undefined ? { isModuleTest: !!isModuleTest } : {}),
      },
    });
    res.json(lesson);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update lesson" });
  }
});

router.delete("/lessons/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    await prisma.lesson.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete lesson" });
  }
});

router.post("/lessons/:id/questions", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { type, prompt, options, correctAnswer, explanation, starterCode, testCases, language, order } = req.body;
    if (!type || !prompt) return res.status(400).json({ error: "type and prompt are required" });
    const q = await prisma.practiceQuestion.create({
      data: {
        lessonId: req.params.id, type, prompt,
        options: options ?? undefined, correctAnswer: correctAnswer ?? undefined,
        explanation: explanation || null, starterCode: starterCode || null,
        testCases: testCases ?? undefined, language: language || null, order: Number(order) || 0,
      },
    });
    res.json(q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create practice question" });
  }
});

router.patch("/practice/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const { type, prompt, options, correctAnswer, explanation, starterCode, testCases, language, order } = req.body;
    const q = await prisma.practiceQuestion.update({
      where: { id: req.params.id },
      data: {
        ...(type !== undefined ? { type } : {}),
        ...(prompt !== undefined ? { prompt } : {}),
        ...(options !== undefined ? { options } : {}),
        ...(correctAnswer !== undefined ? { correctAnswer } : {}),
        ...(explanation !== undefined ? { explanation } : {}),
        ...(starterCode !== undefined ? { starterCode } : {}),
        ...(testCases !== undefined ? { testCases } : {}),
        ...(language !== undefined ? { language } : {}),
        ...(order !== undefined ? { order: Number(order) } : {}),
      },
    });
    res.json(q);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update practice question" });
  }
});

router.delete("/practice/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    await prisma.practiceQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete practice question" });
  }
});

// ADMIN/STAFF: full question detail (with correctAnswer/explanation) for the CMS edit form —
// distinct from the sanitized shape /lessons/:id returns to students.
router.get("/practice/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const q = await prisma.practiceQuestion.findUnique({ where: { id: req.params.id } });
  if (!q) return res.status(404).json({ error: "Question not found" });
  res.json(q);
});

module.exports = router;

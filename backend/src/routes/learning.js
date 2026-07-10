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
  if (req.user.role === "STUDENT") {
    const allLessonIds = course.modules.flatMap((m) => m.lessons.map((l) => l.id));
    const progress = await prisma.lessonProgress.findMany({
      where: { studentId: req.user.id, lessonId: { in: allLessonIds } },
    });
    progressByLesson = new Map(progress.map((p) => [p.lessonId, p]));
  }

  let totalLessons = 0, completedLessons = 0;
  const modules = course.modules.map((m) => {
    const lessons = m.lessons.map((l) => {
      const p = progressByLesson.get(l.id);
      totalLessons++;
      if (p?.status === "COMPLETED") completedLessons++;
      return {
        id: l.id, title: l.title, order: l.order, estimatedMinutes: l.estimatedMinutes,
        status: p?.status || "NOT_STARTED", bookmarked: p?.bookmarked || false,
      };
    });
    const moduleCompleted = lessons.filter((l) => l.status === "COMPLETED").length;
    return { id: m.id, title: m.title, description: m.description, order: m.order, lessons, completedCount: moduleCompleted, totalCount: lessons.length };
  });

  res.json({
    course: { id: course.id, slug: course.slug, name: course.name, description: course.description, isActive: course.isActive },
    modules,
    overall: { totalLessons, completedLessons, percent: totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0 },
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
      estimatedMinutes: lesson.estimatedMinutes,
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
    const { title, content, videoUrl, pdfUrl, externalLinks, order, estimatedMinutes } = req.body;
    if (!title) return res.status(400).json({ error: "title is required" });
    const lesson = await prisma.lesson.create({
      data: {
        moduleId: req.params.id, title,
        content: content || null, videoUrl: videoUrl || null, pdfUrl: pdfUrl || null,
        externalLinks: externalLinks || undefined, order: Number(order) || 0,
        estimatedMinutes: Number(estimatedMinutes) || 10,
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
    const { title, content, videoUrl, pdfUrl, externalLinks, order, estimatedMinutes } = req.body;
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

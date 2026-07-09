const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");

const router = express.Router();

function questionCreateData(questionIds, questionTimeLimits) {
  return (questionIds || []).map((qId, idx) => ({
    questionId: qId,
    order: idx,
    timeLimitSec: Number(questionTimeLimits?.[qId]) || 900,
  }));
}

// A student can see/take a test if it has no class assignment (open to all, legacy default)
// or their class is one of the assigned classes.
async function studentCanAccessTest(test, studentClassId) {
  const links = await prisma.testClass.count({ where: { testId: test.id } });
  if (links === 0) return true;
  if (!studentClassId) return false;
  const match = await prisma.testClass.findUnique({
    where: { testId_classId: { testId: test.id, classId: studentClassId } },
  });
  return !!match;
}

// --- ADMIN/STAFF: create a test ---
// questionIds: string[]  |  questionTimeLimits: { [questionId]: seconds } (optional, defaults to 900s/15min each)
// classIds: string[] (optional) — assign the test to specific classes; omitted/empty = open to all classes
router.post("/", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const {
      title, code, description, instructions, durationMin, passingMarks, showResults,
      startTime, endTime, questionIds, questionTimeLimits, classIds,
    } = req.body;
    const test = await prisma.test.create({
      data: {
        title,
        code: code?.trim() || null,
        description,
        instructions: instructions?.trim() || null,
        durationMin: durationMin || 60,
        passingMarks: passingMarks !== undefined && passingMarks !== "" ? Number(passingMarks) : null,
        showResults: showResults === undefined ? true : !!showResults,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        createdById: req.user.id,
        questions: { create: questionCreateData(questionIds, questionTimeLimits) },
        classes: { create: (classIds || []).map((classId) => ({ classId })) },
      },
      include: { questions: true, classes: true },
    });
    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create test" });
  }
});

// --- ADMIN/STAFF: edit an existing test (replaces questions + class assignment) ---
router.patch("/:id", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const existing = await prisma.test.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Test not found" });

    const {
      title, code, description, instructions, durationMin, passingMarks, showResults,
      startTime, endTime, questionIds, questionTimeLimits, classIds,
    } = req.body;

    const data = {
      title: title ?? existing.title,
      code: code !== undefined ? (code?.trim() || null) : existing.code,
      description: description ?? existing.description,
      instructions: instructions !== undefined ? (instructions?.trim() || null) : existing.instructions,
      durationMin: durationMin !== undefined ? Number(durationMin) : existing.durationMin,
      passingMarks: passingMarks !== undefined ? (passingMarks === "" ? null : Number(passingMarks)) : existing.passingMarks,
      showResults: showResults === undefined ? existing.showResults : !!showResults,
      startTime: startTime ? new Date(startTime) : existing.startTime,
      endTime: endTime ? new Date(endTime) : existing.endTime,
    };

    await prisma.$transaction(async (tx) => {
      await tx.test.update({ where: { id: existing.id }, data });

      if (questionIds) {
        await tx.testQuestion.deleteMany({ where: { testId: existing.id } });
        await tx.testQuestion.createMany({
          data: questionCreateData(questionIds, questionTimeLimits).map((q) => ({ ...q, testId: existing.id })),
        });
      }

      if (classIds) {
        await tx.testClass.deleteMany({ where: { testId: existing.id } });
        if (classIds.length > 0) {
          await tx.testClass.createMany({ data: classIds.map((classId) => ({ testId: existing.id, classId })) });
        }
      }
    });

    const test = await prisma.test.findUnique({
      where: { id: existing.id },
      include: { questions: true, classes: true },
    });
    res.json(test);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update test" });
  }
});

// --- ADMIN/STAFF: duplicate a test (questions + class assignment cloned, always starts unpublished) ---
router.post("/:id/duplicate", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  try {
    const original = await prisma.test.findUnique({
      where: { id: req.params.id },
      include: { questions: true, classes: true },
    });
    if (!original) return res.status(404).json({ error: "Test not found" });

    const copy = await prisma.test.create({
      data: {
        title: `Copy of ${original.title}`,
        code: original.code,
        description: original.description,
        instructions: original.instructions,
        durationMin: original.durationMin,
        passingMarks: original.passingMarks,
        showResults: original.showResults,
        startTime: original.startTime,
        endTime: original.endTime,
        isPublished: false,
        createdById: req.user.id,
        questions: {
          create: original.questions.map((q) => ({ questionId: q.questionId, order: q.order, timeLimitSec: q.timeLimitSec })),
        },
        classes: {
          create: original.classes.map((c) => ({ classId: c.classId })),
        },
      },
      include: { questions: true, classes: true },
    });
    res.json(copy);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to duplicate test" });
  }
});

// --- ADMIN: permanently delete a test (and its attempts/submissions) ---
router.delete("/:id", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    await prisma.test.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete test" });
  }
});

// --- ADMIN/STAFF: publish/unpublish ---
router.patch("/:id/publish", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const test = await prisma.test.update({
    where: { id: req.params.id },
    data: { isPublished: !!req.body.isPublished },
  });
  res.json(test);
});

// --- Everyone authenticated: list tests (students see only published tests assigned to their
// class; staff/admin see full assignment detail — institute, class, batch year, headcount,
// creator — scoped to their own institute unless they're platform-level) ---
router.get("/", authenticate, attachRequesterInstitute, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "STAFF";
  const tests = await prisma.test.findMany({
    where: isStaff ? {} : { isPublished: true },
    orderBy: { startTime: "asc" },
    include: {
      _count: { select: { questions: true, attempts: true } },
      classes: {
        include: {
          class: {
            select: {
              id: true,
              name: true,
              batchYear: true,
              instituteId: true,
              institute: { select: { id: true, name: true } },
              _count: { select: { users: true } },
            },
          },
        },
      },
      createdBy: { select: { id: true, name: true } },
    },
  });

  if (isStaff) {
    const visible = req.requesterInstituteId
      ? tests.filter((t) => t.classes.length === 0 || t.classes.some((tc) => tc.class.instituteId === req.requesterInstituteId))
      : tests;
    return res.json(visible);
  }

  const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classId: true } });
  const visible = tests.filter((t) => t.classes.length === 0 || (student.classId && t.classes.some((c) => c.classId === student.classId)));

  // Surface the student's own attempt status per test so the dashboard can show "Completed"
  // upfront, rather than only after they click Attend and get bounced by a 403.
  const myAttempts = await prisma.testAttempt.findMany({
    where: { studentId: req.user.id, testId: { in: visible.map((t) => t.id) } },
    select: { testId: true, status: true },
  });
  const statusByTest = Object.fromEntries(myAttempts.map((a) => [a.testId, a.status]));
  const withStatus = visible.map((t) => ({ ...t, myStatus: statusByTest[t.id] || null }));

  res.json(withStatus);
});

// --- Get single test detail (questions without hidden test cases, and without
// correctAnswer/explanation, for students — those would leak the answer key) ---
router.get("/:id", authenticate, async (req, res) => {
  const isStaff = req.user.role === "ADMIN" || req.user.role === "STAFF";
  const test = await prisma.test.findUnique({
    where: { id: req.params.id },
    include: {
      classes: { select: { classId: true } },
      questions: {
        include: {
          question: {
            select: {
              id: true,
              questionNumber: true,
              title: true,
              description: true,
              subject: true,
              topic: true,
              questionType: true,
              difficulty: true,
              points: true,
              timeLimitMs: true,
              starterCode: true,
              options: true,
              correctAnswer: isStaff,
              explanation: isStaff,
              testCases: { where: isStaff ? {} : { isHidden: false } },
            },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });
  if (!test) return res.status(404).json({ error: "Test not found" });

  if (!isStaff) {
    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classId: true } });
    const allowed = test.classes.length === 0 || (student.classId && test.classes.some((c) => c.classId === student.classId));
    if (!allowed) return res.status(404).json({ error: "Test not found" });
  }

  res.json(test);
});

// --- STUDENT: start/attend a test attempt (one attempt per student, ever) ---
router.post("/:id/start", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const testId = req.params.id;
    const test = await prisma.test.findUnique({ where: { id: testId } });
    if (!test || !test.isPublished) return res.status(404).json({ error: "Test not available" });

    const student = await prisma.user.findUnique({ where: { id: req.user.id }, select: { classId: true } });
    const allowed = await studentCanAccessTest(test, student.classId);
    if (!allowed) return res.status(404).json({ error: "Test not available" });

    const existing = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId, studentId: req.user.id } },
    });
    if (existing && existing.status !== "IN_PROGRESS") {
      return res.status(403).json({ error: "Thank you. You have already completed this assessment." });
    }

    const now = new Date();
    if (now < test.startTime) return res.status(403).json({ error: "Test has not started yet" });
    if (now > test.endTime) return res.status(403).json({ error: "Test window has closed" });

    const attempt = existing || (await prisma.testAttempt.create({ data: { testId, studentId: req.user.id } }));
    res.json(attempt);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not start test" });
  }
});

// --- STUDENT: report a tab-switch / focus-loss violation during an attempt.
// After MAX_VIOLATIONS, the attempt is auto-submitted server-side. ---
const MAX_TAB_VIOLATIONS = 3;
router.post("/attempts/:attemptId/violation", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const attempt = await prisma.testAttempt.findUnique({ where: { id: req.params.attemptId } });
    if (!attempt || attempt.studentId !== req.user.id) {
      return res.status(403).json({ error: "Invalid attempt" });
    }
    if (attempt.status !== "IN_PROGRESS") {
      return res.json({ tabSwitchCount: attempt.tabSwitchCount, autoSubmitted: true });
    }

    const tabSwitchCount = attempt.tabSwitchCount + 1;
    const autoSubmitted = tabSwitchCount >= MAX_TAB_VIOLATIONS;

    const updated = await prisma.testAttempt.update({
      where: { id: attempt.id },
      data: {
        tabSwitchCount,
        ...(autoSubmitted ? { status: "AUTO_SUBMITTED", submittedAt: new Date() } : {}),
      },
    });
    res.json({ tabSwitchCount: updated.tabSwitchCount, autoSubmitted });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record violation" });
  }
});

// --- ADMIN: grant an individual student a reattempt on a test they've already completed.
// Deletes their existing attempt (submissions cascade with it), so their next POST /:id/start
// creates a fresh one — scoped to this one student only, nothing else about the test changes. ---
router.post("/:testId/attempts/:studentId/reattempt", authenticate, requireRole("ADMIN"), attachRequesterInstitute, async (req, res) => {
  try {
    const { testId, studentId } = req.params;
    const [test, student, attempt] = await Promise.all([
      prisma.test.findUnique({ where: { id: testId }, select: { id: true, title: true } }),
      prisma.user.findUnique({ where: { id: studentId }, select: { id: true, name: true, rollNumber: true, instituteId: true } }),
      prisma.testAttempt.findUnique({ where: { testId_studentId: { testId, studentId } } }),
    ]);
    if (!test) return res.status(404).json({ error: "Test not found" });
    if (!student) return res.status(404).json({ error: "Student not found" });
    if (req.requesterInstituteId && student.instituteId !== req.requesterInstituteId) {
      return res.status(403).json({ error: "You can only manage students under your own institute" });
    }
    if (!attempt) return res.status(404).json({ error: "This student has not attempted this test" });
    if (attempt.status === "IN_PROGRESS") {
      return res.status(400).json({ error: "This student's attempt is still in progress — nothing to reset" });
    }

    const admin = await prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true } });

    await prisma.$transaction([
      prisma.testAttempt.delete({ where: { id: attempt.id } }), // cascades that attempt's Submissions
      prisma.auditLog.create({
        data: {
          action: "REATTEMPT_GRANTED",
          adminId: req.user.id,
          adminName: admin?.name || req.user.email,
          details: {
            studentId: student.id,
            studentName: student.name,
            studentRollNumber: student.rollNumber,
            testId: test.id,
            testTitle: test.title,
          },
        },
      }),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to grant reattempt" });
  }
});

// --- ADMIN/STAFF: leaderboard / results for a test ---
router.get("/:id/results", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  const attempts = await prisma.testAttempt.findMany({
    where: { testId: req.params.id },
    include: { student: { select: { name: true, email: true, rollNumber: true } } },
    orderBy: { totalScore: "desc" },
  });
  res.json(attempts);
});

// --- STUDENT: view their own result for a test, respecting the test's showResults toggle ---
router.get("/:id/my-result", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const test = await prisma.test.findUnique({ where: { id: req.params.id } });
    if (!test) return res.status(404).json({ error: "Test not found" });

    const attempt = await prisma.testAttempt.findUnique({
      where: { testId_studentId: { testId: test.id, studentId: req.user.id } },
      include: { submissions: true },
    });
    if (!attempt) return res.status(404).json({ error: "You have not attempted this test" });
    if (attempt.status === "IN_PROGRESS") return res.status(403).json({ error: "Test not yet submitted" });
    if (!test.showResults) {
      return res.json({ status: attempt.status, showResults: false });
    }

    res.json({
      status: attempt.status,
      showResults: true,
      totalScore: attempt.totalScore,
      passingMarks: test.passingMarks,
      submittedAt: attempt.submittedAt,
      tabSwitchCount: attempt.tabSwitchCount,
      submissions: attempt.submissions,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load result" });
  }
});

module.exports = router;

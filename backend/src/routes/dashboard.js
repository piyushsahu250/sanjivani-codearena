const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { computeStudentPerformance } = require("../utils/studentPerformance");
const { getModuleLockMap } = require("../utils/learningLock");

const router = express.Router();

// Ranks a student against classmates by overall test percentage (score summed across every
// completed attempt, divided by the max possible across those same tests). Students with no
// completed attempts rank last (sentinel -1), tied among themselves. Returns nulls if the
// student has no class (nothing meaningful to rank against).
async function computeClassRank(studentId, classId) {
  if (!classId) return { rank: null, totalStudents: null };
  const classmates = await prisma.user.findMany({ where: { classId, role: "STUDENT" }, select: { id: true } });
  const ids = classmates.map((c) => c.id);
  if (ids.length === 0) return { rank: null, totalStudents: null };

  const attempts = await prisma.testAttempt.findMany({
    where: { studentId: { in: ids }, status: { not: "IN_PROGRESS" } },
    select: { studentId: true, testId: true, totalScore: true },
  });
  const testIds = [...new Set(attempts.map((a) => a.testId))];
  const tests = testIds.length
    ? await prisma.test.findMany({
        where: { id: { in: testIds } },
        select: { id: true, questions: { select: { question: { select: { points: true } } } } },
      })
    : [];
  const maxByTest = new Map(tests.map((t) => [t.id, t.questions.reduce((s, q) => s + q.question.points, 0)]));

  const scoreSum = new Map(), maxSum = new Map();
  for (const a of attempts) {
    const max = maxByTest.get(a.testId) || 0;
    scoreSum.set(a.studentId, (scoreSum.get(a.studentId) || 0) + a.totalScore);
    maxSum.set(a.studentId, (maxSum.get(a.studentId) || 0) + max);
  }

  const ranked = ids
    .map((id) => {
      const s = scoreSum.get(id) || 0, m = maxSum.get(id) || 0;
      return { id, pct: m > 0 ? (s / m) * 100 : -1 };
    })
    .sort((a, b) => b.pct - a.pct);

  const position = ranked.findIndex((r) => r.id === studentId) + 1;
  return { rank: position || null, totalStudents: ids.length };
}

// Consecutive-day streak of learning-module coding practice (any Run, any verdict — showing up
// to practice counts, not just getting it right). "Today" or "yesterday" must have activity for
// the streak to still be considered live; otherwise it's reset to 0.
async function computeCodingStreak(studentId) {
  const logs = await prisma.practiceRunLog.findMany({
    where: { studentId },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  const days = new Set(logs.map((l) => l.createdAt.toISOString().slice(0, 10)));
  if (days.size === 0) return 0;

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  let streak = 0;
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function getRecentActivity(studentId) {
  const [attempts, lessonProgress, certificates, runs] = await Promise.all([
    prisma.testAttempt.findMany({
      where: { studentId, status: { not: "IN_PROGRESS" } },
      select: { submittedAt: true, test: { select: { title: true } } },
      orderBy: { submittedAt: "desc" }, take: 5,
    }),
    prisma.lessonProgress.findMany({
      where: { studentId, status: "COMPLETED" },
      select: { completedAt: true, lesson: { select: { title: true, isModuleTest: true, module: { select: { title: true } } } } },
      orderBy: { completedAt: "desc" }, take: 5,
    }),
    prisma.certificate.findMany({
      where: { studentId },
      select: { issuedAt: true, course: { select: { name: true } } },
      orderBy: { issuedAt: "desc" }, take: 3,
    }),
    prisma.practiceRunLog.findMany({
      where: { studentId, verdict: "ACCEPTED" },
      select: { createdAt: true, question: { select: { prompt: true } } },
      orderBy: { createdAt: "desc" }, take: 5,
    }),
  ]);

  const items = [
    ...attempts.map((a) => ({ type: "test", text: `Completed "${a.test.title}" test`, date: a.submittedAt })),
    ...lessonProgress.map((p) => ({
      type: "lesson",
      text: p.lesson.isModuleTest ? `Passed the "${p.lesson.module.title}" practice test` : `Finished "${p.lesson.title}" (${p.lesson.module.title})`,
      date: p.completedAt,
    })),
    ...certificates.map((c) => ({ type: "certificate", text: `Earned the ${c.course.name} certificate`, date: c.issuedAt })),
    ...runs.map((r) => ({
      type: "coding",
      text: `Solved a coding practice problem: "${r.question.prompt.length > 60 ? `${r.question.prompt.slice(0, 60)}…` : r.question.prompt}"`,
      date: r.createdAt,
    })),
  ]
    .filter((i) => i.date)
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 8);

  return items;
}

async function getNotifications(student) {
  const notifications = [];
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 3600 * 1000);
  const last7d = new Date(now.getTime() - 7 * 24 * 3600 * 1000);

  const assignedTests = await prisma.test.findMany({
    where: {
      isPublished: true,
      OR: [{ classes: { none: {} } }, ...(student.classId ? [{ classes: { some: { classId: student.classId } } }] : [])],
    },
    select: { id: true, title: true, startTime: true, createdAt: true },
  });
  const myAttemptTestIds = new Set(
    (await prisma.testAttempt.findMany({ where: { studentId: student.id }, select: { testId: true } })).map((a) => a.testId)
  );

  for (const t of assignedTests) {
    if (t.createdAt >= last7d && !myAttemptTestIds.has(t.id)) {
      notifications.push({ type: "test_assigned", text: `New test assigned: "${t.title}"`, date: t.createdAt });
    }
    if (t.startTime >= now && t.startTime <= in48h) {
      notifications.push({ type: "test_reminder", text: `"${t.title}" starts ${new Date(t.startTime).toLocaleString()}`, date: t.startTime });
    }
  }

  const javaCourse = await prisma.course.findUnique({ where: { slug: "java" } });
  if (javaCourse) {
    const modules = await prisma.courseModule.findMany({ where: { courseId: javaCourse.id }, orderBy: { order: "asc" } });
    const lockMap = await getModuleLockMap(prisma, student.id, javaCourse.id);
    const currentUnstarted = modules.find((m, i) => i > 0 && !lockMap.get(m.id)?.locked && !lockMap.get(m.id)?.completed);
    if (currentUnstarted) {
      const anyProgress = await prisma.lessonProgress.count({
        where: { studentId: student.id, status: { not: "NOT_STARTED" }, lesson: { moduleId: currentUnstarted.id } },
      });
      if (anyProgress === 0) {
        notifications.push({ type: "module_unlocked", text: `"${currentUnstarted.title}" module is now unlocked`, date: now });
      }
    }
  }

  const recentCerts = await prisma.certificate.findMany({
    where: { studentId: student.id, issuedAt: { gte: last7d } },
    select: { issuedAt: true, course: { select: { name: true } } },
  });
  for (const c of recentCerts) {
    notifications.push({ type: "certificate", text: `You earned the ${c.course.name} certificate!`, date: c.issuedAt });
  }

  return notifications.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
}

// STUDENT: single aggregation endpoint for the dashboard's summary cards, performance summary,
// and recent test results — one round trip instead of the frontend re-deriving these from raw
// test/submission data itself. Upcoming tests and full Learning Module progress are still
// fetched separately (GET /tests and GET /learning/courses/:slug already do exactly this, and
// duplicating their institute/class-scoping logic here would just be a second place for that
// logic to drift out of sync).
router.get("/student", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const student = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!student) return res.status(404).json({ error: "Student not found" });

    const [perf, rank, codingStreak, certificatesEarned, recentActivity, notifications, javaCourse] = await Promise.all([
      computeStudentPerformance(student.id, { maskUnpublished: true }),
      computeClassRank(student.id, student.classId),
      computeCodingStreak(student.id),
      prisma.certificate.count({ where: { studentId: student.id } }),
      getRecentActivity(student.id),
      getNotifications(student),
      prisma.course.findUnique({ where: { slug: "java" } }),
    ]);

    let learningProgressPercent = 0;
    if (javaCourse) {
      const totalLessons = await prisma.lesson.count({ where: { module: { courseId: javaCourse.id } } });
      const completedLessons = await prisma.lessonProgress.count({
        where: { studentId: student.id, status: "COMPLETED", lesson: { module: { courseId: javaCourse.id } } },
      });
      learningProgressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
    }

    res.json({
      cards: {
        testsAssigned: perf.summary.totalTestsAssigned,
        testsCompleted: perf.summary.totalTestsCompleted,
        testsPending: perf.summary.totalTestsPending,
        averageScorePercent: perf.summary.averageScorePercent,
        rank: rank.rank,
        totalStudentsInClass: rank.totalStudents,
        codingSolved: perf.summary.totalCodingSolved,
        mcqCorrect: perf.summary.totalMcqCorrect,
        learningProgressPercent,
        codingStreak,
        certificatesEarned,
      },
      performanceSummary: {
        highest: perf.summary.highest,
        lowest: perf.summary.lowest,
        averageScorePercent: perf.summary.averageScorePercent,
        totalTimeSpentMin: perf.summary.totalTimeSpentMin,
        lastAttemptDate: perf.summary.lastAttemptDate,
      },
      recentTestResults: perf.testHistory.filter((h) => h.status !== "IN_PROGRESS").slice(0, 5),
      recentActivity,
      notifications,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load dashboard" });
  }
});

module.exports = router;

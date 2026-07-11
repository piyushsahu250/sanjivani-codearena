// Shared between routes/learning.js (enforcing the lock) and routes/dashboard.js (surfacing a
// "module unlocked" notification) — kept in one place so the two never drift out of sync.

// Sequential module locking: module N is locked unless every lesson in module N-1 is COMPLETED
// AND (if module N-1 has an active proctored coding test configured) the student has a PASSED
// ModuleCodingAttempt for it. A module with no coding test configured, or one marked inactive,
// is ungated by this second condition entirely — it behaves exactly as it always has, so
// existing modules that predate this feature keep working unchanged. Once one module is locked,
// everything after it stays locked, regardless of that module's own state.
async function getModuleLockMap(prisma, studentId, courseId) {
  const modules = await prisma.courseModule.findMany({
    where: { courseId },
    orderBy: { order: "asc" },
    include: { lessons: { select: { id: true } }, codingTest: true },
  });
  const allLessonIds = modules.flatMap((m) => m.lessons.map((l) => l.id));
  const progress = allLessonIds.length
    ? await prisma.lessonProgress.findMany({
        where: { studentId, lessonId: { in: allLessonIds }, status: "COMPLETED" },
        select: { lessonId: true },
      })
    : [];
  const completedSet = new Set(progress.map((p) => p.lessonId));

  const gatedTestIds = modules.filter((m) => m.codingTest?.isActive).map((m) => m.codingTest.id);
  const passedTestIds = gatedTestIds.length
    ? new Set(
        (
          await prisma.moduleCodingAttempt.findMany({
            where: { moduleCodingTestId: { in: gatedTestIds }, studentId, passed: true },
            select: { moduleCodingTestId: true },
          })
        ).map((a) => a.moduleCodingTestId)
      )
    : new Set();

  const map = new Map();
  let prevSatisfied = true; // nothing is required before the first module
  for (const m of modules) {
    const locked = !prevSatisfied;
    const lessonsComplete = m.lessons.length > 0 && m.lessons.every((l) => completedSet.has(l.id));
    const codingRequired = !!m.codingTest?.isActive;
    const codingPassed = codingRequired ? passedTestIds.has(m.codingTest.id) : true;
    const moduleSatisfied = !locked && lessonsComplete && codingPassed;
    map.set(m.id, {
      locked,
      completed: moduleSatisfied,
      lessonsComplete: !locked && lessonsComplete,
      codingTest: codingRequired ? { required: true, passed: codingPassed } : { required: false, passed: true },
    });
    prevSatisfied = moduleSatisfied;
  }
  return map;
}

module.exports = { getModuleLockMap };

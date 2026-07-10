// Shared between routes/learning.js (enforcing the lock) and routes/dashboard.js (surfacing a
// "module unlocked" notification) — kept in one place so the two never drift out of sync.

// Sequential module locking: module N is locked unless every lesson in module N-1 is
// COMPLETED (which, for that module's practice-test lesson, only happens once it's been
// passed). Once one module is locked, everything after it stays locked, regardless of that
// module's own lesson state.
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

module.exports = { getModuleLockMap };

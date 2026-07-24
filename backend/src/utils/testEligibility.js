// Shared test-eligibility logic, replacing several independently-duplicated copies of the same
// "is this test open to this student" check (tests.js had 3, dashboard.js and studentPerformance.js
// one each, attendance.js two more inline).
//
// A test is visible to a student if it has NO restriction at all (open to everyone — the
// long-standing "empty assignment = unscoped" convention), OR the student's current academic
// group is one of the assigned groups, OR — backward-compat safety net — the student's legacy
// classId is one of the assigned legacy classes. The classId branch exists because the one-time
// migration script mirrors every existing TestClass row onto TestAcademicGroup, but a test created
// through the not-yet-rebuilt class picker (Phase E replaces it with an academic-group picker)
// still only writes TestClass; without this fallback such a test would silently become invisible
// to everyone until that picker ships. Once nothing writes TestClass anymore this fallback becomes
// a permanent no-op, not a bug — safe to leave in place rather than requiring a coordinated flip.

function testEligibilityWhere(academicGroupId, classId) {
  return {
    OR: [
      { academicGroups: { none: {} }, classes: { none: {} } },
      ...(academicGroupId ? [{ academicGroups: { some: { academicGroupId } } }] : []),
      ...(classId ? [{ classes: { some: { classId } } }] : []),
    ],
  };
}

// For an already-loaded test that includes `academicGroups: {select:{academicGroupId:true}}` and
// `classes: {select:{classId:true}}` (or the richer include shapes tests.js already uses) —
// synchronous, no extra query.
function isTestVisibleToStudent(test, academicGroupId, classId) {
  const groups = test.academicGroups || [];
  const classes = test.classes || [];
  if (groups.length === 0 && classes.length === 0) return true;
  if (academicGroupId && groups.some((g) => g.academicGroupId === academicGroupId)) return true;
  if (classId && classes.some((c) => c.classId === classId)) return true;
  return false;
}

// DB-authoritative check for call sites that only have the IDs, not a preloaded relation.
async function studentCanAccessTest(prisma, testId, academicGroupId, classId) {
  const [groupLinks, classLinks] = await Promise.all([
    prisma.testAcademicGroup.count({ where: { testId } }),
    prisma.testClass.count({ where: { testId } }),
  ]);
  if (groupLinks === 0 && classLinks === 0) return true;
  if (academicGroupId) {
    const match = await prisma.testAcademicGroup.findUnique({
      where: { testId_academicGroupId: { testId, academicGroupId } },
    });
    if (match) return true;
  }
  if (classId) {
    const match = await prisma.testClass.findUnique({
      where: { testId_classId: { testId, classId } },
    });
    if (match) return true;
  }
  return false;
}

module.exports = { testEligibilityWhere, isTestVisibleToStudent, studentCanAccessTest };

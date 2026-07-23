// One-time-safe migration that folds every existing Class (+ its optional Division link) into the
// new Institute -> Batch -> Department -> Section AcademicGroup model, and repoints students,
// TestClass links, and StaffClassAssignment rows onto it. Idempotent (find-or-create + only-if-null
// updates) and cheap once steady-state, so — matching prisma/dedupeDuplicateSubmissions.js's own
// precedent — this is safe to run on every deploy rather than needing a separate manual invocation.
//
// Classes with a Division already carry real Department/Section data and keep it. Classes with no
// Division (confirmed the common case, since Division-linking was a manual opt-in step added for
// Attendance) fall back to Department="Unassigned"/Section="Section A" per batch/institute — every
// existing student ends up with a working group, none left behind, since Class stops being read by
// any new code once the cutover phases ship.
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

function normalize(s) {
  return String(s || "").trim();
}
function normKey(s) {
  return normalize(s).toLowerCase();
}

async function findOrCreateDepartment(instituteId, name, cache) {
  const key = `${instituteId}::${normKey(name)}`;
  if (cache.has(key)) return cache.get(key);
  let dept = await prisma.department.findFirst({
    where: { instituteId, name: { equals: name, mode: "insensitive" } },
  });
  if (!dept) {
    dept = await prisma.department.create({ data: { instituteId, name } });
  }
  cache.set(key, dept);
  return dept;
}

async function findOrCreateAcademicGroup({ instituteId, batch, departmentId, section }, cache) {
  const key = `${instituteId}::${batch}::${departmentId}::${normKey(section)}`;
  if (cache.has(key)) return { group: cache.get(key), isNew: false };
  let group = await prisma.academicGroup.findFirst({
    where: { instituteId, batch, departmentId, section: { equals: section, mode: "insensitive" } },
  });
  let isNew = false;
  if (!group) {
    group = await prisma.academicGroup.create({ data: { instituteId, batch, departmentId, section } });
    isNew = true;
  }
  cache.set(key, group);
  return { group, isNew };
}

async function main() {
  console.log("[migrateAcademicGroups] Starting...");

  const neverEnrolled = await prisma.user.count({ where: { role: "STUDENT", classId: null, academicGroupId: null } });
  if (neverEnrolled > 0) {
    console.log(`[migrateAcademicGroups] NOTE: ${neverEnrolled} student(s) have no classId today (never enrolled) — left unlinked, no automatic group assigned.`);
  }

  const classes = await prisma.class.findMany({
    include: { division: { include: { department: true } } },
  });

  const deptCache = new Map();
  const groupCache = new Map();
  const classToGroup = new Map();
  let groupsCreated = 0;

  for (const cls of classes) {
    if (!cls.instituteId) continue; // orphaned class with no institute — nothing sane to migrate it into

    let departmentId, section;
    if (cls.division) {
      departmentId = cls.division.departmentId;
      section = cls.division.name;
    } else {
      const dept = await findOrCreateDepartment(cls.instituteId, "Unassigned", deptCache);
      departmentId = dept.id;
      section = "Section A";
    }
    const batch = normalize(cls.batchYear) || "Unassigned";

    const { group, isNew } = await findOrCreateAcademicGroup({ instituteId: cls.instituteId, batch, departmentId, section }, groupCache);
    if (isNew) groupsCreated++;
    classToGroup.set(cls.id, group.id);
  }

  console.log(`[migrateAcademicGroups] Processed ${classes.length} class(es) -> ${groupCache.size} distinct academic group(s) (${groupsCreated} newly created this run).`);

  let studentsRepointed = 0;
  for (const [classId, academicGroupId] of classToGroup) {
    const result = await prisma.user.updateMany({
      where: { classId, academicGroupId: null },
      data: { academicGroupId },
    });
    studentsRepointed += result.count;
  }
  console.log(`[migrateAcademicGroups] Repointed ${studentsRepointed} student(s) onto their academic group.`);

  const testClasses = await prisma.testClass.findMany();
  let testLinksLinked = 0;
  for (const tc of testClasses) {
    const academicGroupId = classToGroup.get(tc.classId);
    if (!academicGroupId) continue;
    await prisma.testAcademicGroup.upsert({
      where: { testId_academicGroupId: { testId: tc.testId, academicGroupId } },
      update: {},
      create: { testId: tc.testId, academicGroupId },
    });
    testLinksLinked++;
  }
  console.log(`[migrateAcademicGroups] Mirrored ${testLinksLinked} TestClass row(s) onto TestAcademicGroup.`);

  let assignmentsBackfilled = 0;
  for (const [classId, academicGroupId] of classToGroup) {
    const result = await prisma.staffClassAssignment.updateMany({
      where: { classId, academicGroupId: null },
      data: { academicGroupId },
    });
    assignmentsBackfilled += result.count;
  }
  console.log(`[migrateAcademicGroups] Backfilled academicGroupId on ${assignmentsBackfilled} StaffClassAssignment row(s).`);

  const stillUnlinked = await prisma.user.count({
    where: { role: "STUDENT", classId: { not: null }, academicGroupId: null },
  });
  console.log(`[migrateAcademicGroups] Zero-data-loss gate: ${stillUnlinked} student(s) have a classId but no academicGroupId (must be 0 before the Bulk Upload/Test/Attendance cutover ships).`);
  if (stillUnlinked > 0) {
    const examples = await prisma.user.findMany({
      where: { role: "STUDENT", classId: { not: null }, academicGroupId: null },
      select: { id: true, name: true, email: true, classId: true },
      take: 20,
    });
    console.log("[migrateAcademicGroups] Examples:", JSON.stringify(examples, null, 2));
  }

  console.log("[migrateAcademicGroups] Done.");
}

main()
  .catch((err) => {
    console.error("[migrateAcademicGroups] Failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

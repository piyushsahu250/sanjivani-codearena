// One-shot, idempotent migration: brings the platform's existing hand-seeded coding questions up
// to FUNCTION mode (LeetCode-style — see functionHarness.js) on a database that has ALREADY been
// seeded once, which every real deployment has. Editing seedModuleCoding.js/seedLearning.js/
// seedInterview.js/seedInterviewExtras2.js alone only affects a fresh/empty database — each of
// those seeders' own idempotency guard ("skip if any question already exists for this test/
// lesson/bank") means they never touch a row that's already there. This file is what actually
// reaches already-live production content.
//
// Safe to run on every container boot: only ever touches rows that are STILL evaluationType:
// "STDIO" (the default every seeded row started as) AND match one of the known original titles/
// prompts from functionSignatures.js — once a row is converted, it's no longer STDIO, so a later
// run's WHERE clause naturally excludes it. This can't reach a question an admin has since edited
// (a changed title/prompt no longer matches), but it also can't detect "an admin deliberately
// switched this one back to STDIO and wants it to stay that way" — the same limitation
// seedLearning.js's own isPlaceholderContent() convention already accepts for lesson content.

const { resolveCodingFields } = require("../src/utils/functionHarness");
const { MODULE_CODING_SIGNATURES, PRACTICE_CODING_SIGNATURES, INTERVIEW_CODING_SIGNATURES } = require("./functionSignatures");

async function migrateModuleCoding(prisma) {
  const rows = await prisma.question.findMany({
    where: { moduleCodingTestId: { not: null }, evaluationType: "STDIO", title: { in: Object.keys(MODULE_CODING_SIGNATURES) } },
  });
  for (const row of rows) {
    const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: MODULE_CODING_SIGNATURES[row.title] });
    await prisma.question.update({
      where: { id: row.id },
      data: { evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage },
    });
  }
  return rows.length;
}

async function migratePracticeCoding(prisma) {
  const rows = await prisma.practiceQuestion.findMany({
    where: { type: "CODING", evaluationType: "STDIO", prompt: { in: Object.keys(PRACTICE_CODING_SIGNATURES) } },
  });
  for (const row of rows) {
    const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[row.prompt] });
    await prisma.practiceQuestion.update({
      where: { id: row.id },
      data: { evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage },
    });
  }
  return rows.length;
}

async function migrateInterviewCoding(prisma) {
  const rows = await prisma.interviewQuestion.findMany({
    where: { category: "CODING", evaluationType: "STDIO", prompt: { in: Object.keys(INTERVIEW_CODING_SIGNATURES) } },
  });
  for (const row of rows) {
    const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: INTERVIEW_CODING_SIGNATURES[row.prompt] });
    await prisma.interviewQuestion.update({
      where: { id: row.id },
      data: { evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage },
    });
  }
  return rows.length;
}

async function migrateCodingToFunctionMode(prisma) {
  const [moduleCount, practiceCount, interviewCount] = await Promise.all([
    migrateModuleCoding(prisma),
    migratePracticeCoding(prisma),
    migrateInterviewCoding(prisma),
  ]);
  const total = moduleCount + practiceCount + interviewCount;
  if (total > 0) {
    console.log(
      `Migrated ${total} existing coding question(s) to Function-based mode ` +
        `(${moduleCount} Module Coding Test, ${practiceCount} Practice Coding, ${interviewCount} Interview Prep).`
    );
  }
}

module.exports = { migrateCodingToFunctionMode };

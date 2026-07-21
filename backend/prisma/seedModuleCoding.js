// Seeds a real, judge-verified proctored coding assessment for the two fully-authored modules
// (Module 1 "Introduction to Java", Module 2 "Java Basics") — the other 14 stub modules are left
// ungated by this feature (no ModuleCodingTest row = the lock-map gate is skipped entirely for
// them), exactly the same "seed a genuine smaller set, grow the rest via the admin CMS" approach
// used for the Learning Module's lesson content and the Interview Prep question bank.
// Idempotent and non-destructive to admin edits: the ModuleCodingTest config upserts with
// `update: {}`, and its question pool is only ever created once (skipped if any question already
// exists for that test), so admin edits/additions survive a redeploy untouched.
//
// Every question here is authored LeetCode-style (FUNCTION mode) — the student writes only a
// method body matching functionSignature (from functionSignatures.js, the single source of truth
// also used by migrateCodingToFunctionMode.js to update an already-seeded production database).
// resolveCodingFields() generates the real starterCodeByLanguage from that signature, exactly the
// same call every admin CRUD route makes — never hand-authored here.

const { resolveCodingFields } = require("../src/utils/functionHarness");
const { MODULE_CODING_SIGNATURES } = require("./functionSignatures");

const MODULE_TESTS = {
  "Introduction to Java": {
    title: "Module 1 Coding Assessment",
    instructions: "Solve every question by implementing the given method — no need to read input or print output yourself.",
    questionCount: 3,
    timeLimitMin: 30,
    passingPercent: 70,
    maxAttempts: 3,
    cooldownMinutes: 10,
    questions: [
      {
        title: "Sum of Two Integers",
        description: "Return the sum of two integers.",
        difficulty: "EASY",
        testCases: [
          { input: "3\n5", expected: "8" },
          { input: "-2\n7", expected: "5" },
          { input: "0\n0", expected: "0" },
        ],
      },
      {
        title: "Even or Odd",
        description: 'Return "Even" if the given integer is even, or "Odd" if it is odd.',
        difficulty: "EASY",
        testCases: [
          { input: "4", expected: "Even" },
          { input: "7", expected: "Odd" },
          { input: "0", expected: "Even" },
        ],
      },
      {
        title: "String Length",
        description: "Return the number of characters in the given string.",
        difficulty: "EASY",
        testCases: [
          { input: "hello", expected: "5" },
          { input: "Java", expected: "4" },
          { input: "a", expected: "1" },
        ],
      },
      {
        title: "Largest of Three",
        description: "Return the largest of three given integers.",
        difficulty: "EASY",
        testCases: [
          { input: "3\n9\n5", expected: "9" },
          { input: "1\n1\n1", expected: "1" },
          { input: "-4\n-1\n-9", expected: "-1" },
        ],
      },
    ],
  },
  "Java Basics": {
    title: "Module 2 Coding Assessment",
    instructions: "Solve every question by implementing the given method, applying the variables/operators/type-casting concepts from this module.",
    questionCount: 3,
    timeLimitMin: 35,
    passingPercent: 70,
    maxAttempts: 3,
    cooldownMinutes: 10,
    questions: [
      {
        title: "Truncating Cast",
        description: "Return the given decimal number cast to an int (truncated toward zero, no rounding).",
        difficulty: "EASY",
        testCases: [
          { input: "9.7", expected: "9" },
          { input: "3.2", expected: "3" },
          { input: "-2.8", expected: "-2" },
        ],
      },
      {
        title: "Sum 1 to N",
        description: "Return the sum of all integers from 1 to N (inclusive).",
        difficulty: "EASY",
        testCases: [
          { input: "5", expected: "15" },
          { input: "1", expected: "1" },
          { input: "10", expected: "55" },
        ],
      },
      {
        title: "Integer Division",
        description: "Return the result of integer division a / b (truncated).",
        difficulty: "EASY",
        testCases: [
          { input: "7\n2", expected: "3" },
          { input: "10\n3", expected: "3" },
          { input: "9\n3", expected: "3" },
        ],
      },
      {
        title: "Character to ASCII",
        description: "Return the ASCII (integer) value of the given single-character string.",
        difficulty: "MEDIUM",
        testCases: [
          { input: "A", expected: "65" },
          { input: "a", expected: "97" },
          { input: "0", expected: "48" },
        ],
      },
    ],
  },
};

async function seedModuleCoding(prisma) {
  const course = await prisma.course.findUnique({ where: { slug: "java" } });
  if (!course) return;

  let seededCount = 0;
  for (const [moduleTitle, spec] of Object.entries(MODULE_TESTS)) {
    const mod = await prisma.courseModule.findUnique({
      where: { courseId_title: { courseId: course.id, title: moduleTitle } },
    });
    if (!mod) continue;

    const test = await prisma.moduleCodingTest.upsert({
      where: { moduleId: mod.id },
      update: {},
      create: {
        moduleId: mod.id,
        title: spec.title,
        instructions: spec.instructions,
        questionCount: spec.questionCount,
        timeLimitMin: spec.timeLimitMin,
        passingPercent: spec.passingPercent,
        maxAttempts: spec.maxAttempts,
        cooldownMinutes: spec.cooldownMinutes,
      },
    });

    const existingCount = await prisma.question.count({ where: { moduleCodingTestId: test.id } });
    if (existingCount === 0) {
      for (const q of spec.questions) {
        const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: MODULE_CODING_SIGNATURES[q.title] });
        await prisma.question.create({
          data: {
            moduleCodingTestId: test.id,
            title: q.title,
            description: q.description,
            difficulty: q.difficulty || "EASY",
            questionType: "CODING",
            timeLimitMs: 3000,
            evaluationType: resolved.evaluationType,
            functionSignature: resolved.functionSignature,
            starterCodeByLanguage: resolved.starterCodeByLanguage,
            testCases: {
              create: q.testCases.map((tc, i) => ({ input: tc.input, expected: tc.expected, isHidden: i > 0 })),
            },
          },
        });
      }
      seededCount += spec.questions.length;
    }
  }

  console.log("Seeded module coding tests:", seededCount, "new questions across", Object.keys(MODULE_TESTS).length, "modules.");
}

module.exports = { seedModuleCoding };

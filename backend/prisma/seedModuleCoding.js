// Seeds a real, judge-verified proctored coding assessment for the two fully-authored modules
// (Module 1 "Introduction to Java", Module 2 "Java Basics") — the other 14 stub modules are left
// ungated by this feature (no ModuleCodingTest row = the lock-map gate is skipped entirely for
// them), exactly the same "seed a genuine smaller set, grow the rest via the admin CMS" approach
// used for the Learning Module's lesson content and the Interview Prep question bank.
// Idempotent and non-destructive to admin edits: the ModuleCodingTest config upserts with
// `update: {}`, and its question pool is only ever created once (skipped if any question already
// exists for that test), so admin edits/additions survive a redeploy untouched.

function javaStarter(body) {
  return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n${body}\n        // write your solution here\n    }\n}`;
}

const MODULE_TESTS = {
  "Introduction to Java": {
    title: "Module 1 Coding Assessment",
    instructions: "Solve every question in Java. Read input with Scanner and print only the required output — no extra text.",
    questionCount: 3,
    timeLimitMin: 30,
    passingPercent: 70,
    maxAttempts: 3,
    cooldownMinutes: 10,
    questions: [
      {
        title: "Sum of Two Integers",
        description: "Read two space-separated integers on one line and print their sum.",
        difficulty: "EASY",
        starterCode: javaStarter("        int a = sc.nextInt();\n        int b = sc.nextInt();"),
        testCases: [
          { input: "3 5", expected: "8" },
          { input: "-2 7", expected: "5" },
          { input: "0 0", expected: "0" },
        ],
      },
      {
        title: "Even or Odd",
        description: 'Read an integer and print "Even" if it is even, or "Odd" if it is odd.',
        difficulty: "EASY",
        starterCode: javaStarter("        int n = sc.nextInt();"),
        testCases: [
          { input: "4", expected: "Even" },
          { input: "7", expected: "Odd" },
          { input: "0", expected: "Even" },
        ],
      },
      {
        title: "String Length",
        description: "Read a line of text and print the number of characters in it.",
        difficulty: "EASY",
        starterCode: javaStarter("        String s = sc.nextLine();"),
        testCases: [
          { input: "hello", expected: "5" },
          { input: "Java", expected: "4" },
          { input: "a", expected: "1" },
        ],
      },
      {
        title: "Largest of Three",
        description: "Read three space-separated integers and print the largest of the three.",
        difficulty: "EASY",
        starterCode: javaStarter("        int a = sc.nextInt();\n        int b = sc.nextInt();\n        int c = sc.nextInt();"),
        testCases: [
          { input: "3 9 5", expected: "9" },
          { input: "1 1 1", expected: "1" },
          { input: "-4 -1 -9", expected: "-1" },
        ],
      },
    ],
  },
  "Java Basics": {
    title: "Module 2 Coding Assessment",
    instructions: "Solve every question in Java, applying the variables/operators/type-casting concepts from this module. Read input with Scanner and print only the required output.",
    questionCount: 3,
    timeLimitMin: 35,
    passingPercent: 70,
    maxAttempts: 3,
    cooldownMinutes: 10,
    questions: [
      {
        title: "Truncating Cast",
        description: "Read a decimal number and print it cast to an int (truncated toward zero, no rounding).",
        difficulty: "EASY",
        starterCode: javaStarter("        double d = sc.nextDouble();"),
        testCases: [
          { input: "9.7", expected: "9" },
          { input: "3.2", expected: "3" },
          { input: "-2.8", expected: "-2" },
        ],
      },
      {
        title: "Sum 1 to N",
        description: "Read an integer N and print the sum of all integers from 1 to N (inclusive) using a loop.",
        difficulty: "EASY",
        starterCode: javaStarter("        int n = sc.nextInt();"),
        testCases: [
          { input: "5", expected: "15" },
          { input: "1", expected: "1" },
          { input: "10", expected: "55" },
        ],
      },
      {
        title: "Integer Division",
        description: "Read two space-separated integers a and b and print the result of integer division a / b (truncated).",
        difficulty: "EASY",
        starterCode: javaStarter("        int a = sc.nextInt();\n        int b = sc.nextInt();"),
        testCases: [
          { input: "7 2", expected: "3" },
          { input: "10 3", expected: "3" },
          { input: "9 3", expected: "3" },
        ],
      },
      {
        title: "Character to ASCII",
        description: "Read a single character and print its ASCII (integer) value.",
        difficulty: "MEDIUM",
        starterCode: javaStarter("        char c = sc.next().charAt(0);"),
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
        await prisma.question.create({
          data: {
            moduleCodingTestId: test.id,
            title: q.title,
            description: q.description,
            difficulty: q.difficulty || "EASY",
            questionType: "CODING",
            starterCode: q.starterCode,
            timeLimitMs: 3000,
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

// Seeds the Java Learning Module: the full 16-module course structure from the spec, with
// complete hand-authored content for Modules 1-2 and placeholder lessons for Modules 3-16
// (topic titles only — real content for those gets filled in incrementally, either through the
// admin Learning CMS or in a future seed pass).
//
// Idempotent: safe to run on every container start. Course/Module are upserted by their natural
// unique keys (slug / courseId+title). Lesson content goes through upsertLessonContent, which
// only overwrites a lesson's content if it's missing or still the auto-generated placeholder —
// so re-running this after hand-authoring, say, Module 3 will "graduate" its stub lessons to
// real content without touching anything an admin already edited by hand. Practice questions
// are only inserted the first time a lesson has none, so re-running never duplicates them.

function section(label, html) {
  return html ? `<h4>${label}</h4>${html}` : "";
}

// Assembles one lesson's content into consistent HTML: explanation, example, syntax, notes,
// common mistakes, best practices, real-world use cases — the elements the spec requires for
// every topic.
function lessonHTML({ explanation, example, syntax, notes, mistakes, bestPractices, useCases }) {
  return [
    explanation ? `<p>${explanation}</p>` : "",
    syntax ? section("Syntax", `<pre><code>${syntax}</code></pre>`) : "",
    example ? section("Example", `<pre><code>${example}</code></pre>`) : "",
    notes ? section("Notes", `<ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>`) : "",
    mistakes ? section("Common mistakes", `<ul>${mistakes.map((n) => `<li>${n}</li>`).join("")}</ul>`) : "",
    bestPractices ? section("Best practices", `<ul>${bestPractices.map((n) => `<li>${n}</li>`).join("")}</ul>`) : "",
    useCases ? section("Real-world use cases", `<ul>${useCases.map((n) => `<li>${n}</li>`).join("")}</ul>`) : "",
  ].join("\n");
}

const MODULE1_LESSONS = [
  {
    title: "What is Java?",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation:
        "Java is a general-purpose, class-based, object-oriented programming language created by James Gosling at Sun Microsystems (first released in 1995, now owned by Oracle). Its defining promise is <strong>\"Write Once, Run Anywhere\" (WORA)</strong>: source code compiles to an intermediate form called bytecode, which runs unchanged on any device with a Java Virtual Machine (JVM) — Windows, Linux, macOS, or embedded hardware.",
      notes: [
        "Java is statically typed and compiled (to bytecode), then interpreted/JIT-compiled by the JVM at runtime.",
        "It's used across web backends, Android apps, enterprise systems, big data tools (Hadoop, Spark), and embedded devices.",
      ],
      useCases: [
        "Backend services for banks and e-commerce platforms (Spring Boot).",
        "Android app development (Java/Kotlin on the JVM).",
        "Large-scale enterprise systems where portability and long-term stability matter.",
      ],
    }),
  },
  {
    title: "Features of Java",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Java's design goals map directly to a well-known set of features worth memorizing for interviews:",
      notes: [
        "<strong>Simple</strong> — no pointers or manual memory management (garbage-collected).",
        "<strong>Object-Oriented</strong> — everything (except primitives) is modeled as an object.",
        "<strong>Platform-Independent</strong> — bytecode runs on any JVM.",
        "<strong>Secure</strong> — no explicit pointers, bytecode verification, sandboxed execution.",
        "<strong>Robust</strong> — strong compile-time type checking and runtime exception handling.",
        "<strong>Multithreaded</strong> — built-in support for concurrent execution.",
        "<strong>High Performance</strong> — Just-In-Time (JIT) compilation of bytecode to native code.",
        "<strong>Distributed</strong> — networking libraries (RMI, sockets) built into the standard library.",
      ],
      bestPractices: ["Be able to explain WORA and garbage collection specifically — they're the two most-asked \"why Java\" interview points."],
    }),
  },
  {
    title: "History of Java",
    estimatedMinutes: 6,
    content: lessonHTML({
      explanation:
        "Java began in 1991 as \"Oak\", a project by James Gosling and team at Sun Microsystems aimed at interactive television and embedded consumer devices. Oak was renamed <strong>Java</strong> and publicly released in 1995, targeted instead at the newly-exploding World Wide Web via applets. Sun was acquired by <strong>Oracle</strong> in 2010, which now stewards the language.",
      notes: [
        "Java follows a numbered release model: Java 8 (2014, LTS — lambdas/streams), Java 11 (2018, LTS), Java 17 (2021, LTS), Java 21 (2023, LTS).",
        "Since Java 9, releases ship every 6 months, with certain versions marked Long-Term Support (LTS).",
      ],
    }),
  },
  {
    title: "JDK, JRE, JVM",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "These three acronyms are the single most commonly confused Java basics — keep the containment relationship in mind: <strong>JDK ⊃ JRE ⊃ JVM</strong>.",
      notes: [
        "<strong>JVM (Java Virtual Machine)</strong> — the runtime engine that executes bytecode. Platform-specific implementation, platform-independent bytecode.",
        "<strong>JRE (Java Runtime Environment)</strong> — JVM + standard class libraries. Enough to <em>run</em> compiled Java programs, not to compile them.",
        "<strong>JDK (Java Development Kit)</strong> — JRE + development tools (<code>javac</code> compiler, debugger, <code>javadoc</code>). Needed to <em>write and compile</em> Java code.",
      ],
      bestPractices: ["Install the JDK (not just the JRE) for development — the JRE alone has no compiler."],
    }),
  },
  {
    title: "Java Architecture",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "A Java program's journey from source to execution: <code>.java</code> source file → compiled by <code>javac</code> into <code>.class</code> bytecode → loaded by the JVM's <strong>Class Loader</strong> → verified by the <strong>Bytecode Verifier</strong> for security/type-safety → executed by the <strong>Execution Engine</strong> (interpreter + JIT compiler), which the <strong>JIT</strong> increasingly compiles to native machine code for hot code paths.",
      notes: [
        "The JVM also manages the <strong>heap</strong> (object storage, garbage-collected) and per-thread <strong>stacks</strong> (method calls, local variables).",
        "Garbage Collection (GC) automatically reclaims heap memory for objects with no reachable references.",
      ],
    }),
  },
  {
    title: "Installing Java",
    estimatedMinutes: 6,
    content: lessonHTML({
      explanation: "Download the JDK from Oracle or an OpenJDK distribution (Adoptium/Temurin, Amazon Corretto). After installing, add it to your system PATH and confirm with:",
      syntax: "java -version\njavac -version",
      notes: [
        "Prefer a Long-Term Support (LTS) release (17 or 21) for learning and production use.",
        "On most systems the installer sets <code>JAVA_HOME</code> automatically — verify it if compilation fails with \"javac not found\".",
      ],
      mistakes: ["Installing only the JRE, then being unable to find <code>javac</code> to compile anything."],
    }),
  },
  {
    title: "Setting up the IDE",
    estimatedMinutes: 6,
    content: lessonHTML({
      explanation:
        "An IDE (Integrated Development Environment) adds code completion, debugging, and project management on top of the JDK. Popular choices: <strong>IntelliJ IDEA</strong> (Community Edition is free and widely used), <strong>Eclipse</strong>, and <strong>VS Code</strong> with the Java Extension Pack.",
      notes: [
        "Point the IDE at your installed JDK when creating a new project (it will ask for a \"Project SDK\").",
        "A plain text editor + terminal (<code>javac</code>/<code>java</code>) works too, and is worth doing at least once to understand what the IDE automates.",
      ],
    }),
  },
  {
    title: "First Java Program",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Every Java application needs a class containing a <code>main</code> method — the JVM's entry point.",
      syntax:
        "public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
      example:
        "// Save as HelloWorld.java — the filename MUST match the public class name\npublic class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println(\"Hello, World!\");\n    }\n}",
      notes: [
        "<code>public static void main(String[] args)</code> is the exact signature the JVM looks for — <code>public</code> (JVM can call it from outside), <code>static</code> (no object needed), <code>void</code> (returns nothing), <code>String[] args</code> (command-line arguments).",
      ],
      mistakes: [
        "File name not matching the public class name exactly (case-sensitive) — this is a compile error, not a warning.",
        "Misspelling the <code>main</code> signature (e.g. lowercase <code>String[] Args</code>) — the JVM simply won't find an entry point and throws <code>NoSuchMethodError</code>.",
      ],
    }),
  },
  {
    title: "Compilation Process",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "Compiling and running <code>HelloWorld.java</code> from the command line:",
      syntax: "javac HelloWorld.java   # produces HelloWorld.class (bytecode)\njava HelloWorld         # JVM loads and runs the class (no .class extension)",
      notes: [
        "<code>javac</code> only compiles — it never executes your program.",
        "<code>java</code> runs a compiled class — you pass the class name, not the filename.",
      ],
      mistakes: ["Running <code>java HelloWorld.class</code> instead of <code>java HelloWorld</code> — the JVM expects a class name, not a file path."],
    }),
  },
];

const MODULE1_QUIZ = [
  {
    prompt: "What does the JVM execute?",
    options: ["Java source code (.java)", "Bytecode (.class)", "Native machine code directly", "XML configuration"],
    correctAnswer: 1,
    explanation: "javac compiles .java source into platform-independent bytecode (.class), which the JVM interprets/JIT-compiles at runtime.",
  },
  {
    prompt: "Which of these is needed to COMPILE Java code (not just run it)?",
    options: ["JRE", "JVM", "JDK", "Class Loader"],
    correctAnswer: 2,
    explanation: "The JDK includes the javac compiler; the JRE only contains what's needed to run already-compiled bytecode.",
  },
  {
    prompt: "What does \"Write Once, Run Anywhere\" refer to?",
    options: [
      "Java code never needs updating",
      "Compiled bytecode runs unmodified on any platform with a JVM",
      "Java has no compiler",
      "Java programs are automatically translated to other languages",
    ],
    correctAnswer: 1,
    explanation: "Bytecode is platform-independent; only the JVM implementation itself is platform-specific.",
  },
  {
    prompt: "Which command compiles HelloWorld.java?",
    options: ["java HelloWorld.java", "javac HelloWorld.java", "run HelloWorld.java", "javac HelloWorld"],
    correctAnswer: 1,
    explanation: "javac takes the .java source filename and produces a .class bytecode file.",
  },
  {
    prompt: "In `public static void main(String[] args)`, why is `static` required?",
    options: [
      "So the JVM can call main() without first creating an object of the class",
      "So the method runs faster",
      "It's optional in modern Java",
      "So the method can return a value",
    ],
    correctAnswer: 0,
    explanation: "static methods belong to the class itself, so the JVM can invoke main() before any object exists.",
  },
];

const MODULE2_LESSONS = [
  {
    title: "Variables",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation:
        "A variable is a named storage location for a value. Java is <strong>statically typed</strong> — every variable must be declared with a type before use, and that type never changes.",
      syntax: "int age;        // declaration\nage = 21;        // assignment\n\nint marks = 95;  // declaration + initialization in one line",
      notes: [
        "Three kinds: <strong>local</strong> (inside a method, must be initialized before use), <strong>instance</strong> (per-object field, defaults applied), <strong>static</strong> (shared across all instances of a class).",
      ],
      mistakes: ["Using a local variable before assigning it a value — this is a compile-time error in Java (\"variable might not have been initialized\"), not a silent bug."],
      bestPractices: ["Use descriptive camelCase names (<code>totalScore</code>, not <code>ts</code>) and declare a variable as close as possible to where it's first used."],
    }),
  },
  {
    title: "Data Types",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Java has 8 built-in <strong>primitive types</strong> plus <strong>reference types</strong> (objects, arrays, Strings).",
      syntax:
        "byte b = 100;        // 1 byte,  -128 to 127\nshort s = 30000;     // 2 bytes, -32,768 to 32,767\nint i = 2_000_000;   // 4 bytes (default for whole numbers)\nlong l = 10_000_000_000L;  // 8 bytes — needs the L suffix\nfloat f = 3.14f;     // 4 bytes — needs the f suffix\ndouble d = 3.14159;  // 8 bytes (default for decimals)\nchar c = 'A';        // 2 bytes, single Unicode character\nboolean flag = true; // true or false",
      notes: [
        "<code>int</code> and <code>double</code> are the defaults you reach for unless you have a specific reason (memory constraints, exact requirements) to pick a smaller/larger type.",
        "Reference types (String, arrays, custom classes) store a reference to an object on the heap, not the value itself — this is why Strings are compared with <code>.equals()</code>, not <code>==</code>.",
      ],
      mistakes: [
        "Forgetting the <code>L</code> suffix on a long literal larger than int's range — <code>long x = 10000000000;</code> fails to compile because the literal itself is parsed as an int first.",
        "Forgetting the <code>f</code> suffix on a float literal — Java treats decimal literals as <code>double</code> by default.",
      ],
    }),
  },
  {
    title: "Operators",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Java groups operators into arithmetic, relational, logical, assignment, bitwise, and the ternary conditional operator.",
      syntax:
        "+ - * / %        // arithmetic\n== != < > <= >=  // relational — returns boolean\n&& || !          // logical AND / OR / NOT\n= += -= *= /=    // assignment\n& | ^ ~ << >> >>> // bitwise\ncondition ? a : b // ternary",
      example: "int result = 5 + 3 * 2;   // 11, not 16 — * binds tighter than +\nint q = 7 / 2;             // 3 — integer division truncates\ndouble r = 7.0 / 2;        // 3.5 — at least one operand must be floating-point",
      mistakes: [
        "Using <code>=</code> (assignment) instead of <code>==</code> (comparison) inside an <code>if</code> — for booleans this is a compile error, but it's a classic bug in languages that allow it.",
        "Expecting <code>/</code> between two ints to give a decimal — it truncates toward zero. Cast at least one operand to <code>double</code> if you need a fractional result.",
      ],
    }),
  },
  {
    title: "User Input",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "The <code>Scanner</code> class (from <code>java.util</code>) reads input from <code>System.in</code> — the standard way to read user/stdin input in Java.",
      syntax:
        "import java.util.Scanner;\n\nScanner sc = new Scanner(System.in);\nint age = sc.nextInt();\nString name = sc.nextLine();\ndouble price = sc.nextDouble();",
      example:
        "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        System.out.print(\"Enter your age: \");\n        int age = sc.nextInt();\n        System.out.println(\"You are \" + age + \" years old.\");\n    }\n}",
      mistakes: [
        "Calling <code>nextInt()</code> then <code>nextLine()</code> back to back — <code>nextInt()</code> doesn't consume the trailing newline, so the following <code>nextLine()</code> reads an empty string instead of the next line. Add an extra <code>sc.nextLine()</code> to consume it, or use <code>nextLine()</code> + <code>Integer.parseInt()</code> consistently.",
      ],
    }),
  },
  {
    title: "Type Casting",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "<strong>Widening (implicit)</strong> casting happens automatically when converting a smaller type to a larger one (no data loss possible): <code>byte → short → int → long → float → double</code>. <strong>Narrowing (explicit)</strong> casting — converting a larger type to a smaller one — requires an explicit cast and can lose data.",
      syntax: "int i = 100;\ndouble d = i;        // widening — automatic\n\ndouble price = 9.99;\nint whole = (int) price;  // narrowing — explicit cast required",
      example: "double d = 9.7;\nint i = (int) d;   // i = 9 — TRUNCATES, does not round",
      mistakes: ["Assuming <code>(int)</code> rounds to the nearest whole number — it truncates the decimal part. Use <code>Math.round()</code> if you actually want rounding."],
    }),
  },
  {
    title: "Comments",
    estimatedMinutes: 5,
    content: lessonHTML({
      explanation: "Java supports three comment styles:",
      syntax: "// single-line comment\n\n/* multi-line\n   comment */\n\n/**\n * Javadoc comment — generates HTML documentation via the javadoc tool.\n * @param x description of x\n */",
      bestPractices: ["Comment the <em>why</em>, not the <em>what</em> — well-named variables and methods already say what the code does; a comment should explain a non-obvious reason or constraint."],
    }),
  },
  {
    title: "Keywords",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "Keywords are reserved words with special meaning to the compiler — they cannot be used as variable, method, or class names.",
      notes: [
        "Common ones: <code>class</code>, <code>public</code>, <code>private</code>, <code>static</code>, <code>void</code>, <code>int</code>, <code>if</code>, <code>else</code>, <code>for</code>, <code>while</code>, <code>return</code>, <code>new</code>, <code>this</code>, <code>super</code>, <code>try</code>, <code>catch</code>, <code>finally</code>, <code>import</code>, <code>package</code>, <code>extends</code>, <code>implements</code>.",
        "<code>true</code>, <code>false</code>, and <code>null</code> are technically <em>literals</em>, not keywords — but they're reserved the same way and can't be used as identifiers either.",
        "<code>var</code> (Java 10+) is a reserved type name for local-variable type inference, not a full keyword — it can still be used as an identifier in some contexts, though it's best avoided.",
      ],
    }),
  },
  {
    title: "Identifiers",
    estimatedMinutes: 6,
    content: lessonHTML({
      explanation: "An identifier is the name given to a variable, method, class, or package.",
      notes: [
        "Rules: may contain letters, digits, underscore <code>_</code>, and dollar sign <code>$</code>; cannot start with a digit; cannot be a reserved keyword; is case-sensitive (<code>age</code> and <code>Age</code> are different identifiers).",
        "Conventions (not enforced by the compiler, but expected everywhere): <code>camelCase</code> for variables/methods, <code>PascalCase</code> for classes/interfaces, <code>UPPER_SNAKE_CASE</code> for constants.",
      ],
      mistakes: ["Starting an identifier with a digit (<code>2ndValue</code>) — this is a compile error, not just a style issue."],
    }),
  },
];

const MODULE2_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is the size of an `int` in Java?",
    options: ["2 bytes", "4 bytes", "8 bytes", "Depends on the platform"],
    correctAnswer: 1,
    explanation: "Java's primitive sizes are fixed by the language spec regardless of platform — int is always 4 bytes.",
  },
  {
    type: "MCQ",
    prompt: "Which type holds a single character?",
    options: ["String", "char", "byte", "Character (only)"],
    correctAnswer: 1,
    explanation: "char is the primitive type for a single 16-bit Unicode character, e.g. 'A'.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does `System.out.println(7 / 2);` print?",
    options: ["3", "3.5", "4", "Compile error"],
    correctAnswer: 0,
    explanation: "Integer division between two ints truncates toward zero: 7/2 = 3, not 3.5.",
  },
  {
    type: "MCQ",
    prompt: "Which conversion requires an explicit cast?",
    options: ["int to double", "float to double", "double to int", "byte to int"],
    correctAnswer: 2,
    explanation: "double to int is narrowing (loses the fractional part), so Java requires an explicit (int) cast to make the possible data loss visible in the code.",
  },
  {
    type: "DEBUG",
    prompt: "Which of these is NOT a valid Java identifier?",
    options: ["_value", "$value", "valueTwo", "2ndValue"],
    correctAnswer: 3,
    explanation: "Identifiers cannot start with a digit. Underscore and dollar sign are both legal starting characters.",
  },
];

const MODULE2_CODING = [
  {
    type: "CODING",
    prompt: "Read one integer and print \"Even\" if it's even, or \"Odd\" if it's odd.",
    language: "java",
    starterCode:
      "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int n = sc.nextInt();\n        // write your code here\n    }\n}",
    testCases: [{ input: "4", expected: "Even" }, { input: "7", expected: "Odd" }, { input: "0", expected: "Even" }],
    explanation: "n % 2 == 0 means n is even (the remainder of dividing by 2 is zero).",
  },
  {
    type: "CODING",
    prompt: "Read two integers on one line, separated by a space, and print their sum.",
    language: "java",
    starterCode:
      "import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        int a = sc.nextInt();\n        int b = sc.nextInt();\n        // write your code here\n    }\n}",
    testCases: [{ input: "3 5", expected: "8" }, { input: "10 20", expected: "30" }, { input: "-5 5", expected: "0" }],
    explanation: "Scanner's nextInt() reads whitespace-separated tokens regardless of whether they're on the same line.",
  },
];

// Modules 3-16: topic list + trailing practice-section label from the spec. Real lesson
// content isn't hand-authored for these — each gets a placeholder lesson body so the course
// tree, navigation, and progress tracking all work end-to-end, ready for an admin to fill in
// real content via the Learning Management admin panel.
const REMAINING_MODULES = [
  { title: "Control Statements", topics: ["if", "if-else", "Nested if", "switch", "for loop", "while loop", "do-while", "break", "continue"], practiceLabel: "Coding Problems" },
  { title: "Methods", topics: ["Methods", "Parameters", "Return Types", "Method Overloading", "Recursion", "Variable Scope"], practiceLabel: "Practice Problems" },
  { title: "Arrays", topics: ["1D Arrays", "2D Arrays", "Array Operations", "Searching", "Sorting"], practiceLabel: "Coding Exercises" },
  { title: "Strings", topics: ["String", "StringBuilder", "StringBuffer", "String Methods", "Regular Expressions"], practiceLabel: "Coding Problems" },
  { title: "Object-Oriented Programming (OOP)", topics: ["Classes", "Objects", "Constructors", "Inheritance", "Polymorphism", "Abstraction", "Encapsulation", "Interfaces"], practiceLabel: "Mini Quiz & Coding Exercises" },
  { title: "Exception Handling", topics: ["try", "catch", "finally", "throw", "throws", "Custom Exceptions"], practiceLabel: "Coding Problems" },
  { title: "Collections Framework", topics: ["ArrayList", "LinkedList", "HashMap", "HashSet", "TreeMap", "Queue", "Stack", "PriorityQueue"], practiceLabel: "Practice Questions" },
  { title: "File Handling", topics: ["Reading Files", "Writing Files", "BufferedReader", "FileWriter", "Scanner"], practiceLabel: "Coding Problems" },
  { title: "Multithreading", topics: ["Threads", "Runnable", "Synchronization", "Thread Lifecycle"], practiceLabel: "Practice" },
  { title: "Java 8 Features", topics: ["Lambda Expressions", "Stream API", "Functional Interfaces", "Optional", "Method References"], practiceLabel: "Practice" },
  { title: "JDBC", topics: ["Database Connectivity", "CRUD Operations", "PreparedStatement", "ResultSet"], practiceLabel: "Mini Project" },
  { title: "Advanced Java", topics: ["Generics", "Reflection", "Serialization", "Networking", "Annotations"], practiceLabel: "Coding Practice" },
  { title: "Data Structures & Algorithms in Java", topics: ["Arrays", "Linked Lists", "Stack", "Queue", "Trees", "Graphs", "Sorting", "Searching"], practiceLabel: "Coding Problems" },
  { title: "Interview Preparation", topics: ["Frequently Asked Java Interview Questions", "MCQs", "Coding Questions", "Company-based Questions", "Previous Placement Questions"], practiceLabel: null },
];

// A lesson's content is only overwritten if it's missing or still carries the auto-generated
// placeholder text — a real admin edit (or previously-seeded real content) is left untouched.
// This lets later seed runs "graduate" a module from stub to real content (e.g. authoring
// Module 3 in a future pass) without clobbering anything a human already changed.
function isPlaceholderContent(content) {
  if (!content) return true;
  return content.includes("is coming soon") || content.includes("will be added soon");
}

// isModuleTest is structural metadata the seed owns (not admin-editable prose), so unlike
// `content` it's synced unconditionally on every run rather than gated by the placeholder
// check — this is what retroactively flags already-seeded trailing lessons as the module's
// gating test once this field is introduced.
async function upsertLessonContent(prisma, moduleId, title, { content, estimatedMinutes = 10, order, isModuleTest = false }) {
  const existing = await prisma.lesson.findUnique({ where: { moduleId_title: { moduleId, title } } });
  if (!existing) {
    return prisma.lesson.create({ data: { moduleId, title, order, content, estimatedMinutes, isModuleTest } });
  }
  const data = { isModuleTest };
  if (isPlaceholderContent(existing.content)) {
    data.content = content;
    data.estimatedMinutes = estimatedMinutes;
  }
  return prisma.lesson.update({ where: { id: existing.id }, data });
}

async function seedLearningModule(prisma) {
  const course = await prisma.course.upsert({
    where: { slug: "java" },
    update: {},
    create: {
      slug: "java", name: "Java", order: 0, isActive: true,
      description: "Learn Java from basics to advanced — syntax, OOP, collections, multithreading, JDBC, and interview prep.",
    },
  });

  for (const slug of [
    { slug: "python", name: "Python" },
    { slug: "cpp", name: "C++" },
    { slug: "sql", name: "SQL" },
  ]) {
    await prisma.course.upsert({
      where: { slug: slug.slug },
      update: {},
      create: { slug: slug.slug, name: slug.name, order: slug.slug === "python" ? 1 : slug.slug === "cpp" ? 2 : 3, isActive: false, description: "Coming soon." },
    });
  }

  // --- Module 1: full hand-authored content ---
  const module1 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Introduction to Java" } },
    update: {},
    create: { courseId: course.id, title: "Introduction to Java", order: 0 },
  });

  for (let i = 0; i < MODULE1_LESSONS.length; i++) {
    const l = MODULE1_LESSONS[i];
    await upsertLessonContent(prisma, module1.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const quizLesson = await upsertLessonContent(prisma, module1.id, "Practice Quiz", {
    content: "<p>Test what you've learned in this module.</p>", estimatedMinutes: 10, order: MODULE1_LESSONS.length,
    isModuleTest: true,
  });
  const existingQuiz = await prisma.practiceQuestion.count({ where: { lessonId: quizLesson.id } });
  if (existingQuiz === 0) {
    for (let i = 0; i < MODULE1_QUIZ.length; i++) {
      const q = MODULE1_QUIZ[i];
      await prisma.practiceQuestion.create({
        data: {
          lessonId: quizLesson.id, type: "MCQ", prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: i,
        },
      });
    }
  }

  // --- Module 2: full hand-authored content ---
  const module2 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Java Basics" } },
    update: {},
    create: { courseId: course.id, title: "Java Basics", order: 1 },
  });

  for (let i = 0; i < MODULE2_LESSONS.length; i++) {
    const l = MODULE2_LESSONS[i];
    await upsertLessonContent(prisma, module2.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module2PracticeLesson = await upsertLessonContent(prisma, module2.id, "Practice Questions & Coding Exercises", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE2_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule2Practice = await prisma.practiceQuestion.count({ where: { lessonId: module2PracticeLesson.id } });
  if (existingModule2Practice === 0) {
    let order = 0;
    for (const q of MODULE2_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module2PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE2_CODING) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module2PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          starterCode: q.starterCode, testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Modules 3-16: stub structure only, real content added later via admin CMS ---
  for (let m = 0; m < REMAINING_MODULES.length; m++) {
    const spec = REMAINING_MODULES[m];
    const mod = await prisma.courseModule.upsert({
      where: { courseId_title: { courseId: course.id, title: spec.title } },
      update: {},
      create: { courseId: course.id, title: spec.title, order: m + 2 },
    });

    for (let t = 0; t < spec.topics.length; t++) {
      await upsertLessonContent(prisma, mod.id, spec.topics[t], {
        content: `<p><em>Content for "${spec.topics[t]}" is coming soon. Add it from the admin Learning Management panel.</em></p>`,
        estimatedMinutes: 10, order: t,
      });
    }

    if (spec.practiceLabel) {
      // Not flagged isModuleTest yet — a gating test with zero questions would make this
      // module (and everything after it) permanently unpassable. Left as a regular lesson
      // (mark-complete like any other) until real practice questions are authored for it,
      // at which point flip isModuleTest true in that same pass.
      await upsertLessonContent(prisma, mod.id, spec.practiceLabel, {
        content: "<p><em>Practice questions for this module will be added soon.</em></p>",
        estimatedMinutes: 15, order: spec.topics.length,
      });
    }
  }

  console.log("Seeded Learning Module: Java course with", REMAINING_MODULES.length + 2, "modules.");
}

module.exports = { seedLearningModule };

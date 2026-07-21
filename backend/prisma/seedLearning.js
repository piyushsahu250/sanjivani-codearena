// Seeds the Java Learning Module: the full 16-module course structure from the spec, with
// complete hand-authored content for Modules 1-3 and placeholder lessons for Modules 4-16
// (topic titles only — real content for those gets filled in incrementally, either through the
// admin Learning CMS or in a future seed pass).
//
// Idempotent: safe to run on every container start. Course/Module are upserted by their natural
// unique keys (slug / courseId+title). Lesson content goes through upsertLessonContent, which
// only overwrites a lesson's content if it's missing or still the auto-generated placeholder —
// so re-running this after hand-authoring, say, Module 4 will "graduate" its stub lessons to
// real content without touching anything an admin already edited by hand. Practice questions
// are only inserted the first time a lesson has none, so re-running never duplicates them.

const { resolveCodingFields } = require("../src/utils/functionHarness");
const { PRACTICE_CODING_SIGNATURES } = require("./functionSignatures");

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

// LeetCode-style FUNCTION mode — the student implements only the method matching
// PRACTICE_CODING_SIGNATURES[prompt] (functionSignatures.js); resolveCodingFields() generates the
// real starterCodeByLanguage from that signature in the create loop below, same as every admin
// CRUD route does — never hand-authored here.
const MODULE2_CODING = [
  {
    type: "CODING",
    prompt: "Read one integer and print \"Even\" if it's even, or \"Odd\" if it's odd.",
    language: "java",
    testCases: [{ input: "4", expected: "Even" }, { input: "7", expected: "Odd" }, { input: "0", expected: "Even" }],
    explanation: "n % 2 == 0 means n is even (the remainder of dividing by 2 is zero).",
  },
  {
    type: "CODING",
    prompt: "Read two integers on one line, separated by a space, and print their sum.",
    language: "java",
    testCases: [{ input: "3\n5", expected: "8" }, { input: "10\n20", expected: "30" }, { input: "-5\n5", expected: "0" }],
    explanation: "Each parameter is passed on its own line.",
  },
];

const MODULE3_LESSONS = [
  {
    title: "if",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation:
        "The <code>if</code> statement executes a block of code only when its boolean condition evaluates to <code>true</code>. It's the most basic branching construct in Java.",
      syntax: "if (condition) {\n    // executed only if condition is true\n}",
      example: "int age = 20;\nif (age >= 18) {\n    System.out.println(\"Eligible to vote\");\n}",
      notes: [
        "The condition must be a genuine boolean expression — unlike C, Java does not treat <code>int</code> as truthy; <code>if (1)</code> is a compile error.",
        "Braces <code>{}</code> are optional for a single-statement body, but omitting them is a common source of bugs when a second line is added later.",
      ],
      mistakes: [
        "Writing <code>if (flag = true)</code> instead of <code>if (flag == true)</code> — for a <code>boolean</code> variable this compiles and silently always evaluates to the assigned value, since <code>=</code> is an assignment expression that itself evaluates to what was assigned.",
        "Assuming an unbraced <code>if</code> applies to every line that follows just because it's indented the same way — Java attaches an unbraced <code>if</code> to exactly one statement, regardless of indentation.",
      ],
      bestPractices: ["Always use braces, even for a single-statement body — it prevents the classic \"added a second line, forgot to add braces\" bug."],
    }),
  },
  {
    title: "if-else",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "An <code>if-else</code> statement provides an alternative branch for when the condition is false. Chaining <code>else if</code> lets you test multiple conditions in sequence, stopping at the first one that's true.",
      syntax: "if (condition1) {\n    // ...\n} else if (condition2) {\n    // ...\n} else {\n    // runs only if none of the above matched\n}",
      example:
        "int marks = 72;\nString grade;\nif (marks >= 90) {\n    grade = \"A\";\n} else if (marks >= 75) {\n    grade = \"B\";\n} else if (marks >= 60) {\n    grade = \"C\";\n} else {\n    grade = \"F\";\n}\nSystem.out.println(grade); // C",
      notes: [
        "Only ONE branch of an if-else-if chain ever runs — evaluation stops at the first true condition, even if a later condition would also have matched.",
        "The final <code>else</code> is optional; without it, if no condition matches, nothing happens.",
      ],
      mistakes: ["Ordering conditions loosest-first (e.g. checking <code>marks >= 60</code> before <code>marks >= 90</code>) — every score of 90+ would incorrectly stop at the looser branch first."],
    }),
  },
  {
    title: "Nested if",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation:
        "A nested <code>if</code> is an <code>if</code> (or <code>if-else</code>) statement placed inside the body of another <code>if</code>. It's used when a decision depends on more than one condition being checked in stages.",
      syntax: "if (outerCondition) {\n    if (innerCondition) {\n        // both true\n    }\n}",
      example:
        "int age = 25;\nboolean hasLicense = true;\nif (age >= 18) {\n    if (hasLicense) {\n        System.out.println(\"Can drive\");\n    } else {\n        System.out.println(\"Needs a license\");\n    }\n} else {\n    System.out.println(\"Too young to drive\");\n}",
      notes: [
        "Deep nesting (3+ levels) hurts readability — the same logic can often be flattened using <code>&&</code> to combine conditions in a single <code>if</code>.",
        "Always brace nested blocks, even though the compiler resolves a dangling <code>else</code> unambiguously (to the nearest unmatched <code>if</code>) — braces make it unambiguous for a human skimming the code too.",
      ],
      bestPractices: ["Prefer combining conditions with <code>&&</code> over nesting when both conditions must be true together and there's no need to separately handle the outer-false case."],
    }),
  },
  {
    title: "switch",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation:
        "A <code>switch</code> statement selects one of several code blocks to execute based on the value of a single variable — a more readable alternative to a long if-else-if chain over discrete values.",
      syntax: "switch (value) {\n    case option1:\n        // ...\n        break;\n    case option2:\n        // ...\n        break;\n    default:\n        // ...\n}",
      example:
        "int day = 3;\nString name;\nswitch (day) {\n    case 1: name = \"Monday\"; break;\n    case 2: name = \"Tuesday\"; break;\n    case 3: name = \"Wednesday\"; break;\n    default: name = \"Unknown\";\n}\nSystem.out.println(name); // Wednesday",
      notes: [
        "<code>switch</code> works on <code>int</code>/<code>char</code>/<code>String</code>/<code>enum</code> values (and their wrapper types) — not on <code>boolean</code> or floating-point types.",
        "Java 14+ also has a newer arrow-form switch expression (<code>case 3 -> \"Wednesday\";</code>) that returns a value directly and never falls through — worth recognizing, though the classic colon-form above is still the most common in existing code.",
      ],
      mistakes: [
        "Forgetting <code>break</code> at the end of a case — execution \"falls through\" into the next case's code instead of exiting the switch. This is a classic interview trick question and a real production bug source.",
        "Forgetting a <code>default</code> case — if no case matches and there's no default, the switch simply does nothing, silently skipping logic the developer expected to run.",
      ],
      bestPractices: [
        "Always include a <code>default</code> case, even just to handle unexpected values defensively.",
        "Only stack case labels with no break between them when the fall-through is deliberate — and comment it as such.",
      ],
    }),
  },
  {
    title: "for loop",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A <code>for</code> loop repeats a block of code a known number of times, combining initialization, condition, and update into one line.",
      syntax: "for (initialization; condition; update) {\n    // repeated while condition is true\n}",
      example:
        "for (int i = 1; i <= 5; i++) {\n    System.out.println(i);\n} // prints 1 2 3 4 5, each on its own line\n\n// enhanced for-each loop — iterates every element of an array/collection\nint[] nums = {10, 20, 30};\nfor (int n : nums) {\n    System.out.println(n);\n}",
      notes: [
        "All three parts (initialization, condition, update) are optional — <code>for (;;) {}</code> is a valid infinite loop.",
        "The enhanced for-each form (<code>for (Type x : collection)</code>) is preferred when you only need each element's value, not its index — less error-prone, but it can't modify the underlying array by index or track position.",
      ],
      mistakes: [
        "Off-by-one errors — using <code>&lt;=</code> when you meant <code>&lt;</code> (or vice versa) is the single most common loop bug; always check the boundary against the first/last value you actually want.",
        "Modifying the loop variable inside the loop body in addition to the update clause — this makes the iteration count hard to reason about and is rarely intentional.",
      ],
      bestPractices: ["Use a <code>for</code> loop when the number of iterations is known ahead of time (a count, an array length); reach for <code>while</code> when the stopping condition depends on something computed during the loop."],
    }),
  },
  {
    title: "while loop",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "A <code>while</code> loop repeats a block of code as long as its condition remains true, checking the condition BEFORE each iteration (including the first).",
      syntax: "while (condition) {\n    // repeated while condition is true\n}",
      example: "int count = 0;\nwhile (count < 3) {\n    System.out.println(\"Count: \" + count);\n    count++;\n}\n// prints Count: 0, Count: 1, Count: 2",
      notes: [
        "Because the condition is checked first, a <code>while</code> loop can run zero times if the condition is already false on entry.",
        "The loop body must eventually make the condition false, or it runs forever — a genuine infinite loop, not something the compiler can catch.",
      ],
      mistakes: [
        "Forgetting to update the variable the condition depends on inside the loop body — the most common cause of an accidental infinite loop.",
        "Using <code>while</code> when the number of iterations is actually fixed and known in advance — a <code>for</code> loop keeps the initialization/condition/update together and is easier to audit for off-by-one mistakes.",
      ],
    }),
  },
  {
    title: "do-while",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation:
        "A <code>do-while</code> loop is like a <code>while</code> loop, but it checks its condition AFTER each iteration — so the body always executes at least once, even if the condition is false from the start.",
      syntax: "do {\n    // executed at least once\n} while (condition);",
      example:
        "int input;\ndo {\n    System.out.println(\"Requesting input...\");\n    input = getSimulatedInput();\n} while (input < 0);\n// the prompt runs at least once, even if input turns out to already be valid on the first try",
      notes: [
        "The trailing semicolon after <code>while (condition);</code> is required for <code>do-while</code> — easy to forget, unlike the other loop forms.",
        "Classic use case: menu-driven programs, where you want to show the menu at least once before checking whether the user chose to exit.",
      ],
      mistakes: [
        "Using a <code>do-while</code> when a plain <code>while</code> would be correct — if there's any chance the body shouldn't run at all, a <code>do-while</code> runs it anyway, producing a spurious first pass.",
      ],
    }),
  },
  {
    title: "break",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "The <code>break</code> statement immediately exits the nearest enclosing loop (<code>for</code>/<code>while</code>/<code>do-while</code>) or <code>switch</code> statement, skipping any remaining iterations or cases.",
      syntax: "for (int i = 0; i < 10; i++) {\n    if (i == 5) {\n        break; // exits the loop entirely once i reaches 5\n    }\n    System.out.println(i);\n} // prints 0 1 2 3 4",
      example:
        "// labeled break — exits an OUTER loop from inside a nested loop\nouter:\nfor (int i = 0; i < 3; i++) {\n    for (int j = 0; j < 3; j++) {\n        if (j == 1) {\n            break outer;\n        }\n        System.out.println(i + \",\" + j);\n    }\n}\n// prints only 0,0 — the labeled break exits BOTH loops immediately",
      notes: [
        "A plain, unlabeled <code>break</code> only exits the SINGLE nearest loop or switch it's directly inside — not any outer loops.",
        "A labeled break (<code>label:</code> before the outer loop, <code>break label;</code> inside) exits multiple nested loops at once without needing a boolean \"stop flag\" variable.",
      ],
      mistakes: ["Expecting an unlabeled <code>break</code> inside a nested loop to exit both loops — it only exits the innermost one."],
    }),
  },
  {
    title: "continue",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "The <code>continue</code> statement skips the rest of the current loop iteration and jumps straight to the next one — the update step still runs (in a <code>for</code> loop), and the condition is re-checked.",
      syntax: "for (int i = 1; i <= 5; i++) {\n    if (i % 2 == 0) {\n        continue; // skip even numbers\n    }\n    System.out.println(i);\n} // prints 1 3 5",
      example:
        "// labeled continue — skips to the next iteration of an OUTER loop\nouter:\nfor (int i = 0; i < 3; i++) {\n    for (int j = 0; j < 3; j++) {\n        if (j == 1) {\n            continue outer;\n        }\n        System.out.println(i + \",\" + j);\n    }\n}\n// prints 0,0  1,0  2,0 — each inner loop only ever prints j=0 before jumping to the next outer i",
      notes: [
        "<code>continue</code> does NOT exit the loop (unlike <code>break</code>) — it just skips to the next iteration.",
        "Like <code>break</code>, <code>continue</code> can be labeled to affect an outer loop from inside a nested one.",
      ],
      mistakes: ["Confusing <code>continue</code> with <code>break</code> when reading unfamiliar code — <code>continue</code> keeps looping, <code>break</code> stops it. Read the surrounding logic rather than assuming from habit."],
    }),
  },
];

const MODULE3_QUIZ = [
  {
    type: "MCQ",
    prompt: "What type must the condition inside an `if` statement evaluate to in Java?",
    options: ["int (0 = false, non-zero = true)", "boolean", "String", "Any type — Java infers truthiness"],
    correctAnswer: 1,
    explanation: "Unlike C, Java requires a genuine boolean expression as an if condition — if (1) is a compile error, not a truthy check.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nint x = 10;\nif (x > 5)\n    System.out.println(\"A\");\n    System.out.println(\"B\");",
    options: ["A", "B", "A\nB", "Nothing — compile error"],
    correctAnswer: 2,
    explanation: "Without braces, the if only applies to the very next statement (println(\"A\")). println(\"B\") is a separate, unconditional statement that always runs.",
  },
  {
    type: "MCQ",
    prompt: "In an if-else-if ladder with multiple conditions, how many branches execute?",
    options: ["All branches whose condition is true", "At most one — the first true condition, then the ladder stops", "Exactly one, always", "Zero, unless there's a default"],
    correctAnswer: 1,
    explanation: "Evaluation stops at the first true condition; even if a later condition would also be true, its branch never runs.",
  },
  {
    type: "DEBUG",
    prompt: "What does this print when n is 1?\n\nswitch (n) {\n    case 1: System.out.println(\"one\");\n    case 2: System.out.println(\"two\"); break;\n    default: System.out.println(\"other\");\n}",
    options: ["one", "one\ntwo", "two", "other"],
    correctAnswer: 1,
    explanation: "case 1 has no break, so execution falls through into case 2's code as well, printing both \"one\" and \"two\".",
  },
  {
    type: "MCQ",
    prompt: "Which of these types can a classic Java `switch` statement NOT switch on?",
    options: ["int", "String", "double", "char"],
    correctAnswer: 2,
    explanation: "switch works on int/char/String/enum (and their wrapper types) — not on floating-point types like double or float.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nfor (int i = 0; i < 3; i++) {\n    System.out.print(i);\n}",
    options: ["012", "123", "0123", "Infinite loop"],
    correctAnswer: 0,
    explanation: "i starts at 0 and the loop runs while i < 3, printing 0, 1, then 2 before the condition becomes false.",
  },
  {
    type: "MCQ",
    prompt: "What is guaranteed about a `do-while` loop that is NOT guaranteed about a plain `while` loop?",
    options: ["It never repeats more than once", "Its body executes at least once, even if the condition is false from the start", "It cannot be exited with break", "It doesn't require a boolean condition"],
    correctAnswer: 1,
    explanation: "do-while checks its condition AFTER the body runs, so the body always executes at least once; while checks BEFORE, so it can run zero times.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nfor (int i = 0; i < 5; i++) {\n    if (i == 3) continue;\n    System.out.print(i);\n}",
    options: ["01234", "0124", "012", "Nothing"],
    correctAnswer: 1,
    explanation: "continue skips only the current iteration's remaining code (the print) when i == 3, then the loop carries on to i = 4 — it does not exit the loop the way break would.",
  },
];

// Same LeetCode-style FUNCTION mode as MODULE2_CODING — resolveCodingFields() generates the real
// starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] in the create loop below.
const MODULE3_CODING = [
  {
    type: "CODING",
    prompt: "Read one integer representing a score from 0 to 100 and print the grade: \"A\" for 90 or above, \"B\" for 75-89, \"C\" for 60-74, or \"F\" below 60.",
    language: "java",
    testCases: [{ input: "95", expected: "A" }, { input: "80", expected: "B" }, { input: "40", expected: "F" }],
    explanation: "Chain if-else-if conditions from the highest threshold down to the lowest — the first true condition wins.",
  },
  {
    type: "CODING",
    prompt: "Read one integer N and print the sum of all even numbers from 1 to N (inclusive).",
    language: "java",
    testCases: [{ input: "10", expected: "30" }, { input: "1", expected: "0" }, { input: "7", expected: "12" }],
    explanation: "Loop from 1 to N, adding i to a running total only when i % 2 == 0.",
  },
];

const MODULE4_LESSONS = [
  {
    title: "Methods",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "A method is a named, reusable block of code that performs a specific task. Methods let you break a program into smaller, testable pieces and avoid repeating the same code (DRY — Don't Repeat Yourself).",
      syntax: "accessModifier returnType methodName(parameterList) {\n    // method body\n    return value; // only if returnType is not void\n}",
      example:
        "public class Calculator {\n    public static int square(int n) {\n        return n * n;\n    }\n\n    public static void main(String[] args) {\n        int result = square(5); // calling the method\n        System.out.println(result); // 25\n    }\n}",
      notes: [
        "A method must be declared inside a class — Java has no free-standing functions.",
        "<code>static</code> methods (like <code>main</code>) can be called without creating an object; instance methods require an object of the class.",
      ],
      mistakes: ["Forgetting parentheses when calling a method with no arguments — a method name alone, without <code>()</code>, refers to the method itself, not a call, and is a compile error in that position."],
      bestPractices: ["Keep each method focused on a single task — if you find yourself describing a method with \"and\", it's a sign to split it into two."],
    }),
  },
  {
    title: "Parameters",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Parameters are the inputs a method accepts, declared in its signature. The values passed in when calling the method are called arguments.",
      syntax: "returnType methodName(type1 param1, type2 param2) {\n    // use param1, param2 inside the method\n}",
      example: "public static int add(int a, int b) {\n    return a + b;\n}\n\nint sum = add(3, 4); // 3 and 4 are the arguments; a and b are the parameters",
      notes: [
        "Java is strictly pass-by-value: for primitives, a COPY of the value is passed, so changes to a parameter inside the method never affect the caller's original variable.",
        "For objects/arrays, the reference itself is passed by value — the method can modify the object's contents through that reference, but reassigning the parameter to a new object inside the method doesn't affect the caller's reference.",
      ],
      mistakes: ["Assuming Java passes objects \"by reference\" the way some other languages do — Java always passes the reference by value; you can mutate the object it points to, but you can't make the caller's variable point to a different object."],
    }),
  },
  {
    title: "Return Types",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "A method's return type, declared before its name, specifies what kind of value it gives back to the caller. <code>void</code> means the method returns nothing.",
      syntax: "returnType methodName(...) {\n    return value; // value's type must match returnType\n}\n\nvoid methodName(...) {\n    // no return statement needed, or a bare 'return;' to exit early\n}",
      example:
        "public static boolean isEven(int n) {\n    return n % 2 == 0;\n}\n\npublic static void printGreeting(String name) {\n    System.out.println(\"Hello, \" + name);\n    // no return needed — void method\n}",
      notes: [
        "Every code path in a non-void method must return a value, or the code fails to compile (\"missing return statement\").",
        "A <code>return</code> statement immediately exits the method — any code after it in the same block never runs.",
      ],
      mistakes: ["Writing an if-else where only one branch returns a value and forgetting the other branch also needs one — the compiler rejects this as a missing return statement on the path where the condition is false."],
    }),
  },
  {
    title: "Method Overloading",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "Method overloading lets a class have multiple methods with the SAME name but DIFFERENT parameter lists (different number, type, or order of parameters). The compiler picks the right one to call based on the arguments provided.",
      syntax: "returnType methodName(int a) { ... }\nreturnType methodName(int a, int b) { ... }\nreturnType methodName(double a) { ... }",
      example:
        "public static int max(int a, int b) {\n    return a > b ? a : b;\n}\n\npublic static double max(double a, double b) {\n    return a > b ? a : b;\n}\n\nmax(3, 5);      // calls the int version\nmax(3.5, 2.1);  // calls the double version",
      notes: [
        "Overloading is resolved at COMPILE time based on the argument types — this is different from overriding (a subclass changing an inherited method's behavior), which is resolved at runtime.",
        "The return type ALONE is not enough to distinguish two overloads — two methods with the same name and parameter list but different return types will not compile.",
      ],
      mistakes: ["Trying to overload two methods that differ only in return type, e.g. <code>int getValue()</code> and <code>double getValue()</code> — this is a compile error because the compiler can't tell them apart from a call site."],
    }),
  },
  {
    title: "Recursion",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation:
        "A recursive method is one that calls itself to solve a smaller instance of the same problem. Every recursive method needs a <strong>base case</strong> (a condition that stops the recursion) — without one, it recurses forever and eventually crashes with a <code>StackOverflowError</code>.",
      syntax: "returnType recursiveMethod(params) {\n    if (baseCase) {\n        return baseResult; // stops the recursion\n    }\n    return recursiveMethod(smallerParams); // the recursive call\n}",
      example: "public static long factorial(int n) {\n    if (n <= 1) {\n        return 1; // base case\n    }\n    return n * factorial(n - 1); // recursive case\n}\n\nfactorial(5); // 5 * 4 * 3 * 2 * 1 = 120",
      notes: [
        "Each recursive call adds a new frame to the call stack; very deep recursion (thousands of levels) can exhaust the stack even with a correct base case.",
        "Any recursive solution can also be written iteratively (with a loop) — recursion is often more readable for naturally recursive problems (trees, divide-and-conquer) but isn't always the more efficient choice.",
      ],
      mistakes: ["Forgetting the base case entirely, or writing one that's never actually reached (e.g. the recursive call doesn't move the input closer to the base case) — both produce infinite recursion and a StackOverflowError."],
    }),
  },
  {
    title: "Variable Scope",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "A variable's scope is the region of code where it can be accessed. Java has <strong>local</strong> scope (inside a method or block), <strong>instance</strong> scope (a non-static field, one copy per object), and <strong>static/class</strong> scope (a static field, one copy shared by the whole class).",
      syntax: "public class Example {\n    static int classVar;    // static scope — shared by all instances\n    int instanceVar;        // instance scope — one copy per object\n\n    void method() {\n        int localVar = 5;   // local scope — exists only inside this method\n        {\n            int blockVar = 10; // block scope — exists only inside these braces\n        }\n    }\n}",
      example:
        "public static void main(String[] args) {\n    int x = 10;\n    if (x > 5) {\n        int y = 20; // y only exists inside this if-block\n        System.out.println(x + y); // 30 — x is visible here too\n    }\n    // System.out.println(y); // compile error — y is out of scope here\n}",
      notes: [
        "A local variable's scope ends at the closing brace of the block it's declared in — it doesn't exist outside that block.",
        "A local variable with the same name as an instance/static field \"shadows\" the field inside that method — use <code>this.fieldName</code> to refer to the field explicitly when both exist.",
      ],
      mistakes: ["Trying to use a variable declared inside an if/for/while block outside of that block — the variable simply doesn't exist there, and this is a compile error, not a runtime surprise."],
      bestPractices: ["Declare variables in the narrowest scope that works — a variable only needed inside a loop shouldn't be declared at the top of the whole method."],
    }),
  },
];

const MODULE4_QUIZ = [
  {
    type: "MCQ",
    prompt: "Which of these is NOT one of Java's named variable scopes?",
    options: ["Local", "Instance", "Static", "Global"],
    correctAnswer: 3,
    explanation: "Java has local, instance, and static scope — there is no \"global\" variable scope; the closest equivalent is a public static field, which is still class-scoped, not truly global.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\npublic static void modify(int x) {\n    x = 100;\n}\n\npublic static void main(String[] args) {\n    int a = 5;\n    modify(a);\n    System.out.println(a);\n}",
    options: ["100", "5", "0", "Compile error"],
    correctAnswer: 1,
    explanation: "Java passes primitives by value — modify() receives a COPY of a's value. Reassigning the parameter x inside modify() has no effect on the caller's variable a.",
  },
  {
    type: "MCQ",
    prompt: "What happens if a non-void method has a code path that doesn't reach a return statement?",
    options: ["It returns null automatically", "It returns a default value (0/false) automatically", "Compile error: missing return statement", "Runtime exception when that path is hit"],
    correctAnswer: 2,
    explanation: "Java checks this at compile time — every path through a non-void method must return a value, or the code fails to compile.",
  },
  {
    type: "MCQ",
    prompt: "Which of these correctly distinguishes two overloaded methods?",
    options: ["Same parameter list, different return type only", "Different number or types of parameters", "Different access modifier only (public vs private)", "Different method body only"],
    correctAnswer: 1,
    explanation: "Overload resolution is based on the parameter list (number, types, order) — return type alone, access modifier alone, or body alone cannot distinguish two overloads.",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with this recursive method?\n\npublic static int countDown(int n) {\n    System.out.println(n);\n    return countDown(n - 1);\n}",
    options: ["Nothing, it works correctly", "It has no base case, so it recurses forever and throws StackOverflowError", "It won't compile without a for loop", "The return type should be void"],
    correctAnswer: 1,
    explanation: "There is no condition that stops the recursion, so countDown keeps calling itself with smaller values forever, eventually exhausting the call stack.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\npublic static int factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n - 1);\n}\n\nSystem.out.println(factorial(4));",
    options: ["24", "10", "4", "1"],
    correctAnswer: 0,
    explanation: "factorial(4) = 4 * 3 * 2 * 1 = 24.",
  },
  {
    type: "MCQ",
    prompt: "A local variable declared inside a for loop's body is accessible:",
    options: ["Anywhere in the enclosing method", "Only inside that loop's block", "Anywhere in the class", "Only after the loop ends"],
    correctAnswer: 1,
    explanation: "A local variable's scope is limited to the block (the braces) it's declared in — it ceases to exist once that block ends.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "Given these two overloaded methods:\n\nstatic String describe(int x) { return \"int: \" + x; }\nstatic String describe(double x) { return \"double: \" + x; }\n\nWhat does describe(7) return?",
    options: ["\"int: 7\"", "\"double: 7.0\"", "Compile error — ambiguous call", "Both methods run"],
    correctAnswer: 0,
    explanation: "7 is an int literal, which exactly matches the int overload — Java prefers an exact match over a widening conversion to double.",
  },
];

// Same LeetCode-style FUNCTION mode as MODULE2_CODING/MODULE3_CODING — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below.
const MODULE4_CODING = [
  {
    type: "CODING",
    prompt: "Read two integers M and N and print their greatest common divisor (GCD), computed using recursion (Euclidean algorithm).",
    language: "java",
    testCases: [{ input: "12\n18", expected: "6" }, { input: "17\n5", expected: "1" }, { input: "48\n18", expected: "6" }],
    explanation: "gcd(a, b) = a when b is 0, otherwise gcd(b, a % b) — the classic recursive Euclidean algorithm.",
  },
  {
    type: "CODING",
    prompt: "Read one integer and print \"true\" if it is a power of two, or \"false\" otherwise.",
    language: "java",
    testCases: [{ input: "16", expected: "true" }, { input: "18", expected: "false" }, { input: "1", expected: "true" }],
    explanation: "Repeatedly divide by 2 while the number is even and greater than 1 — if you land on exactly 1, it was a power of two.",
  },
];

const MODULE5_LESSONS = [
  {
    title: "1D Arrays",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "An array is a fixed-size, indexed collection of elements of the SAME type, stored in contiguous memory. Once created, its size cannot change.",
      syntax:
        "int[] numbers = new int[5];       // declaration + allocation, all elements default to 0\nint[] scores = {90, 85, 78, 92, 88};    // declaration + initialization with literal values\nnumbers[0] = 10;                         // assign by index (0-based)\nint first = numbers[0];                  // read by index\nint size = numbers.length;               // length is a FIELD, not a method — no parentheses",
      example: "int[] marks = {70, 85, 90};\nfor (int i = 0; i < marks.length; i++) {\n    System.out.println(marks[i]);\n}\n// 70 85 90, each on its own line",
      notes: [
        "Array indices are 0-based: a length-5 array has valid indices 0 through 4.",
        "Accessing an index outside the valid range (e.g. <code>numbers[5]</code> on a length-5 array) throws <code>ArrayIndexOutOfBoundsException</code> at runtime — Java does not silently return a default value or wrap around.",
      ],
      mistakes: ["Using <code>&lt;=</code> instead of <code>&lt;</code> when looping with <code>array.length</code> — this reads one past the end and throws <code>ArrayIndexOutOfBoundsException</code> on the last iteration."],
      bestPractices: ["Prefer the enhanced for-each loop (<code>for (int n : marks)</code>) when you only need each value, not its index — it can't throw an out-of-bounds error."],
    }),
  },
  {
    title: "2D Arrays",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A 2D array is an \"array of arrays\" — commonly used to represent grids, matrices, or tables of data.",
      syntax:
        "int[][] grid = new int[3][4];   // 3 rows, 4 columns, all elements default to 0\nint[][] matrix = {{1, 2}, {3, 4}, {5, 6}}; // literal initialization, 3 rows of 2 columns each\ngrid[1][2] = 7;                          // row 1, column 2\nint rows = grid.length;                  // number of rows\nint cols = grid[0].length;               // number of columns in row 0",
      example:
        "int[][] matrix = {{1, 2, 3}, {4, 5, 6}};\nfor (int i = 0; i < matrix.length; i++) {\n    for (int j = 0; j < matrix[i].length; j++) {\n        System.out.print(matrix[i][j] + \" \");\n    }\n    System.out.println();\n}\n// 1 2 3\n// 4 5 6",
      notes: [
        "Java 2D arrays are technically arrays of array references, which means rows don't all need the same length — this is called a <strong>jagged array</strong>.",
        "Use <code>matrix[i].length</code> (the length of a specific row), not <code>matrix.length</code>, when a jagged array's rows may differ in size.",
      ],
      mistakes: ["Assuming every row of a 2D array has the same length by reusing <code>matrix[0].length</code> as a constant for all rows — this breaks on a jagged array where row lengths differ."],
    }),
  },
  {
    title: "Array Operations",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Beyond simple read/write by index, arrays support a small set of common operations: traversal (visiting every element), aggregation (sum/min/max), and copying.",
      syntax:
        "int sum = 0;\nfor (int n : numbers) { sum += n; }\n\nint[] copy = Arrays.copyOf(numbers, numbers.length);  // java.util.Arrays\nSystem.arraycopy(numbers, 0, copy, 0, numbers.length); // lower-level alternative",
      example: "int[] scores = {70, 95, 60, 88};\nint max = scores[0];\nfor (int s : scores) {\n    if (s > max) max = s;\n}\nSystem.out.println(max); // 95",
      notes: [
        "Arrays have a FIXED size — there's no built-in \"insert\" or \"remove\" that resizes an array; you'd copy into a new, larger/smaller array, or use an <code>ArrayList</code> instead when the size needs to change.",
        "Assigning one array variable to another (<code>int[] b = a;</code>) copies the REFERENCE, not the contents — both variables point to the same underlying array. Use <code>Arrays.copyOf()</code> when you need an independent copy.",
      ],
      mistakes: ["Writing <code>int[] b = a;</code> expecting an independent copy, then being surprised that modifying <code>b</code> also changes what <code>a</code> sees — both variables reference the same array object."],
    }),
  },
  {
    title: "Searching",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Searching means finding whether (and where) a target value exists in an array. The two classic approaches are <strong>linear search</strong> (works on any array) and <strong>binary search</strong> (requires a SORTED array, but is much faster).",
      syntax:
        "// Linear search — checks every element in order\nfor (int i = 0; i < arr.length; i++) {\n    if (arr[i] == target) return i;\n}\nreturn -1;\n\n// Binary search — repeatedly halves the search range on a SORTED array\nint low = 0, high = arr.length - 1;\nwhile (low <= high) {\n    int mid = low + (high - low) / 2;\n    if (arr[mid] == target) return mid;\n    else if (arr[mid] < target) low = mid + 1;\n    else high = mid - 1;\n}\nreturn -1;",
      example: "int[] sorted = {2, 5, 8, 12, 16, 23, 38};\n// binary search for 23: mid index 3 (value 8) is too low → search right half →\n// mid index 5 (value 23) → found at index 5",
      notes: [
        "Linear search is O(n) — in the worst case it checks every element. Binary search is O(log n) but ONLY works correctly on a sorted array.",
        "<code>low + (high - low) / 2</code> is the safe way to compute the midpoint — <code>(low + high) / 2</code> can theoretically overflow for very large index values.",
      ],
      mistakes: ["Running binary search on an UNSORTED array — it silently gives wrong (or missing) results instead of erroring, since each comparison assumes the array is sorted."],
    }),
  },
  {
    title: "Sorting",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Sorting arranges an array's elements into a defined order (typically ascending). Java's standard library provides a built-in, well-tested sort — <code>Arrays.sort()</code> — for production use; understanding a simple algorithm like bubble sort builds intuition for how sorting works underneath.",
      syntax:
        "import java.util.Arrays;\n\nint[] nums = {5, 2, 8, 1, 9};\nArrays.sort(nums); // sorts in place, ascending\n\n// Bubble sort — repeatedly swaps adjacent out-of-order pairs\nfor (int i = 0; i < arr.length - 1; i++) {\n    for (int j = 0; j < arr.length - 1 - i; j++) {\n        if (arr[j] > arr[j + 1]) {\n            int temp = arr[j];\n            arr[j] = arr[j + 1];\n            arr[j + 1] = temp;\n        }\n    }\n}",
      example: "int[] nums = {5, 2, 8, 1, 9};\nArrays.sort(nums);\nSystem.out.println(Arrays.toString(nums)); // [1, 2, 5, 8, 9]",
      notes: [
        "<code>Arrays.sort()</code> uses a dual-pivot quicksort for primitives (O(n log n) average) — always prefer it over a hand-rolled sort in real code; bubble sort (O(n²)) is taught for understanding, not for production use.",
        "<code>Arrays.toString(array)</code> is the standard way to print an array's contents readably — printing the array variable directly (<code>System.out.println(nums)</code>) prints its memory-address-based hash, not its elements.",
      ],
      mistakes: ["Forgetting that <code>Arrays.sort()</code> sorts IN PLACE and returns <code>void</code> — writing <code>int[] sorted = Arrays.sort(nums);</code> is a compile error, since <code>sort()</code>'s return type is <code>void</code>, not an array."],
    }),
  },
];

const MODULE5_QUIZ = [
  {
    type: "MCQ",
    prompt: "A Java array declared as `int[] arr = new int[5];` has valid indices:",
    options: ["1 to 5", "0 to 4", "0 to 5", "1 to 4"],
    correctAnswer: 1,
    explanation: "Array indices are 0-based, so a length-5 array has valid indices 0 through 4.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What happens when this runs?\n\nint[] arr = {10, 20, 30};\nSystem.out.println(arr[3]);",
    options: ["0", "30", "Compile error", "ArrayIndexOutOfBoundsException at runtime"],
    correctAnswer: 3,
    explanation: "arr has valid indices 0-2; index 3 is out of range, which throws ArrayIndexOutOfBoundsException at runtime (not a compile-time error, since Java can't always know the index in advance).",
  },
  {
    type: "MCQ",
    prompt: "In a 2D array `int[][] grid = new int[3][4];`, how many rows and columns does it have?",
    options: ["4 rows, 3 columns", "3 rows, 4 columns", "3 rows, 3 columns", "4 rows, 4 columns"],
    correctAnswer: 1,
    explanation: "The first bracket dimension is the number of rows (3), the second is the number of columns per row (4).",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nint[] a = {1, 2, 3};\nint[] b = a;\nb[0] = 99;\nSystem.out.println(a[0]);",
    options: ["1", "99", "0", "Compile error"],
    correctAnswer: 1,
    explanation: "b = a; copies the reference, not the array's contents — a and b point to the SAME array, so modifying b[0] also changes what a[0] reads.",
  },
  {
    type: "MCQ",
    prompt: "What is a required precondition for binary search to work correctly?",
    options: ["The array must contain only positive numbers", "The array must be sorted", "The array must have an even length", "The array must contain no duplicates"],
    correctAnswer: 1,
    explanation: "Binary search relies on comparing against a midpoint and discarding half the range — that logic is only valid if the array is sorted.",
  },
  {
    type: "MCQ",
    prompt: "What is the time complexity of linear search in the worst case, for an array of size n?",
    options: ["O(1)", "O(log n)", "O(n)", "O(n^2)"],
    correctAnswer: 2,
    explanation: "Linear search may need to check every one of the n elements before finding (or ruling out) the target.",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with this line?\n\nint[] sorted = Arrays.sort(nums);",
    options: ["Nothing, it's correct", "Arrays.sort() returns void, not an array — it sorts in place", "Arrays.sort() only works on Strings", "sorted should be declared as a List, not an array"],
    correctAnswer: 1,
    explanation: "Arrays.sort(nums) mutates nums directly and returns void, so assigning its result to an int[] variable is a compile error.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nint[] nums = {5, 2, 8, 1};\nArrays.sort(nums);\nSystem.out.println(Arrays.toString(nums));",
    options: ["[5, 2, 8, 1]", "[1, 2, 5, 8]", "[8, 5, 2, 1]", "A memory address, not the elements"],
    correctAnswer: 1,
    explanation: "Arrays.sort() sorts ascending in place, and Arrays.toString() renders the elements readably as [1, 2, 5, 8].",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below.
const MODULE5_CODING = [
  {
    type: "CODING",
    prompt: "Read space-separated integers and print the second largest distinct value in the array (there will be at least two distinct values).",
    language: "java",
    testCases: [{ input: "10 20 4 45 99", expected: "45" }, { input: "1 2", expected: "1" }, { input: "3 3 3 7", expected: "3" }],
    explanation: "Track the largest and second-largest distinct values seen so far in a single pass — whenever a new value beats the current largest, the old largest becomes the new second-largest.",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers on one line and a target integer on the next line. Print how many times the target appears in the array.",
    language: "java",
    testCases: [{ input: "1 2 2 3 2\n2", expected: "3" }, { input: "5 5 5\n5", expected: "3" }, { input: "1 2 3\n4", expected: "0" }],
    explanation: "Walk the array once, incrementing a counter every time an element equals the target.",
  },
];

const MODULE6_LESSONS = [
  {
    title: "String",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation:
        "<code>String</code> is a reference type representing an <strong>immutable</strong> sequence of characters. Immutable means once created, a String object's contents can never change — every operation that appears to modify a string actually creates a NEW String object.",
      syntax: "String s1 = \"Hello\";                  // string literal — stored in the String pool\nString s2 = new String(\"Hello\");     // explicit object — always a new object, not pooled\nString s3 = s1 + \" World\";           // concatenation creates a new String",
      example: "String greeting = \"Hello\";\ngreeting = greeting + \", World!\"; // does NOT modify the original — creates a new String and reassigns greeting\nSystem.out.println(greeting); // Hello, World!",
      notes: [
        "String literals are interned in a special memory area called the String pool — two literals with the same text (<code>String a = \"hi\";</code> <code>String b = \"hi\";</code>) can share the SAME object, but <code>new String(\"hi\")</code> always allocates a distinct object.",
        "Because Strings are objects, always compare their CONTENTS with <code>.equals()</code>, not <code>==</code> — <code>==</code> compares references, which can give a wrong answer even when the text is identical, especially with <code>new String()</code>.",
      ],
      mistakes: ["Comparing strings with <code>==</code> instead of <code>.equals()</code> — this can appear to work correctly for literals (due to pooling) but silently breaks for strings built with <code>new String(...)</code> or produced by concatenation/user input."],
      bestPractices: ["Never build a string incrementally in a loop with <code>+=</code> — each <code>+=</code> allocates a brand-new String object, making a loop with N iterations O(n²). Use StringBuilder for that (next lesson)."],
    }),
  },
  {
    title: "StringBuilder",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>StringBuilder</code> is a MUTABLE sequence of characters — unlike String, its methods modify the object in place rather than creating a new one. This makes it the right tool for building up a string incrementally (e.g. inside a loop).",
      syntax:
        "StringBuilder sb = new StringBuilder();\nsb.append(\"Hello\");\nsb.append(\", \").append(\"World!\"); // methods can be chained — each returns the same StringBuilder\nsb.insert(0, \">> \");\nsb.reverse();\nString result = sb.toString(); // convert back to a String when done",
      example: "StringBuilder sb = new StringBuilder();\nfor (int i = 1; i <= 3; i++) {\n    sb.append(i).append(\" \");\n}\nSystem.out.println(sb.toString()); // 1 2 3",
      notes: [
        "StringBuilder is NOT thread-safe — its methods aren't synchronized, which is exactly what makes it faster than StringBuffer for single-threaded code (the overwhelming majority of use cases).",
        "Common methods: <code>append()</code>, <code>insert(index, str)</code>, <code>delete(start, end)</code>, <code>reverse()</code>, <code>toString()</code>, <code>length()</code>.",
      ],
      mistakes: ["Using String concatenation (<code>+=</code>) inside a loop instead of <code>StringBuilder.append()</code> — each <code>+=</code> silently allocates a new String, turning an O(n) loop into O(n²) for large inputs."],
      bestPractices: ["Reach for StringBuilder any time you're building a string piece by piece, especially inside a loop."],
    }),
  },
  {
    title: "StringBuffer",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "<code>StringBuffer</code> is functionally almost identical to StringBuilder (same mutable, chainable API) — the one difference is that StringBuffer's methods are <strong>synchronized</strong>, making it thread-safe at the cost of extra overhead.",
      syntax: "StringBuffer sb = new StringBuffer();\nsb.append(\"Hello\").append(\" World\");\nString result = sb.toString();",
      example: "// Same API as StringBuilder — this compiles and behaves identically, just slower due to synchronization:\nStringBuffer buf = new StringBuffer(\"Count: \");\nbuf.append(42);\nSystem.out.println(buf); // Count: 42",
      notes: [
        "StringBuffer predates StringBuilder (added in Java 1.0; StringBuilder arrived in Java 5 as an unsynchronized, faster alternative for the common single-threaded case).",
        "Use StringBuffer only when multiple threads might genuinely mutate the SAME buffer concurrently — for everything else, prefer StringBuilder.",
      ],
      bestPractices: ["Default to StringBuilder unless you have a specific, verified need for thread-safety — most code doesn't share a single mutable string buffer across threads."],
    }),
  },
  {
    title: "String Methods",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "The String class provides a large set of built-in methods for inspecting, transforming, and comparing text. A handful cover the vast majority of real-world use.",
      syntax:
        "String s = \"Hello, World!\";\ns.length();               // 13\ns.charAt(0);              // 'H'\ns.substring(7);           // \"World!\"\ns.substring(7, 12);       // \"World\"\ns.indexOf(\"World\");       // 7\ns.toUpperCase();          // \"HELLO, WORLD!\"\ns.toLowerCase();          // \"hello, world!\"\ns.trim();                 // removes leading/trailing whitespace\ns.replace(\"World\", \"Java\"); // \"Hello, Java!\"\ns.split(\", \");            // [\"Hello\", \"World!\"]\ns.equals(\"Hello, World!\"); // true — content comparison\ns.contains(\"World\");      // true",
      example: "String email = \"  User@Example.com  \";\nString normalized = email.trim().toLowerCase();\nSystem.out.println(normalized); // \"user@example.com\"",
      notes: [
        "<code>substring(begin)</code> goes from begin to the end; <code>substring(begin, end)</code> goes from begin UP TO BUT NOT INCLUDING end — a classic off-by-one trap.",
        "Every one of these methods returns a NEW String — none of them modify the original, because String is immutable.",
      ],
      mistakes: ["Calling a method like <code>s.trim()</code> or <code>s.toUpperCase()</code> and expecting <code>s</code> itself to change — since String is immutable, you must capture the return value: <code>s = s.trim();</code>, not just <code>s.trim();</code>."],
    }),
  },
  {
    title: "Regular Expressions",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A regular expression (regex) is a pattern for matching text — useful for validating formats (emails, phone numbers), searching, and complex find-and-replace operations that go beyond a literal substring match.",
      syntax:
        "String s = \"Order #12345\";\ns.matches(\"[A-Za-z ]+#\\\\d+\");   // true — matches() tests the WHOLE string against the pattern\ns.replaceAll(\"\\\\d+\", \"X\");      // \"Order #X\" — replaces every digit run with X\nString[] parts = \"a,b,,c\".split(\",\");  // [\"a\", \"b\", \"\", \"c\"]\n\nimport java.util.regex.Pattern;\nimport java.util.regex.Matcher;\nPattern p = Pattern.compile(\"\\\\d+\");\nMatcher m = p.matcher(\"Order 123, Item 456\");\nwhile (m.find()) {\n    System.out.println(m.group()); // 123, then 456\n}",
      notes: [
        "Common building blocks: <code>\\d</code> (digit), <code>\\w</code> (word character), <code>\\s</code> (whitespace), <code>+</code> (one or more), <code>*</code> (zero or more), <code>?</code> (zero or one), <code>[]</code> (character class), <code>^</code> / <code>$</code> (start/end of string).",
        "In a Java string literal, backslashes must be doubled (<code>\\\\d</code>, not <code>\\d</code>) because <code>\\</code> is itself the string-escape character — the regex engine sees <code>\\d</code> only after Java's own string parsing removes one backslash.",
      ],
      mistakes: ["Forgetting to double the backslash in a Java string literal (writing <code>\"\\d+\"</code> instead of <code>\"\\\\d+\"</code>) — <code>\\d</code> isn't a valid Java string escape, so this often fails to compile or behaves unexpectedly."],
      bestPractices: ["Use <code>s.matches(pattern)</code> only when the ENTIRE string must match; use <code>Pattern</code>/<code>Matcher</code> with <code>find()</code> when you need to locate a pattern anywhere within a larger string, possibly multiple times."],
    }),
  },
];

const MODULE6_QUIZ = [
  {
    type: "MCQ",
    prompt: "Why should you compare String contents with `.equals()` instead of `==`?",
    options: ["== is slower than .equals()", "== compares references, not contents, which can give the wrong answer for non-pooled strings", "== only works for numbers", "There's no difference in Java"],
    correctAnswer: 1,
    explanation: "Strings are objects, so == checks whether two references point to the same object in memory — .equals() checks whether their contents are the same, which is almost always what you actually want.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nString s = \"hello\";\ns.toUpperCase();\nSystem.out.println(s);",
    options: ["HELLO", "hello", "null", "Compile error"],
    correctAnswer: 1,
    explanation: "toUpperCase() returns a NEW String rather than modifying s in place — since the return value here isn't captured or reassigned, s is unchanged.",
  },
  {
    type: "MCQ",
    prompt: "Which class should you use to efficiently build a string inside a loop?",
    options: ["String, with += concatenation", "StringBuilder", "Integer", "Scanner"],
    correctAnswer: 1,
    explanation: "StringBuilder mutates in place, avoiding the repeated allocation that makes String += inside a loop O(n²).",
  },
  {
    type: "MCQ",
    prompt: "What is the key functional difference between StringBuilder and StringBuffer?",
    options: ["StringBuilder is immutable, StringBuffer is mutable", "StringBuffer's methods are synchronized (thread-safe); StringBuilder's are not", "StringBuilder can't be converted to a String", "There is no difference at all"],
    correctAnswer: 1,
    explanation: "Both are mutable with an identical API — StringBuffer adds synchronization for thread-safety, at the cost of extra overhead StringBuilder doesn't pay.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does `\"Hello, World!\".substring(7, 12)` return?",
    options: ["\"World!\"", "\"World\"", "\"Worl\"", "\"orld!\""],
    correctAnswer: 1,
    explanation: "Index 7 is 'W' and substring(7, 12) goes up to but not including index 12, covering indices 7-11: \"World\".",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with this code, given the goal is to trim and store the result?\n\nString name = \"  Alice  \";\nname.trim();\nSystem.out.println(name);",
    options: ["Nothing, it prints \"Alice\" trimmed", "trim() doesn't modify name in place — the return value must be reassigned, e.g. name = name.trim();", "trim() only works on StringBuilder", "This throws a NullPointerException"],
    correctAnswer: 1,
    explanation: "Like every String method, trim() returns a new String rather than mutating the original — the result here is discarded, so name still has its original leading/trailing spaces.",
  },
  {
    type: "MCQ",
    prompt: "In a Java string literal representing a regex, why must you write \"\\\\d+\" instead of \"\\d+\"?",
    options: ["\\d+ is not valid regex syntax", "Java requires all regex to use double backslashes for performance", "\\ is Java's string-escape character, so it must be doubled to produce a literal backslash for the regex engine", "There is no difference, both work identically"],
    correctAnswer: 2,
    explanation: "Java's string literal parser consumes one backslash as an escape character first — doubling it (\\\\) is what actually produces a single literal backslash for the regex engine to see as \\d.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does `\"a,b,,c\".split(\",\")` produce (as an array)?",
    options: ["[\"a\", \"b\", \"c\"]", "[\"a\", \"b\", \"\", \"c\"]", "[\"a,b,,c\"]", "Compile error"],
    correctAnswer: 1,
    explanation: "split(\",\") produces one element for every gap between delimiters, including empty strings for consecutive delimiters — the double comma produces an empty string between \"b\" and \"c\".",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below.
const MODULE6_CODING = [
  {
    type: "CODING",
    prompt: "Read a string and print it with all vowels (a, e, i, o, u, both cases) removed.",
    language: "java",
    testCases: [{ input: "Hello World", expected: "Hll Wrld" }, { input: "AEIOUaeiou", expected: "" }, { input: "xyz", expected: "xyz" }],
    explanation: "Walk the string and append only the characters that aren't in the vowel set to a StringBuilder.",
  },
  {
    type: "CODING",
    prompt: "Read a string and print \"true\" if every character in it is a digit, or \"false\" otherwise.",
    language: "java",
    testCases: [{ input: "007", expected: "true" }, { input: "12.5", expected: "false" }, { input: "abc", expected: "false" }],
    explanation: "Check every character with Character.isDigit(c) (or compare it against '0'-'9') — if any character fails, the whole string isn't numeric.",
  },
];

const MODULE7_LESSONS = [
  {
    title: "Classes",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A class is a blueprint for creating objects — it defines the fields (data/state) and methods (behavior) that every object created from it will have. Nothing runs until you create an object from the class.",
      syntax: "class Student {\n    String name;      // field\n    int age;           // field\n\n    void greet() {      // method\n        System.out.println(\"Hi, I'm \" + name);\n    }\n}",
      example:
        "class Car {\n    String model;\n    int year;\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Car c = new Car();  // creates an OBJECT from the Car class\n        c.model = \"Civic\";\n        c.year = 2023;\n        System.out.println(c.model + \" \" + c.year);\n    }\n}",
      notes: [
        "A single .java file may contain multiple classes, but only ONE can be public, and its name must match the filename.",
        "Fields declared inside a class but outside any method are called instance fields — each object gets its own copy.",
      ],
      mistakes: ["Confusing a class with an object — the class Car is just the blueprint; no memory is allocated for model/year until you write <code>new Car()</code>."],
      bestPractices: ["Name classes with PascalCase nouns (Car, Student, BankAccount) — a class represents a \"thing\", so its name should read like one."],
    }),
  },
  {
    title: "Objects",
    estimatedMinutes: 8,
    content: lessonHTML({
      explanation: "An object is a concrete instance of a class, created with the <code>new</code> keyword. Each object has its own independent copy of the class's instance fields.",
      syntax: "ClassName obj = new ClassName();   // allocates memory, calls the constructor, returns a reference\nobj.field = value;                    // access a field\nobj.method();                          // call a method",
      example: "Car car1 = new Car();\ncar1.model = \"Civic\";\n\nCar car2 = new Car();\ncar2.model = \"Accord\";\n\nSystem.out.println(car1.model); // Civic — car1 and car2 are independent objects",
      notes: [
        "<code>new ClassName()</code> does two things: allocates memory on the heap for the object, and calls a constructor to initialize it.",
        "A variable of a class type doesn't hold the object itself — it holds a reference (like an address) to the object on the heap, same as arrays.",
      ],
      mistakes: ["Declaring a variable (<code>Car car;</code>) and using it before assigning it an object with <code>new</code> — accessing a field on it throws <code>NullPointerException</code> at runtime, not a compile error, since <code>car</code> defaults to <code>null</code> until assigned."],
    }),
  },
  {
    title: "Constructors",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A constructor is a special method that runs automatically when an object is created with <code>new</code>, used to initialize its fields. A constructor has the SAME name as the class and no return type (not even <code>void</code>).",
      syntax:
        "class Student {\n    String name;\n    int age;\n\n    Student(String name, int age) {   // constructor — same name as class, no return type\n        this.name = name;              // this.name is the field; name is the parameter\n        this.age = age;\n    }\n}",
      example: "Student s = new Student(\"Asha\", 20);\nSystem.out.println(s.name + \" is \" + s.age); // Asha is 20",
      notes: [
        "If you don't write ANY constructor, Java automatically provides a no-argument default constructor that does nothing. The moment you write even one constructor yourself, that automatic default disappears.",
        "A class can have multiple constructors with different parameter lists — this is constructor overloading, following the same rules as method overloading.",
        "<code>this.name = name;</code> is necessary specifically because the parameter <code>name</code> shadows the field <code>name</code> — <code>this.name</code> refers to the field, plain <code>name</code> refers to the parameter.",
      ],
      mistakes: ["Writing a parameterized constructor and then still trying to call <code>new Student()</code> (no arguments) — once you define any constructor, the free no-argument default is gone unless you explicitly write one too."],
    }),
  },
  {
    title: "Inheritance",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Inheritance lets one class (the subclass/child) reuse and extend the fields and methods of another class (the superclass/parent), using the <code>extends</code> keyword. It models an \"is-a\" relationship.",
      syntax: "class Animal {\n    void eat() { System.out.println(\"This animal eats food.\"); }\n}\n\nclass Dog extends Animal {   // Dog IS-A Animal\n    void bark() { System.out.println(\"Woof!\"); }\n}",
      example: "Dog d = new Dog();\nd.eat();   // inherited from Animal — \"This animal eats food.\"\nd.bark();  // defined in Dog — \"Woof!\"",
      notes: [
        "Java supports only SINGLE inheritance for classes — a class can extend only one superclass directly (unlike interfaces, which support multiple inheritance).",
        "A subclass can call its superclass's constructor explicitly with <code>super(args)</code> as the first line of its own constructor; if omitted, Java inserts an implicit <code>super()</code> call to the no-argument superclass constructor.",
      ],
      mistakes: ["Assuming a subclass can access the superclass's private fields directly — private members are never inherited-accessible; use <code>protected</code> or a public getter/setter instead."],
    }),
  },
  {
    title: "Polymorphism",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Polymorphism (\"many forms\") lets a single method call behave differently depending on the actual object it's invoked on. Java achieves this through method overriding (runtime polymorphism) and method overloading (compile-time polymorphism, covered in the Methods module).",
      syntax: "class Animal {\n    void sound() { System.out.println(\"Some generic sound\"); }\n}\nclass Cat extends Animal {\n    @Override\n    void sound() { System.out.println(\"Meow\"); }  // overrides the parent's version\n}",
      example:
        "Animal a = new Cat();   // Animal reference, Cat object — perfectly legal\na.sound();                 // Meow — the ACTUAL object's method runs, not the reference type's\n\nAnimal[] animals = {new Animal(), new Cat()};\nfor (Animal an : animals) {\n    an.sound();            // \"Some generic sound\" then \"Meow\" — same call, different behavior\n}",
      notes: [
        "This is called runtime (or dynamic) polymorphism because the JVM decides WHICH version of <code>sound()</code> to run based on the object's actual type at runtime, not the reference variable's declared type.",
        "<code>@Override</code> is an annotation, not required by the compiler, but it makes the compiler verify you're actually overriding a real superclass method — catching typos (like a misspelled method name) that would otherwise silently create a brand-new, unrelated method instead.",
      ],
      mistakes: ["Believing the reference type (<code>Animal a = ...</code>) determines which overridden method runs — it's always the ACTUAL object's type (<code>Cat</code>) that decides, for overridden instance methods."],
    }),
  },
  {
    title: "Abstraction",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Abstraction means exposing only the essential details of an object while hiding its internal implementation. In Java, this is achieved with abstract classes (which can mix implemented and unimplemented methods) and interfaces (traditionally fully unimplemented, though Java 8+ allows default methods).",
      syntax:
        "abstract class Shape {\n    abstract double area();     // no body — subclasses MUST implement this\n\n    void describe() {           // a regular, implemented method — abstract classes can mix both\n        System.out.println(\"This shape has area \" + area());\n    }\n}\n\nclass Circle extends Shape {\n    double radius;\n    Circle(double radius) { this.radius = radius; }\n    @Override\n    double area() { return Math.PI * radius * radius; }\n}",
      example: "Shape s = new Circle(5);\ns.describe(); // This shape has area 78.53981633974483",
      notes: [
        "An abstract class CANNOT be instantiated directly (<code>new Shape()</code> is a compile error) — it exists only to be extended.",
        "A class with even ONE abstract method must itself be declared abstract; a subclass must implement every inherited abstract method, or it too must be declared abstract.",
      ],
      mistakes: ["Trying to create an object of an abstract class directly, e.g. <code>new Shape()</code> — this is always a compile error, regardless of whether Shape has any implemented methods."],
    }),
  },
  {
    title: "Encapsulation",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Encapsulation means bundling an object's data (fields) with the methods that operate on it, and restricting direct outside access to that data — typically by making fields private and exposing controlled access through public getter/setter methods.",
      syntax:
        "class BankAccount {\n    private double balance;    // private — can't be accessed directly from outside the class\n\n    public double getBalance() {   // getter — read access\n        return balance;\n    }\n\n    public void deposit(double amount) {  // controlled write access — can validate\n        if (amount > 0) {\n            balance += amount;\n        }\n    }\n}",
      example: "BankAccount acc = new BankAccount();\nacc.deposit(100);\n// acc.balance = -500;      // compile error — balance is private, can't be set directly\nSystem.out.println(acc.getBalance()); // 100",
      notes: [
        "The main benefit is VALIDATION and control — a setter (like <code>deposit()</code> above) can reject invalid values, which a public field can never do.",
        "Encapsulation also means an object's internal representation can change later without breaking code that uses it, as long as the public method signatures stay the same.",
      ],
      mistakes: ["Making every field public \"to keep things simple\" — this removes any ability to validate changes or later refactor the internal representation without breaking every caller."],
      bestPractices: ["Default to private fields with public getters/setters (or no setter at all, for values that shouldn't change after construction) — only make a field public when there's a specific reason to."],
    }),
  },
  {
    title: "Interfaces",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "An interface is a fully abstract contract — a set of method signatures (traditionally with no bodies) that any implementing class must provide. Unlike class inheritance, a class can implement MULTIPLE interfaces, which is how Java achieves a form of multiple inheritance.",
      syntax:
        "interface Drivable {\n    void drive();          // implicitly public and abstract — no body\n    void stop();\n}\n\nclass Car implements Drivable {\n    @Override\n    public void drive() { System.out.println(\"Car is driving\"); }\n    @Override\n    public void stop() { System.out.println(\"Car has stopped\"); }\n}",
      example: "Drivable d = new Car();  // interface reference, Car object — legal, like superclass references\nd.drive(); // Car is driving",
      notes: [
        "A class can implement any number of interfaces (<code>class Car implements Drivable, Serializable { ... }</code>), but can extend only one class.",
        "Since Java 8, interfaces can also have default methods (with a body, using the <code>default</code> keyword) and static methods — but every method WITHOUT a body must still be implemented by any concrete implementing class.",
      ],
      mistakes: ["Forgetting to mark an implementing method <code>public</code> — interface methods are implicitly public, and Java doesn't allow an implementing class to reduce a method's visibility, so an implementation left package-private won't compile."],
    }),
  },
];

const MODULE7_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is the relationship between a class and an object?",
    options: ["An object is the blueprint, a class is an instance of it", "A class is a blueprint; an object is an instance created from it", "They are the same thing", "An object contains multiple classes"],
    correctAnswer: 1,
    explanation: "A class defines the structure and behavior; an object is a concrete instance created from that class with new.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nclass Counter {\n    int count;\n}\n\npublic static void main(String[] args) {\n    Counter c1 = new Counter();\n    Counter c2 = new Counter();\n    c1.count = 5;\n    System.out.println(c2.count);\n}",
    options: ["5", "0", "null", "Compile error"],
    correctAnswer: 1,
    explanation: "c1 and c2 are independent objects with independent fields — c2.count was never set, so it holds int's default value, 0.",
  },
  {
    type: "MCQ",
    prompt: "What happens if you define a parameterized constructor but no no-argument constructor, and then call `new MyClass()`?",
    options: ["Java auto-generates a no-argument constructor anyway", "Compile error — no matching constructor found", "Runtime exception", "It calls the parameterized constructor with default values"],
    correctAnswer: 1,
    explanation: "The automatic default constructor only exists if you write NO constructors at all — defining any constructor yourself removes it.",
  },
  {
    type: "MCQ",
    prompt: "Which keyword establishes inheritance between two classes?",
    options: ["implements", "extends", "inherits", "super"],
    correctAnswer: 1,
    explanation: "extends is used for class-to-class inheritance; implements is used for a class adopting an interface.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nclass Animal { void sound() { System.out.println(\"...\"); } }\nclass Cat extends Animal { @Override void sound() { System.out.println(\"Meow\"); } }\n\nAnimal a = new Cat();\na.sound();",
    options: ["...", "Meow", "Compile error", "Nothing"],
    correctAnswer: 1,
    explanation: "Runtime polymorphism: the JVM calls the overridden method based on the object's actual type (Cat), not the reference's declared type (Animal).",
  },
  {
    type: "MCQ",
    prompt: "Which of these is true about abstract classes?",
    options: ["They can be instantiated directly with new", "A class with any abstract method must itself be declared abstract", "They cannot have any implemented (concrete) methods", "They are the same as interfaces"],
    correctAnswer: 1,
    explanation: "An abstract class may freely mix implemented and unimplemented (abstract) methods, but it can never be instantiated directly, and any class containing an abstract method must itself be marked abstract.",
  },
  {
    type: "MCQ",
    prompt: "What is the main purpose of encapsulation?",
    options: ["To make a program run faster", "To bundle data with the methods that operate on it and control access to that data", "To allow multiple inheritance", "To enable method overloading"],
    correctAnswer: 1,
    explanation: "Encapsulation hides internal state behind controlled access (typically private fields + public getters/setters), enabling validation and safe internal changes later.",
  },
  {
    type: "MCQ",
    prompt: "How many interfaces can a single Java class implement?",
    options: ["Exactly one", "At most two", "Any number — a class can implement multiple interfaces", "Zero, interfaces can only be extended by other interfaces"],
    correctAnswer: 2,
    explanation: "Unlike class extension (limited to one superclass), a class can implement any number of interfaces — this is how Java approximates multiple inheritance.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. True
// class/object design isn't expressible through the single-static-method judge, so these are
// real-world word problems in the spirit of this module's Shape/BankAccount examples instead.
const MODULE7_CODING = [
  {
    type: "CODING",
    prompt: "Read a rectangle's length and width, and print its area and perimeter as two space-separated integers (area first, then perimeter).",
    language: "java",
    testCases: [{ input: "5\n4", expected: "20 18" }, { input: "3\n3", expected: "9 12" }, { input: "10\n2", expected: "20 24" }],
    explanation: "area = length * width; perimeter = 2 * (length + width).",
  },
  {
    type: "CODING",
    prompt: "Read the radius of a circle and print the floor of its area (using pi) as an integer.",
    language: "java",
    testCases: [{ input: "5", expected: "78" }, { input: "1", expected: "3" }, { input: "10", expected: "314" }],
    explanation: "area = Math.PI * radius * radius, then floor (truncate) to an int.",
  },
];

const MODULE8_LESSONS = [
  {
    title: "try",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A <code>try</code> block wraps code that might throw an exception (a runtime error) — Java monitors this block, and if an exception occurs anywhere inside it, execution immediately jumps to a matching catch block instead of crashing the program.",
      syntax: "try {\n    // code that might throw an exception\n} catch (ExceptionType e) {\n    // handle the exception\n}",
      example: "try {\n    int result = 10 / 0; // throws ArithmeticException\n    System.out.println(\"This line never runs\");\n} catch (ArithmeticException e) {\n    System.out.println(\"Cannot divide by zero!\");\n}",
      notes: [
        "A try block MUST be followed by at least one catch block, a finally block, or both — a lone try with neither is a compile error.",
        "The instant an exception is thrown inside a try block, ALL remaining code in that block is skipped — execution jumps straight to a matching catch.",
      ],
      mistakes: ["Wrapping an enormous amount of code in a single try block \"just in case\" — this makes it hard to tell which specific line could actually throw, and can accidentally swallow unrelated bugs. Keep try blocks focused on the risky operation."],
    }),
  },
  {
    title: "catch",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A <code>catch</code> block handles a specific exception type thrown inside its try block. You can chain multiple catch blocks after one try to handle different exception types differently.",
      syntax:
        "try {\n    // risky code\n} catch (ArithmeticException e) {\n    // handles division by zero, etc.\n} catch (NullPointerException e) {\n    // handles null dereference\n} catch (Exception e) {\n    // catches anything else — must come LAST, since Exception is a supertype of the others\n}",
      example: "try {\n    int[] arr = new int[3];\n    System.out.println(arr[5]);\n} catch (ArrayIndexOutOfBoundsException e) {\n    System.out.println(\"Invalid index: \" + e.getMessage());\n}",
      notes: [
        "Catch blocks are checked top to bottom, and only the FIRST matching one runs — order them from most specific to most general.",
        "<code>e.getMessage()</code> returns a human-readable description of what went wrong; <code>e.printStackTrace()</code> prints the full call chain, useful for debugging.",
      ],
      mistakes: ["Ordering <code>catch (Exception e)</code> BEFORE a more specific catch like <code>catch (ArithmeticException e)</code> — this is actually a COMPILE ERROR in Java, since the specific catch becomes unreachable code."],
      bestPractices: ["Never write an empty catch block (<code>catch (Exception e) {}</code>) — silently swallowing an exception hides real bugs. At minimum, log it."],
    }),
  },
  {
    title: "finally",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A <code>finally</code> block, if present, ALWAYS runs after the try/catch — whether an exception was thrown or not, and even if the try or catch block returns early. It's the standard place to release resources (close files, database connections, etc.).",
      syntax: "try {\n    // risky code\n} catch (Exception e) {\n    // handle it\n} finally {\n    // ALWAYS runs — cleanup code goes here\n}",
      example:
        "try {\n    System.out.println(\"Trying...\");\n    throw new RuntimeException(\"Oops\");\n} catch (RuntimeException e) {\n    System.out.println(\"Caught: \" + e.getMessage());\n} finally {\n    System.out.println(\"Finally block always runs\");\n}\n// Trying...\n// Caught: Oops\n// Finally block always runs",
      notes: [
        "finally runs even if the try or catch block contains a return statement — the return value is computed first, then finally runs, THEN the method actually returns.",
        "The only way finally does NOT run is if the JVM itself exits (<code>System.exit()</code>) or crashes during the try/catch.",
      ],
      mistakes: ["Putting a return statement inside <code>finally</code> — this silently overrides any return value from the try or catch block, which is almost always a bug, not an intentional design choice."],
    }),
  },
  {
    title: "throw",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "The <code>throw</code> keyword manually raises an exception — used when your own code detects an invalid state and wants to signal an error, rather than waiting for the JVM to raise one on its own.",
      syntax: "if (age < 0) {\n    throw new IllegalArgumentException(\"Age cannot be negative\");\n}",
      example: "static int divide(int a, int b) {\n    if (b == 0) {\n        throw new ArithmeticException(\"Division by zero is not allowed\");\n    }\n    return a / b;\n}",
      notes: [
        "<code>throw</code> is followed by an actual exception OBJECT (<code>new SomeException(\"message\")</code>), not just a class name.",
        "Once thrown, an exception propagates up the call stack until some caller's catch block handles it — if none does, the program terminates with a stack trace.",
      ],
      mistakes: ["Confusing <code>throw</code> (used inside a method body to actually raise an exception) with <code>throws</code> (used in a method signature to declare that it might raise one) — they look similar but do completely different things."],
    }),
  },
  {
    title: "throws",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "The <code>throws</code> keyword appears in a method's signature to declare that it might propagate a CHECKED exception to its caller, without handling it itself. This is Java's way of forcing callers to acknowledge the possibility.",
      syntax:
        "void readFile(String path) throws IOException {\n    // code that might throw IOException, not caught here\n}\n\n// the caller must either catch it or declare throws itself:\nvoid caller() throws IOException {\n    readFile(\"data.txt\");\n}",
      example: "import java.io.*;\n\nstatic void readConfig() throws FileNotFoundException {\n    FileReader fr = new FileReader(\"config.txt\"); // can throw FileNotFoundException\n}",
      notes: [
        "Java distinguishes CHECKED exceptions (like <code>IOException</code>) — which the compiler forces you to either catch or declare with throws — from UNCHECKED exceptions (<code>RuntimeException</code> and its subclasses, like <code>ArithmeticException</code>/<code>NullPointerException</code>), which require neither.",
        "A method can declare multiple exception types: <code>void method() throws IOException, SQLException</code>.",
      ],
      mistakes: ["Adding <code>throws Exception</code> to every method \"to be safe\" — this defeats the purpose of checked exceptions, since it tells callers nothing specific about what could actually go wrong."],
    }),
  },
  {
    title: "Custom Exceptions",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "You can define your own exception class by extending <code>Exception</code> (checked) or <code>RuntimeException</code> (unchecked), for errors specific to your application's domain that no built-in exception describes well.",
      syntax: "class InsufficientFundsException extends Exception {\n    public InsufficientFundsException(String message) {\n        super(message); // pass the message up to Exception's constructor\n    }\n}",
      example:
        "class InsufficientFundsException extends Exception {\n    public InsufficientFundsException(String message) { super(message); }\n}\n\nstatic void withdraw(double balance, double amount) throws InsufficientFundsException {\n    if (amount > balance) {\n        throw new InsufficientFundsException(\"Cannot withdraw \" + amount + \", balance is only \" + balance);\n    }\n}",
      notes: [
        "Extend <code>Exception</code> when callers SHOULD be forced to handle the error (checked); extend <code>RuntimeException</code> when it represents a programming bug that shouldn't require every caller to catch it (unchecked).",
        "A custom exception class is otherwise just a normal class — you can add extra fields (e.g. an error code) and methods beyond what Exception already provides.",
      ],
      mistakes: ["Extending <code>Throwable</code> or <code>Error</code> instead of <code>Exception</code>/<code>RuntimeException</code> — <code>Error</code> is reserved for serious JVM-level problems (like <code>OutOfMemoryError</code>) that application code should never try to handle."],
      bestPractices: ["Give a custom exception a name ending in \"Exception\" and always call the <code>super(message)</code> constructor so <code>getMessage()</code> works correctly."],
    }),
  },
];

const MODULE8_QUIZ = [
  {
    type: "MCQ",
    prompt: "What must follow a try block?",
    options: ["Nothing, try can stand alone", "At least a catch block, a finally block, or both", "Only a catch block, never finally", "Only a finally block, never catch"],
    correctAnswer: 1,
    explanation: "A try block by itself is a compile error — it needs at least one catch, a finally, or both.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\ntry {\n    System.out.println(\"A\");\n    int x = 10 / 0;\n    System.out.println(\"B\");\n} catch (ArithmeticException e) {\n    System.out.println(\"C\");\n}",
    options: ["A\nB\nC", "A\nC", "A\nB", "C"],
    correctAnswer: 1,
    explanation: "\"A\" prints, then 10/0 throws ArithmeticException immediately — \"B\" is skipped entirely, and the catch block prints \"C\".",
  },
  {
    type: "MCQ",
    prompt: "In a chain of catch blocks, what determines which one runs?",
    options: ["The LAST matching catch block, checked bottom to top", "The FIRST matching catch block, checked top to bottom", "All matching catch blocks run", "A random matching catch block"],
    correctAnswer: 1,
    explanation: "Catch blocks are evaluated top to bottom, and execution enters the first one whose type matches the thrown exception.",
  },
  {
    type: "DEBUG",
    prompt: "Why won't this compile?\n\ntry {\n    riskyCall();\n} catch (Exception e) {\n    System.out.println(\"generic\");\n} catch (ArithmeticException e) {\n    System.out.println(\"specific\");\n}",
    options: ["It compiles fine", "The ArithmeticException catch is unreachable — Exception already matches it, and it comes first", "catch blocks can't be chained", "Exception isn't a valid catch type"],
    correctAnswer: 1,
    explanation: "Since ArithmeticException IS-A Exception, the first catch (Exception e) would always match first, making the second catch block dead code — Java flags this as a compile error rather than silently allowing unreachable code.",
  },
  {
    type: "MCQ",
    prompt: "When does a finally block run?",
    options: ["Only if an exception was thrown", "Only if no exception was thrown", "Always, whether or not an exception was thrown (except for JVM exit/crash)", "Only if the catch block doesn't handle the exception"],
    correctAnswer: 2,
    explanation: "finally is guaranteed to run in virtually every case — its purpose is reliable cleanup regardless of what happened in try/catch.",
  },
  {
    type: "MCQ",
    prompt: "What is the difference between `throw` and `throws`?",
    options: ["They are identical, interchangeable keywords", "throw actually raises an exception inside a method body; throws declares in a method's signature that it might propagate one", "throw is for checked exceptions, throws is for unchecked", "throws actually raises an exception; throw declares it"],
    correctAnswer: 1,
    explanation: "throw is an executable statement that raises an exception object; throws is signature metadata declaring a possible checked exception to callers.",
  },
  {
    type: "MCQ",
    prompt: "Which category of exception does the compiler force you to catch or declare with `throws`?",
    options: ["Unchecked exceptions like NullPointerException", "Checked exceptions like IOException", "Errors like OutOfMemoryError", "All exceptions, with no distinction"],
    correctAnswer: 1,
    explanation: "Checked exceptions (subclasses of Exception that aren't RuntimeException) must be caught or declared; unchecked exceptions and Errors require neither.",
  },
  {
    type: "MCQ",
    prompt: "When creating a custom exception, which class should you extend to make it an unchecked exception?",
    options: ["Exception", "RuntimeException", "Throwable", "Error"],
    correctAnswer: 1,
    explanation: "RuntimeException and its subclasses are unchecked — the compiler doesn't force callers to catch or declare them.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. The judge
// only checks the returned value, so these are written to naturally invite an internal try/catch
// even though the grader can't verify the implementation technique itself.
const MODULE8_CODING = [
  {
    type: "CODING",
    prompt: "Read two integers a and b, and print a / b as an integer. If b is 0, print \"Error: division by zero\" instead of crashing.",
    language: "java",
    testCases: [{ input: "10\n2", expected: "5" }, { input: "5\n0", expected: "Error: division by zero" }, { input: "-9\n3", expected: "-3" }],
    explanation: "Wrap the division in a try/catch for ArithmeticException (or check b == 0 directly) and return the error message instead of letting the division throw.",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers on one line and an index on the next line. If the index is valid, print the element at that index; otherwise print \"Error: index out of bounds\".",
    language: "java",
    testCases: [{ input: "1 2 3\n1", expected: "2" }, { input: "1 2 3\n5", expected: "Error: index out of bounds" }, { input: "5\n0", expected: "5" }],
    explanation: "Wrap the array access in a try/catch for ArrayIndexOutOfBoundsException (or validate the index range directly) and return the error message instead of letting it crash.",
  },
];

// Modules 9-16: topic list + trailing practice-section label from the spec. Real lesson
// content isn't hand-authored for these — each gets a placeholder lesson body so the course
// tree, navigation, and progress tracking all work end-to-end, ready for an admin to fill in
// real content via the Learning Management admin panel.
const REMAINING_MODULES = [
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
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module2PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 3: full hand-authored content ---
  const module3 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Control Statements" } },
    update: {},
    create: { courseId: course.id, title: "Control Statements", order: 2 },
  });

  for (let i = 0; i < MODULE3_LESSONS.length; i++) {
    const l = MODULE3_LESSONS[i];
    await upsertLessonContent(prisma, module3.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module3PracticeLesson = await upsertLessonContent(prisma, module3.id, "Coding Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE3_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule3Practice = await prisma.practiceQuestion.count({ where: { lessonId: module3PracticeLesson.id } });
  if (existingModule3Practice === 0) {
    let order = 0;
    for (const q of MODULE3_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module3PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE3_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module3PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 4: full hand-authored content ---
  const module4 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Methods" } },
    update: {},
    create: { courseId: course.id, title: "Methods", order: 3 },
  });

  for (let i = 0; i < MODULE4_LESSONS.length; i++) {
    const l = MODULE4_LESSONS[i];
    await upsertLessonContent(prisma, module4.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module4PracticeLesson = await upsertLessonContent(prisma, module4.id, "Practice Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE4_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule4Practice = await prisma.practiceQuestion.count({ where: { lessonId: module4PracticeLesson.id } });
  if (existingModule4Practice === 0) {
    let order = 0;
    for (const q of MODULE4_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module4PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE4_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module4PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 5: full hand-authored content ---
  const module5 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Arrays" } },
    update: {},
    create: { courseId: course.id, title: "Arrays", order: 4 },
  });

  for (let i = 0; i < MODULE5_LESSONS.length; i++) {
    const l = MODULE5_LESSONS[i];
    await upsertLessonContent(prisma, module5.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module5PracticeLesson = await upsertLessonContent(prisma, module5.id, "Coding Exercises", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE5_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule5Practice = await prisma.practiceQuestion.count({ where: { lessonId: module5PracticeLesson.id } });
  if (existingModule5Practice === 0) {
    let order = 0;
    for (const q of MODULE5_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module5PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE5_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module5PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 6: full hand-authored content ---
  const module6 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Strings" } },
    update: {},
    create: { courseId: course.id, title: "Strings", order: 5 },
  });

  for (let i = 0; i < MODULE6_LESSONS.length; i++) {
    const l = MODULE6_LESSONS[i];
    await upsertLessonContent(prisma, module6.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module6PracticeLesson = await upsertLessonContent(prisma, module6.id, "Coding Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE6_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule6Practice = await prisma.practiceQuestion.count({ where: { lessonId: module6PracticeLesson.id } });
  if (existingModule6Practice === 0) {
    let order = 0;
    for (const q of MODULE6_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module6PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE6_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module6PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 7: full hand-authored content ---
  const module7 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Object-Oriented Programming (OOP)" } },
    update: {},
    create: { courseId: course.id, title: "Object-Oriented Programming (OOP)", order: 6 },
  });

  for (let i = 0; i < MODULE7_LESSONS.length; i++) {
    const l = MODULE7_LESSONS[i];
    await upsertLessonContent(prisma, module7.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module7PracticeLesson = await upsertLessonContent(prisma, module7.id, "Mini Quiz & Coding Exercises", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE7_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule7Practice = await prisma.practiceQuestion.count({ where: { lessonId: module7PracticeLesson.id } });
  if (existingModule7Practice === 0) {
    let order = 0;
    for (const q of MODULE7_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module7PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE7_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module7PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 8: full hand-authored content ---
  const module8 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Exception Handling" } },
    update: {},
    create: { courseId: course.id, title: "Exception Handling", order: 7 },
  });

  for (let i = 0; i < MODULE8_LESSONS.length; i++) {
    const l = MODULE8_LESSONS[i];
    await upsertLessonContent(prisma, module8.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module8PracticeLesson = await upsertLessonContent(prisma, module8.id, "Coding Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE8_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule8Practice = await prisma.practiceQuestion.count({ where: { lessonId: module8PracticeLesson.id } });
  if (existingModule8Practice === 0) {
    let order = 0;
    for (const q of MODULE8_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module8PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE8_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module8PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Modules 9-16: stub structure only, real content added later via admin CMS ---
  for (let m = 0; m < REMAINING_MODULES.length; m++) {
    const spec = REMAINING_MODULES[m];
    const mod = await prisma.courseModule.upsert({
      where: { courseId_title: { courseId: course.id, title: spec.title } },
      update: {},
      create: { courseId: course.id, title: spec.title, order: m + 8 },
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

  console.log("Seeded Learning Module: Java course with", REMAINING_MODULES.length + 8, "modules.");
}

module.exports = { seedLearningModule };

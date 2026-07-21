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

const MODULE9_LESSONS = [
  {
    title: "ArrayList",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "<code>ArrayList</code> is a resizable array implementation of the <code>List</code> interface — unlike a plain array, it grows automatically as elements are added, and it stores objects (not primitives directly — primitives are auto-boxed to their wrapper types).",
      syntax:
        "import java.util.ArrayList;\n\nArrayList<String> names = new ArrayList<>();\nnames.add(\"Alice\");             // append\nnames.add(0, \"Bob\");             // insert at index\nnames.get(0);                    // read by index\nnames.set(1, \"Carol\");           // update by index\nnames.remove(0);                 // remove by index (or by value with remove(Object))\nnames.size();                    // current element count\nnames.contains(\"Alice\");         // search\nfor (String n : names) { /* ... */ }   // iterate",
      example: "ArrayList<Integer> nums = new ArrayList<>();\nnums.add(10);\nnums.add(20);\nnums.add(30);\nSystem.out.println(nums); // [10, 20, 30]\nnums.remove(Integer.valueOf(20)); // removes the VALUE 20, not index 20\nSystem.out.println(nums); // [10, 30]",
      notes: [
        "<code>ArrayList&lt;int&gt;</code> is illegal — generics only work with reference types, so you must use the wrapper class <code>ArrayList&lt;Integer&gt;</code> (Java auto-boxes int↔Integer for you).",
        "<code>remove(int index)</code> and <code>remove(Object o)</code> are OVERLOADED — <code>remove(5)</code> removes the element AT index 5, while <code>remove(Integer.valueOf(5))</code> removes the first element EQUAL TO 5. This is a classic gotcha.",
      ],
      mistakes: ["Calling <code>list.remove(5)</code> expecting to remove the value 5 — for an <code>ArrayList&lt;Integer&gt;</code>, this removes whatever is at INDEX 5, since the int literal matches the <code>remove(int index)</code> overload, not <code>remove(Object o)</code>."],
      bestPractices: ["Prefer ArrayList over a plain array whenever the collection's size isn't fixed or known in advance."],
    }),
  },
  {
    title: "LinkedList",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>LinkedList</code> is a doubly-linked-list implementation of both the <code>List</code> and <code>Deque</code> interfaces — it supports the same List operations as ArrayList, plus efficient insertion/removal at both ends (<code>addFirst</code>/<code>addLast</code>/<code>removeFirst</code>/<code>removeLast</code>).",
      syntax: "import java.util.LinkedList;\n\nLinkedList<String> queue = new LinkedList<>();\nqueue.addFirst(\"A\");\nqueue.addLast(\"B\");\nqueue.removeFirst();\nqueue.peekFirst();  // read without removing\nqueue.get(0);        // still supports List-style index access, but it's O(n)",
      example: "LinkedList<Integer> list = new LinkedList<>();\nlist.add(1);\nlist.add(2);\nlist.addFirst(0);\nSystem.out.println(list); // [0, 1, 2]",
      notes: [
        "ArrayList has O(1) random access (<code>get(i)</code>) but O(n) insertion/removal in the middle; LinkedList has O(1) insertion/removal at the ends but O(n) random access — pick based on your access pattern.",
        "LinkedList implements <code>Deque</code>, so it can be used as a stack (push/pop) or a queue (offer/poll) directly.",
      ],
      bestPractices: ["Default to ArrayList unless you specifically need frequent insertion/removal at the ends (or in the middle via an iterator) — for most everyday use, ArrayList's better cache locality makes it faster in practice."],
    }),
  },
  {
    title: "HashMap",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "<code>HashMap</code> stores key-value pairs, giving average O(1) lookup, insertion, and removal by key. Keys are unique (adding an existing key overwrites its value); iteration order is NOT guaranteed.",
      syntax:
        "import java.util.HashMap;\n\nHashMap<String, Integer> ages = new HashMap<>();\nages.put(\"Alice\", 30);          // insert/update\nages.get(\"Alice\");               // 30 — read (null if key absent)\nages.getOrDefault(\"Bob\", 0);     // 0 — safe read with a fallback\nages.containsKey(\"Alice\");       // true\nages.remove(\"Alice\");\nfor (Map.Entry<String, Integer> e : ages.entrySet()) {\n    System.out.println(e.getKey() + \" -> \" + e.getValue());\n}",
      example:
        "HashMap<String, Integer> wordCount = new HashMap<>();\nString[] words = {\"a\", \"b\", \"a\", \"c\", \"a\"};\nfor (String w : words) {\n    wordCount.put(w, wordCount.getOrDefault(w, 0) + 1);\n}\nSystem.out.println(wordCount.get(\"a\")); // 3",
      notes: [
        "<code>get()</code> on a missing key returns <code>null</code> (not an exception) — always check with <code>containsKey()</code> or use <code>getOrDefault()</code> to avoid a surprise NullPointerException when you later use the result.",
        "Two objects that are <code>.equals()</code> to each other MUST have the same <code>hashCode()</code> for HashMap to work correctly — this is why custom key classes need both methods overridden consistently.",
      ],
      mistakes: ["Calling <code>get()</code> on a key that might not exist and immediately using the result without a null check — this is one of the most common sources of NullPointerException in real Java code."],
    }),
  },
  {
    title: "HashSet",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>HashSet</code> stores a collection of UNIQUE elements with no defined order, backed internally by a HashMap. Adding a duplicate element is silently a no-op — <code>add()</code> returns <code>false</code> but doesn't throw.",
      syntax:
        "import java.util.HashSet;\n\nHashSet<String> visited = new HashSet<>();\nvisited.add(\"A\");\nvisited.add(\"B\");\nvisited.add(\"A\");    // no-op — A is already present\nvisited.contains(\"A\"); // true — O(1) average lookup\nvisited.size();          // 2, not 3\nvisited.remove(\"A\");",
      example: "int[] nums = {1, 2, 2, 3, 3, 3};\nHashSet<Integer> unique = new HashSet<>();\nfor (int n : nums) { unique.add(n); }\nSystem.out.println(unique.size()); // 3 — duplicates automatically collapsed",
      notes: [
        "The classic use case is deduplication and O(1) average membership testing — checking <code>contains()</code> on a HashSet is far faster than scanning a List with <code>contains()</code>, which is O(n).",
        "Like HashMap, HashSet gives no guarantee about iteration order — don't rely on elements coming out in insertion order.",
      ],
      mistakes: ["Using an ArrayList and calling <code>contains()</code> repeatedly in a loop to check for duplicates — this is O(n) per check, O(n²) overall; a HashSet does the same job in O(n) total."],
    }),
  },
  {
    title: "TreeMap",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>TreeMap</code> is a Map implementation that keeps its keys sorted (by natural ordering, or a custom Comparator), backed by a red-black tree. Operations are O(log n) rather than HashMap's average O(1), in exchange for guaranteed sorted order.",
      syntax:
        "import java.util.TreeMap;\n\nTreeMap<String, Integer> scores = new TreeMap<>();\nscores.put(\"Charlie\", 70);\nscores.put(\"Alice\", 90);\nscores.put(\"Bob\", 80);\nfor (String key : scores.keySet()) {\n    System.out.println(key); // Alice, Bob, Charlie — sorted, not insertion order\n}\nscores.firstKey();  // \"Alice\" — smallest key\nscores.lastKey();   // \"Charlie\" — largest key",
      example: "TreeMap<Integer, String> map = new TreeMap<>();\nmap.put(3, \"three\");\nmap.put(1, \"one\");\nmap.put(2, \"two\");\nSystem.out.println(map.keySet()); // [1, 2, 3] — always sorted",
      notes: [
        "Use TreeMap when you need entries sorted by key (e.g. a leaderboard, a range query) — otherwise HashMap's faster average performance makes it the default choice.",
        "Keys must be mutually comparable — either they implement <code>Comparable</code>, or you supply a <code>Comparator</code> when constructing the TreeMap.",
      ],
      mistakes: ["Defaulting to TreeMap \"just to be safe\" when sorted order isn't actually needed — this pays an unnecessary O(log n) cost on every operation compared to HashMap's average O(1)."],
    }),
  },
  {
    title: "Queue",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>Queue</code> is an interface representing a First-In-First-Out (FIFO) collection — elements are added at the tail and removed from the head, like a line at a checkout counter. LinkedList and ArrayDeque are common implementations.",
      syntax:
        "import java.util.Queue;\nimport java.util.LinkedList;\n\nQueue<Integer> queue = new LinkedList<>();\nqueue.offer(1);       // add to the tail (preferred over add() — returns false instead of throwing if the queue is full/bounded)\nqueue.offer(2);\nqueue.poll();          // removes and returns the head (1) — returns null if empty, instead of throwing\nqueue.peek();          // reads the head without removing it — null if empty",
      example: "Queue<String> line = new LinkedList<>();\nline.offer(\"Alice\");\nline.offer(\"Bob\");\nline.offer(\"Carol\");\nSystem.out.println(line.poll()); // Alice — first in, first out\nSystem.out.println(line.poll()); // Bob",
      notes: [
        "<code>poll()</code>/<code>peek()</code> return null on an empty queue instead of throwing, unlike <code>remove()</code>/<code>element()</code> which DO throw — prefer poll()/peek() unless you specifically want the exception-throwing behavior.",
        "A classic use case: breadth-first search (BFS) uses a Queue to process nodes level by level.",
      ],
      mistakes: ["Using <code>remove()</code> or <code>element()</code> on a possibly-empty queue and being surprised by a <code>NoSuchElementException</code> — <code>poll()</code>/<code>peek()</code> are the null-safe alternatives."],
    }),
  },
  {
    title: "Stack",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A stack is a Last-In-First-Out (LIFO) collection — the last element added is the first one removed, like a stack of plates. Java's legacy <code>Stack</code> class exists, but <code>ArrayDeque</code> is now the recommended implementation for stack behavior.",
      syntax:
        "import java.util.ArrayDeque;\nimport java.util.Deque;\n\nDeque<Integer> stack = new ArrayDeque<>();\nstack.push(1);    // add to the top\nstack.push(2);\nstack.push(3);\nstack.pop();       // removes and returns the top (3)\nstack.peek();      // reads the top without removing it\n\n// The legacy alternative, still widely seen in older code and interview questions:\nimport java.util.Stack;\nStack<Integer> legacyStack = new Stack<>();\nlegacyStack.push(1);\nlegacyStack.pop();",
      example: "Deque<Character> stack = new ArrayDeque<>();\nfor (char c : \"(()\".toCharArray()) {\n    if (c == '(') stack.push(c);\n    else stack.pop();\n}\nSystem.out.println(stack.size()); // 1 — one unmatched '('",
      notes: [
        "The legacy <code>java.util.Stack</code> extends <code>Vector</code> and is synchronized (thread-safe but slower) — for single-threaded code, <code>ArrayDeque</code> used as a stack is faster and is the modern recommendation.",
        "Classic use cases: undo functionality, expression evaluation, matching brackets/parentheses, and function call stacks (which is literally how recursion works under the hood).",
      ],
      mistakes: ["Calling <code>pop()</code> or <code>peek()</code> on an empty stack — both throw an exception (<code>EmptyStackException</code> for legacy Stack, <code>NoSuchElementException</code> for ArrayDeque) rather than returning null, unlike Queue's poll()/peek()."],
    }),
  },
  {
    title: "PriorityQueue",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "<code>PriorityQueue</code> is a queue where elements come out in PRIORITY order (smallest first, by default) rather than insertion order — internally backed by a binary heap, giving O(log n) insertion and removal.",
      syntax:
        "import java.util.PriorityQueue;\n\nPriorityQueue<Integer> pq = new PriorityQueue<>();  // min-heap by default\npq.offer(5);\npq.offer(1);\npq.offer(3);\npq.poll();   // 1 — the SMALLEST element comes out first, not insertion order\n\n// Max-heap: supply a reverse-order comparator\nPriorityQueue<Integer> maxHeap = new PriorityQueue<>((a, b) -> b - a);\nmaxHeap.offer(5);\nmaxHeap.offer(1);\nmaxHeap.poll();  // 5 — the LARGEST comes out first",
      example: "PriorityQueue<Integer> pq = new PriorityQueue<>();\npq.offer(10);\npq.offer(4);\npq.offer(7);\nwhile (!pq.isEmpty()) {\n    System.out.print(pq.poll() + \" \");\n}\n// 4 7 10 — always ascending, regardless of insertion order",
      notes: [
        "Iterating a PriorityQueue directly (with a for-each loop) does NOT visit elements in priority order — only repeated <code>poll()</code> calls guarantee sorted removal order.",
        "Classic use cases: Dijkstra's shortest-path algorithm, task scheduling by priority, and finding the k largest/smallest elements in a stream.",
      ],
      mistakes: ["Assuming a for-each loop over a PriorityQueue processes elements smallest-to-largest — the internal heap array isn't stored in sorted order, only the ROOT (accessible via <code>peek()</code>/<code>poll()</code>) is guaranteed to be the minimum."],
    }),
  },
];

const MODULE9_QUIZ = [
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nArrayList<Integer> list = new ArrayList<>();\nlist.add(10);\nlist.add(20);\nlist.add(30);\nlist.remove(1);\nSystem.out.println(list);",
    options: ["[10, 20, 30]", "[10, 30]", "[20, 30]", "[10, 20]"],
    correctAnswer: 1,
    explanation: "remove(1) matches the remove(int index) overload — it removes the element AT index 1 (the value 20), leaving [10, 30].",
  },
  {
    type: "MCQ",
    prompt: "What is the key performance trade-off between ArrayList and LinkedList?",
    options: ["ArrayList has O(1) random access but O(n) middle insertion; LinkedList has O(n) random access but O(1) end insertion", "They have identical performance characteristics", "LinkedList always outperforms ArrayList", "ArrayList cannot store more than 100 elements"],
    correctAnswer: 0,
    explanation: "ArrayList's backing array gives fast indexed access but shifts elements on insertion; LinkedList's node links give fast end insertion but require O(n) traversal for indexed access.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does `map.get(\"missing\")` return on a HashMap that doesn't contain the key \"missing\"?",
    options: ["Throws an exception", "0", "null", "An empty string"],
    correctAnswer: 2,
    explanation: "HashMap.get() on an absent key returns null rather than throwing — this is why get() results should be null-checked or getOrDefault() should be used instead.",
  },
  {
    type: "MCQ",
    prompt: "What happens when you add a value to a HashSet that already contains an equal element?",
    options: ["Throws an exception", "The add() call is a silent no-op — the set is unchanged, add() returns false", "The old element is duplicated", "The HashSet automatically converts to a List"],
    correctAnswer: 1,
    explanation: "HashSet guarantees uniqueness — adding a duplicate is a harmless no-op that returns false rather than throwing or duplicating.",
  },
  {
    type: "MCQ",
    prompt: "What guarantee does TreeMap provide that HashMap does not?",
    options: ["Faster average lookup", "Keys are always iterated in sorted order", "It allows duplicate keys", "It uses less memory"],
    correctAnswer: 1,
    explanation: "TreeMap keeps its keys in sorted order at the cost of O(log n) operations, versus HashMap's unordered but average-O(1) operations.",
  },
  {
    type: "MCQ",
    prompt: "Which ordering does a Queue follow?",
    options: ["LIFO — last in, first out", "FIFO — first in, first out", "Random order", "Sorted order, always"],
    correctAnswer: 1,
    explanation: "Queue is First-In-First-Out — elements are removed in the same order they were added.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nDeque<Integer> stack = new ArrayDeque<>();\nstack.push(1);\nstack.push(2);\nstack.push(3);\nSystem.out.println(stack.pop());",
    options: ["1", "2", "3", "Throws an exception"],
    correctAnswer: 2,
    explanation: "A stack is LIFO — the last element pushed (3) is the first one popped.",
  },
  {
    type: "MCQ",
    prompt: "By default, what order does PriorityQueue.poll() return elements in?",
    options: ["Insertion order", "Largest first", "Smallest first (natural ordering)", "Random order"],
    correctAnswer: 2,
    explanation: "PriorityQueue is a min-heap by default — poll() always removes and returns the smallest remaining element, unless a custom Comparator reverses the order.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. True List/
// Map/Set/Queue parameter types aren't supported by the judge's FUNCTION-mode harness, so these use
// arrays/strings to model the same Collections-Framework thinking (frequency counting, priority
// ordering) that a HashMap/PriorityQueue would provide.
const MODULE9_CODING = [
  {
    type: "CODING",
    prompt: "Read space-separated integers and print the value that appears most frequently (there is a unique winner).",
    language: "java",
    testCases: [{ input: "1 3 2 3 3 2", expected: "3" }, { input: "5 5 6 6 6", expected: "6" }, { input: "7", expected: "7" }],
    explanation: "Count occurrences with a HashMap<Integer, Integer> (or an equivalent frequency array), then find the key with the highest count.",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers on one line and an integer K on the next line. Print the Kth largest value.",
    language: "java",
    testCases: [{ input: "3 1 4 1 5\n2", expected: "4" }, { input: "7 7 7\n1", expected: "7" }, { input: "10 20 30 40\n3", expected: "20" }],
    explanation: "Sort descending (or use a min-heap PriorityQueue of size K) and take the element at position K-1.",
  },
];

const MODULE10_LESSONS = [
  {
    title: "Reading Files",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Java provides several ways to read data from a file — the modern, simplest approach for whole-file or line-by-line reading is <code>java.nio.file.Files</code>, while classic I/O streams (<code>FileReader</code>, <code>BufferedReader</code>) remain common in existing code and interview contexts.",
      syntax:
        "import java.nio.file.*;\nimport java.util.List;\n\nList<String> lines = Files.readAllLines(Paths.get(\"data.txt\"));  // reads the whole file into a List<String>\nString content = Files.readString(Paths.get(\"data.txt\"));       // reads the whole file as one String (Java 11+)",
      example:
        "import java.nio.file.*;\nimport java.util.List;\nimport java.io.IOException;\n\ntry {\n    List<String> lines = Files.readAllLines(Paths.get(\"scores.txt\"));\n    for (String line : lines) {\n        System.out.println(line);\n    }\n} catch (IOException e) {\n    System.out.println(\"Could not read file: \" + e.getMessage());\n}",
      notes: [
        "Nearly every file operation can throw <code>IOException</code> (a CHECKED exception) — file reading code must be wrapped in try/catch or declared with <code>throws IOException</code>.",
        "<code>Files.readAllLines()</code> loads the ENTIRE file into memory at once — fine for small files, but BufferedReader's line-by-line reading (next lesson) is better for very large files.",
      ],
      mistakes: ["Forgetting that file I/O methods throw checked <code>IOException</code> — code that calls <code>Files.readAllLines()</code> without a try/catch or throws declaration simply won't compile."],
    }),
  },
  {
    title: "Writing Files",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Writing to a file is the mirror image of reading — <code>java.nio.file.Files</code> offers simple whole-content writes, while FileWriter/BufferedWriter (covered more in the next lessons) support incremental writing.",
      syntax:
        "import java.nio.file.*;\nimport java.util.List;\n\nFiles.writeString(Paths.get(\"output.txt\"), \"Hello, file!\");           // overwrites the file with this content (Java 11+)\nFiles.write(Paths.get(\"output.txt\"), List.of(\"line1\", \"line2\"));      // writes a list of lines\n\n// Appending instead of overwriting:\nFiles.writeString(Paths.get(\"log.txt\"), \"New entry\\n\", StandardOpenOption.APPEND);",
      example:
        "import java.nio.file.*;\nimport java.io.IOException;\n\ntry {\n    Files.writeString(Paths.get(\"greeting.txt\"), \"Hello, World!\");\n    System.out.println(\"File written successfully.\");\n} catch (IOException e) {\n    System.out.println(\"Could not write file: \" + e.getMessage());\n}",
      notes: [
        "By default, <code>Files.writeString()</code>/<code>Files.write()</code> OVERWRITE the target file's existing contents — pass <code>StandardOpenOption.APPEND</code> explicitly if you want to add to the end instead.",
        "If the target directory doesn't exist, these methods throw an exception rather than creating it automatically — the containing directory must already exist.",
      ],
      mistakes: ["Assuming a write call appends by default — without <code>StandardOpenOption.APPEND</code>, every write silently replaces the file's previous contents."],
    }),
  },
  {
    title: "BufferedReader",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "<code>BufferedReader</code> wraps another <code>Reader</code> (typically a <code>FileReader</code>) and adds an internal buffer, dramatically reducing the number of actual disk reads — and provides the convenient <code>readLine()</code> method for reading one line at a time.",
      syntax:
        "import java.io.*;\n\ntry (BufferedReader reader = new BufferedReader(new FileReader(\"data.txt\"))) {\n    String line;\n    while ((line = reader.readLine()) != null) {   // readLine() returns null at end-of-file\n        System.out.println(line);\n    }\n} catch (IOException e) {\n    System.out.println(\"Error reading file: \" + e.getMessage());\n}",
      example:
        "try (BufferedReader reader = new BufferedReader(new FileReader(\"names.txt\"))) {\n    String line;\n    int count = 0;\n    while ((line = reader.readLine()) != null) {\n        count++;\n    }\n    System.out.println(\"Total lines: \" + count);\n} catch (IOException e) {\n    e.printStackTrace();\n}",
      notes: [
        "The try-with-resources syntax (<code>try (BufferedReader reader = ...)</code>) automatically closes the reader when the block ends, even if an exception occurs — this is the standard, safe pattern for any I/O resource.",
        "<code>readLine()</code> returns <code>null</code> exactly once, at end-of-file — the <code>while ((line = reader.readLine()) != null)</code> idiom is the standard way to read every line.",
      ],
      mistakes: ["Forgetting to close a BufferedReader (or any I/O resource) — this leaks a file handle. Always use try-with-resources instead of manually calling <code>close()</code> in a finally block."],
    }),
  },
  {
    title: "FileWriter",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>FileWriter</code> is the basic class for writing character data to a file. Like BufferedReader speeds up reading, wrapping a FileWriter in a <code>BufferedWriter</code> improves write performance for many small writes.",
      syntax:
        "import java.io.*;\n\ntry (FileWriter writer = new FileWriter(\"output.txt\")) {    // overwrites by default\n    writer.write(\"Hello, World!\\n\");\n    writer.write(\"Second line\\n\");\n} catch (IOException e) {\n    System.out.println(\"Error writing file: \" + e.getMessage());\n}\n\n// Appending: pass true as the second constructor argument\ntry (FileWriter appender = new FileWriter(\"log.txt\", true)) {\n    appender.write(\"New log entry\\n\");\n} catch (IOException e) { /* ... */ }",
      example: "try (FileWriter writer = new FileWriter(\"report.txt\")) {\n    for (int i = 1; i <= 3; i++) {\n        writer.write(\"Line \" + i + \"\\n\");\n    }\n} catch (IOException e) {\n    e.printStackTrace();\n}",
      notes: [
        "<code>new FileWriter(path)</code> OVERWRITES the file by default; <code>new FileWriter(path, true)</code> APPENDS instead — the boolean second argument is easy to forget.",
        "Wrap a FileWriter in a <code>BufferedWriter</code> (<code>new BufferedWriter(new FileWriter(path))</code>) when writing many small pieces of text, for the same buffering benefit BufferedReader gives to reads.",
      ],
      mistakes: ["Reopening a FileWriter without the append flag inside a loop — each <code>new FileWriter(path)</code> call truncates the file again, so only the LAST write survives instead of all of them."],
    }),
  },
  {
    title: "Scanner",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>Scanner</code> (most familiar from reading keyboard input via <code>System.in</code>) can also read from a file, tokenizing input by whitespace and offering typed read methods (<code>nextInt()</code>, <code>nextDouble()</code>, etc.) — convenient when a file contains structured, space-separated data.",
      syntax:
        "import java.util.Scanner;\nimport java.io.File;\nimport java.io.FileNotFoundException;\n\ntry (Scanner sc = new Scanner(new File(\"numbers.txt\"))) {\n    while (sc.hasNextInt()) {\n        int n = sc.nextInt();\n        System.out.println(n);\n    }\n} catch (FileNotFoundException e) {\n    System.out.println(\"File not found: \" + e.getMessage());\n}",
      example: "try (Scanner sc = new Scanner(new File(\"scores.txt\"))) {\n    int total = 0;\n    while (sc.hasNextInt()) {\n        total += sc.nextInt();\n    }\n    System.out.println(\"Total: \" + total);\n} catch (FileNotFoundException e) {\n    e.printStackTrace();\n}",
      notes: [
        "Scanner throws <code>FileNotFoundException</code> (a checked exception, subclass of <code>IOException</code>) if the file doesn't exist — different from BufferedReader/FileReader's plain <code>IOException</code>, but still must be caught or declared.",
        "<code>hasNextInt()</code>/<code>hasNextLine()</code>/etc. let you check whether more matching input remains BEFORE consuming it with <code>nextInt()</code>/<code>nextLine()</code> — calling the next methods without checking risks a <code>NoSuchElementException</code> at end-of-input.",
      ],
      mistakes: ["Mixing <code>nextInt()</code> with <code>nextLine()</code> without accounting for the leftover newline — <code>nextInt()</code> doesn't consume the newline after the number, so a following <code>nextLine()</code> can return an unexpectedly empty string. (This applies to Scanner on <code>System.in</code> even more often than on files.)"],
      bestPractices: ["Prefer BufferedReader for line-oriented text and Scanner for whitespace-tokenized structured data (numbers, mixed types) — pick based on the file's actual format."],
    }),
  },
];

const MODULE10_QUIZ = [
  {
    type: "MCQ",
    prompt: "What type of exception must file-reading code in Java handle or declare?",
    options: ["RuntimeException, always optional", "IOException, a checked exception", "No exception handling is ever required for file I/O", "ArithmeticException"],
    correctAnswer: 1,
    explanation: "File operations can fail for reasons outside the program's control (missing file, permissions, disk errors) — Java models this as the checked IOException, forcing explicit handling.",
  },
  {
    type: "MCQ",
    prompt: "By default, does `Files.writeString(path, content)` overwrite or append to an existing file?",
    options: ["It appends", "It overwrites", "It throws an exception if the file exists", "It asks the user interactively"],
    correctAnswer: 1,
    explanation: "Without StandardOpenOption.APPEND, Files.writeString() replaces the file's entire previous contents.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does `reader.readLine()` return when BufferedReader reaches the end of the file?",
    options: ["An empty string \"\"", "Throws an exception", "null", "0"],
    correctAnswer: 2,
    explanation: "readLine() returns null exactly once at end-of-file, which is why while ((line = reader.readLine()) != null) is the standard read-loop idiom.",
  },
  {
    type: "MCQ",
    prompt: "Why is try-with-resources (`try (BufferedReader r = ...) { }`) preferred for file I/O?",
    options: ["It runs faster than any other approach", "It automatically closes the resource when the block ends, even if an exception occurs", "It disables checked exceptions", "It is required by the Java compiler for all file access"],
    correctAnswer: 1,
    explanation: "try-with-resources guarantees close() is called on the resource, preventing file-handle leaks even when an exception is thrown mid-block.",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with this code, if the goal is to accumulate lines across multiple calls to writeLine()?\n\nvoid writeLine(String text) throws IOException {\n    FileWriter writer = new FileWriter(\"log.txt\");\n    writer.write(text + \"\\n\");\n    writer.close();\n}",
    options: ["Nothing, each call correctly appends a new line", "new FileWriter(\"log.txt\") without the append flag overwrites the file every call — only the last write survives", "FileWriter cannot write strings, only bytes", "close() should be called before write()"],
    correctAnswer: 1,
    explanation: "Each call constructs a new FileWriter without true (append mode), so every call truncates the file and only the most recent write remains.",
  },
  {
    type: "MCQ",
    prompt: "What is the main purpose of wrapping a FileReader in a BufferedReader?",
    options: ["To encrypt the file contents", "To reduce disk reads via internal buffering, and to gain access to readLine()", "To convert the file to a different format", "BufferedReader and FileReader are functionally identical"],
    correctAnswer: 1,
    explanation: "BufferedReader adds an internal buffer (fewer physical disk reads) and the convenient readLine() method, which plain FileReader doesn't have.",
  },
  {
    type: "MCQ",
    prompt: "What exception does `new Scanner(new File(\"missing.txt\"))` throw if the file doesn't exist?",
    options: ["IOException directly", "FileNotFoundException, a subclass of IOException", "NullPointerException", "No exception — Scanner returns null"],
    correctAnswer: 1,
    explanation: "Scanner's File constructor throws the checked FileNotFoundException, which is itself a subclass of IOException.",
  },
  {
    type: "MCQ",
    prompt: "Which class is generally preferable for reading whitespace-tokenized structured data (like a file of space-separated numbers) with typed reads like nextInt()?",
    options: ["BufferedReader", "FileWriter", "Scanner", "StringBuilder"],
    correctAnswer: 2,
    explanation: "Scanner's hasNextInt()/nextInt()-style typed, whitespace-tokenized reads are purpose-built for structured data, unlike BufferedReader's plain line-based readLine().",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. Real file
// I/O isn't exercised by the judge (no filesystem access in FUNCTION mode), so these model the same
// word/line processing you'd do on text read from a file.
const MODULE10_CODING = [
  {
    type: "CODING",
    prompt: "Read a string representing text content (space-separated words) and print the total word count.",
    language: "java",
    testCases: [{ input: "the quick brown fox", expected: "4" }, { input: "hello", expected: "1" }, { input: "a b c d e", expected: "5" }],
    explanation: "Split the string on whitespace and count the resulting tokens.",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers (as if read line by line from a file of scores) and print their average, floored to the nearest integer.",
    language: "java",
    testCases: [{ input: "10 20 30", expected: "20" }, { input: "5 5 5 5", expected: "5" }, { input: "7", expected: "7" }],
    explanation: "Sum all the scores, divide by the count, and floor (integer division truncates toward zero for positive sums).",
  },
];

const MODULE11_LESSONS = [
  {
    title: "Threads",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A thread is an independent path of execution within a program — every Java program has at least one thread (the \"main\" thread). Creating additional threads lets multiple tasks run concurrently.",
      syntax:
        "class MyThread extends Thread {\n    @Override\n    public void run() {\n        System.out.println(\"Running in a separate thread\");\n    }\n}\n\nMyThread t = new MyThread();\nt.start();   // starts a NEW thread, which then calls run()\n// NOT t.run() — calling run() directly just executes it on the CURRENT thread, no new thread is created",
      example:
        "class Counter extends Thread {\n    public void run() {\n        for (int i = 1; i <= 3; i++) {\n            System.out.println(Thread.currentThread().getName() + \": \" + i);\n        }\n    }\n}\n\npublic static void main(String[] args) {\n    Counter c = new Counter();\n    c.start();\n}",
      notes: [
        "<code>start()</code> creates a new OS-level thread and schedules <code>run()</code> to execute on it; <code>run()</code> is just a normal method call if invoked directly — this is the single most common beginner mistake with threads.",
        "<code>Thread.currentThread().getName()</code> identifies which thread is currently executing — useful for observing concurrent behavior.",
      ],
      mistakes: ["Calling <code>t.run()</code> instead of <code>t.start()</code> — this executes the code synchronously on the calling thread, defeating the entire purpose of using a thread."],
    }),
  },
  {
    title: "Runnable",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "<code>Runnable</code> is a functional interface with a single <code>run()</code> method — implementing Runnable (rather than extending Thread) is the preferred way to define a task, since Java only allows single inheritance and a class implementing Runnable can still extend something else.",
      syntax:
        "class MyTask implements Runnable {\n    @Override\n    public void run() {\n        System.out.println(\"Task running\");\n    }\n}\n\nThread t = new Thread(new MyTask());\nt.start();\n\n// Or, using a lambda (Runnable is functional — single abstract method):\nThread t2 = new Thread(() -> System.out.println(\"Lambda task running\"));\nt2.start();",
      example: "Runnable task = () -> {\n    for (int i = 1; i <= 3; i++) {\n        System.out.println(\"Working: \" + i);\n    }\n};\nThread worker = new Thread(task);\nworker.start();",
      notes: [
        "Prefer <code>implements Runnable</code> over <code>extends Thread</code> in almost all real code — it separates \"what task to run\" from \"how it's executed,\" and doesn't burn your one shot at class inheritance.",
        "Since Runnable has exactly one abstract method (<code>run()</code>), it's a natural fit for lambda expressions in modern Java.",
      ],
      bestPractices: ["Default to Runnable (or a lambda) over extending Thread directly — it's more flexible and is the pattern used throughout the standard library (e.g. <code>ExecutorService</code>)."],
    }),
  },
  {
    title: "Synchronization",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "When multiple threads access shared mutable data concurrently, their operations can interleave unpredictably, corrupting the data — this is a race condition. The <code>synchronized</code> keyword ensures only one thread at a time can execute a given block or method, preventing that interleaving.",
      syntax:
        "class Counter {\n    private int count = 0;\n\n    public synchronized void increment() {   // only one thread at a time can run this method\n        count++;\n    }\n\n    public synchronized int getCount() {\n        return count;\n    }\n}\n\n// Or synchronize just a critical block instead of the whole method:\nsynchronized (this) {\n    count++;\n}",
      example: "class Counter {\n    private int count = 0;\n    public synchronized void increment() { count++; }\n    public int getCount() { return count; }\n}\n\n// Without synchronized, two threads calling increment() concurrently could both\n// read count=5, both compute 6, and both write 6 — one increment is lost.",
      notes: [
        "<code>count++</code> looks like a single operation but is actually three steps (read, add 1, write) — without synchronization, two threads can interleave these steps and lose an update. This is the textbook race condition.",
        "<code>synchronized</code> has a performance cost (only one thread can hold the lock at a time) — apply it to the smallest scope that actually needs protection, not the entire class.",
      ],
      mistakes: ["Assuming a simple operation like <code>count++</code> is atomic (indivisible) just because it looks like one line of code — it is NOT atomic, and needs synchronization (or an <code>AtomicInteger</code>) when shared across threads."],
    }),
  },
  {
    title: "Thread Lifecycle",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A Java thread moves through a defined sequence of states: NEW (created but not started) → RUNNABLE (running or eligible to run) → BLOCKED/WAITING/TIMED_WAITING (paused, e.g. waiting for a lock or for sleep()/join() to finish) → TERMINATED (run() has completed).",
      syntax:
        "Thread t = new Thread(() -> {\n    try {\n        Thread.sleep(1000);   // pauses THIS thread for 1000ms — moves to TIMED_WAITING\n    } catch (InterruptedException e) { /* ... */ }\n});\nt.start();\nt.join();   // the CALLING thread waits here until t finishes (TERMINATED)\nSystem.out.println(\"Thread finished\");",
      example:
        "Thread worker = new Thread(() -> System.out.println(\"Working...\"));\nSystem.out.println(worker.getState()); // NEW — not started yet\nworker.start();\ntry {\n    worker.join(); // main thread waits for worker to finish\n} catch (InterruptedException e) { /* ... */ }\nSystem.out.println(worker.getState()); // TERMINATED\nSystem.out.println(\"Main continues\");",
      notes: [
        "<code>join()</code> makes the CALLING thread wait for the target thread to finish — a common use is the main thread waiting for a worker thread to complete before continuing.",
        "<code>Thread.sleep()</code> and <code>t.join()</code> both throw the checked <code>InterruptedException</code>, since another thread can interrupt a sleeping/waiting thread — this must be caught or declared.",
      ],
      mistakes: ["Calling <code>t.start()</code> a second time on the same Thread object — a Thread can only be started once; calling start() again throws <code>IllegalThreadStateException</code>."],
      bestPractices: ["Use <code>join()</code> when a subsequent step genuinely depends on a thread having finished — otherwise the main thread might print results before the worker thread has actually produced them."],
    }),
  },
];

const MODULE11_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is the correct way to actually start a new thread of execution?",
    options: ["Call run() directly", "Call start()", "Call execute()", "Create the Thread object; it starts automatically"],
    correctAnswer: 1,
    explanation: "start() creates a new OS-level thread and schedules run() on it — this is the only way to get real concurrent execution.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What happens if you call `t.run()` instead of `t.start()` on a Thread object?",
    options: ["A new thread is created and run() executes on it", "run() executes synchronously on the CURRENT thread — no new thread is created", "It throws IllegalThreadStateException", "Nothing happens"],
    correctAnswer: 1,
    explanation: "run() is just a normal method — calling it directly runs its body on whichever thread made the call, with no new thread involved.",
  },
  {
    type: "MCQ",
    prompt: "Why is implementing Runnable generally preferred over extending Thread?",
    options: ["Runnable is faster at runtime", "It avoids using up the class's one allowed superclass, and separates the task from its execution mechanism", "Thread cannot run more than once", "There is no real difference"],
    correctAnswer: 1,
    explanation: "A class can only extend one superclass, so extending Thread forecloses extending anything else — implementing Runnable keeps that option open and cleanly separates task logic from execution.",
  },
  {
    type: "MCQ",
    prompt: "What is a race condition?",
    options: ["A thread that runs faster than expected", "Unpredictable behavior caused by multiple threads interleaving access to shared mutable data without synchronization", "An error thrown when too many threads are created", "A synonym for deadlock"],
    correctAnswer: 1,
    explanation: "A race condition occurs when the outcome depends on the unpredictable timing/interleaving of concurrent operations on shared state.",
  },
  {
    type: "MCQ",
    prompt: "Is `count++` an atomic (single-step, indivisible) operation?",
    options: ["Yes, always", "No — it's actually a read-modify-write sequence of multiple steps, which can be interleaved by other threads", "Only for long variables", "Only inside a synchronized block"],
    correctAnswer: 1,
    explanation: "count++ decomposes into read, increment, and write steps — without synchronization, another thread can interleave between them and cause a lost update.",
  },
  {
    type: "MCQ",
    prompt: "What does calling `t.join()` do?",
    options: ["Merges two threads into one", "Makes the calling thread wait until thread t finishes execution", "Starts thread t", "Immediately terminates thread t"],
    correctAnswer: 1,
    explanation: "join() blocks the calling thread until the target thread t reaches the TERMINATED state.",
  },
  {
    type: "MCQ",
    prompt: "What state is a newly-created Thread object in before `start()` is called?",
    options: ["RUNNABLE", "TERMINATED", "NEW", "BLOCKED"],
    correctAnswer: 2,
    explanation: "A Thread object starts in the NEW state and only transitions to RUNNABLE once start() is called.",
  },
  {
    type: "MCQ",
    prompt: "What happens if you call `start()` twice on the same Thread object?",
    options: ["It runs the thread twice, back to back", "It throws IllegalThreadStateException", "Nothing, it's silently ignored", "It throws InterruptedException"],
    correctAnswer: 1,
    explanation: "A Thread instance can only be started once — a second start() call on the same object throws IllegalThreadStateException.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. Real
// concurrent execution is inherently non-deterministic and can't be graded against a fixed expected
// output, so these model synchronization/scheduling OUTCOMES as plain deterministic computations.
const MODULE11_CODING = [
  {
    type: "CODING",
    prompt: "Read space-separated integers representing amounts contributed by different worker threads (each protected by proper synchronization, so no updates are lost) and print the final total.",
    language: "java",
    testCases: [{ input: "1 2 3 4 5", expected: "15" }, { input: "10 20", expected: "30" }, { input: "7", expected: "7" }],
    explanation: "With correct synchronization, no update is ever lost, so the final total is simply the sum of every contribution.",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers representing the sleep duration in ms of each worker thread, all started at the same time and joined afterward. Print the total wall-clock time until all have finished (the MAXIMUM duration, since they run in parallel, not the sum).",
    language: "java",
    testCases: [{ input: "100 300 200", expected: "300" }, { input: "50", expected: "50" }, { input: "10 10 10", expected: "10" }],
    explanation: "Threads started together and run in parallel all finish by the time the SLOWEST one does — the total wall-clock time is the maximum duration, not the sum.",
  },
];

const MODULE12_LESSONS = [
  {
    title: "Lambda Expressions",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A lambda expression is a compact way to write an anonymous function — a block of code you can pass around as a value. It's Java's syntax for implementing a functional interface (an interface with exactly one abstract method) inline, without a full class definition.",
      syntax:
        "(parameters) -> expression\n(parameters) -> { statements; }\n\n// Examples:\nRunnable r = () -> System.out.println(\"Hello\");\nComparator<Integer> cmp = (a, b) -> a - b;\nFunction<Integer, Integer> square = x -> x * x;",
      example:
        "List<String> names = List.of(\"Charlie\", \"Alice\", \"Bob\");\nnames.forEach(name -> System.out.println(name));\n\n// Sorting with a lambda instead of writing an anonymous Comparator class\nList<Integer> nums = new ArrayList<>(List.of(5, 2, 8, 1));\nnums.sort((a, b) -> a - b);\nSystem.out.println(nums); // [1, 2, 5, 8]",
      notes: [
        "A lambda's parameter types are usually inferred from context — you rarely need to write <code>(Integer a, Integer b) -> ...</code> explicitly.",
        "Lambdas can only implement a functional interface (exactly ONE abstract method) — this is what lets the compiler know which method the lambda's body corresponds to.",
      ],
      mistakes: ["Trying to use a lambda where the target type has more than one abstract method — lambdas only work for functional interfaces (single abstract method), which the compiler enforces at compile time."],
    }),
  },
  {
    title: "Stream API",
    estimatedMinutes: 14,
    content: lessonHTML({
      explanation: "A <code>Stream</code> represents a sequence of elements that supports functional-style operations (filter, map, reduce, etc.) chained together in a pipeline. Streams don't store data themselves — they process data from a source (a collection, array, etc.) and are consumed once.",
      syntax:
        "List<Integer> nums = List.of(1, 2, 3, 4, 5, 6);\n\nList<Integer> evenSquares = nums.stream()\n    .filter(n -> n % 2 == 0)     // keep only even numbers\n    .map(n -> n * n)             // square each remaining number\n    .collect(Collectors.toList()); // gather results back into a List\n\nint sum = nums.stream().mapToInt(Integer::intValue).sum();\nlong count = nums.stream().filter(n -> n > 3).count();",
      example:
        "List<String> names = List.of(\"Charlie\", \"Alice\", \"Bob\", \"Dave\");\nList<String> result = names.stream()\n    .filter(n -> n.length() > 3)\n    .sorted()\n    .collect(Collectors.toList());\nSystem.out.println(result); // [Alice, Charlie, Dave]",
      notes: [
        "Stream operations are either INTERMEDIATE (<code>filter</code>, <code>map</code>, <code>sorted</code> — return a new Stream, lazy) or TERMINAL (<code>collect</code>, <code>sum</code>, <code>count</code>, <code>forEach</code> — actually trigger processing and produce a result).",
        "A Stream can only be consumed (traversed) ONCE — calling a terminal operation twice on the same stream throws <code>IllegalStateException</code>.",
      ],
      mistakes: ["Reusing the same Stream object for two separate pipelines/terminal operations — streams are single-use; you must create a fresh stream (e.g. call <code>.stream()</code> again) for each pipeline."],
      bestPractices: ["Chain <code>filter()</code>/<code>map()</code> before <code>collect()</code>/<code>reduce()</code> — nothing actually runs until a terminal operation is called, since intermediate operations are lazily evaluated."],
    }),
  },
  {
    title: "Functional Interfaces",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A functional interface is any interface with EXACTLY ONE abstract method, making it a valid target for a lambda expression or method reference. <code>java.util.function</code> provides a standard set: <code>Function&lt;T,R&gt;</code>, <code>Predicate&lt;T&gt;</code>, <code>Consumer&lt;T&gt;</code>, <code>Supplier&lt;T&gt;</code>, and more.",
      syntax:
        "@FunctionalInterface\ninterface Calculator {\n    int calculate(int a, int b);\n}\n\nCalculator add = (a, b) -> a + b;\nSystem.out.println(add.calculate(3, 4)); // 7\n\n// Standard library interfaces:\nFunction<Integer, Integer> square = x -> x * x;         // takes a T, returns an R\nPredicate<Integer> isEven = x -> x % 2 == 0;             // takes a T, returns boolean\nConsumer<String> printer = s -> System.out.println(s);  // takes a T, returns nothing\nSupplier<String> greeting = () -> \"Hello!\";              // takes nothing, returns a T",
      example: "Predicate<Integer> isPositive = n -> n > 0;\nSystem.out.println(isPositive.test(5));   // true\nSystem.out.println(isPositive.test(-3));  // false",
      notes: [
        "<code>@FunctionalInterface</code> is an OPTIONAL annotation — it doesn't change behavior, but makes the compiler verify the interface really has exactly one abstract method, catching accidental additions early.",
        "An interface can still have default and static methods (with bodies) and remain functional — only ABSTRACT methods count toward the \"exactly one\" rule.",
      ],
      mistakes: ["Adding a second abstract method to an interface already used as a lambda target — this breaks every lambda assigned to it, since the compiler can no longer tell which method the lambda implements."],
    }),
  },
  {
    title: "Optional",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "<code>Optional&lt;T&gt;</code> is a container that may or may not hold a non-null value — it's designed to make the possibility of \"no value\" explicit in a method's return type, as an alternative to returning null and risking a NullPointerException.",
      syntax:
        "Optional<String> present = Optional.of(\"Hello\");        // wraps a known non-null value\nOptional<String> empty = Optional.empty();                // represents \"no value\"\nOptional<String> maybe = Optional.ofNullable(getName());  // wraps a possibly-null value safely\n\nif (present.isPresent()) {\n    System.out.println(present.get());\n}\npresent.ifPresent(s -> System.out.println(s));            // safer — only runs if a value exists\nString result = maybe.orElse(\"default\");                  // fallback value if empty\nString result2 = maybe.orElseThrow(() -> new NoSuchElementException(\"missing\"));",
      example:
        "Optional<Integer> findFirst(int[] nums, int target) {\n    for (int n : nums) {\n        if (n == target) return Optional.of(n);\n    }\n    return Optional.empty();\n}\n\nOptional<Integer> result = findFirst(new int[]{1, 2, 3}, 5);\nSystem.out.println(result.orElse(-1)); // -1 — not found, uses the fallback",
      notes: [
        "Calling <code>.get()</code> on an EMPTY Optional throws <code>NoSuchElementException</code> — always check <code>isPresent()</code> first, or better, use <code>orElse()</code>/<code>orElseGet()</code>/<code>ifPresent()</code> to avoid the check entirely.",
        "Optional is intended as a RETURN TYPE to signal \"this might not have a value\" — it's generally discouraged as a field type or method parameter type.",
      ],
      mistakes: ["Calling <code>.get()</code> on an Optional without checking <code>isPresent()</code> first (or without using a safer alternative like <code>orElse()</code>) — this just relocates the null-pointer-style risk to a <code>NoSuchElementException</code> instead of actually solving it."],
    }),
  },
  {
    title: "Method References",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "A method reference is shorthand for a lambda that does nothing but call an existing method — using the <code>::</code> syntax instead of writing out the lambda explicitly.",
      syntax:
        "// Lambda                          Equivalent method reference\nnames.forEach(n -> System.out.println(n));   names.forEach(System.out::println);\ns -> s.toUpperCase()                          String::toUpperCase\n(a, b) -> a.compareTo(b)                      String::compareTo\n() -> new ArrayList<>()                       ArrayList::new",
      example: "List<String> names = List.of(\"charlie\", \"alice\", \"bob\");\nList<String> upper = names.stream()\n    .map(String::toUpperCase)     // same as .map(s -> s.toUpperCase())\n    .collect(Collectors.toList());\nSystem.out.println(upper); // [CHARLIE, ALICE, BOB]",
      notes: [
        "There are 4 kinds: static method (<code>ClassName::staticMethod</code>), instance method on a particular object (<code>obj::instanceMethod</code>), instance method on an arbitrary object of a type (<code>ClassName::instanceMethod</code>), and constructor reference (<code>ClassName::new</code>).",
        "A method reference is purely syntactic sugar for a lambda — it compiles to the same kind of code, just more concise when the lambda would only forward its arguments to an existing method.",
      ],
      mistakes: ["Using a method reference when the lambda needs to do MORE than just call one existing method (e.g. transform an argument first) — method references only work as a direct stand-in for \"call this exact method with these exact arguments\"."],
      bestPractices: ["Prefer a method reference over a lambda when the lambda's body is literally just calling one existing method — it's shorter and often clearer about intent."],
    }),
  },
];

const MODULE12_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is required for an interface to be a valid target for a lambda expression?",
    options: ["It must have at least 2 methods", "It must have exactly one ABSTRACT method (a functional interface)", "It must be annotated @FunctionalInterface", "It must extend Runnable"],
    correctAnswer: 1,
    explanation: "A lambda's body implements the single abstract method — the interface must have exactly one for the compiler to know which method it corresponds to. @FunctionalInterface is optional documentation, not a requirement.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nList<Integer> nums = List.of(1, 2, 3, 4, 5, 6);\nlong count = nums.stream().filter(n -> n % 2 == 0).count();\nSystem.out.println(count);",
    options: ["6", "3", "2", "0"],
    correctAnswer: 1,
    explanation: "The even numbers are 2, 4, and 6 — three elements pass the filter, so count() returns 3.",
  },
  {
    type: "MCQ",
    prompt: "Which of these is a TERMINAL stream operation (as opposed to intermediate)?",
    options: ["filter()", "map()", "sorted()", "collect()"],
    correctAnswer: 3,
    explanation: "collect() triggers the pipeline and produces a result; filter(), map(), and sorted() are lazy intermediate operations that just build up the pipeline.",
  },
  {
    type: "MCQ",
    prompt: "What happens if you call a terminal operation twice on the same Stream object?",
    options: ["It runs successfully both times", "It throws IllegalStateException — a stream can only be consumed once", "It automatically creates a new stream", "It returns null the second time"],
    correctAnswer: 1,
    explanation: "Streams are single-use — once a terminal operation has been called, that stream is considered consumed, and reusing it throws IllegalStateException.",
  },
  {
    type: "MCQ",
    prompt: "What is the purpose of Optional<T>?",
    options: ["To make a variable final", "To make the possibility of 'no value' explicit in a return type, instead of returning null", "To store multiple values of type T", "To replace all uses of arrays"],
    correctAnswer: 1,
    explanation: "Optional signals in the type system itself that a method might not have a value to return, encouraging callers to handle that case explicitly rather than risk a NullPointerException.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "What does this print?\n\nOptional<String> empty = Optional.empty();\nSystem.out.println(empty.orElse(\"default\"));",
    options: ["null", "Throws NoSuchElementException", "default", "empty"],
    correctAnswer: 2,
    explanation: "orElse() returns its argument as a fallback whenever the Optional holds no value, without throwing.",
  },
  {
    type: "MCQ",
    prompt: "Which method reference is equivalent to the lambda `s -> s.toUpperCase()`?",
    options: ["String::new", "System.out::println", "String::toUpperCase", "String::valueOf"],
    correctAnswer: 2,
    explanation: "String::toUpperCase is an instance-method-on-an-arbitrary-object reference — s.toUpperCase() becomes String::toUpperCase, with s supplied as the receiver when the functional interface is invoked.",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with calling .get() on an Optional without checking first?\n\nOptional<String> maybe = Optional.empty();\nString value = maybe.get();",
    options: ["Nothing, this is always safe", "It throws NoSuchElementException, since the Optional is empty", "It returns null", "It's a compile error"],
    correctAnswer: 1,
    explanation: "get() on an empty Optional throws NoSuchElementException — the safer alternatives (orElse(), ifPresent(), isPresent() first) avoid this exact pitfall.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. The judge
// grades a single method's return value regardless of implementation technique, so these are phrased
// as the kind of filter/map/reduce pipeline you'd naturally reach for with the Stream API.
const MODULE12_CODING = [
  {
    type: "CODING",
    prompt: "Read space-separated integers and print the sum of the squares of only the even numbers.",
    language: "java",
    testCases: [{ input: "1 2 3 4", expected: "20" }, { input: "1 3 5", expected: "0" }, { input: "2 4 6", expected: "56" }],
    explanation: "Filter to even numbers, square each one, then sum — the same pipeline as nums.stream().filter(n -> n % 2 == 0).map(n -> n * n).sum().",
  },
  {
    type: "CODING",
    prompt: "Read space-separated integers on one line and a threshold on the next line. Print the count of values strictly greater than the threshold.",
    language: "java",
    testCases: [{ input: "1 5 3 8 2\n4", expected: "2" }, { input: "10 20 30\n25", expected: "1" }, { input: "1 2 3\n10", expected: "0" }],
    explanation: "Filter to values greater than the threshold, then count — the same pipeline as nums.stream().filter(n -> n > threshold).count().",
  },
];

const MODULE13_LESSONS = [
  {
    title: "Database Connectivity",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "JDBC (Java Database Connectivity) is the standard API for connecting Java applications to relational databases. Establishing a connection requires the database's JDBC driver on the classpath, plus a connection URL, username, and password.",
      syntax:
        "import java.sql.*;\n\nString url = \"jdbc:mysql://localhost:3306/mydb\";\nString user = \"root\";\nString password = \"secret\";\n\ntry (Connection conn = DriverManager.getConnection(url, user, password)) {\n    System.out.println(\"Connected successfully!\");\n} catch (SQLException e) {\n    System.out.println(\"Connection failed: \" + e.getMessage());\n}",
      example: "try (Connection conn = DriverManager.getConnection(\n        \"jdbc:mysql://localhost:3306/school\", \"admin\", \"pass123\")) {\n    System.out.println(\"Database connection established.\");\n} catch (SQLException e) {\n    e.printStackTrace();\n}",
      notes: [
        "<code>SQLException</code> is a CHECKED exception — virtually every JDBC operation can throw it, since it represents failures outside the program's control (network issues, wrong credentials, a down database).",
        "The connection URL format is driver-specific: <code>jdbc:mysql://host:port/database</code>, <code>jdbc:postgresql://host:port/database</code>, etc.",
      ],
      mistakes: ["Never closing a Connection — this leaks a database connection resource. Always use try-with-resources (<code>try (Connection conn = ...)</code>) so it's closed automatically."],
      bestPractices: ["Never hardcode real database credentials directly in source code committed to version control — use environment variables or a configuration file excluded from source control."],
    }),
  },
  {
    title: "CRUD Operations",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "CRUD stands for Create, Read, Update, Delete — the four basic operations on stored data, corresponding to SQL's INSERT, SELECT, UPDATE, and DELETE statements. In JDBC, a <code>Statement</code> (or <code>PreparedStatement</code>) executes these against the database.",
      syntax:
        "Statement stmt = conn.createStatement();\n\n// Create\nstmt.executeUpdate(\"INSERT INTO students (name, age) VALUES ('Asha', 20)\");\n\n// Read\nResultSet rs = stmt.executeQuery(\"SELECT * FROM students\");\n\n// Update\nstmt.executeUpdate(\"UPDATE students SET age = 21 WHERE name = 'Asha'\");\n\n// Delete\nstmt.executeUpdate(\"DELETE FROM students WHERE name = 'Asha'\");",
      example: "int rowsAffected = stmt.executeUpdate(\"UPDATE students SET age = 21 WHERE id = 5\");\nSystem.out.println(rowsAffected + \" row(s) updated.\");",
      notes: [
        "<code>executeQuery()</code> is for SELECT statements and returns a <code>ResultSet</code>; <code>executeUpdate()</code> is for INSERT/UPDATE/DELETE and returns an <code>int</code> (the number of rows affected).",
        "Calling <code>executeQuery()</code> with an INSERT/UPDATE/DELETE statement (or <code>executeUpdate()</code> with a SELECT) throws <code>SQLException</code> — the method must match the statement type.",
      ],
      mistakes: ["Building SQL statements by directly concatenating user input into a query string (e.g. <code>\"SELECT * FROM users WHERE name = '\" + userInput + \"'\"</code>) — this is vulnerable to SQL injection. Use PreparedStatement instead (next lesson)."],
    }),
  },
  {
    title: "PreparedStatement",
    estimatedMinutes: 14,
    content: lessonHTML({
      explanation: "<code>PreparedStatement</code> precompiles a parameterized SQL statement with placeholders (<code>?</code>), letting you safely bind values without string concatenation. This prevents SQL injection and is also more efficient for repeated execution of the same statement shape.",
      syntax:
        "String sql = \"INSERT INTO students (name, age) VALUES (?, ?)\";\nPreparedStatement pstmt = conn.prepareStatement(sql);\npstmt.setString(1, \"Asha\");   // 1-based parameter index, not 0-based\npstmt.setInt(2, 20);\npstmt.executeUpdate();\n\n// Safe against SQL injection, even with untrusted input:\nPreparedStatement query = conn.prepareStatement(\"SELECT * FROM users WHERE name = ?\");\nquery.setString(1, userInput);   // userInput is treated as DATA, never as SQL syntax\nResultSet rs = query.executeQuery();",
      example: "PreparedStatement pstmt = conn.prepareStatement(\"SELECT * FROM students WHERE age > ?\");\npstmt.setInt(1, 18);\nResultSet rs = pstmt.executeQuery();",
      notes: [
        "PreparedStatement parameter indices are 1-based, not 0-based — the first <code>?</code> is index 1, not 0. This is a common off-by-one source of <code>SQLException</code>.",
        "Because the placeholder value is always treated as pure data (never parsed as SQL), a malicious input like <code>' OR '1'='1</code> cannot alter the query's structure — this is the core SQL-injection defense.",
      ],
      mistakes: ["Using regular <code>Statement</code> with string-concatenated user input instead of PreparedStatement — this is the single most common cause of SQL injection vulnerabilities in real applications."],
      bestPractices: ["Always use PreparedStatement instead of Statement whenever a query includes any value that isn't a fixed literal known at compile time — treat this as the default, not just \"when there's user input\"."],
    }),
  },
  {
    title: "ResultSet",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A <code>ResultSet</code> represents the tabular result of a SELECT query — a cursor that starts positioned BEFORE the first row, advanced one row at a time with <code>next()</code>.",
      syntax:
        "ResultSet rs = stmt.executeQuery(\"SELECT id, name, age FROM students\");\nwhile (rs.next()) {   // advances to the next row; returns false when there are no more\n    int id = rs.getInt(\"id\");        // read by column name\n    String name = rs.getString(\"name\");\n    int age = rs.getInt(3);           // or read by 1-based column index\n    System.out.println(id + \": \" + name + \", age \" + age);\n}",
      example: "ResultSet rs = stmt.executeQuery(\"SELECT name FROM students WHERE age > 18\");\nList<String> names = new ArrayList<>();\nwhile (rs.next()) {\n    names.add(rs.getString(\"name\"));\n}\nSystem.out.println(names);",
      notes: [
        "You MUST call <code>rs.next()</code> before reading any data — a freshly-returned ResultSet is positioned before the first row, and calling <code>getString()</code>/<code>getInt()</code> before the first <code>next()</code> call throws <code>SQLException</code>.",
        "Reading columns by NAME (<code>rs.getString(\"name\")</code>) is more readable and resilient to query changes than by index (<code>rs.getString(2)</code>), though index access is marginally faster.",
      ],
      mistakes: ["Forgetting the <code>while (rs.next())</code> loop entirely and trying to read from a ResultSet immediately after <code>executeQuery()</code> — the cursor starts before the first row, so this throws an exception."],
      bestPractices: ["Close a ResultSet (or better, wrap it in try-with-resources alongside its Statement/PreparedStatement) once you're done reading it, to free the underlying database cursor."],
    }),
  },
];

const MODULE13_QUIZ = [
  {
    type: "MCQ",
    prompt: "What type of exception does virtually every JDBC operation potentially throw?",
    options: ["IOException", "SQLException, a checked exception", "ArithmeticException", "NullPointerException, always"],
    correctAnswer: 1,
    explanation: "JDBC operations depend on external factors (network, credentials, database availability), which Java models as the checked SQLException.",
  },
  {
    type: "MCQ",
    prompt: "Which method executes a SELECT query and returns a ResultSet?",
    options: ["executeUpdate()", "executeQuery()", "execute()", "query()"],
    correctAnswer: 1,
    explanation: "executeQuery() is specifically for SELECT statements and returns the tabular ResultSet of matching rows.",
  },
  {
    type: "MCQ",
    prompt: "What does executeUpdate() return?",
    options: ["A ResultSet", "The generated SQL string", "An int — the number of rows affected", "Nothing, it returns void"],
    correctAnswer: 2,
    explanation: "executeUpdate() is used for INSERT/UPDATE/DELETE and returns the count of rows the statement affected.",
  },
  {
    type: "MCQ",
    prompt: "Why is PreparedStatement preferred over Statement when a query includes a variable value?",
    options: ["It's the only way to execute a SELECT statement", "It prevents SQL injection by treating parameter values as pure data, never as SQL syntax", "It automatically closes the connection", "There's no real difference"],
    correctAnswer: 1,
    explanation: "PreparedStatement placeholders bind values as data, not SQL text, so untrusted input can never change the query's structure — the core SQL-injection defense.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "In `pstmt.setString(1, \"Asha\")`, what does the `1` refer to?",
    options: ["A zero-based column index", "A 1-based parameter placeholder index — the first ? in the query", "The row number", "The table's primary key"],
    correctAnswer: 1,
    explanation: "PreparedStatement parameter indices are 1-based — setString(1, ...) binds the FIRST ? placeholder in the SQL text.",
  },
  {
    type: "MCQ",
    prompt: "What must you call before reading the first row of data from a ResultSet?",
    options: ["rs.first()", "rs.next()", "rs.read()", "Nothing — data can be read immediately"],
    correctAnswer: 1,
    explanation: "A ResultSet starts positioned before the first row; next() must be called to advance the cursor onto an actual row before reading columns.",
  },
  {
    type: "DEBUG",
    prompt: "What is the security problem with this code?\n\nString sql = \"SELECT * FROM users WHERE name = '\" + userInput + \"'\";\nStatement stmt = conn.createStatement();\nResultSet rs = stmt.executeQuery(sql);",
    options: ["No problem, this is safe", "It's vulnerable to SQL injection — userInput is concatenated directly into the SQL string instead of using a PreparedStatement parameter", "Statement objects can't run SELECT queries", "The SQL syntax is invalid"],
    correctAnswer: 1,
    explanation: "Directly concatenating untrusted input into SQL text lets an attacker inject SQL syntax (e.g. ' OR '1'='1) — PreparedStatement parameters avoid this by never treating bound values as SQL.",
  },
  {
    type: "MCQ",
    prompt: "Which JDBC interface should be used to safely release a Connection, Statement, or ResultSet once you're done with it?",
    options: ["Use try-with-resources so close() is called automatically", "Never close them — Java garbage collects them", "Call System.gc() manually", "Restart the database"],
    correctAnswer: 0,
    explanation: "Connection, Statement, and ResultSet all implement AutoCloseable — try-with-resources guarantees close() runs even if an exception occurs, preventing resource leaks.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. The judge
// has no real database to connect to, so these model the OUTCOME of SQL/JDBC operations (WHERE
// filters, LIKE-style prefix matching) as plain array/string computations.
const MODULE13_CODING = [
  {
    type: "CODING",
    prompt: "Simulate counting matching rows from a SELECT ... WHERE age > ? query, given an array of ages and a threshold parameter. Print the count.",
    language: "java",
    testCases: [{ input: "15 20 25 30\n18", expected: "3" }, { input: "10 12\n18", expected: "0" }, { input: "50\n18", expected: "1" }],
    explanation: "Count how many ages are strictly greater than the threshold — the same result a WHERE age > ? clause would filter to.",
  },
  {
    type: "CODING",
    prompt: "Simulate a WHERE name LIKE 'prefix%' filter: given an array of names and a prefix, print the count of names starting with that prefix.",
    language: "java",
    testCases: [{ input: "Asha Aditi Bob\nA", expected: "2" }, { input: "Tom Tim\nT", expected: "2" }, { input: "Cat\nZ", expected: "0" }],
    explanation: "Count the names whose first characters match the prefix, mirroring how a SQL LIKE 'prefix%' pattern filters rows.",
  },
];

const MODULE14_LESSONS = [
  {
    title: "Generics",
    estimatedMinutes: 14,
    content: lessonHTML({
      explanation: "Generics let a class, interface, or method operate on a TYPE PARAMETER specified at usage time, giving compile-time type safety without casting. Instead of writing a separate Box class for every type, you write ONE generic <code>Box&lt;T&gt;</code>.",
      syntax:
        "class Box<T> {\n    private T value;\n    public void set(T value) { this.value = value; }\n    public T get() { return value; }\n}\n\nBox<String> stringBox = new Box<>();\nstringBox.set(\"Hello\");\nString s = stringBox.get(); // no cast needed\n\n// Generic method\npublic static <T> T firstElement(T[] array) {\n    return array[0];\n}",
      example: "Box<Integer> intBox = new Box<>();\nintBox.set(42);\nint value = intBox.get(); // no cast needed, and intBox.set(\"text\") would be a COMPILE error",
      notes: [
        "Generics are erased at compile time (\"type erasure\") — at runtime, a <code>Box&lt;String&gt;</code> and a <code>Box&lt;Integer&gt;</code> are both just <code>Box</code>; the type parameter exists only for compile-time checking.",
        "Bounded type parameters (<code>&lt;T extends Number&gt;</code>) restrict what types can be used, letting you call methods defined on the bound (e.g. Number's methods) inside the generic class.",
      ],
      mistakes: ["Trying to create an array of a generic type directly (<code>new T[10]</code>) — this doesn't compile due to type erasure; use an <code>Object[]</code> internally with an unchecked cast, or a collection like <code>ArrayList&lt;T&gt;</code> instead."],
      bestPractices: ["Use generics instead of raw types (<code>Box</code> instead of <code>Box&lt;Object&gt;</code>) and instead of Object + casting — the compiler catches type mismatches at compile time rather than at runtime with a ClassCastException."],
    }),
  },
  {
    title: "Reflection",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Reflection lets a program inspect and manipulate classes, methods, and fields at RUNTIME — even ones it didn't know about at compile time. It's how frameworks like Spring and JUnit discover and invoke your code without you wiring it up manually.",
      syntax:
        "Class<?> clazz = obj.getClass();                  // get the runtime class of an object\nClass<?> clazz2 = String.class;                    // get a Class object directly\n\nMethod[] methods = clazz.getDeclaredMethods();     // list all declared methods\nField[] fields = clazz.getDeclaredFields();        // list all declared fields\n\nMethod m = clazz.getMethod(\"toUpperCase\");\nObject result = m.invoke(someStringInstance);      // call the method reflectively",
      example: "Object obj = \"Hello\";\nClass<?> clazz = obj.getClass();\nSystem.out.println(clazz.getName()); // java.lang.String\nSystem.out.println(clazz.getSimpleName()); // String",
      notes: [
        "Reflection can access PRIVATE fields/methods too, via <code>setAccessible(true)</code> — bypassing normal encapsulation, which is powerful but should be used sparingly and carefully.",
        "Reflective calls are significantly slower than direct method calls, since type checks that are normally done at compile time happen at runtime instead.",
      ],
      mistakes: ["Overusing reflection for everyday code where a normal method call or interface would work — reflection bypasses compile-time type safety and hurts performance, so it should be reserved for genuinely dynamic scenarios (frameworks, plugin systems, serialization libraries)."],
    }),
  },
  {
    title: "Serialization",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Serialization converts an object's state into a byte stream (for saving to a file or sending over a network); deserialization reconstructs the object from that stream. A class must implement the marker interface <code>Serializable</code> to be serializable.",
      syntax:
        "import java.io.*;\n\nclass Student implements Serializable {\n    String name;\n    int age;\n}\n\n// Writing (serializing)\ntry (ObjectOutputStream out = new ObjectOutputStream(new FileOutputStream(\"student.ser\"))) {\n    out.writeObject(new Student());\n}\n\n// Reading (deserializing)\ntry (ObjectInputStream in = new ObjectInputStream(new FileInputStream(\"student.ser\"))) {\n    Student s = (Student) in.readObject();\n}",
      example: "class Student implements Serializable {\n    private static final long serialVersionUID = 1L;\n    String name;\n    int age;\n}",
      notes: [
        "<code>Serializable</code> is a MARKER interface — it has no methods to implement; it just signals to the JVM that instances of this class are allowed to be serialized.",
        "A field marked <code>transient</code> is deliberately EXCLUDED from serialization (e.g. a password or a non-serializable resource like a Thread) — it comes back as its default value (null/0/false) after deserialization.",
        "<code>serialVersionUID</code> is a version identifier for a serializable class — if it doesn't match between the serialized data and the class definition trying to read it, deserialization throws <code>InvalidClassException</code>.",
      ],
      mistakes: ["Trying to serialize a class that has a non-serializable field without marking that field <code>transient</code> — this throws <code>NotSerializableException</code> at runtime when <code>writeObject()</code> is called."],
    }),
  },
  {
    title: "Networking",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Java's <code>java.net</code> package provides classes for network communication — <code>Socket</code> for client-side TCP connections, <code>ServerSocket</code> for a server listening for incoming connections, and <code>URL</code>/<code>HttpURLConnection</code> for HTTP requests.",
      syntax:
        "// Client\nSocket socket = new Socket(\"localhost\", 8080);\nPrintWriter out = new PrintWriter(socket.getOutputStream(), true);\nBufferedReader in = new BufferedReader(new InputStreamReader(socket.getInputStream()));\nout.println(\"Hello server\");\nString response = in.readLine();\nsocket.close();\n\n// Server\nServerSocket serverSocket = new ServerSocket(8080);\nSocket client = serverSocket.accept();  // blocks until a client connects",
      example: "try (ServerSocket server = new ServerSocket(5000)) {\n    System.out.println(\"Waiting for a client...\");\n    Socket client = server.accept();\n    System.out.println(\"Client connected: \" + client.getInetAddress());\n} catch (IOException e) {\n    e.printStackTrace();\n}",
      notes: [
        "<code>Socket</code> represents one end of a two-way TCP connection between a client and server; <code>ServerSocket</code> only LISTENS for and accepts incoming connections — it doesn't itself send/receive application data.",
        "<code>accept()</code> BLOCKS the calling thread until a client actually connects — a real server typically spawns a new thread (or uses a thread pool) per accepted connection to handle multiple clients concurrently.",
      ],
      mistakes: ["Forgetting that <code>ServerSocket.accept()</code> is a BLOCKING call — code after it won't run until a client connects, which surprises beginners expecting it to return immediately."],
    }),
  },
  {
    title: "Annotations",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "An annotation is metadata attached to code (<code>@Override</code>, <code>@Deprecated</code>, <code>@FunctionalInterface</code>, or custom ones) — it doesn't change what the code does directly, but tools, the compiler, or the runtime (via reflection) can read and act on it.",
      syntax:
        "@Override                  // tells the compiler this method must override a superclass/interface method\npublic void run() { }\n\n@Deprecated                // marks this API as discouraged; usage triggers a compiler warning\npublic void oldMethod() { }\n\n// A simple custom annotation:\n@interface Author {\n    String name();\n}\n\n@Author(name = \"Asha\")\nclass MyClass { }",
      example: "@Override\npublic String toString() {\n    return \"Custom string representation\";\n}\n// If this method's signature doesn't actually match any superclass method,\n// @Override causes a COMPILE ERROR instead of silently creating an unrelated new method.",
      notes: [
        "<code>@Override</code> is purely a compiler-time safety check — it catches typos in method names/signatures that would otherwise silently fail to override anything.",
        "Custom annotations are defined with <code>@interface</code> and become genuinely useful combined with reflection — frameworks scan for annotated classes/methods/fields at runtime to wire up behavior automatically.",
      ],
      mistakes: ["Assuming an annotation by itself changes runtime behavior — most annotations (aside from a few compiler-recognized ones like <code>@Override</code>/<code>@FunctionalInterface</code>) do nothing unless something else (a framework, a reflection-based tool) explicitly reads and acts on them."],
    }),
  },
];

const MODULE14_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is the main benefit of generics like Box<T> over using Object and casting?",
    options: ["Faster runtime performance always", "Compile-time type safety — type mismatches are caught by the compiler instead of causing a runtime ClassCastException", "Generics remove the need for classes entirely", "Generics only work with primitive types"],
    correctAnswer: 1,
    explanation: "Generics let the compiler verify type correctness at compile time, catching mistakes that would otherwise only surface as a runtime ClassCastException.",
  },
  {
    type: "MCQ",
    prompt: "What happens to generic type parameters at runtime, due to type erasure?",
    options: ["They are preserved and can be inspected exactly like any other type", "They are erased — a Box<String> and Box<Integer> are the same class at runtime", "They are converted to primitive types", "Type erasure only affects interfaces"],
    correctAnswer: 1,
    explanation: "Java implements generics via type erasure — the type parameter is a compile-time-only construct, and both Box<String> and Box<Integer> compile down to the same raw Box class.",
  },
  {
    type: "MCQ",
    prompt: "What does reflection allow a Java program to do?",
    options: ["Compile faster", "Inspect and invoke classes, methods, and fields at runtime, even ones not known at compile time", "Automatically parallelize loops", "Encrypt data automatically"],
    correctAnswer: 1,
    explanation: "Reflection is the runtime-introspection API that frameworks use to discover and invoke code dynamically.",
  },
  {
    type: "MCQ",
    prompt: "What must a class do to become serializable?",
    options: ["Implement the Serializable marker interface", "Extend the Object class (already automatic)", "Override toString()", "Nothing — every class is serializable by default"],
    correctAnswer: 0,
    explanation: "Serializable is a marker interface with no methods — implementing it is simply how a class opts in to being serialized.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "A field is marked `transient` in a Serializable class. What happens to it after deserialization?",
    options: ["It keeps its original value", "It is set to its default value (e.g. null, 0, false)", "Deserialization throws an exception", "transient has no effect"],
    correctAnswer: 1,
    explanation: "transient fields are skipped during serialization entirely, so on deserialization they come back as their type's default value.",
  },
  {
    type: "MCQ",
    prompt: "What does ServerSocket.accept() do?",
    options: ["Immediately returns null if no client is connected", "Blocks the calling thread until a client actually connects, then returns a Socket for that client", "Sends data to all connected clients", "Closes the server"],
    correctAnswer: 1,
    explanation: "accept() is a blocking call — execution pauses there until an incoming client connection arrives, at which point it returns a Socket representing that connection.",
  },
  {
    type: "MCQ",
    prompt: "What is the primary purpose of the @Override annotation?",
    options: ["It makes the method run faster", "It's a compile-time check confirming the method actually overrides a superclass/interface method, catching signature typos", "It automatically calls the superclass version too", "It's required on every method in Java"],
    correctAnswer: 1,
    explanation: "@Override doesn't change runtime behavior — it lets the compiler verify the annotated method really does override something, catching accidental typos.",
  },
  {
    type: "DEBUG",
    prompt: "What is wrong with this code, given Connection is NOT Serializable?\n\nclass Report implements Serializable {\n    String title;\n    Connection dbConnection;\n}",
    options: ["Nothing, all fields serialize automatically", "Serializing a Report instance throws NotSerializableException because dbConnection isn't Serializable and isn't marked transient", "Connection objects are automatically skipped", "Report can't implement Serializable at all"],
    correctAnswer: 1,
    explanation: "Every non-transient field of a Serializable class must itself be serializable (or null) at serialization time — an unserializable field like a live Connection throws NotSerializableException unless marked transient.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. Generics/
// reflection/serialization/networking/annotations aren't exercisable by the judge directly, so these
// model outcomes (bounded-type validation, port-availability lookup) as plain computations.
const MODULE14_CODING = [
  {
    type: "CODING",
    prompt: "Given arrays of stored values and their per-slot maximum capacities (same length), print the count of slots where the value exceeds its capacity.",
    language: "java",
    testCases: [{ input: "5 10 3\n4 10 5", expected: "1" }, { input: "1 2 3\n10 10 10", expected: "0" }, { input: "100\n1", expected: "1" }],
    explanation: "Compare each value against its capacity at the same index and count how many exceed it — the kind of bound violation a bounded generic (<T extends Number>) combined with validation would catch.",
  },
  {
    type: "CODING",
    prompt: "Read a list of candidate port numbers on one line and a list of already-used port numbers on the next line. Print the first candidate port that is NOT in the used list, or -1 if all candidates are used.",
    language: "java",
    testCases: [{ input: "8080 8081 8082\n8080 8081", expected: "8082" }, { input: "80 443\n80 443", expected: "-1" }, { input: "3000 5000\n3000", expected: "5000" }],
    explanation: "Scan the candidate ports in order and return the first one that doesn't appear in the used-ports list — the same lookup a server binding to a port would perform.",
  },
];

const MODULE15_LESSONS = [
  {
    title: "Arrays",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "In a Data Structures & Algorithms context, an array is valued for its O(1) random access and cache-friendly contiguous memory layout — the same array covered in the Arrays module, but here the focus shifts to ANALYZING the time complexity of its operations and using it as the building block for other structures (like a heap or a hash table).",
      syntax:
        "// Time complexity cheat sheet for arrays:\n// Access by index:      O(1)\n// Search (unsorted):    O(n)\n// Search (sorted, binary search): O(log n)\n// Insert/delete at end:  O(1) amortized\n// Insert/delete at start/middle: O(n) — requires shifting elements",
      example: "// Shifting elements to insert at the front — O(n)\nstatic int[] insertAtFront(int[] arr, int value) {\n    int[] result = new int[arr.length + 1];\n    result[0] = value;\n    System.arraycopy(arr, 0, result, 1, arr.length);\n    return result;\n}",
      notes: [
        "The O(1) random access is the single biggest reason arrays outperform linked structures for read-heavy workloads — no traversal is needed to reach any index.",
        "A dynamic array (like ArrayList) amortizes its resizing cost — most appends are O(1), but occasionally one append triggers an O(n) copy to a larger backing array.",
      ],
      mistakes: ["Assuming insertion is always O(1) just because array ACCESS is O(1) — inserting anywhere except the very end requires shifting every subsequent element, which is O(n)."],
    }),
  },
  {
    title: "Linked Lists",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "A linked list is a sequence of nodes, where each node holds a value and a reference to the next node — unlike an array, elements are NOT stored contiguously in memory. This trades away O(1) random access for O(1) insertion/deletion once you already have a reference to the right spot.",
      syntax:
        "class Node {\n    int value;\n    Node next;\n    Node(int value) { this.value = value; }\n}\n\nclass LinkedList {\n    Node head;\n\n    void addFirst(int value) {\n        Node newNode = new Node(value);\n        newNode.next = head;\n        head = newNode;\n    }\n\n    void printAll() {\n        Node current = head;\n        while (current != null) {\n            System.out.print(current.value + \" \");\n            current = current.next;\n        }\n    }\n}",
      example: "LinkedList list = new LinkedList();\nlist.addFirst(3);\nlist.addFirst(2);\nlist.addFirst(1);\nlist.printAll(); // 1 2 3",
      notes: [
        "Random access (get the Nth element) is O(n) for a linked list — you must traverse node by node from the head, unlike an array's O(1) index access.",
        "A DOUBLY linked list adds a prev reference to each node, allowing O(1) traversal backward and O(1) removal of a known node without needing its predecessor.",
      ],
      mistakes: ["Forgetting to update the head reference when inserting/removing the first node — this silently \"loses\" part of the list, since head is the only entry point to traverse from."],
    }),
  },
  {
    title: "Stack",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "In a DSA context, a stack (LIFO) is often implemented from scratch on top of an array or linked list to build intuition, before switching to Java's built-in ArrayDeque in real code. Every push/pop/peek should run in O(1).",
      syntax:
        "class ArrayStack {\n    private int[] data;\n    private int top = -1;\n\n    ArrayStack(int capacity) { data = new int[capacity]; }\n\n    void push(int value) { data[++top] = value; }\n    int pop() { return data[top--]; }\n    int peek() { return data[top]; }\n    boolean isEmpty() { return top == -1; }\n}",
      example: "ArrayStack stack = new ArrayStack(10);\nstack.push(1);\nstack.push(2);\nstack.push(3);\nSystem.out.println(stack.pop()); // 3 — LIFO",
      notes: [
        "A fixed-capacity array-backed stack risks a \"stack overflow\" (running out of array space) if pushed beyond its capacity — a production implementation resizes the backing array, same as ArrayList.",
        "Classic algorithmic use: balanced-parentheses checking, evaluating postfix expressions, and simulating recursion (since the JVM's actual call stack is, itself, a stack).",
      ],
      mistakes: ["Calling <code>pop()</code> or <code>peek()</code> on an empty stack (<code>top == -1</code>) — this reads an invalid/negative array index, so always check <code>isEmpty()</code> first."],
    }),
  },
  {
    title: "Queue",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "In a DSA context, a queue (FIFO) is commonly implemented with either a linked list (O(1) enqueue/dequeue at opposite ends) or a CIRCULAR array (avoiding the O(n) cost of shifting elements after every dequeue).",
      syntax:
        "class CircularQueue {\n    private int[] data;\n    private int front = 0, rear = -1, size = 0;\n\n    CircularQueue(int capacity) { data = new int[capacity]; }\n\n    void enqueue(int value) {\n        rear = (rear + 1) % data.length;\n        data[rear] = value;\n        size++;\n    }\n\n    int dequeue() {\n        int value = data[front];\n        front = (front + 1) % data.length;\n        size--;\n        return value;\n    }\n}",
      example: "CircularQueue q = new CircularQueue(5);\nq.enqueue(1);\nq.enqueue(2);\nq.enqueue(3);\nSystem.out.println(q.dequeue()); // 1 — FIFO",
      notes: [
        "A NAIVE array-backed queue (dequeuing from index 0 by shifting everything left) is O(n) per dequeue — a circular array wraps front/rear indices with modulo arithmetic to keep both enqueue and dequeue O(1).",
        "Classic algorithmic use: breadth-first search (BFS) on a tree or graph, and any \"process in the order received\" scheduling problem.",
      ],
      mistakes: ["Implementing a queue with a plain array and dequeuing by shifting all remaining elements left — this works correctly but is O(n) per dequeue, defeating the point of using a queue for efficiency."],
    }),
  },
  {
    title: "Trees",
    estimatedMinutes: 14,
    content: lessonHTML({
      explanation: "A tree is a hierarchical structure of nodes, each with a value and references to child nodes, with exactly one root and no cycles. A binary tree restricts each node to at most two children (commonly called left and right).",
      syntax:
        "class TreeNode {\n    int value;\n    TreeNode left, right;\n    TreeNode(int value) { this.value = value; }\n}\n\n// In-order traversal (left, root, right) — visits a Binary Search Tree in sorted order\nstatic void inorder(TreeNode node) {\n    if (node == null) return;\n    inorder(node.left);\n    System.out.print(node.value + \" \");\n    inorder(node.right);\n}",
      example:
        "TreeNode root = new TreeNode(5);\nroot.left = new TreeNode(3);\nroot.right = new TreeNode(8);\ninorder(root); // 3 5 8\n// A Binary Search Tree (BST) keeps every left subtree's values SMALLER and every\n// right subtree's values LARGER than the node's own value — this is what makes\n// in-order traversal produce sorted output.",
      notes: [
        "The three classic depth-first traversal orders are pre-order (root, left, right), in-order (left, root, right), and post-order (left, right, root) — each visits every node exactly once, just in a different sequence.",
        "In a balanced Binary Search Tree, search/insert/delete are all O(log n); in a degenerate (essentially linear) tree, they degrade to O(n) — this is why self-balancing trees (AVL, Red-Black) exist.",
      ],
      mistakes: ["Forgetting the null-check base case in a recursive tree traversal — every recursive tree function needs a <code>if (node == null) return;</code> (or equivalent) base case, or it throws NullPointerException at the first leaf's child."],
    }),
  },
  {
    title: "Graphs",
    estimatedMinutes: 14,
    content: lessonHTML({
      explanation: "A graph is a set of nodes (vertices) connected by edges, more general than a tree — graphs can have cycles, multiple connections, and no single root. Common representations are an adjacency list (a map/array of each node's neighbors) and an adjacency matrix (a 2D grid of connections).",
      syntax:
        "import java.util.*;\n\nMap<Integer, List<Integer>> adjacencyList = new HashMap<>();\nadjacencyList.put(1, List.of(2, 3));\nadjacencyList.put(2, List.of(1, 4));\nadjacencyList.put(3, List.of(1));\nadjacencyList.put(4, List.of(2));\n\n// Breadth-first search (BFS) using a Queue\nstatic void bfs(Map<Integer, List<Integer>> graph, int start) {\n    Set<Integer> visited = new HashSet<>();\n    Queue<Integer> queue = new LinkedList<>();\n    queue.offer(start);\n    visited.add(start);\n    while (!queue.isEmpty()) {\n        int node = queue.poll();\n        System.out.print(node + \" \");\n        for (int neighbor : graph.getOrDefault(node, List.of())) {\n            if (!visited.contains(neighbor)) {\n                visited.add(neighbor);\n                queue.offer(neighbor);\n            }\n        }\n    }\n}",
      example: "// For the graph above, bfs(adjacencyList, 1) prints: 1 2 3 4\n// (visits 1's neighbors 2,3 first, then 2's unvisited neighbor 4)",
      notes: [
        "An adjacency LIST is efficient for SPARSE graphs (few edges relative to nodes) — O(V + E) space; an adjacency MATRIX is simpler for DENSE graphs but always uses O(V²) space regardless of edge count.",
        "BFS explores level by level using a Queue (finds the shortest path in an unweighted graph); DFS explores as deep as possible before backtracking, typically using a Stack or recursion.",
      ],
      mistakes: ["Forgetting to track visited nodes during traversal — without a visited set, a graph with a cycle causes infinite traversal (unlike a tree, which has no cycles by definition)."],
    }),
  },
  {
    title: "Sorting",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Sorting arranges elements into order. Beyond Java's built-in <code>Arrays.sort()</code> (covered in the Arrays module), understanding classic algorithms — their time complexity and trade-offs — is a core DSA skill, especially for interviews.",
      syntax:
        "// Bubble Sort — O(n^2), simple but slow\n// Selection Sort — O(n^2), fewer swaps than bubble sort\n// Insertion Sort — O(n^2) worst case, but O(n) on nearly-sorted data\n// Merge Sort — O(n log n) guaranteed, but uses O(n) extra space\n// Quick Sort — O(n log n) average, O(n^2) worst case, but in-place\n\nstatic void selectionSort(int[] arr) {\n    for (int i = 0; i < arr.length - 1; i++) {\n        int minIndex = i;\n        for (int j = i + 1; j < arr.length; j++) {\n            if (arr[j] < arr[minIndex]) minIndex = j;\n        }\n        int temp = arr[minIndex];\n        arr[minIndex] = arr[i];\n        arr[i] = temp;\n    }\n}",
      example: "int[] arr = {5, 2, 8, 1, 9};\nselectionSort(arr);\nSystem.out.println(Arrays.toString(arr)); // [1, 2, 5, 8, 9]",
      notes: [
        "O(n²) algorithms (bubble/selection/insertion sort) are fine for small or nearly-sorted inputs but become impractical for large datasets — this is exactly why <code>Arrays.sort()</code> uses an O(n log n) algorithm internally.",
        "Merge Sort is STABLE (equal elements keep their relative order) and has guaranteed O(n log n) performance; Quick Sort is usually faster in practice but has a worst-case O(n²) on adversarial input.",
      ],
      mistakes: ["Assuming all sorting algorithms have the same time complexity — bubble/selection/insertion sort's O(n²) becomes genuinely slow well before merge/quick sort's O(n log n) does, on large inputs."],
    }),
  },
  {
    title: "Searching",
    estimatedMinutes: 10,
    content: lessonHTML({
      explanation: "Searching locates a target value in a collection — the Arrays module covered linear and binary search for using Java arrays; here the focus is on WHEN to choose which algorithm, and searching within non-array structures like trees.",
      syntax:
        "// Linear search: O(n), works on any (even unsorted) collection\n// Binary search: O(log n), REQUIRES a sorted array\n// BST search: O(log n) average (balanced tree), O(n) worst case (degenerate tree)\n\nstatic boolean searchBST(TreeNode node, int target) {\n    if (node == null) return false;\n    if (node.value == target) return true;\n    return target < node.value ? searchBST(node.left, target) : searchBST(node.right, target);\n}",
      example: "// Searching a Binary Search Tree follows the same divide-and-conquer\n// idea as binary search on a sorted array — go left or right based on comparison,\n// discarding half the remaining tree at each step.",
      notes: [
        "Binary search's O(log n) advantage only applies when the data is ALREADY sorted — sorting first just to binary search once is often not worth the O(n log n) sorting cost.",
        "A Binary Search Tree gives O(log n) search when balanced, matching binary search's array performance, while ALSO supporting O(log n) insertion/deletion — something a sorted array can't do without O(n) shifting.",
      ],
      mistakes: ["Choosing binary search over a HashMap/HashSet lookup for a problem that just needs \"does this value exist?\" — a hash-based structure gives O(1) average lookup, strictly better than binary search's O(log n), when insertion order/sorted order isn't otherwise needed."],
    }),
  },
];

const MODULE15_QUIZ = [
  {
    type: "MCQ",
    prompt: "What is the time complexity of accessing an element by index in an array?",
    options: ["O(n)", "O(log n)", "O(1)", "O(n log n)"],
    correctAnswer: 2,
    explanation: "Array elements are stored contiguously, so the memory address of any index can be computed directly — no traversal needed.",
  },
  {
    type: "MCQ",
    prompt: "Why is insertion at the FRONT of a linked list O(1), while insertion at the front of an array is O(n)?",
    options: ["Linked lists don't actually support front insertion", "A linked list just rewires a few references; an array must shift every existing element over by one position", "Arrays are always slower than linked lists for everything", "There is no difference"],
    correctAnswer: 1,
    explanation: "A linked list's front insertion only touches the new node's next pointer and the head reference; an array must physically move every existing element to make room.",
  },
  {
    type: "OUTPUT_PREDICTION",
    prompt: "Given a stack implemented with push/pop, what is printed?\n\npush(1); push(2); push(3);\nprint(pop());",
    options: ["1", "2", "3", "Empty stack error"],
    correctAnswer: 2,
    explanation: "A stack is LIFO — the most recently pushed value (3) is the first one popped.",
  },
  {
    type: "MCQ",
    prompt: "Why is a naive array-backed queue (shifting elements left after every dequeue) inefficient?",
    options: ["It uses too much memory", "Each dequeue is O(n) due to shifting; a circular array avoids this and keeps dequeue O(1)", "Arrays can't be used for queues at all", "It only works for small queues"],
    correctAnswer: 1,
    explanation: "Shifting every remaining element after each dequeue costs O(n); wrapping front/rear indices with modulo arithmetic (a circular array) avoids the shift entirely.",
  },
  {
    type: "MCQ",
    prompt: "What does an in-order traversal (left, root, right) of a Binary Search Tree produce?",
    options: ["A random order", "The nodes in ascending sorted order", "The nodes in descending sorted order", "Only the leaf nodes"],
    correctAnswer: 1,
    explanation: "A BST's left-subtree-smaller, right-subtree-larger invariant means visiting left, then root, then right naturally produces ascending order.",
  },
  {
    type: "MCQ",
    prompt: "Why must a graph traversal track visited nodes, unlike a tree traversal?",
    options: ["It's optional for both", "Graphs can contain cycles, so without tracking visited nodes, traversal could loop forever", "Trees are always larger than graphs", "Visited tracking makes traversal slower, so it should be avoided"],
    correctAnswer: 1,
    explanation: "A tree has no cycles by definition, so traversal always terminates naturally; a graph can have cycles, so revisiting nodes without a visited set can loop indefinitely.",
  },
  {
    type: "MCQ",
    prompt: "Which sorting algorithm guarantees O(n log n) performance in the worst case?",
    options: ["Bubble Sort", "Quick Sort (worst case is actually O(n^2))", "Merge Sort", "Selection Sort"],
    correctAnswer: 2,
    explanation: "Merge Sort's divide-and-conquer structure guarantees O(n log n) even in the worst case, unlike Quick Sort, which can degrade to O(n²) on adversarial input.",
  },
  {
    type: "MCQ",
    prompt: "When is binary search's O(log n) advantage available?",
    options: ["Always, regardless of data", "Only when the array is already sorted", "Only for arrays smaller than 100 elements", "Only for arrays of strings"],
    correctAnswer: 1,
    explanation: "Binary search relies on being able to discard half the remaining range based on a single comparison — that only works correctly when the array is sorted.",
  },
];

// Same LeetCode-style FUNCTION mode as the other modules' embedded practice — resolveCodingFields()
// generates the real starterCodeByLanguage from PRACTICE_CODING_SIGNATURES[prompt] below. The judge
// only supports primitive/String/array types, so linked lists, trees, and graphs are represented as
// plain arrays (values, or structural properties like a complete-tree array length or node degrees).
const MODULE15_CODING = [
  {
    type: "CODING",
    prompt: "Read an array representing a COMPLETE binary tree filled level by level (only its length matters). Print the height of the tree (the number of edges on the longest root-to-leaf path).",
    language: "java",
    testCases: [{ input: "5", expected: "0" }, { input: "1 2 3", expected: "1" }, { input: "1 2 3 4 5 6 7", expected: "2" }],
    explanation: "For a complete binary tree with n nodes, the height is floor(log2(n)) — each level roughly doubles the node count.",
  },
  {
    type: "CODING",
    prompt: "Read the degree (number of direct neighbors) of each node in an undirected graph. Print the number of edges in the graph (the sum of all degrees is always twice the number of edges).",
    language: "java",
    testCases: [{ input: "2 2 2", expected: "3" }, { input: "1 1", expected: "1" }, { input: "4", expected: "2" }],
    explanation: "Sum every node's degree and divide by 2 — this is the handshake lemma: every edge contributes exactly 2 to the total degree sum.",
  },
];

const MODULE16_LESSONS = [
  {
    title: "Frequently Asked Java Interview Questions",
    estimatedMinutes: 15,
    content: lessonHTML({
      explanation: "This lesson is a rapid-fire review of the Java questions that come up most consistently across interviews — a checklist to test yourself against everything covered in Modules 1-15, phrased the way an interviewer would actually ask it.",
      syntax:
        "Q: What is the difference between JDK, JRE, and JVM?\nA: JVM runs bytecode; JRE bundles the JVM plus the standard libraries needed to RUN Java programs; JDK bundles the JRE plus the tools (javac, etc.) needed to DEVELOP them.\n\nQ: Why is Java called \"platform independent\"?\nA: Java source compiles to bytecode, which any JVM (on any OS) can run — \"write once, run anywhere.\"\n\nQ: What is the difference between == and .equals() for objects?\nA: == compares references (identity); .equals() compares content, when overridden meaningfully (as String does).\n\nQ: What is the difference between an abstract class and an interface?\nA: A class can extend only one abstract class but implement many interfaces; abstract classes can hold state and constructors, interfaces traditionally cannot.\n\nQ: What is the difference between ArrayList and LinkedList?\nA: ArrayList gives O(1) indexed access but O(n) middle insertion; LinkedList gives O(1) end insertion but O(n) indexed access.\n\nQ: What is a checked vs unchecked exception?\nA: Checked exceptions (like IOException) must be caught or declared; unchecked exceptions (RuntimeException and its subclasses) require neither.\n\nQ: What does the \"static\" keyword mean?\nA: A static member belongs to the CLASS itself, not to any individual instance — one shared copy across all objects.\n\nQ: What is method overloading vs overriding?\nA: Overloading is same name, different parameter list, resolved at compile time; overriding is a subclass replacing an inherited method's implementation, resolved at runtime.",
      example:
        "Sample strong answer to \"Explain how HashMap works internally\":\n\"A HashMap stores key-value pairs in an array of buckets. When you call put(key, value), Java computes key.hashCode(), maps it to a bucket index, and stores the entry there. On a collision (two keys landing in the same bucket), Java chains entries in that bucket (as a linked list, or a red-black tree once a bucket gets large enough, since Java 8). get(key) recomputes the hash, jumps to the right bucket, then uses .equals() to find the matching entry among any collisions.\" — Notice this answer explains the MECHANISM, not just the API surface.",
      notes: [
        "Interviewers are usually testing whether you understand the WHY behind a concept, not just whether you can recite a definition — practice explaining mechanisms, not just terms.",
        "Reviewing every module's \"Common Mistakes\" callout in this course is one of the fastest ways to prepare, since interviewers frequently ask about exactly those gotchas.",
      ],
      mistakes: ["Memorizing a rehearsed definition without being able to give a concrete example when asked \"can you show me\" — always have a short code snippet ready for any concept you claim to know."],
      bestPractices: ["When you don't know an answer, say so and reason through it out loud from what you DO know — interviewers usually value clear reasoning over a lucky guess."],
    }),
  },
  {
    title: "MCQs",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "This lesson reviews rapid multiple-choice-style questions — the format many companies use for an initial screening round before the technical interview.",
      syntax:
        "1) What is the default value of a boolean instance field in Java?\n   a) true  b) false  c) null  d) 0\n   Answer: b) false\n\n2) Which collection does NOT allow duplicate elements?\n   a) ArrayList  b) LinkedList  c) HashSet  d) Deque\n   Answer: c) HashSet\n\n3) What does the \"final\" keyword do to a variable?\n   a) Makes it static  b) Prevents reassignment after initialization  c) Makes it private  d) Nothing\n   Answer: b) Prevents reassignment after initialization\n\n4) Which of these is NOT a valid access modifier in Java?\n   a) public  b) private  c) internal  d) protected\n   Answer: c) internal (this is a C#, not a Java, modifier)\n\n5) What is the output of `System.out.println(5 / 2);`?\n   a) 2.5  b) 2  c) 3  d) Compile error\n   Answer: b) 2 (integer division truncates)",
      example: "MCQ screening rounds are usually TIMED — practicing at speed matters as much as knowing the material. Try covering the answer and timing yourself to under 20 seconds per question.",
      notes: [
        "MCQ rounds often include intentionally tricky \"gotcha\" options that test a subtle misunderstanding (like integer division, or default field values) rather than pure recall.",
        "Elimination is a valid strategy — ruling out 2 clearly wrong options doubles your odds even on a genuine guess.",
      ],
      mistakes: ["Rushing past the question stem without noticing a qualifier word like \"NOT\" or \"always\" — MCQ questions are often written specifically to catch skimmers."],
    }),
  },
  {
    title: "Coding Questions",
    estimatedMinutes: 15,
    content: lessonHTML({
      explanation: "This lesson reviews the shape of coding-round interview questions and how to approach them — the actual practice happens in this platform's dedicated Coding Practice, Module Coding Tests, and Daily/Weekly Challenges, which give you a real compiler and graded test cases.",
      syntax:
        "A strong approach to any coding interview question:\n1. Restate the problem in your own words to confirm you understood it.\n2. Ask about edge cases and constraints (empty input? negative numbers? duplicates?).\n3. Talk through a brute-force approach FIRST, even if you already see a better one.\n4. Optimize, explaining the time/space trade-off as you go.\n5. Code it, narrating your reasoning as you write.\n6. Trace through your own code with a sample input before declaring it done.",
      example:
        "A classic prompt: \"Given an array of integers, find two numbers that add up to a target value.\"\nBrute force: check every pair — O(n^2).\nOptimized: use a HashMap of value to index; for each number, check if (target - number) was already seen — O(n) time, O(n) space.\nThis \"brute force, then optimize with a HashMap\" pattern recurs across a large fraction of array/string interview questions.",
      notes: [
        "Every module in this course (especially Arrays, Strings, Collections Framework, and Data Structures & Algorithms) directly maps to the topics coding rounds draw from — review those modules' practice questions and proctored assessments as your primary coding-round preparation.",
        "This platform's Coding Practice and Company Coding Tests sections (outside this Learning module) give you real compiler feedback and hidden test cases — use them to simulate the actual round.",
      ],
      mistakes: ["Jumping straight to typing code before verbally confirming the approach — interviewers weight your PROCESS heavily, and silent coding gives them nothing to evaluate until you're already done."],
      bestPractices: ["Practice explaining your approach OUT LOUD, not just solving problems silently — the interview skill being tested is communication under a coding constraint, not just correctness."],
    }),
  },
  {
    title: "Company-based Questions",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Different companies tend to emphasize different rounds and question styles — this lesson gives a general orientation; this platform's dedicated Company Round and Interview Prep company browse pages let you practice against real company-specific patterns and analytics.",
      syntax:
        "Broad patterns across company types (general tendencies, not universal rules):\n- Product companies (large tech firms): heavier emphasis on DSA/algorithmic coding rounds, often multiple rounds.\n- Service/IT companies: broader coverage across core CS fundamentals (OOP, DBMS, OS, CN) plus a coding round, often less algorithmically intense.\n- Startups: more likely to ask about a specific tech stack, past projects, and practical problem-solving over abstract algorithms.\n- Finance/fintech: frequently combine technical rounds with questions about handling correctness/reliability under strict constraints.",
      example: "Before any company-specific interview, review that company's listed tech stack and product domain, and be ready to explain how relevant Java concepts (concurrency, collections, JDBC) would matter to a system like theirs.",
      notes: [
        "This platform's Interview Prep module includes a Company Round mode and a company browse view with real usage analytics — use those for actual company-flavored coding and interview practice.",
        "Company patterns shift over time — treat any list of \"typical\" questions as a starting point for practice, not a guarantee of what you'll actually be asked.",
      ],
      mistakes: ["Assuming every company in the same industry asks identical questions — preparation should cover fundamentals broadly, with company-specific research as a supplement, not a substitute."],
    }),
  },
  {
    title: "Previous Placement Questions",
    estimatedMinutes: 12,
    content: lessonHTML({
      explanation: "Reviewing real, previously-asked placement questions helps you calibrate difficulty and format expectations — this lesson gives a representative sample; this platform's Interview Prep history and reports let you track your own performance against real practice sessions over time.",
      syntax:
        "Representative placement-season question styles:\n- HR round: \"Tell me about yourself\", \"Why should we hire you?\", \"Describe a challenge you overcame.\"\n- Technical round: core-subject questions (OOP, DBMS, OS) mixed with 1-2 coding problems.\n- Coding round: typically 2-3 problems of increasing difficulty, often with a strict time limit.\n- Aptitude round (common in mass-recruitment drives): quantitative reasoning, logical puzzles, verbal ability — not Java-specific, but frequently a first-round filter.",
      example: "A typical placement-season coding round might give 90 minutes for 2 problems: one straightforward array/string problem, and one requiring a specific data structure (like a HashMap or Stack) to pass within the time/memory limits — matching the proctored assessments in this course's Arrays, Strings, and Collections Framework modules.",
      notes: [
        "Placement drives often run under real time pressure and proctoring similar to this platform's Module Coding Tests — practicing under those same constraints (timer running, no external references) builds the right habits.",
        "Aptitude and HR rounds are frequently a first-pass FILTER before the technical rounds even begin — don't neglect them while focusing only on coding practice.",
      ],
      mistakes: ["Preparing only for the coding round and treating the HR/aptitude rounds as an afterthought — many placement processes reject candidates at those earlier filter stages before the coding round is ever reached."],
      bestPractices: ["Simulate full mock sessions (not just isolated practice problems) close to placement season — this platform's Mock Interview and Company Round modes are built for exactly this end-to-end rehearsal."],
    }),
  },
];

// No REMAINING_MODULES stub loop is needed anymore — Modules 1-16 are all hand-authored. Module 16
// ("Interview Preparation") has no trailing quiz/coding-practice lesson (practiceLabel was null in
// the original spec) — its real graded practice already lives in this platform's dedicated Interview
// Prep, Coding Practice, and Company Coding Tests systems, which the lessons below point students to.
const REMAINING_MODULES = [];

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

  // --- Module 9: full hand-authored content ---
  const module9 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Collections Framework" } },
    update: {},
    create: { courseId: course.id, title: "Collections Framework", order: 8 },
  });

  for (let i = 0; i < MODULE9_LESSONS.length; i++) {
    const l = MODULE9_LESSONS[i];
    await upsertLessonContent(prisma, module9.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module9PracticeLesson = await upsertLessonContent(prisma, module9.id, "Practice Questions", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE9_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule9Practice = await prisma.practiceQuestion.count({ where: { lessonId: module9PracticeLesson.id } });
  if (existingModule9Practice === 0) {
    let order = 0;
    for (const q of MODULE9_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module9PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE9_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module9PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 10: full hand-authored content ---
  const module10 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "File Handling" } },
    update: {},
    create: { courseId: course.id, title: "File Handling", order: 9 },
  });

  for (let i = 0; i < MODULE10_LESSONS.length; i++) {
    const l = MODULE10_LESSONS[i];
    await upsertLessonContent(prisma, module10.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module10PracticeLesson = await upsertLessonContent(prisma, module10.id, "Coding Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE10_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule10Practice = await prisma.practiceQuestion.count({ where: { lessonId: module10PracticeLesson.id } });
  if (existingModule10Practice === 0) {
    let order = 0;
    for (const q of MODULE10_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module10PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE10_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module10PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 11: full hand-authored content ---
  const module11 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Multithreading" } },
    update: {},
    create: { courseId: course.id, title: "Multithreading", order: 10 },
  });

  for (let i = 0; i < MODULE11_LESSONS.length; i++) {
    const l = MODULE11_LESSONS[i];
    await upsertLessonContent(prisma, module11.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module11PracticeLesson = await upsertLessonContent(prisma, module11.id, "Practice", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE11_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule11Practice = await prisma.practiceQuestion.count({ where: { lessonId: module11PracticeLesson.id } });
  if (existingModule11Practice === 0) {
    let order = 0;
    for (const q of MODULE11_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module11PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE11_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module11PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 12: full hand-authored content ---
  const module12 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Java 8 Features" } },
    update: {},
    create: { courseId: course.id, title: "Java 8 Features", order: 11 },
  });

  for (let i = 0; i < MODULE12_LESSONS.length; i++) {
    const l = MODULE12_LESSONS[i];
    await upsertLessonContent(prisma, module12.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module12PracticeLesson = await upsertLessonContent(prisma, module12.id, "Practice", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE12_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule12Practice = await prisma.practiceQuestion.count({ where: { lessonId: module12PracticeLesson.id } });
  if (existingModule12Practice === 0) {
    let order = 0;
    for (const q of MODULE12_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module12PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE12_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module12PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 13: full hand-authored content ---
  const module13 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "JDBC" } },
    update: {},
    create: { courseId: course.id, title: "JDBC", order: 12 },
  });

  for (let i = 0; i < MODULE13_LESSONS.length; i++) {
    const l = MODULE13_LESSONS[i];
    await upsertLessonContent(prisma, module13.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module13PracticeLesson = await upsertLessonContent(prisma, module13.id, "Mini Project", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE13_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule13Practice = await prisma.practiceQuestion.count({ where: { lessonId: module13PracticeLesson.id } });
  if (existingModule13Practice === 0) {
    let order = 0;
    for (const q of MODULE13_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module13PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE13_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module13PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 14: full hand-authored content ---
  const module14 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Advanced Java" } },
    update: {},
    create: { courseId: course.id, title: "Advanced Java", order: 13 },
  });

  for (let i = 0; i < MODULE14_LESSONS.length; i++) {
    const l = MODULE14_LESSONS[i];
    await upsertLessonContent(prisma, module14.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module14PracticeLesson = await upsertLessonContent(prisma, module14.id, "Coding Practice", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE14_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule14Practice = await prisma.practiceQuestion.count({ where: { lessonId: module14PracticeLesson.id } });
  if (existingModule14Practice === 0) {
    let order = 0;
    for (const q of MODULE14_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module14PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE14_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module14PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 15: full hand-authored content ---
  const module15 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Data Structures & Algorithms in Java" } },
    update: {},
    create: { courseId: course.id, title: "Data Structures & Algorithms in Java", order: 14 },
  });

  for (let i = 0; i < MODULE15_LESSONS.length; i++) {
    const l = MODULE15_LESSONS[i];
    await upsertLessonContent(prisma, module15.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  const module15PracticeLesson = await upsertLessonContent(prisma, module15.id, "Coding Problems", {
    content: "<p>Test what you've learned in this module — multiple choice, then two coding exercises.</p>",
    estimatedMinutes: 20, order: MODULE15_LESSONS.length,
    isModuleTest: true,
  });
  const existingModule15Practice = await prisma.practiceQuestion.count({ where: { lessonId: module15PracticeLesson.id } });
  if (existingModule15Practice === 0) {
    let order = 0;
    for (const q of MODULE15_QUIZ) {
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module15PracticeLesson.id, type: q.type, prompt: q.prompt,
          options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation, order: order++,
        },
      });
    }
    for (const q of MODULE15_CODING) {
      const resolved = resolveCodingFields({ evaluationType: "FUNCTION", functionSignature: PRACTICE_CODING_SIGNATURES[q.prompt] });
      await prisma.practiceQuestion.create({
        data: {
          lessonId: module15PracticeLesson.id, type: q.type, prompt: q.prompt, language: q.language,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, explanation: q.explanation, order: order++,
        },
      });
    }
  }

  // --- Module 16: full hand-authored content (no trailing quiz/coding-practice lesson —
  // practiceLabel was null in the original spec; real graded practice lives in this
  // platform's dedicated Interview Prep / Coding Practice / Company Coding Tests systems) ---
  const module16 = await prisma.courseModule.upsert({
    where: { courseId_title: { courseId: course.id, title: "Interview Preparation" } },
    update: {},
    create: { courseId: course.id, title: "Interview Preparation", order: 15 },
  });

  for (let i = 0; i < MODULE16_LESSONS.length; i++) {
    const l = MODULE16_LESSONS[i];
    await upsertLessonContent(prisma, module16.id, l.title, { content: l.content, estimatedMinutes: l.estimatedMinutes, order: i });
  }

  // REMAINING_MODULES is now empty — Modules 1-16 are all hand-authored above.
  for (let m = 0; m < REMAINING_MODULES.length; m++) {
    const spec = REMAINING_MODULES[m];
    const mod = await prisma.courseModule.upsert({
      where: { courseId_title: { courseId: course.id, title: spec.title } },
      update: {},
      create: { courseId: course.id, title: spec.title, order: m + 16 },
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

  console.log("Seeded Learning Module: Java course with", REMAINING_MODULES.length + 16, "modules.");
}

module.exports = { seedLearningModule };

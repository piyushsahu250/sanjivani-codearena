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

// Modules 4-16: topic list + trailing practice-section label from the spec. Real lesson
// content isn't hand-authored for these — each gets a placeholder lesson body so the course
// tree, navigation, and progress tracking all work end-to-end, ready for an admin to fill in
// real content via the Learning Management admin panel.
const REMAINING_MODULES = [
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

  // --- Modules 4-16: stub structure only, real content added later via admin CMS ---
  for (let m = 0; m < REMAINING_MODULES.length; m++) {
    const spec = REMAINING_MODULES[m];
    const mod = await prisma.courseModule.upsert({
      where: { courseId_title: { courseId: course.id, title: spec.title } },
      update: {},
      create: { courseId: course.id, title: spec.title, order: m + 3 },
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

  console.log("Seeded Learning Module: Java course with", REMAINING_MODULES.length + 3, "modules.");
}

module.exports = { seedLearningModule };

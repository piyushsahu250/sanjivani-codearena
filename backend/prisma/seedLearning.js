// Seeds the Java Learning Module: the full 16-module course structure from the spec, with
// complete hand-authored content for Module 1 (proof that the content model/renderer works
// end-to-end) and placeholder lessons for Modules 2-16 (topic titles only — real content for
// those gets filled in through the new admin Learning CMS, not hand-written here).
//
// Idempotent: safe to run on every container start. Course/Module/Lesson are upserted by their
// natural unique keys (slug / courseId+title / moduleId+title); practice questions are only
// inserted the first time a lesson has none, so re-running never duplicates them.

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

// Modules 2-16: topic list + trailing practice-section label from the spec. Real lesson
// content isn't hand-authored for these — each gets a placeholder lesson body so the course
// tree, navigation, and progress tracking all work end-to-end, ready for an admin to fill in
// real content via the Learning Management admin panel.
const REMAINING_MODULES = [
  { title: "Java Basics", topics: ["Variables", "Data Types", "Operators", "User Input", "Type Casting", "Comments", "Keywords", "Identifiers"], practiceLabel: "Practice Questions & Coding Exercises" },
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

  let lastLessonId = null;
  for (let i = 0; i < MODULE1_LESSONS.length; i++) {
    const l = MODULE1_LESSONS[i];
    const lesson = await prisma.lesson.upsert({
      where: { moduleId_title: { moduleId: module1.id, title: l.title } },
      update: {},
      create: { moduleId: module1.id, title: l.title, order: i, content: l.content, estimatedMinutes: l.estimatedMinutes },
    });
    lastLessonId = lesson.id;
  }

  const quizLesson = await prisma.lesson.upsert({
    where: { moduleId_title: { moduleId: module1.id, title: "Practice Quiz" } },
    update: {},
    create: {
      moduleId: module1.id, title: "Practice Quiz", order: MODULE1_LESSONS.length,
      content: "<p>Test what you've learned in this module.</p>", estimatedMinutes: 10,
    },
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

  // --- Modules 2-16: stub structure only, real content added later via admin CMS ---
  for (let m = 0; m < REMAINING_MODULES.length; m++) {
    const spec = REMAINING_MODULES[m];
    const mod = await prisma.courseModule.upsert({
      where: { courseId_title: { courseId: course.id, title: spec.title } },
      update: {},
      create: { courseId: course.id, title: spec.title, order: m + 1 },
    });

    for (let t = 0; t < spec.topics.length; t++) {
      await prisma.lesson.upsert({
        where: { moduleId_title: { moduleId: mod.id, title: spec.topics[t] } },
        update: {},
        create: {
          moduleId: mod.id, title: spec.topics[t], order: t,
          content: `<p><em>Content for "${spec.topics[t]}" is coming soon. Add it from the admin Learning Management panel.</em></p>`,
          estimatedMinutes: 10,
        },
      });
    }

    if (spec.practiceLabel) {
      await prisma.lesson.upsert({
        where: { moduleId_title: { moduleId: mod.id, title: spec.practiceLabel } },
        update: {},
        create: {
          moduleId: mod.id, title: spec.practiceLabel, order: spec.topics.length,
          content: "<p><em>Practice questions for this module will be added soon.</em></p>", estimatedMinutes: 15,
        },
      });
    }
  }

  console.log("Seeded Learning Module: Java course with", REMAINING_MODULES.length + 1, "modules.");
}

module.exports = { seedLearningModule };

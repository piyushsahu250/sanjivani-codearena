// Seeds a genuine, fully-functional starter question bank for the Interview Prep module.
// NOTE: the spec asks for 500+ questions; this seeds ~125 real, hand-authored ones (25 HR,
// 55 Technical across 11 subjects, 20 Aptitude across 4 categories, 26 Coding across 13
// topics with real judge-verified test cases) — enough to exercise every flow end-to-end.
// Reaching 500+ is a content-authoring task, not a technical one; the admin CMS (with CSV
// import) built alongside this is exactly the tool for growing the bank incrementally.
//
// Idempotent: skips seeding entirely once any non-generated question already exists, so
// re-running on redeploy never duplicates rows (there's no natural unique key to upsert
// against — question text isn't guaranteed unique — so "seed once" is the simplest safe rule).

const { resolveCodingFields } = require("../src/utils/functionHarness");
const { INTERVIEW_CODING_SIGNATURES } = require("./functionSignatures");

const HR_QUESTIONS = [
  { prompt: "Tell me about yourself.", expectedKeywords: ["experience", "skills", "background"] },
  { prompt: "Why should we hire you?", expectedKeywords: ["skills", "value", "contribute"] },
  { prompt: "What are your strengths and weaknesses?", expectedKeywords: ["strength", "weakness", "improve"] },
  { prompt: "Why do you want this job?", expectedKeywords: ["role", "company", "growth"] },
  { prompt: "Where do you see yourself in 5 years?", expectedKeywords: ["growth", "career", "goals"] },
  { prompt: "Describe a time you demonstrated leadership.", expectedKeywords: ["team", "led", "responsibility"] },
  { prompt: "How do you handle conflict with a coworker?", expectedKeywords: ["communication", "resolve", "listen"] },
  { prompt: "What is your biggest achievement?", expectedKeywords: ["achievement", "result", "impact"] },
  { prompt: "Tell me about a time you failed and what you learned.", expectedKeywords: ["failure", "learned", "improve"] },
  { prompt: "Why are you looking for a new opportunity?", expectedKeywords: ["growth", "opportunity", "role"] },
  { prompt: "How do you handle stress and pressure?", expectedKeywords: ["stress", "manage", "prioritize"] },
  { prompt: "Describe your ideal work environment.", expectedKeywords: ["environment", "team", "culture"] },
  { prompt: "What motivates you at work?", expectedKeywords: ["motivate", "passion", "goals"] },
  { prompt: "How do you prioritize your work when you have multiple deadlines?", expectedKeywords: ["prioritize", "deadline", "plan"] },
  { prompt: "Tell me about a time you worked effectively in a team.", expectedKeywords: ["team", "collaborate", "contribution"] },
  { prompt: "What do you know about our company?", expectedKeywords: ["company", "research", "product"] },
  { prompt: "Do you have any questions for us?", expectedKeywords: ["question", "role", "team"] },
  { prompt: "How do you handle constructive criticism?", expectedKeywords: ["feedback", "improve", "criticism"] },
  { prompt: "Describe a situation where you had to learn something new quickly.", expectedKeywords: ["learn", "quickly", "adapt"] },
  { prompt: "What are your salary expectations?", expectedKeywords: ["salary", "expectation", "market"] },
  { prompt: "Tell me about a time you disagreed with your manager.", expectedKeywords: ["disagree", "manager", "respect"] },
  { prompt: "How would your friends or colleagues describe you?", expectedKeywords: ["describe", "personality", "trait"] },
  { prompt: "What is your greatest weakness, and how are you working on it?", expectedKeywords: ["weakness", "working on", "improve"] },
  { prompt: "Describe a time you went above and beyond at work or school.", expectedKeywords: ["extra", "effort", "impact"] },
  { prompt: "Why should we choose you over other candidates?", expectedKeywords: ["unique", "skills", "value"] },
];

const TECHNICAL_QUESTIONS = {
  C: [
    { prompt: "What is a pointer in C?", expectedKeywords: ["address", "memory", "variable", "dereference"] },
    { prompt: "Explain the difference between malloc and calloc.", expectedKeywords: ["malloc", "calloc", "memory", "initialize"] },
    { prompt: "What is the difference between a structure and a union in C?", expectedKeywords: ["struct", "union", "memory", "shared"] },
    { prompt: "What are storage classes in C?", expectedKeywords: ["auto", "static", "extern", "register"] },
    { prompt: "Explain the difference between call by value and call by reference.", expectedKeywords: ["copy", "address", "value", "reference"] },
  ],
  "C++": [
    { prompt: "What is the difference between a pointer and a reference in C++?", expectedKeywords: ["pointer", "reference", "null", "address"] },
    { prompt: "Explain RAII in C++.", expectedKeywords: ["resource", "constructor", "destructor"] },
    { prompt: "What is operator overloading?", expectedKeywords: ["operator", "overload", "class"] },
    { prompt: "Explain virtual functions and polymorphism in C++.", expectedKeywords: ["virtual", "polymorphism", "override"] },
    { prompt: "What is the difference between stack and heap memory?", expectedKeywords: ["stack", "heap", "allocation", "dynamic"] },
  ],
  Java: [
    { prompt: "Explain the difference between JVM, JRE, and JDK.", expectedKeywords: ["jvm", "jre", "jdk", "compiler"] },
    { prompt: "What is the difference between an interface and an abstract class?", expectedKeywords: ["interface", "abstract", "implementation"] },
    { prompt: "Explain method overloading vs method overriding.", expectedKeywords: ["overload", "override", "polymorphism"] },
    { prompt: "What is garbage collection in Java?", expectedKeywords: ["garbage collection", "memory", "heap"] },
    { prompt: "Explain the difference between == and .equals() in Java.", expectedKeywords: ["reference", "value", "equals"] },
  ],
  Python: [
    { prompt: "What is the GIL in Python?", expectedKeywords: ["gil", "global interpreter lock", "thread"] },
    { prompt: "Explain the difference between a list and a tuple.", expectedKeywords: ["mutable", "immutable", "list", "tuple"] },
    { prompt: "What are Python decorators?", expectedKeywords: ["decorator", "function", "wrapper"] },
    { prompt: "Explain list comprehension with an example.", expectedKeywords: ["list comprehension", "for", "iterable"] },
    { prompt: "What is the difference between deep copy and shallow copy?", expectedKeywords: ["deep copy", "shallow copy", "reference"] },
  ],
  JavaScript: [
    { prompt: "Explain closures in JavaScript.", expectedKeywords: ["closure", "scope", "function"] },
    { prompt: "What is the difference between var, let, and const?", expectedKeywords: ["var", "let", "const", "scope"] },
    { prompt: "Explain the event loop in JavaScript.", expectedKeywords: ["event loop", "call stack", "asynchronous"] },
    { prompt: "What is the difference between == and === in JavaScript?", expectedKeywords: ["type coercion", "strict equality"] },
    { prompt: "Explain promises and async/await.", expectedKeywords: ["promise", "async", "await"] },
  ],
  SQL: [
    { prompt: "Explain the difference between INNER JOIN and LEFT JOIN.", expectedKeywords: ["inner join", "left join", "null"] },
    { prompt: "What is normalization? Explain 1NF, 2NF, 3NF.", expectedKeywords: ["normalization", "redundancy", "1nf", "2nf", "3nf"] },
    { prompt: "What is the difference between DELETE, TRUNCATE, and DROP?", expectedKeywords: ["delete", "truncate", "drop"] },
    { prompt: "Explain primary key vs foreign key.", expectedKeywords: ["primary key", "foreign key", "reference"] },
    { prompt: "What is an index, and how does it improve performance?", expectedKeywords: ["index", "performance", "lookup"] },
  ],
  DBMS: [
    { prompt: "What is a transaction, and what are ACID properties?", expectedKeywords: ["transaction", "acid", "atomicity", "consistency"] },
    { prompt: "Explain the difference between DBMS and RDBMS.", expectedKeywords: ["rdbms", "relational", "tables"] },
    { prompt: "What is a deadlock, and how can it be prevented?", expectedKeywords: ["deadlock", "lock", "resource"] },
    { prompt: "Explain database normalization and denormalization.", expectedKeywords: ["normalization", "denormalization", "redundancy"] },
    { prompt: "What is the difference between clustered and non-clustered index?", expectedKeywords: ["clustered", "non-clustered", "index"] },
  ],
  OS: [
    { prompt: "What is the difference between a process and a thread?", expectedKeywords: ["process", "thread", "memory"] },
    { prompt: "Explain deadlock and the conditions for it to occur.", expectedKeywords: ["deadlock", "mutual exclusion", "circular wait"] },
    { prompt: "What is virtual memory?", expectedKeywords: ["virtual memory", "paging", "physical memory"] },
    { prompt: "Explain the difference between paging and segmentation.", expectedKeywords: ["paging", "segmentation", "fixed size"] },
    { prompt: "What is a semaphore, and how is it used for synchronization?", expectedKeywords: ["semaphore", "synchronization", "mutex"] },
  ],
  CN: [
    { prompt: "Explain the OSI model and its layers.", expectedKeywords: ["osi", "layers", "transport", "application"] },
    { prompt: "What is the difference between TCP and UDP?", expectedKeywords: ["tcp", "udp", "connection", "reliable"] },
    { prompt: "Explain the three-way handshake in TCP.", expectedKeywords: ["syn", "ack", "handshake"] },
    { prompt: "What is DNS, and how does it work?", expectedKeywords: ["dns", "domain", "ip address"] },
    { prompt: "Explain the difference between a router and a switch.", expectedKeywords: ["router", "switch", "routing"] },
  ],
  OOP: [
    { prompt: "Explain the four pillars of OOP.", expectedKeywords: ["encapsulation", "inheritance", "polymorphism", "abstraction"] },
    { prompt: "What is encapsulation, and why is it important?", expectedKeywords: ["encapsulation", "data hiding"] },
    { prompt: "Explain the difference between composition and inheritance.", expectedKeywords: ["composition", "inheritance", "has-a", "is-a"] },
    { prompt: "What is polymorphism? Give an example.", expectedKeywords: ["polymorphism", "overriding", "overloading"] },
    { prompt: "What are the SOLID principles?", expectedKeywords: ["solid", "single responsibility", "open closed"] },
  ],
  DSA: [
    { prompt: "Explain the difference between an array and a linked list.", expectedKeywords: ["array", "linked list", "contiguous", "pointer"] },
    { prompt: "What is a binary search tree, and what is its time complexity for search?", expectedKeywords: ["binary search tree", "o(log n)"] },
    { prompt: "Explain the difference between BFS and DFS.", expectedKeywords: ["bfs", "dfs", "breadth", "depth"] },
    { prompt: "What is dynamic programming, and when would you use it?", expectedKeywords: ["dynamic programming", "memoization", "overlapping subproblems"] },
    { prompt: "Explain time complexity and the complexity of common sorting algorithms.", expectedKeywords: ["time complexity", "big o", "sorting"] },
  ],
};

const APTITUDE_QUESTIONS = {
  QUANTITATIVE: [
    { prompt: "What is 15% of 200?", options: ["20", "30", "25", "35"], correctAnswer: 1, explanation: "15% of 200 = 0.15 × 200 = 30." },
    { prompt: "If a train travels 60 km in 45 minutes, what is its speed in km/h?", options: ["70", "80", "90", "75"], correctAnswer: 1, explanation: "60 ÷ (45/60) = 60 ÷ 0.75 = 80 km/h." },
    { prompt: "The average of 5 numbers is 20. If one number is removed, the average becomes 18. What was the removed number?", options: ["24", "26", "28", "30"], correctAnswer: 2, explanation: "5×20=100, 4×18=72, removed = 100−72 = 28." },
    { prompt: "A shopkeeper sells an item for ₹450 at a profit of 20%. What was the cost price?", options: ["350", "375", "400", "360"], correctAnswer: 1, explanation: "CP = 450 ÷ 1.2 = 375." },
    { prompt: "What is the compound interest on ₹1000 at 10% per annum for 2 years?", options: ["200", "210", "220", "190"], correctAnswer: 1, explanation: "CI = 1000×(1.1² − 1) = 210." },
  ],
  LOGICAL: [
    { prompt: "Find the odd one out: Dog, Cat, Lion, Snake", options: ["Dog", "Cat", "Lion", "Snake"], correctAnswer: 3, explanation: "Snake is a reptile; the others are mammals." },
    { prompt: "Complete the series: 2, 6, 12, 20, 30, ?", options: ["36", "40", "42", "44"], correctAnswer: 2, explanation: "Pattern is n(n+1): next term is 6×7=42." },
    { prompt: "If all Bloops are Razzies and all Razzies are Lazzies, are all Bloops definitely Lazzies?", options: ["Yes", "No", "Cannot be determined", "Only some"], correctAnswer: 0, explanation: "By transitivity, all Bloops are Lazzies." },
    { prompt: "A is the brother of B. B is the sister of C. C is the father of D. How is A related to D?", options: ["Uncle", "Father", "Brother", "Cousin"], correctAnswer: 0, explanation: "A is B's sibling, and C's sibling — so A is D's uncle." },
    { prompt: "Find the next letter in the series: A, C, F, J, O, ?", options: ["T", "U", "V", "S"], correctAnswer: 1, explanation: "Gaps increase by 1 each time (+2,+3,+4,+5,+6): O+6=U." },
  ],
  VERBAL: [
    { prompt: "Choose the correct synonym for 'Abundant'.", options: ["Scarce", "Plentiful", "Limited", "Rare"], correctAnswer: 1, explanation: "'Plentiful' means existing in large quantities, same as 'Abundant'." },
    { prompt: "Choose the correct antonym for 'Benevolent'.", options: ["Kind", "Generous", "Malevolent", "Caring"], correctAnswer: 2, explanation: "'Malevolent' (wishing harm) is the opposite of 'Benevolent'." },
    { prompt: "Fill in the blank: She ___ to the store every day.", options: ["go", "goes", "going", "gone"], correctAnswer: 1, explanation: "Third-person singular present tense requires 'goes'." },
    { prompt: "Identify the correctly spelled word.", options: ["Recieve", "Receive", "Receve", "Receeve"], correctAnswer: 1, explanation: "'i before e except after c' — Receive is correct." },
    { prompt: "Choose the sentence with correct grammar.", options: ["He don't like it.", "He doesn't likes it.", "He doesn't like it.", "He not like it."], correctAnswer: 2, explanation: "'Doesn't' pairs with the base verb form 'like'." },
  ],
  DATA_INTERPRETATION: [
    { prompt: "A pie chart shows 25% for Category A out of a total of 400 units. How many units does Category A represent?", options: ["80", "90", "100", "110"], correctAnswer: 2, explanation: "25% of 400 = 100." },
    { prompt: "A bar graph shows sales of 50, 70, 90, and 60 over 4 quarters. What is the average quarterly sales?", options: ["65", "67.5", "70", "72.5"], correctAnswer: 1, explanation: "(50+70+90+60)/4 = 270/4 = 67.5." },
    { prompt: "Product X sold 120 units in January and 150 in February. What is the percentage increase?", options: ["20%", "25%", "30%", "15%"], correctAnswer: 1, explanation: "(150−120)/120 × 100 = 25%." },
    { prompt: "A line graph shows temperature rising from 20°C to 35°C over 5 hours. What is the average rate of increase per hour?", options: ["2", "3", "4", "5"], correctAnswer: 1, explanation: "(35−20)/5 = 3°C per hour." },
    { prompt: "A survey of 200 people shows 40% prefer tea. How many people prefer tea?", options: ["60", "70", "80", "90"], correctAnswer: 2, explanation: "40% of 200 = 80." },
  ],
};

function javaStarter(body) {
  return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n${body}\n        // write your solution here\n    }\n}`;
}

// All topics below are authored LeetCode-style (FUNCTION mode) — see functionSignatures.js's
// INTERVIEW_CODING_SIGNATURES (keyed by exact prompt text), which resolveCodingFields() turns
// into the real starterCodeByLanguage in the create loop below. The Graphs topic is the one
// deliberate exception: its multi-line "read edges until EOF" input shape doesn't fit FUNCTION
// mode's one-value/array-per-parameter convention, so it stays full-program (STDIO), the only
// topic that still carries its own starterCode here.
const CODING_QUESTIONS = {
  Arrays: [
    { prompt: "Read space-separated integers on one line and print the maximum value.", testCases: [{ input: "3 7 2 9 4", expected: "9" }, { input: "1 1 1", expected: "1" }, { input: "-5 -2 -8", expected: "-2" }] },
    { prompt: "Read space-separated integers and print them in reverse order, space-separated.", testCases: [{ input: "1 2 3 4 5", expected: "5 4 3 2 1" }, { input: "1 2", expected: "2 1" }] },
  ],
  Strings: [
    { prompt: "Read a string and print \"true\" if it's a palindrome, else \"false\".", testCases: [{ input: "madam", expected: "true" }, { input: "hello", expected: "false" }, { input: "a", expected: "true" }] },
    { prompt: "Read a string and print the number of vowels in it.", testCases: [{ input: "hello world", expected: "3" }, { input: "xyz", expected: "0" }] },
  ],
  Stack: [
    { prompt: "Read a string of brackets ()[]{} and print \"true\" if they are balanced, else \"false\".", testCases: [{ input: "{[()]}", expected: "true" }, { input: "{[(])}", expected: "false" }, { input: "()", expected: "true" }] },
    { prompt: "Read space-separated integers and print \"true\" if reversing them with a stack gives a strictly descending sequence, else \"false\".", testCases: [{ input: "1 2 3", expected: "true" }, { input: "1 3 2", expected: "false" }] },
  ],
  Queue: [
    { prompt: "Read space-separated integers representing a queue (front to back). Print them after removing the front element.", testCases: [{ input: "1 2 3 4", expected: "2 3 4" }, { input: "5 6", expected: "6" }] },
    { prompt: "Read space-separated integers. Print \"true\" if they are already in ascending order (a valid sorted queue), else \"false\".", testCases: [{ input: "1 2 3", expected: "true" }, { input: "3 1 2", expected: "false" }] },
  ],
  Trees: [
    { prompt: "Read a level-order array of a binary tree (space-separated, -1 for null). Print the count of non-null nodes.", testCases: [{ input: "1 2 3 -1 4", expected: "4" }, { input: "1 -1 -1", expected: "1" }] },
    { prompt: "Read a level-order array of a binary tree (space-separated, -1 for null). Print the sum of all non-null node values.", testCases: [{ input: "1 2 3 -1 4", expected: "10" }, { input: "5 -1 -1", expected: "5" }] },
  ],
  Graphs: [
    { prompt: "Read a list of edges as pairs \"u v\" (one pair per line ends input). Print the count of unique nodes.", starterCode: javaStarter("        // read lines until input ends"), testCases: [{ input: "1 2\n2 3\n3 1", expected: "3" }, { input: "1 2\n1 3", expected: "3" }] },
    { prompt: "Read space-separated node degrees and print their sum (should equal 2 × edge count for a valid graph).", starterCode: javaStarter("        String line = sc.nextLine();"), testCases: [{ input: "2 2 2", expected: "6" }, { input: "1 1", expected: "2" }] },
  ],
  DP: [
    { prompt: "Read an integer N and print the Nth Fibonacci number (0-indexed, F(0)=0, F(1)=1).", testCases: [{ input: "10", expected: "55" }, { input: "0", expected: "0" }, { input: "1", expected: "1" }] },
    { prompt: "Read an integer N and print the number of ways to climb N stairs taking 1 or 2 steps at a time.", testCases: [{ input: "4", expected: "5" }, { input: "1", expected: "1" }, { input: "2", expected: "2" }] },
  ],
  "Linked List": [
    { prompt: "Read space-separated integers (a linked list) and print them in reverse order.", testCases: [{ input: "1 2 3", expected: "3 2 1" }, { input: "7 8", expected: "8 7" }] },
    { prompt: "Read space-separated integers and print them with duplicates removed, preserving first-occurrence order.", testCases: [{ input: "1 2 2 3 1", expected: "1 2 3" }, { input: "5 5 5", expected: "5" }] },
  ],
  Recursion: [
    { prompt: "Read an integer N and print its factorial using recursion.", testCases: [{ input: "5", expected: "120" }, { input: "0", expected: "1" }] },
    { prompt: "Read an integer N and print the sum of its digits using recursion.", testCases: [{ input: "1234", expected: "10" }, { input: "9", expected: "9" }] },
  ],
  Sorting: [
    { prompt: "Read space-separated integers and print them sorted in ascending order.", testCases: [{ input: "5 3 1 4 2", expected: "1 2 3 4 5" }, { input: "2 1", expected: "1 2" }] },
    { prompt: "Read space-separated integers and print them sorted in descending order.", testCases: [{ input: "5 3 1 4 2", expected: "5 4 3 2 1" }, { input: "1 2", expected: "2 1" }] },
  ],
  Searching: [
    { prompt: "Read space-separated sorted integers on one line and a target on the next line. Print the 0-based index of the target, or -1 if not found.", testCases: [{ input: "1 3 5 7 9\n7", expected: "3" }, { input: "2 4 6\n5", expected: "-1" }] },
    { prompt: "Read space-separated integers on one line and a target on the next. Print \"true\" if the target exists, else \"false\".", testCases: [{ input: "1 3 5 7\n5", expected: "true" }, { input: "1 3 5 7\n4", expected: "false" }] },
  ],
  Hashing: [
    { prompt: "Read space-separated integers and print \"true\" if there are any duplicates, else \"false\".", testCases: [{ input: "1 2 3 2", expected: "true" }, { input: "1 2 3", expected: "false" }] },
    { prompt: "Read a string and print its first non-repeating character.", testCases: [{ input: "swiss", expected: "w" }, { input: "aabbcddc", expected: "-1" }] },
  ],
  Backtracking: [
    { prompt: "Read an integer N and print the total number of permutations of N distinct items (N!).", testCases: [{ input: "4", expected: "24" }, { input: "1", expected: "1" }, { input: "3", expected: "6" }] },
    { prompt: "Read an integer N (board size) and print \"true\" if the N-Queens problem has at least one solution, else \"false\".", testCases: [{ input: "4", expected: "true" }, { input: "3", expected: "false" }, { input: "1", expected: "true" }] },
  ],
};

async function seedInterviewModule(prisma) {
  const existing = await prisma.interviewQuestion.count({ where: { generatedForStudentId: null } });
  if (existing > 0) {
    console.log("Interview Prep question bank already seeded, skipping.");
    return;
  }

  let count = 0;

  for (const q of HR_QUESTIONS) {
    await prisma.interviewQuestion.create({ data: { category: "HR", difficulty: "EASY", prompt: q.prompt, expectedKeywords: q.expectedKeywords } });
    count++;
  }

  for (const [subject, questions] of Object.entries(TECHNICAL_QUESTIONS)) {
    for (const q of questions) {
      await prisma.interviewQuestion.create({ data: { category: "TECHNICAL", subject, difficulty: "MEDIUM", prompt: q.prompt, expectedKeywords: q.expectedKeywords } });
      count++;
    }
  }

  for (const [aptitudeCategory, questions] of Object.entries(APTITUDE_QUESTIONS)) {
    for (const q of questions) {
      await prisma.interviewQuestion.create({
        data: { category: "APTITUDE", aptitudeCategory, difficulty: "MEDIUM", prompt: q.prompt, options: q.options, correctAnswer: q.correctAnswer, explanation: q.explanation },
      });
      count++;
    }
  }

  for (const [topic, questions] of Object.entries(CODING_QUESTIONS)) {
    for (const q of questions) {
      const signature = INTERVIEW_CODING_SIGNATURES[q.prompt];
      // A CODING question needs EITHER a FUNCTION-mode signature OR its own starterCode (the
      // Graphs topic's deliberate STDIO exception) — never neither. Throwing here instead of
      // silently falling back to STDIO-with-no-starter-code catches a future prompt/signature
      // typo at seed time (visible in deploy logs) rather than shipping students a blank editor.
      if (!signature && !q.starterCode) {
        throw new Error(`No FUNCTION-mode signature or starterCode found for CODING question: "${q.prompt.slice(0, 70)}" — add an entry to INTERVIEW_CODING_SIGNATURES in functionSignatures.js, or give it its own starterCode if it's meant to stay full-program.`);
      }
      const resolved = resolveCodingFields(signature ? { evaluationType: "FUNCTION", functionSignature: signature } : { evaluationType: "STDIO" });
      await prisma.interviewQuestion.create({
        data: {
          category: "CODING", subject: topic, difficulty: "EASY", prompt: q.prompt, starterCode: q.starterCode || null,
          evaluationType: resolved.evaluationType, functionSignature: resolved.functionSignature, starterCodeByLanguage: resolved.starterCodeByLanguage,
          testCases: q.testCases, language: "java",
        },
      });
      count++;
    }
  }

  console.log(`Seeded Interview Prep question bank: ${count} questions (25 HR, ${Object.values(TECHNICAL_QUESTIONS).flat().length} Technical, ${Object.values(APTITUDE_QUESTIONS).flat().length} Aptitude, ${Object.values(CODING_QUESTIONS).flat().length} Coding).`);
}

module.exports = { seedInterviewModule };

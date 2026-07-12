// Second follow-on seed pass: Managerial category questions, 12 more companies (bringing the
// total named in the spec to all 24), and a handful of real admin-linked follow-up question
// chains (e.g. "Explain JVM" -> "How does JVM differ from JRE?"). Uses its own idempotency gate
// — seedInterviewExtras.js's gate ("any SYSTEM_DESIGN/BEHAVIORAL/company question exists") is
// already tripped in production from the first pass, so reusing it here would silently skip
// this content forever.

function javaStarter(body) {
  return `import java.util.Scanner;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n${body}\n        // write your solution here\n    }\n}`;
}

const MANAGERIAL_QUESTIONS = [
  { prompt: "How do you prioritize tasks when your team has multiple urgent deadlines at once?", expectedKeywords: ["priorit", "deadline", "urgent", "plan"] },
  { prompt: "Describe how you would handle an underperforming team member.", expectedKeywords: ["underperform", "feedback", "support", "improve"] },
  { prompt: "How do you delegate work effectively within a team?", expectedKeywords: ["delegate", "team", "strength", "trust"] },
  { prompt: "Tell me about a time you had to make an unpopular decision as a leader.", expectedKeywords: ["decision", "leader", "unpopular", "communicate"] },
  { prompt: "How would you resolve a conflict between two team members?", expectedKeywords: ["conflict", "resolve", "mediate", "listen"] },
  { prompt: "How do you keep a team motivated during a difficult project?", expectedKeywords: ["motivate", "team", "morale", "support"] },
  { prompt: "Describe your approach to giving constructive feedback to a direct report.", expectedKeywords: ["feedback", "constructive", "direct report", "improve"] },
  { prompt: "How would you handle a situation where a project is falling behind schedule?", expectedKeywords: ["schedule", "behind", "risk", "plan"] },
  { prompt: "How do you balance individual contributor work with people-management responsibilities?", expectedKeywords: ["balance", "manage", "individual", "time"] },
  { prompt: "Describe a time you had to communicate a difficult decision to your team.", expectedKeywords: ["communicate", "decision", "team", "transparent"] },
];

// { company, category, subject?, prompt, expectedKeywords }
const COMPANY_QUESTIONS = [
  { company: "Tech Mahindra", category: "HR", prompt: "Why do you want to build your career at Tech Mahindra?", expectedKeywords: ["tech mahindra", "career", "growth"] },
  { company: "Tech Mahindra", category: "TECHNICAL", subject: "Java", prompt: "What is the difference between an abstract class and an interface in Java?", expectedKeywords: ["abstract", "interface", "implement", "extend"] },
  { company: "LTIMindtree", category: "HR", prompt: "How do you approach working with clients across different time zones?", expectedKeywords: ["client", "time zone", "communication", "flexible"] },
  { company: "LTIMindtree", category: "TECHNICAL", subject: "SQL", prompt: "Explain the difference between INNER JOIN and LEFT JOIN with an example.", expectedKeywords: ["inner join", "left join", "table", "match"] },
  { company: "Oracle", category: "TECHNICAL", subject: "DBMS", prompt: "What are indexes in a database, and how do they improve query performance?", expectedKeywords: ["index", "query", "performance", "b-tree"] },
  {
    company: "Oracle", category: "CODING",
    prompt: "Read space-separated integers on one line and a target sum on the next. Print the first pair (in index order) that adds up to the target, space-separated.",
    starterCode: javaStarter("        String line = sc.nextLine();\n        int target = sc.nextInt();"),
    testCases: [{ input: "2 7 11 15\n9", expected: "2 7" }, { input: "3 2 4\n6", expected: "2 4" }, { input: "1 5 3 8\n11", expected: "3 8" }],
    language: "java",
  },
  { company: "SAP", category: "HR", prompt: "What interests you about enterprise software as opposed to consumer apps?", expectedKeywords: ["enterprise", "software", "interest", "scale"] },
  { company: "SAP", category: "TECHNICAL", subject: "OOP", prompt: "Explain the SOLID principles of object-oriented design.", expectedKeywords: ["solid", "single responsibility", "open closed", "dependency"] },
  { company: "Zoho", category: "HR", prompt: "Zoho builds most of its own tools in-house — how do you feel about working in a self-reliant engineering culture?", expectedKeywords: ["self-reliant", "in-house", "engineering", "culture"] },
  { company: "Zoho", category: "TECHNICAL", subject: "Java", prompt: "What is the difference between a HashMap and a TreeMap in Java?", expectedKeywords: ["hashmap", "treemap", "order", "sorted"] },
  { company: "Adobe", category: "TECHNICAL", subject: "DSA", prompt: "How would you check if a binary tree is balanced?", expectedKeywords: ["balanced", "binary tree", "height", "recursion"] },
  { company: "Adobe", category: "SYSTEM_DESIGN", prompt: "How would you design an image processing pipeline that handles millions of uploads per day?", expectedKeywords: ["pipeline", "queue", "scalability", "storage"] },
  { company: "Cisco", category: "TECHNICAL", subject: "CN", prompt: "Explain the OSI model and the role of each layer.", expectedKeywords: ["osi", "layer", "network", "protocol"] },
  { company: "Cisco", category: "TECHNICAL", subject: "OS", prompt: "What is a deadlock, and what are the conditions necessary for it to occur?", expectedKeywords: ["deadlock", "mutual exclusion", "hold and wait", "circular wait"] },
  { company: "Qualcomm", category: "TECHNICAL", subject: "C", prompt: "Explain the use of volatile and const keywords in C.", expectedKeywords: ["volatile", "const", "compiler", "optimization"] },
  { company: "Qualcomm", category: "HR", prompt: "What draws you to hardware-adjacent software roles rather than pure web development?", expectedKeywords: ["hardware", "embedded", "interest", "systems"] },
  { company: "Intel", category: "TECHNICAL", subject: "OS", prompt: "Explain the difference between paging and segmentation in memory management.", expectedKeywords: ["paging", "segmentation", "memory", "fragmentation"] },
  {
    company: "Intel", category: "CODING",
    prompt: "Read a non-negative integer and print its digits reversed (drop any leading zeros in the result).",
    starterCode: javaStarter("        int n = sc.nextInt();"),
    testCases: [{ input: "12345", expected: "54321" }, { input: "100", expected: "1" }, { input: "7", expected: "7" }],
    language: "java",
  },
  { company: "NVIDIA", category: "TECHNICAL", subject: "DSA", prompt: "Explain how a min-heap works and its time complexity for insertion and extraction.", expectedKeywords: ["heap", "insertion", "extraction", "log n"] },
  { company: "NVIDIA", category: "HR", prompt: "What excites you about working on hardware-accelerated computing?", expectedKeywords: ["gpu", "parallel", "computing", "interest"] },
  { company: "JPMorgan Chase", category: "HR", prompt: "How would you approach writing software in a highly regulated environment like banking?", expectedKeywords: ["regulated", "compliance", "banking", "careful"] },
  { company: "JPMorgan Chase", category: "TECHNICAL", subject: "SQL", prompt: "How would you optimize a slow-running SQL query on a large transactions table?", expectedKeywords: ["optimize", "index", "query plan", "table"] },
  { company: "Goldman Sachs", category: "MANAGERIAL", prompt: "How would you handle disagreement with a senior stakeholder about a technical approach?", expectedKeywords: ["disagree", "stakeholder", "technical", "communicate"] },
  { company: "Goldman Sachs", category: "TECHNICAL", subject: "DSA", prompt: "How would you detect and remove a cycle in a linked list?", expectedKeywords: ["cycle", "linked list", "floyd", "two pointer"] },
];

// Real admin-linked follow-up chains — deterministic, not generated from the answer's content.
const FOLLOW_UP_CHAINS = [
  {
    parent: { category: "TECHNICAL", subject: "Java", prompt: "Explain JVM (Java Virtual Machine) and its role.", expectedKeywords: ["jvm", "bytecode", "class loader", "runtime"] },
    followUp: { category: "TECHNICAL", subject: "Java", prompt: "How does JVM differ from JRE and JDK?", expectedKeywords: ["jvm", "jre", "jdk", "runtime", "development kit"] },
  },
  {
    parent: { category: "TECHNICAL", subject: "DBMS", prompt: "What is database normalization?", expectedKeywords: ["normalization", "redundancy", "normal form"] },
    followUp: { category: "TECHNICAL", subject: "DBMS", prompt: "When would you deliberately denormalize a database, and why?", expectedKeywords: ["denormalize", "performance", "read", "trade-off"] },
  },
  {
    parent: { category: "HR", prompt: "Tell me about a challenging project you worked on.", expectedKeywords: ["challenge", "project", "overcome"] },
    followUp: { category: "HR", prompt: "What would you do differently if you faced that same challenge again?", expectedKeywords: ["differently", "learn", "improve"] },
  },
];

async function seedInterviewExtras2(prisma) {
  const newCompanies = [...new Set(COMPANY_QUESTIONS.map((q) => q.company))];
  const existing = await prisma.interviewQuestion.count({
    where: { OR: [{ category: "MANAGERIAL" }, { company: { in: newCompanies } }] },
  });
  if (existing > 0) {
    console.log("Interview Prep extras 2 (Managerial/more companies/follow-ups) already seeded, skipping.");
    return;
  }

  let count = 0;
  for (const q of MANAGERIAL_QUESTIONS) {
    await prisma.interviewQuestion.create({ data: { category: "MANAGERIAL", difficulty: "MEDIUM", prompt: q.prompt, expectedKeywords: q.expectedKeywords } });
    count++;
  }
  for (const q of COMPANY_QUESTIONS) {
    await prisma.interviewQuestion.create({
      data: {
        category: q.category, company: q.company, subject: q.subject || null,
        difficulty: q.category === "TECHNICAL" || q.category === "SYSTEM_DESIGN" || q.category === "CODING" ? "MEDIUM" : "EASY",
        prompt: q.prompt, expectedKeywords: q.expectedKeywords ?? undefined,
        starterCode: q.starterCode || null, testCases: q.testCases ?? undefined, language: q.language || null,
      },
    });
    count++;
  }
  for (const chain of FOLLOW_UP_CHAINS) {
    const followUpQ = await prisma.interviewQuestion.create({
      data: { category: chain.followUp.category, subject: chain.followUp.subject || null, difficulty: "MEDIUM", prompt: chain.followUp.prompt, expectedKeywords: chain.followUp.expectedKeywords },
    });
    await prisma.interviewQuestion.create({
      data: { category: chain.parent.category, subject: chain.parent.subject || null, difficulty: "MEDIUM", prompt: chain.parent.prompt, expectedKeywords: chain.parent.expectedKeywords, followUpQuestionId: followUpQ.id },
    });
    count += 2;
  }

  console.log(`Seeded Interview Prep extras 2: ${count} questions (${MANAGERIAL_QUESTIONS.length} Managerial, ${COMPANY_QUESTIONS.length} across ${newCompanies.length} new companies, ${FOLLOW_UP_CHAINS.length} follow-up chains).`);
}

module.exports = { seedInterviewExtras2 };

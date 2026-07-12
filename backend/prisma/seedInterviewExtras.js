// Seeds System Design + Behavioral categories and a modest company-tagged question set — added
// after the original Interview Prep seed already shipped, so this uses its OWN idempotency gate
// (seedInterview.js's gate is "skip if ANY non-generated question exists," which is already true
// in production and would silently skip these new categories forever if reused). Company banks
// cover all 12 companies named in the spec, but shallowly (1-3 real
// questions each, not a full bank per company) — same "seed a genuine smaller set, grow via the
// admin CMS" approach used everywhere else; the admin CSV import/export already built for this
// question bank is exactly the tool for deepening any individual company's bank over time.

const SYSTEM_DESIGN_QUESTIONS = [
  { prompt: "How would you design a URL shortening service like Bitly?", expectedKeywords: ["hash", "database", "unique", "redirect", "scalability"] },
  { prompt: "Explain how a load balancer works and why it's needed.", expectedKeywords: ["load balancer", "distribute", "traffic", "availability"] },
  { prompt: "What is caching, and where would you introduce it in a web application?", expectedKeywords: ["cache", "redis", "latency", "database load"] },
  { prompt: "Explain the CAP theorem and its trade-offs.", expectedKeywords: ["consistency", "availability", "partition", "trade-off"] },
  { prompt: "How would you design a rate limiter for a public API?", expectedKeywords: ["rate limit", "throttle", "token bucket", "api"] },
  { prompt: "What is database sharding, and when would you use it?", expectedKeywords: ["shard", "partition", "scale", "database"] },
  { prompt: "Compare a monolithic architecture with a microservices architecture.", expectedKeywords: ["monolith", "microservices", "coupling", "deployment"] },
  { prompt: "How does a Content Delivery Network (CDN) improve performance?", expectedKeywords: ["cdn", "edge", "latency", "cache"] },
  { prompt: "Explain the role of a message queue in a distributed system.", expectedKeywords: ["queue", "asynchronous", "decouple", "kafka"] },
  { prompt: "How would you design a basic notification system (email/SMS/push) for an app with millions of users?", expectedKeywords: ["queue", "scalability", "worker", "retry"] },
];

const BEHAVIORAL_QUESTIONS = [
  { prompt: "Describe a time you had to adapt quickly to a significant change.", expectedKeywords: ["adapt", "change", "flexible"] },
  { prompt: "Tell me about a time you took initiative without being asked.", expectedKeywords: ["initiative", "proactive", "ownership"] },
  { prompt: "Describe a situation where you had to persuade someone to see things your way.", expectedKeywords: ["persuade", "convince", "communication"] },
  { prompt: "Tell me about a time you had to manage multiple priorities under a tight deadline.", expectedKeywords: ["priorit", "deadline", "manage", "time"] },
  { prompt: "Describe a mistake you made at work or school and how you handled it.", expectedKeywords: ["mistake", "responsibility", "fix", "learned"] },
  { prompt: "Tell me about a time you had to work with someone whose working style was very different from yours.", expectedKeywords: ["different", "collaborate", "adjust"] },
  { prompt: "Describe a time you had to give someone difficult feedback.", expectedKeywords: ["feedback", "difficult", "honest", "constructive"] },
  { prompt: "Tell me about a time your work exceeded expectations.", expectedKeywords: ["exceed", "expectation", "result", "impact"] },
  { prompt: "Describe a decision you made with incomplete information.", expectedKeywords: ["incomplete", "decision", "judgment", "risk"] },
  { prompt: "Tell me about a time you had to quickly learn a new skill or tool to complete a task.", expectedKeywords: ["learn", "quickly", "new skill", "adapt"] },
];

// { company, category, subject?, prompt, expectedKeywords }
const COMPANY_QUESTIONS = [
  // TCS — heavy on HR/aptitude/fundamentals for mass campus hiring
  { company: "TCS", category: "HR", prompt: "Why do you want to join TCS specifically?", expectedKeywords: ["tcs", "opportunity", "growth", "learn"] },
  { company: "TCS", category: "TECHNICAL", subject: "OOP", prompt: "Explain the four pillars of Object-Oriented Programming with real examples.", expectedKeywords: ["encapsulation", "inheritance", "polymorphism", "abstraction"] },
  { company: "TCS", category: "TECHNICAL", subject: "DBMS", prompt: "What is normalization in DBMS, and why is it important?", expectedKeywords: ["normalization", "redundancy", "normal form"] },
  // Infosys — similar profile, communication-heavy
  { company: "Infosys", category: "HR", prompt: "How do you handle working in a team with people from different backgrounds?", expectedKeywords: ["team", "diverse", "collaborate", "respect"] },
  { company: "Infosys", category: "TECHNICAL", subject: "OS", prompt: "Explain the difference between a process and a thread.", expectedKeywords: ["process", "thread", "memory", "context switch"] },
  { company: "Infosys", category: "TECHNICAL", subject: "SQL", prompt: "Write and explain a SQL query to find the second-highest salary from an Employee table.", expectedKeywords: ["subquery", "limit", "order by", "max"] },
  // Accenture
  { company: "Accenture", category: "HR", prompt: "Describe a project where you had to deliver under a strict deadline.", expectedKeywords: ["deadline", "deliver", "prioritize"] },
  { company: "Accenture", category: "TECHNICAL", subject: "OOP", prompt: "What is the difference between method overloading and method overriding?", expectedKeywords: ["overload", "override", "polymorphism"] },
  // Wipro
  { company: "Wipro", category: "HR", prompt: "What do you know about Wipro's business, and why does it interest you?", expectedKeywords: ["wipro", "business", "interest", "research"] },
  { company: "Wipro", category: "TECHNICAL", subject: "DSA", prompt: "Explain the difference between an array and a linked list, with trade-offs.", expectedKeywords: ["array", "linked list", "memory", "insertion"] },
  // Cognizant
  { company: "Cognizant", category: "HR", prompt: "How do you stay updated with new technologies?", expectedKeywords: ["learn", "technology", "update", "course"] },
  { company: "Cognizant", category: "TECHNICAL", subject: "Java", prompt: "What is exception handling in Java, and why is it important?", expectedKeywords: ["exception", "try", "catch", "handle"] },
  // Capgemini
  { company: "Capgemini", category: "HR", prompt: "Describe your experience working on a team project — what was your specific role?", expectedKeywords: ["team", "role", "contribution"] },
  { company: "Capgemini", category: "TECHNICAL", subject: "DBMS", prompt: "What are ACID properties in a database transaction?", expectedKeywords: ["atomicity", "consistency", "isolation", "durability"] },
  // IBM
  { company: "IBM", category: "TECHNICAL", subject: "OOP", prompt: "Explain the concept of an interface versus an abstract class.", expectedKeywords: ["interface", "abstract", "implement", "extend"] },
  { company: "IBM", category: "HR", prompt: "Why are you interested in a career at IBM?", expectedKeywords: ["ibm", "career", "interest", "technology"] },
  // Deloitte
  { company: "Deloitte", category: "HR", prompt: "Describe a time you had to explain a technical concept to a non-technical person.", expectedKeywords: ["explain", "technical", "communicate", "simplify"] },
  // HCL
  { company: "HCL", category: "TECHNICAL", subject: "CN", prompt: "Explain the difference between TCP and UDP.", expectedKeywords: ["tcp", "udp", "reliable", "connectionless"] },
  // Amazon — leadership-principle-flavored behavioral + DSA-heavy
  { company: "Amazon", category: "BEHAVIORAL", prompt: "Tell me about a time you disagreed with a decision but committed to it anyway (Disagree and Commit).", expectedKeywords: ["disagree", "commit", "decision", "team"] },
  { company: "Amazon", category: "BEHAVIORAL", prompt: "Describe a time you went above and beyond for a customer.", expectedKeywords: ["customer", "above and beyond", "obsession"] },
  { company: "Amazon", category: "TECHNICAL", subject: "DSA", prompt: "How would you find whether a linked list has a cycle? Explain your approach.", expectedKeywords: ["cycle", "linked list", "two pointer", "floyd"] },
  // Microsoft — coding + system design flavored
  { company: "Microsoft", category: "TECHNICAL", subject: "DSA", prompt: "Explain how a hash map works internally, including collision handling.", expectedKeywords: ["hash", "collision", "bucket", "load factor"] },
  { company: "Microsoft", category: "SYSTEM_DESIGN", prompt: "How would you design a simplified version of OneDrive/file-sync service?", expectedKeywords: ["sync", "storage", "conflict", "versioning"] },
  // Google — DSA + system design heavy, minimal HR emphasis
  { company: "Google", category: "TECHNICAL", subject: "DSA", prompt: "Explain time and space complexity trade-offs between recursive and iterative solutions.", expectedKeywords: ["time complexity", "space complexity", "recursion", "iterative"] },
  { company: "Google", category: "SYSTEM_DESIGN", prompt: "How would you design a scalable web crawler?", expectedKeywords: ["crawler", "queue", "scalability", "duplicate"] },
];

async function seedInterviewExtras(prisma) {
  const existing = await prisma.interviewQuestion.count({
    where: { OR: [{ category: "SYSTEM_DESIGN" }, { category: "BEHAVIORAL" }, { company: { not: null } }] },
  });
  if (existing > 0) {
    console.log("Interview Prep extras (System Design/Behavioral/company) already seeded, skipping.");
    return;
  }

  let count = 0;
  for (const q of SYSTEM_DESIGN_QUESTIONS) {
    await prisma.interviewQuestion.create({ data: { category: "SYSTEM_DESIGN", difficulty: "MEDIUM", prompt: q.prompt, expectedKeywords: q.expectedKeywords } });
    count++;
  }
  for (const q of BEHAVIORAL_QUESTIONS) {
    await prisma.interviewQuestion.create({ data: { category: "BEHAVIORAL", difficulty: "EASY", prompt: q.prompt, expectedKeywords: q.expectedKeywords } });
    count++;
  }
  for (const q of COMPANY_QUESTIONS) {
    await prisma.interviewQuestion.create({
      data: {
        category: q.category, company: q.company, subject: q.subject || null,
        difficulty: q.category === "TECHNICAL" || q.category === "SYSTEM_DESIGN" ? "MEDIUM" : "EASY",
        prompt: q.prompt, expectedKeywords: q.expectedKeywords,
      },
    });
    count++;
  }

  const companyCount = new Set(COMPANY_QUESTIONS.map((q) => q.company)).size;
  console.log(`Seeded Interview Prep extras: ${count} questions (${SYSTEM_DESIGN_QUESTIONS.length} System Design, ${BEHAVIORAL_QUESTIONS.length} Behavioral, ${COMPANY_QUESTIONS.length} company-tagged across ${companyCount} companies).`);
}

module.exports = { seedInterviewExtras };

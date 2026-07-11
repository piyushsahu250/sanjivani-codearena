// Generates personalized interview questions from a student's own Resume (built in the Resume
// Builder feature) — no separate "resume_analysis" step needed since Resume.skills/projects/
// experience already IS the structured, analyzed data.

const SKILL_QUESTIONS = {
  java: ["Explain the difference between JVM, JRE, and JDK.", "What is the difference between an interface and an abstract class in Java?"],
  python: ["Explain Python's GIL and how it affects multithreading.", "What's the difference between a list and a tuple in Python?"],
  javascript: ["Explain the Virtual DOM and why it's used in libraries like React.", "What is a closure in JavaScript? Give an example."],
  react: ["Explain the Virtual DOM and how React's reconciliation works.", "What's the difference between state and props in React?"],
  sql: ["Explain the difference between INNER JOIN and LEFT JOIN.", "What is database normalization, and why does it matter?"],
  mysql: ["Explain the difference between INNER JOIN and LEFT JOIN.", "How would you optimize a slow SQL query?"],
  node: ["Explain the Node.js event loop.", "How does Node.js handle asynchronous I/O?"],
  "c++": ["Explain the difference between a pointer and a reference in C++.", "What is RAII and why is it important in C++?"],
  django: ["Explain Django's MVT architecture.", "How does Django's ORM handle database migrations?"],
  docker: ["Explain the difference between a Docker image and a container.", "How would you reduce the size of a Docker image?"],
  aws: ["Explain the difference between EC2 and Lambda.", "How would you design a highly available system on AWS?"],
  git: ["Explain the difference between `git merge` and `git rebase`.", "How would you resolve a merge conflict?"],
};

function genericSkillQuestion(skillName) {
  return `You listed ${skillName} as a skill. Explain a key concept or feature of ${skillName} and describe how you've used it in a real project.`;
}

function questionsForSkill(skillName) {
  const key = String(skillName || "").trim().toLowerCase();
  return SKILL_QUESTIONS[key] || [genericSkillQuestion(skillName)];
}

const PROJECT_QUESTION_TEMPLATES = [
  (p) => `You built "${p.title}". What was the most challenging part of building it, and how did you solve it?`,
  (p) => `Walk me through the overall architecture and design decisions behind "${p.title}".`,
  (p) => `If you rebuilt "${p.title}" today, what would you do differently?`,
];

const EXPERIENCE_QUESTION_TEMPLATE = (e) =>
  `At ${e.company || "your previous role"}, you worked as ${e.title || "a team member"}. Describe a specific contribution you made and its impact.`;

// Returns [{ prompt, expectedKeywords, category: "TECHNICAL" }] — capped at a reasonable
// interview length (~8 questions). Falls back to a prompt-to-complete-your-resume-first message
// if there's nothing usable yet.
function generateResumeQuestions(resume) {
  const questions = [];
  const skills = Array.isArray(resume?.skills) ? resume.skills : [];
  const projects = Array.isArray(resume?.projects) ? resume.projects : [];
  const experience = Array.isArray(resume?.experience) ? resume.experience : [];

  for (const s of skills.slice(0, 4)) {
    const [prompt] = questionsForSkill(s.name);
    questions.push({ prompt, expectedKeywords: [s.name], subject: s.category || "Skills" });
  }

  for (const p of projects.slice(0, 2)) {
    const template = PROJECT_QUESTION_TEMPLATES[questions.length % PROJECT_QUESTION_TEMPLATES.length];
    questions.push({ prompt: template(p), expectedKeywords: (p.technologies || "").split(",").map((t) => t.trim()).filter(Boolean), subject: "Projects" });
  }

  for (const e of experience.slice(0, 2)) {
    questions.push({ prompt: EXPERIENCE_QUESTION_TEMPLATE(e), expectedKeywords: [], subject: "Experience" });
  }

  return questions.slice(0, 8);
}

module.exports = { generateResumeQuestions };

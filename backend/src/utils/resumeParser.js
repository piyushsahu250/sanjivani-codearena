const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

// Heuristic, regex-based resume parsing — NOT a real NLP/AI model. This works well for
// single-column, text-based resumes (which is also what's ATS-recommended in the first place —
// the whole point of this feature). Multi-column layouts, graphics-heavy templates (e.g. some
// Canva designs), and legacy .doc files degrade gracefully but with lower field-extraction
// accuracy — genuinely reliable resume parsing across arbitrary layouts is a hard, actively
// researched NLP problem that real commercial parsers (Sovren, Affinda, etc.) spend years on;
// this is a good-faith heuristic pass, not a claim of universal accuracy.

async function extractTextFromFile(buffer, mimetype, filename) {
  const ext = String(filename || "").toLowerCase().split(".").pop();
  if (mimetype === "application/pdf" || ext === "pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (
    mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === "docx"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  if (ext === "doc") {
    throw new Error("Legacy .doc files aren't supported. Please save your resume as .docx or .pdf and try again.");
  }
  throw new Error("Unsupported file type. Please upload a .pdf or .docx file.");
}

// ---- Section heading recognition ----
const SECTION_SYNONYMS = {
  summary: ["professional summary", "summary", "objective", "career objective", "about me", "profile", "professional profile", "personal summary"],
  education: ["education", "academic background", "academic qualifications", "educational qualifications", "qualifications", "academics"],
  skills: ["technical skills", "skills", "core skills", "competencies", "key skills", "skill set", "technical proficiencies", "areas of expertise"],
  projects: ["projects", "academic projects", "personal projects", "key projects", "project experience", "major projects"],
  experience: ["experience", "work experience", "professional experience", "employment history", "internship experience", "internships", "work history"],
  certifications: ["certifications", "certificates", "licenses & certifications", "courses & certifications", "certifications & courses"],
  achievements: ["achievements", "awards", "awards & achievements", "honors", "accomplishments", "extracurricular", "achievements & awards"],
  languages: ["languages", "languages known", "spoken languages"],
};

function normalizeHeading(line) {
  return line.replace(/[^a-zA-Z&\s]/g, "").trim().toLowerCase();
}

function detectSectionKey(line) {
  const norm = normalizeHeading(line);
  if (!norm || norm.split(/\s+/).length > 5) return null;
  for (const [key, synonyms] of Object.entries(SECTION_SYNONYMS)) {
    if (synonyms.includes(norm)) return key;
  }
  return null;
}

// Splits the raw text into { header, summary, education, skills, ... } line arrays. Blank lines
// are preserved as `""` entries within each section's array — they're the primary signal used
// downstream to split a section into individual entries (one education/project/experience block
// per blank-line-separated group).
function segmentSections(text) {
  const rawLines = text.split(/\r?\n/).map((l) => l.trim());
  const sections = { header: [] };
  let current = "header";
  for (const line of rawLines) {
    if (line === "") {
      sections[current].push("");
      continue;
    }
    const key = detectSectionKey(line);
    if (key) {
      current = key;
      sections[key] = sections[key] || [];
      continue;
    }
    sections[current].push(line);
  }
  for (const k of Object.keys(sections)) {
    sections[k] = collapseBlankRuns(sections[k]);
  }
  return sections;
}

function collapseBlankRuns(lines) {
  const out = [];
  let lastBlank = true; // trims leading blanks
  for (const l of lines) {
    if (l === "") {
      if (!lastBlank) out.push("");
      lastBlank = true;
    } else {
      out.push(l);
      lastBlank = false;
    }
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

function splitBlocks(lines) {
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (line === "") {
      if (current.length) { blocks.push(current); current = []; }
      continue;
    }
    current.push(line);
  }
  if (current.length) blocks.push(current);
  return blocks;
}

// ---- Field-level regexes ----
const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,5}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/;
const LINKEDIN_RE = /(https?:\/\/)?(www\.)?linkedin\.com\/[a-zA-Z0-9_\-/]+/i;
const GITHUB_RE = /(https?:\/\/)?(www\.)?github\.com\/[a-zA-Z0-9_\-/]+/i;
const GENERIC_URL_RE = /(https?:\/\/)?(www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/[^\s,;]*)?/;
const MONTH = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";
const DATE_TOKEN = `(?:(?:${MONTH})[a-z]*\\.?\\s*)?\\d{4}|present|current`;
const DATE_RANGE_RE = new RegExp(`(${DATE_TOKEN})\\s*(?:[-–—]|to)\\s*(${DATE_TOKEN})`, "i");
const YEAR_RE = /\b(19|20)\d{2}\b/;

function extractPersonalDetails(headerLines, wholeText) {
  const details = { fullName: "", email: "", mobile: "", linkedin: "", github: "", portfolio: "", address: "" };

  const emailMatch = wholeText.match(EMAIL_RE);
  if (emailMatch) details.email = emailMatch[0];

  const phoneMatch = wholeText.match(PHONE_RE);
  if (phoneMatch && phoneMatch[0].replace(/\D/g, "").length >= 10) details.mobile = phoneMatch[0].trim();

  const linkedinMatch = wholeText.match(LINKEDIN_RE);
  if (linkedinMatch) details.linkedin = linkedinMatch[0];

  const githubMatch = wholeText.match(GITHUB_RE);
  if (githubMatch) details.github = githubMatch[0];

  // Portfolio: first generic URL that isn't linkedin/github/email domain
  const urlMatches = wholeText.match(new RegExp(GENERIC_URL_RE, "gi")) || [];
  for (const u of urlMatches) {
    if (/linkedin\.com|github\.com/i.test(u)) continue;
    if (details.email && u.includes(details.email.split("@")[1])) continue;
    details.portfolio = u;
    break;
  }

  // Name: first header line that looks like "First Last" (2-4 capitalized words, no digits/@/URLs)
  for (const line of headerLines) {
    if (!line || line.length > 50) continue;
    if (/[@\d]/.test(line)) continue;
    if (EMAIL_RE.test(line) || LINKEDIN_RE.test(line) || GITHUB_RE.test(line)) continue;
    const words = line.split(/\s+/);
    if (words.length >= 1 && words.length <= 4 && words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w))) {
      details.fullName = line;
      break;
    }
  }

  // Address: a header/contact-area line with a pincode or 2+ comma-separated location parts
  for (const line of headerLines) {
    if (/\d{5,6}/.test(line) && !EMAIL_RE.test(line) && !PHONE_RE.test(line.replace(/\d{5,6}/, ""))) {
      details.address = line;
      break;
    }
    if ((line.match(/,/g) || []).length >= 2 && line.length < 80 && !EMAIL_RE.test(line)) {
      details.address = line;
      break;
    }
  }

  return details;
}

const DEGREE_RE = /\b(b\.?\s?tech|b\.?\s?e\.?\b|m\.?\s?tech|m\.?\s?e\.?\b|b\.?\s?sc|m\.?\s?sc|bca|mca|bba|mba|b\.?\s?com|m\.?\s?com|ph\.?\s?d|bachelor'?s?|master'?s?|diploma|class\s?xii|class\s?x\b|hsc|ssc|10th|12th|associate'?s?\s?degree)\b/i;

function parseEducationSection(lines) {
  const entries = [];
  let current = null;
  for (const raw of lines) {
    if (raw === "") continue;
    const line = raw.replace(/^[-•*]\s*/, "").trim();
    if (DEGREE_RE.test(line)) {
      if (current) entries.push(current);
      current = { degree: "", specialization: "", institution: "", board: "", startYear: "", endYear: "", score: "", status: "Completed" };
      const degMatch = line.match(DEGREE_RE);
      current.degree = degMatch[0].toUpperCase().replace(/\s+/g, " ");
      const rest = line.replace(DEGREE_RE, "").replace(/^[\s,\-–]+/, "");
      if (rest) current.specialization = rest.split(/[,–\-|]/)[0].trim();
    }
    if (!current) continue;
    const yearRange = line.match(/\b(19|20)\d{2}\b\s*[-–]\s*(present|current|\b(19|20)\d{2}\b)/i);
    if (yearRange) {
      const years = line.match(/\b(19|20)\d{2}\b/g) || [];
      current.startYear = years[0] || "";
      current.endYear = /present|current/i.test(yearRange[0]) ? "" : years[1] || "";
      if (/present|current/i.test(yearRange[0])) current.status = "Pursuing";
      continue;
    }
    const scoreMatch = line.match(/\b(cgpa|gpa)\b\s*[:\-]?\s*(\d+(\.\d+)?)|(\d+(\.\d+)?)\s*%|\b(\d+(\.\d+)?)\s*(cgpa|gpa)\b/i);
    if (scoreMatch) {
      current.score = scoreMatch[0].trim();
      continue;
    }
    if (!current.institution && !DEGREE_RE.test(line)) {
      current.institution = line.split(/[,–\-|]/)[0].trim();
    }
  }
  if (current) entries.push(current);
  return entries;
}

const SKILL_CATEGORIES = {
  "Programming Languages": ["java", "python", "c++", "c#", "javascript", "typescript", "golang", "go", "ruby", "php", "kotlin", "swift", "rust", "scala", "r", "matlab", "dart", "c"],
  "Frameworks": ["react", "react.js", "angular", "vue", "vue.js", "spring", "spring boot", "django", "flask", "express", "express.js", "node.js", "node", "next.js", "laravel", ".net", "asp.net", "bootstrap", "tailwind", "tailwindcss", "jquery", "hibernate", "fastapi"],
  "Databases": ["mysql", "postgresql", "postgres", "mongodb", "sqlite", "oracle", "redis", "cassandra", "dynamodb", "firebase", "mssql", "sql server", "sql"],
  "Cloud": ["aws", "azure", "gcp", "google cloud", "heroku", "vercel", "netlify", "docker", "kubernetes", "terraform", "jenkins", "ci/cd"],
  "Tools": ["git", "github", "gitlab", "postman", "jira", "figma", "vs code", "intellij", "eclipse", "linux", "bash", "webpack", "npm", "maven", "gradle", "excel"],
  "Soft Skills": ["communication", "teamwork", "leadership", "problem solving", "problem-solving", "time management", "adaptability", "collaboration", "critical thinking", "public speaking"],
};

function categorizeSkill(name) {
  const lower = name.toLowerCase().trim();
  for (const [category, list] of Object.entries(SKILL_CATEGORIES)) {
    if (list.includes(lower)) return category;
  }
  return "Other";
}

function parseSkillsSection(lines) {
  const text = lines.join(", ");
  const raw = text.split(/[,•|;\/]|(?:\s{2,})/).map((s) => s.trim()).filter(Boolean);
  const seen = new Set();
  const skills = [];
  for (const token of raw) {
    const cleaned = token.replace(/^[-*]\s*/, "").replace(/\.$/, "").trim();
    if (cleaned.length < 2 || cleaned.length > 30) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    skills.push({ category: categorizeSkill(cleaned), name: cleaned, proficiency: "" });
  }
  return skills;
}

function parseProjectBlock(lines) {
  const p = { title: "", description: "", technologies: "", role: "", duration: "", githubUrl: "", liveUrl: "" };
  const descLines = [];
  let titleSet = false;
  for (const raw of lines) {
    const isBullet = /^[-•*]/.test(raw);
    const line = raw.replace(/^[-•*]\s*/, "").trim();
    const githubMatch = line.match(GITHUB_RE);
    const techMatch = line.match(/^(tech(nologies)?( used)?|tools|stack)\s*[:\-]\s*(.+)/i);
    const dateMatch = line.match(DATE_RANGE_RE);
    if (!titleSet && !isBullet && line.length < 80 && !githubMatch && !techMatch) {
      p.title = line;
      titleSet = true;
      continue;
    }
    if (githubMatch) { p.githubUrl = githubMatch[0]; continue; }
    if (techMatch) { p.technologies = techMatch[4]; continue; }
    if (dateMatch && !p.duration) { p.duration = dateMatch[0]; continue; }
    const liveMatch = line.match(GENERIC_URL_RE);
    if (liveMatch && !GITHUB_RE.test(line) && !p.liveUrl) { p.liveUrl = liveMatch[0]; continue; }
    descLines.push(line);
  }
  p.description = descLines.join(" ").trim();
  return p;
}

function parseExperienceBlock(lines) {
  const e = { company: "", title: "", employmentType: "Internship", startDate: "", endDate: "", responsibilities: "", technologies: "" };
  const descLines = [];
  let headerSet = false;
  for (const raw of lines) {
    const isBullet = /^[-•*]/.test(raw);
    const line = raw.replace(/^[-•*]\s*/, "").trim();
    const techMatch = line.match(/^(tech(nologies)?( used)?|tools|stack)\s*[:\-]\s*(.+)/i);
    const dateMatch = line.match(DATE_RANGE_RE);
    if (!headerSet && !isBullet && line.length < 100 && !techMatch) {
      const sep = line.split(/\s[—\-|]\s|\sat\s/i);
      if (sep.length >= 2) {
        e.title = sep[0].trim();
        e.company = sep.slice(1).join(" ").trim();
      } else {
        e.title = line;
      }
      headerSet = true;
      continue;
    }
    if (techMatch) { e.technologies = techMatch[4]; continue; }
    if (dateMatch) {
      const parts = dateMatch[0].split(/[-–—]|(?:\bto\b)/i).map((s) => s.trim()).filter(Boolean);
      e.startDate = parts[0] || "";
      e.endDate = parts[1] || "";
      continue;
    }
    descLines.push(line);
  }
  e.responsibilities = descLines.join(" ").trim();
  return e;
}

function parseCertBlock(lines) {
  let rest = lines.map((l) => l.replace(/^[-•*]\s*/, "")).join(" ").trim();
  const c = { name: "", org: "", issueDate: "", credentialId: "", credentialUrl: "" };
  const urlMatch = rest.match(GENERIC_URL_RE);
  if (urlMatch) { c.credentialUrl = urlMatch[0]; rest = rest.replace(urlMatch[0], "").trim(); }
  const idMatch = rest.match(/(credential\s*id|cert(ificate)?\s*id|id)\s*[:\-]\s*([\w-]+)/i);
  if (idMatch) { c.credentialId = idMatch[3]; rest = rest.replace(idMatch[0], "").trim(); }
  const dateMatch = rest.match(DATE_RANGE_RE) || rest.match(YEAR_RE);
  if (dateMatch) { c.issueDate = dateMatch[0]; rest = rest.replace(dateMatch[0], "").trim(); }
  const parts = rest.split(/\s[—\-|]\s|,\s*/).map((s) => s.trim()).filter(Boolean);
  c.name = (parts[0] || "").replace(/[,\-–|]+$/, "").trim();
  c.org = (parts[1] || "").replace(/^\(|\)$/g, "").replace(/[,\-–|()]+$/, "").trim();
  return c;
}

function categorizeAchievement(text) {
  const lower = text.toLowerCase();
  if (/hackathon/.test(lower)) return "Hackathon";
  if (/scholarship/.test(lower)) return "Scholarship";
  if (/publish|paper|journal|conference/.test(lower)) return "Academic";
  if (/rank|position|place|winner|runner.?up/.test(lower)) return "Contest Ranking";
  if (/open.?source|contributor/.test(lower)) return "Open Source";
  return "Award";
}

function parseAchievements(lines) {
  return lines
    .filter((l) => l !== "")
    .map((raw) => raw.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean)
    .map((text) => ({ category: categorizeAchievement(text), text }));
}

function parseLanguages(lines) {
  const text = lines.join(", ");
  const tokens = text.split(/[,•|;]/).map((s) => s.trim()).filter(Boolean);
  return tokens.map((token) => {
    const m = token.match(/^(.+?)\s*[\(\-]\s*(native|fluent|advanced|intermediate|beginner|basic|proficient)\)?/i);
    if (m) {
      const prof = m[2].toLowerCase();
      const mapped = /native/.test(prof) ? "Native" : /fluent|proficient|advanced/.test(prof) ? "Fluent" : /intermediate/.test(prof) ? "Intermediate" : "Beginner";
      return { name: m[1].trim(), proficiency: mapped };
    }
    return { name: token, proficiency: "Intermediate" };
  }).filter((l) => l.name);
}

// Main entry point. Returns a partial Resume-shaped object — every field matches the exact
// shape the existing Resume model / ResumeBuilder editor already expects, so parsed output can
// be saved and edited with zero translation layer.
async function parseResumeFile(buffer, mimetype, filename) {
  const text = await extractTextFromFile(buffer, mimetype, filename);
  if (!text || text.trim().length < 30) {
    throw new Error("Couldn't extract readable text from this file — it may be a scanned image rather than a text-based document.");
  }

  const sections = segmentSections(text);
  const personal = extractPersonalDetails(sections.header || [], text);

  const summaryLines = sections.summary || [];
  const summary = summaryLines.filter((l) => l !== "").join(" ").trim();

  const education = parseEducationSection(sections.education || []);
  const skills = parseSkillsSection(sections.skills || []);
  const projects = splitBlocks(sections.projects || []).map(parseProjectBlock).filter((p) => p.title || p.description);
  const experience = splitBlocks(sections.experience || []).map(parseExperienceBlock).filter((e) => e.title || e.responsibilities);
  const certifications = splitBlocks(sections.certifications || []).map(parseCertBlock).filter((c) => c.name);
  const achievements = parseAchievements(sections.achievements || []);
  const languages = parseLanguages(sections.languages || []);

  return {
    ...personal,
    summary,
    education,
    skills,
    projects,
    experience,
    certifications,
    achievements,
    languages,
  };
}

module.exports = { parseResumeFile, extractTextFromFile };

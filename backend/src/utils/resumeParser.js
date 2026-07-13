const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");

// Heuristic, regex-based resume parsing — NOT a real NLP/AI model. This works well for
// single-column, text-based resumes (which is also what's ATS-recommended in the first place —
// the whole point of this feature). Multi-column layouts, graphics-heavy templates (e.g. some
// Canva designs), LaTeX/Overleaf PDFs (which can lose inter-word spaces entirely in the
// underlying text layer — a known pdf-parse limitation this can't fully correct for), and legacy
// .doc files degrade gracefully but with lower field-extraction accuracy — genuinely reliable
// resume parsing across arbitrary layouts is a hard, actively researched NLP problem that real
// commercial parsers (Sovren, Affinda, etc.) spend years on; this is a good-faith heuristic pass,
// not a claim of universal accuracy. Every extraction ships with a per-section confidence score
// (see computeConfidence) precisely so students know which fields to double-check rather than
// trusting a false sense of completeness.

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
// are preserved as `""` entries within each section's array — when present, they're the most
// reliable signal for splitting a section into individual entries. But many PDF exports (Canva,
// Overleaf, some Word "Save as PDF" paths) simply don't preserve blank lines as blank lines in
// the extracted text layer, which is why entry-splitting below never relies on them exclusively.
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
const BULLET_RE = /^[•\-*▪‣●○◦]\s*/;
const TECH_LINE_RE = /^(tech(nologies)?( used)?|tools|stack)\s*[:\-]\s*(.+)/i;

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

  // Name: the first header line that looks like a person's name (2-4 capitalized words, no
  // digits/@/URLs). Some templates split the name across two lines ("John" / "Doe") or render
  // it fully upper-case ("JOHN DOE") — both are handled below.
  for (let i = 0; i < headerLines.length; i++) {
    const line = headerLines[i];
    if (!line || line.length > 50) continue;
    if (/[@\d]/.test(line)) continue;
    if (EMAIL_RE.test(line) || LINKEDIN_RE.test(line) || GITHUB_RE.test(line)) continue;
    const words = line.split(/\s+/);
    const looksLikeName =
      words.length >= 1 && words.length <= 4 &&
      words.every((w) => /^[A-Z][a-zA-Z.'-]*$/.test(w) || /^[A-Z]+$/.test(w));
    if (looksLikeName) {
      // All-caps single word followed by another all-caps word on the very next line is likely
      // a first-name/last-name split across two lines (some templates center-align each part).
      const next = headerLines[i + 1];
      if (words.length === 1 && next && /^[A-Z][a-zA-Z.'-]*$/.test(next) && next.length < 25) {
        details.fullName = `${toTitleCase(line)} ${toTitleCase(next)}`;
      } else {
        details.fullName = words.length === 1 && /^[A-Z]+$/.test(line) ? toTitleCase(line) : line;
      }
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

function toTitleCase(word) {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

const DEGREE_RE = /\b(b\.?\s?tech|b\.?\s?e\.?\b|m\.?\s?tech|m\.?\s?e\.?\b|b\.?\s?sc|m\.?\s?sc|bca|mca|bba|mba|b\.?\s?com|m\.?\s?com|ph\.?\s?d|bachelor'?s?|master'?s?|diploma|class\s?xii|class\s?x\b|hsc|ssc|10th|12th|associate'?s?\s?degree)\b/i;

function parseEducationSection(lines) {
  const entries = [];
  let current = null;
  for (const raw of lines) {
    if (raw === "") continue;
    const line = raw.replace(BULLET_RE, "").trim();
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
  "Frameworks": ["react", "react.js", "angular", "vue", "vue.js", "spring", "spring boot", "django", "flask", "express", "express.js", "node.js", "node", "next.js", "laravel", ".net", "asp.net", "bootstrap", "tailwind", "tailwindcss", "hibernate", "fastapi"],
  "Databases": ["mysql", "postgresql", "postgres", "mongodb", "sqlite", "oracle", "redis", "cassandra", "dynamodb", "firebase", "mssql", "sql server", "sql"],
  "Cloud": ["aws", "azure", "gcp", "google cloud", "google cloud platform", "heroku", "vercel", "netlify", "aws lambda", "amazon web services"],
  "DevOps": ["docker", "kubernetes", "terraform", "jenkins", "ci/cd", "ansible", "github actions", "gitlab ci", "circleci"],
  "Tools": ["git", "github", "gitlab", "postman", "jira", "figma", "vs code", "intellij", "eclipse", "linux", "bash", "webpack", "npm", "maven", "gradle", "excel"],
  "Libraries": ["jquery", "numpy", "pandas", "matplotlib", "scikit-learn", "sklearn", "tensorflow", "pytorch", "keras", "opencv", "seaborn", "redux", "axios", "lodash", "plotly"],
  "Soft Skills": ["communication", "teamwork", "leadership", "problem solving", "problem-solving", "time management", "adaptability", "collaboration", "critical thinking", "public speaking"],
};

// Spoken languages are cross-checked out of the Skills section when a resume lists them there
// instead of (or in addition to) a dedicated Languages section — e.g. "Skills: Java, Python,
// English, Hindi" — so "English"/"Hindi" don't end up miscategorized as "Other" technical skills.
const SPOKEN_LANGUAGES = [
  "english", "hindi", "marathi", "tamil", "telugu", "kannada", "malayalam", "gujarati", "bengali",
  "punjabi", "urdu", "odia", "assamese", "french", "german", "spanish", "mandarin", "chinese",
  "japanese", "russian", "arabic", "portuguese", "italian", "korean",
];

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
  const spokenLanguages = [];
  for (const token of raw) {
    const cleaned = token.replace(BULLET_RE, "").replace(/\.$/, "").trim();
    if (cleaned.length < 2 || cleaned.length > 30) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (SPOKEN_LANGUAGES.includes(key)) {
      spokenLanguages.push({ name: toTitleCase(cleaned), proficiency: "Intermediate" });
      continue;
    }
    skills.push({ category: categorizeSkill(cleaned), name: cleaned, proficiency: "" });
  }
  return { skills, spokenLanguages };
}

// ---- Multi-entry splitting for Projects/Experience (the main accuracy fix) ----
//
// Blank-line separation between entries is the most reliable signal when present, but many PDF
// exports don't preserve it — so when a section reduces to a single block via blank lines, this
// structural fallback splits it using three signals instead: (1) an explicit ordinal header like
// "Project 2" or "Internship 1", (2) a plain (non-bulleted) line appearing right after we've
// already started collecting body content (bullets/description/tech) for the current entry —
// the classic "Title" -> bullets -> next "Title" pattern — and (3) never anything mid-entry, so
// a resume with genuinely one very long entry isn't incorrectly fragmented.
const ORDINAL_HEADER_RE = /^(project|experience|internship|work\s*experience|company)\s*[#:\-]?\s*\d+\b\s*[:\-]?\s*$/i;

function splitStructuralEntries(lines) {
  const nonEmpty = lines.filter((l) => l !== "");
  if (nonEmpty.length === 0) return [];

  const entries = [];
  let current = null;
  let sawBodyContent = false;

  for (const raw of nonEmpty) {
    const isOrdinal = ORDINAL_HEADER_RE.test(raw);
    const isBullet = BULLET_RE.test(raw);
    const isTechLine = TECH_LINE_RE.test(raw);

    if (isOrdinal) {
      // The ordinal line itself ("Project 2") is a label, not content — start a fresh entry and
      // don't push the label line into it.
      if (current && current.length) entries.push(current);
      current = [];
      sawBodyContent = false;
      continue;
    }

    const startsNewEntry = current && current.length > 0 && !isBullet && sawBodyContent;
    if (startsNewEntry) {
      entries.push(current);
      current = [];
      sawBodyContent = false;
    }
    if (!current) current = [];
    current.push(raw);

    if (isBullet || isTechLine) sawBodyContent = true;
    else if (current.length > 1) sawBodyContent = true; // a second plain line is body/description too
  }
  if (current && current.length) entries.push(current);
  return entries;
}

// Blank-line splitting first (trusted when it actually finds more than one block); structural
// splitting only as a fallback when the whole section collapsed into a single undivided block.
function splitEntries(lines) {
  const blankBased = splitBlocks(lines);
  if (blankBased.length > 1) return blankBased;
  const structural = splitStructuralEntries(lines);
  return structural.length > 0 ? structural : blankBased;
}

// Certifications are usually one per line (or one short multi-line block per cert). A
// "continuation" line — a date, a bare URL, an "Issued by ..." clause, a parenthetical, or a
// line starting lowercase — is folded into the current entry; anything else starts a new one.
function isCertContinuationLine(line) {
  if (/^\(/.test(line)) return true;
  if (/^(issued by|issuer|org(anization)?)\s*[:\-]/i.test(line)) return true;
  if (DATE_RANGE_RE.test(line) && line.replace(DATE_RANGE_RE, "").trim().length < 5) return true;
  if (YEAR_RE.test(line) && line.trim().length < 15) return true;
  const urlMatch = line.match(GENERIC_URL_RE);
  if (urlMatch && line.trim().length < 60 && line.replace(urlMatch[0], "").trim().split(/\s+/).filter((w) => w.length > 3).length === 0) return true;
  if (/^[a-z]/.test(line)) return true;
  return false;
}

function splitCertEntries(lines) {
  const blankBased = splitBlocks(lines);
  if (blankBased.length > 1) return blankBased;
  const nonEmpty = lines.filter((l) => l !== "");
  const entries = [];
  let current = [];
  for (const line of nonEmpty) {
    if (current.length > 0 && !isCertContinuationLine(line)) {
      entries.push(current);
      current = [];
    }
    current.push(line);
  }
  if (current.length) entries.push(current);
  return entries;
}

function parseProjectBlock(lines) {
  const p = { title: "", description: "", technologies: "", role: "", duration: "", githubUrl: "", liveUrl: "" };
  const descLines = [];
  let titleSet = false;
  for (const raw of lines) {
    const isBullet = BULLET_RE.test(raw);
    const line = raw.replace(BULLET_RE, "").trim();
    const githubMatch = line.match(GITHUB_RE);
    const techMatch = line.match(TECH_LINE_RE);
    const dateMatch = line.match(DATE_RANGE_RE);
    if (!titleSet && !isBullet && line.length < 80 && !githubMatch && !techMatch && !dateMatch) {
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
  // Every line was bulleted (no plain title line found, e.g. "Project 2" ordinal header with
  // every real line under it bulleted) — fall back to the first collected line as the title.
  if (!titleSet && descLines.length > 0) {
    p.title = descLines.shift();
  }
  // A short bare comma-separated word list with no "Tech:" prefix ("Java, Spring Boot, MySQL")
  // is almost always the tech stack, not a prose description — reclassify it.
  if (!p.technologies && descLines.length === 1 && /^[\w+#.() ]+(,\s*[\w+#.() ]+){1,7}$/.test(descLines[0]) && descLines[0].length < 100) {
    p.technologies = descLines.shift();
  }
  p.description = descLines.join(" ").trim();
  return p;
}

function parseExperienceBlock(lines) {
  const e = { company: "", title: "", employmentType: "Internship", startDate: "", endDate: "", responsibilities: "", technologies: "" };
  const descLines = [];
  let headerSet = false;
  for (const raw of lines) {
    const isBullet = BULLET_RE.test(raw);
    const line = raw.replace(BULLET_RE, "").trim();
    const techMatch = line.match(TECH_LINE_RE);
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
  if (!headerSet && descLines.length > 0) {
    e.title = descLines.shift();
  }
  e.responsibilities = descLines.join(" ").trim();
  return e;
}

function parseCertBlock(lines) {
  let rest = lines.map((l) => l.replace(BULLET_RE, "")).join(" ").trim();
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
    .map((raw) => raw.replace(BULLET_RE, "").trim())
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

// ---- Confidence scoring (spec: per-section confidence, highlight only uncertain fields) ----
// A section that genuinely had no content in the source resume scores `null` ("not applicable")
// rather than 0 — only sections that had raw content but still extracted poorly (or not at all)
// count as "low confidence, please review."
function hadRawContent(rawLines) {
  return Array.isArray(rawLines) && rawLines.some((l) => l !== "");
}

function entryConfidence(entries, rawLines, scoreFn) {
  if (!entries || entries.length === 0) return hadRawContent(rawLines) ? 0 : null;
  const total = entries.reduce((s, e) => s + scoreFn(e), 0);
  return Math.round(total / entries.length);
}

function computeConfidence(parsed, sections) {
  let personalPts = 0;
  if (parsed.fullName) personalPts++;
  if (parsed.email) personalPts++;
  if (parsed.mobile) personalPts++;
  if (parsed.linkedin || parsed.github) personalPts++;
  if (parsed.address) personalPts++;
  const personal = Math.round((personalPts / 5) * 100);

  const summary = parsed.summary && parsed.summary.length >= 40 ? 95 : parsed.summary ? 55 : hadRawContent(sections.summary) ? 0 : null;

  const education = entryConfidence(parsed.education, sections.education, (e) => {
    let pts = 0;
    if (e.degree) pts++;
    if (e.institution) pts++;
    if (e.startYear || e.endYear) pts++;
    if (e.score) pts++;
    return (pts / 4) * 100;
  });

  let skills;
  if (!parsed.skills || parsed.skills.length === 0) skills = hadRawContent(sections.skills) ? 0 : null;
  else {
    const categorized = parsed.skills.filter((s) => s.category !== "Other").length;
    skills = Math.round((categorized / parsed.skills.length) * 70 + 30);
  }

  const projects = entryConfidence(parsed.projects, sections.projects, (p) => {
    let pts = 0;
    if (p.title) pts++;
    if (p.description) pts++;
    if (p.technologies || p.githubUrl || p.liveUrl) pts++;
    return (pts / 3) * 100;
  });

  const experience = entryConfidence(parsed.experience, sections.experience, (e) => {
    let pts = 0;
    if (e.title) pts++;
    if (e.company) pts++;
    if (e.responsibilities) pts++;
    return (pts / 3) * 100;
  });

  const certifications = entryConfidence(parsed.certifications, sections.certifications, (c) => (c.name ? (c.org ? 100 : 65) : 0));

  const scores = { personal, summary, education, skills, projects, experience, certifications };
  const lowConfidenceFields = Object.entries(scores).filter(([, v]) => v !== null && v < 70).map(([k]) => k);
  return { scores, lowConfidenceFields };
}

// Main entry point. Returns a partial Resume-shaped object — every field matches the exact
// shape the existing Resume model / ResumeBuilder editor already expects, so parsed output can
// be saved and edited with zero translation layer — plus a `confidence` block the frontend uses
// to highlight exactly which sections need a manual review pass, instead of implying the whole
// resume is equally reliable.
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
  const { skills, spokenLanguages } = parseSkillsSection(sections.skills || []);
  const projects = splitEntries(sections.projects || []).map(parseProjectBlock).filter((p) => p.title || p.description);
  const experience = splitEntries(sections.experience || []).map(parseExperienceBlock).filter((e) => e.title || e.responsibilities);
  const certifications = splitCertEntries(sections.certifications || []).map(parseCertBlock).filter((c) => c.name);
  const achievements = parseAchievements(sections.achievements || []);

  // Merge spoken languages found inside the Skills section with a dedicated Languages section,
  // if both exist — de-duped by name so a language mentioned in both places isn't doubled.
  const fromLanguageSection = parseLanguages(sections.languages || []);
  const seenLangNames = new Set(fromLanguageSection.map((l) => l.name.toLowerCase()));
  const languages = [...fromLanguageSection, ...spokenLanguages.filter((l) => !seenLangNames.has(l.name.toLowerCase()))];

  const parsed = { ...personal, summary, education, skills, projects, experience, certifications, achievements, languages };
  const confidence = computeConfidence(parsed, sections);

  // Raw extracted text, capped to a sane size — used only for the frontend's "original vs
  // parsed" side-by-side review view. Never persisted (no original file is stored either), just
  // passed through this one response so students can sanity-check the parse against the source.
  const rawText = text.trim().slice(0, 20000);

  return { ...parsed, confidence: confidence.scores, lowConfidenceFields: confidence.lowConfidenceFields, rawText };
}

module.exports = { parseResumeFile, extractTextFromFile };

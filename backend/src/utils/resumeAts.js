// Rule-based (not AI) resume completeness + ATS scoring. The spec's "Future Enhancements"
// section explicitly lists AI-generated summaries/rewrites as future work, which confirms this
// pass is meant to be a deterministic heuristic checker, not an LLM call — same spirit as the
// judge's exact-match grading elsewhere on this platform: transparent, reproducible, free.

function arr(x) {
  return Array.isArray(x) ? x : [];
}

const SECTION_DEFS = [
  { key: "personal", label: "Personal Details", check: (r) => !!(r.fullName && r.email && r.mobile) },
  { key: "summary", label: "Professional Summary", check: (r) => !!(r.summary && r.summary.trim().length >= 20) },
  { key: "education", label: "Education", check: (r) => arr(r.education).length > 0 },
  { key: "skills", label: "Skills", check: (r) => arr(r.skills).length > 0 },
  { key: "projects", label: "Projects", check: (r) => arr(r.projects).length > 0 },
  { key: "experience", label: "Experience", check: (r) => arr(r.experience).length > 0 },
  { key: "certifications", label: "Certifications", check: (r) => arr(r.certifications).length > 0 },
  { key: "achievements", label: "Achievements", check: (r) => arr(r.achievements).length > 0 },
  { key: "languages", label: "Languages", check: (r) => arr(r.languages).length > 0 },
];

// Completion counts every section (not just mandatory ones) toward the progress bar, but also
// separately flags which currently-empty sections are on the admin-configured mandatory list —
// the frontend can badge those more urgently than optional gaps.
function computeCompletion(resume, mandatorySections = []) {
  const results = SECTION_DEFS.map((s) => ({ key: s.key, label: s.label, complete: s.check(resume) }));
  const percent = Math.round((results.filter((r) => r.complete).length / results.length) * 100);
  const missingSections = results.filter((r) => !r.complete).map((r) => r.label);
  const missingMandatory = results.filter((r) => !r.complete && mandatorySections.includes(r.key)).map((r) => r.label);
  return { percent, missingSections, missingMandatory };
}

const KEYWORDS = [
  "java", "python", "c++", "javascript", "typescript", "sql", "git", "github", "api", "rest",
  "microservices", "data structures", "algorithms", "oop", "object-oriented", "agile", "scrum",
  "docker", "kubernetes", "aws", "azure", "cloud", "ci/cd", "testing", "unit test", "react",
  "node", "spring", "django", "database", "mongodb", "mysql", "postgresql", "machine learning",
  "linux", "html", "css",
];

function collectSearchableText(resume) {
  const parts = [resume.summary || ""];
  for (const s of arr(resume.skills)) parts.push(s.name || "");
  for (const p of arr(resume.projects)) parts.push(p.description || "", p.technologies || "");
  for (const e of arr(resume.experience)) parts.push(e.responsibilities || "", e.technologies || "");
  return parts.join(" ").toLowerCase();
}

function computeAtsScore(resume) {
  const text = collectSearchableText(resume);
  const matchedKeywords = KEYWORDS.filter((k) => text.includes(k));

  const contactScore = (() => {
    let s = resume.email && resume.mobile ? 6 : resume.email || resume.mobile ? 3 : 0;
    if (resume.linkedin) s += 2;
    if (resume.github || resume.portfolio) s += 2;
    return Math.min(s, 10);
  })();

  const summaryLen = (resume.summary || "").trim().length;
  const summaryScore = summaryLen >= 40 ? 10 : summaryLen >= 15 ? 5 : 0;

  const skillsCount = arr(resume.skills).length;
  const skillsScore = Math.round((Math.min(skillsCount, 8) / 8) * 10);

  const educationOk = arr(resume.education).some((e) => e.degree && e.institution);
  const educationScore = educationOk ? 10 : arr(resume.education).length > 0 ? 5 : 0;

  const projects = arr(resume.projects);
  const projectsScore = Math.min(projects.length, 3) * 4 + (projects.some((p) => p.githubUrl || p.liveUrl) ? 3 : 0);

  const experienceCount = arr(resume.experience).length;
  const experienceScore = Math.min(experienceCount, 2) * 5;

  const certCount = arr(resume.certifications).length;
  const certScore = Math.round((Math.min(certCount, 3) / 3) * 10);

  const keywordScore = Math.round((Math.min(matchedKeywords.length, 10) / 10) * 15);

  const { percent: completionPercent } = computeCompletion(resume, []);
  const formattingScore = Math.round((completionPercent / 100) * 10);

  const breakdown = {
    contact: contactScore, summary: summaryScore, skills: skillsScore, education: educationScore,
    projects: Math.min(projectsScore, 15), experience: experienceScore, certifications: certScore,
    keywords: keywordScore, formatting: formattingScore,
  };
  const score = Math.min(100, Object.values(breakdown).reduce((a, b) => a + b, 0));

  const status = score >= 90 ? "Excellent" : score >= 75 ? "Good" : score >= 60 ? "Fair" : "Needs Improvement";

  const suggestions = [];
  if (breakdown.contact < 10) suggestions.push("Add your LinkedIn and GitHub/portfolio links for stronger contact information.");
  if (breakdown.summary < 10) suggestions.push("Improve the professional summary — aim for 2-3 sentences highlighting your strengths and goals.");
  if (breakdown.skills < 7) suggestions.push("Add more technical skills relevant to software engineering roles.");
  if (breakdown.education < 10) suggestions.push("Complete your education details (degree, institution, and graduation year).");
  if (breakdown.projects < 10) suggestions.push("Add more projects with GitHub/portfolio links to showcase your work.");
  if (experienceCount === 0) suggestions.push("Add internship, freelance, or research project experience if available — even short-term roles count.");
  if (certCount === 0) suggestions.push("Add certifications to strengthen your credentials.");
  if (matchedKeywords.length < 8) suggestions.push("Include more industry-relevant keywords (e.g. Data Structures, REST APIs, Git, Cloud, Testing).");
  if (breakdown.formatting < 10) suggestions.push("Complete all resume sections for better formatting and organization.");
  suggestions.push("Quantify your achievements and experience with numbers where possible (e.g. \"improved load time by 30%\").");
  suggestions.push("Use strong action verbs (built, designed, implemented, optimized) in project and experience descriptions.");

  return { score, status, breakdown, matchedKeywords, suggestions: suggestions.slice(0, 10) };
}

module.exports = { SECTION_DEFS, computeCompletion, computeAtsScore };

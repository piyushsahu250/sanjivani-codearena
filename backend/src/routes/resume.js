const express = require("express");
const prisma = require("../prisma");
const { authenticate, requireRole } = require("../middleware/auth");
const { attachRequesterInstitute } = require("../middleware/institute");
const { computeCompletion, computeAtsScore } = require("../utils/resumeAts");
const { generateResumePdf } = require("../utils/resumePdf");
const { buildAutofillData } = require("../utils/resumeAutofill");

const router = express.Router();

const ALLOWED_FIELDS = [
  "template", "fullName", "photoUrl", "email", "mobile", "linkedin", "github", "portfolio", "address", "summary",
  "education", "skills", "projects", "experience", "certifications", "achievements", "languages",
];
const DEFAULT_MANDATORY = ["personal", "summary", "education", "skills", "projects", "certifications"];

async function getFieldConfig() {
  let config = await prisma.resumeFieldConfig.findUnique({ where: { id: "default" } });
  if (!config) {
    config = await prisma.resumeFieldConfig.create({ data: { id: "default", mandatorySections: DEFAULT_MANDATORY } });
  }
  return config;
}

function pdfFilename(resume) {
  return `${(resume.fullName || "resume").replace(/[^a-z0-9]+/gi, "-")}-resume.pdf`;
}

// =========================== Student-facing ===========================

// STUDENT: fetch (auto-creating an empty draft on first call) their own resume, plus computed
// completion status and any admin feedback notes left on it.
router.get("/me", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    let resume = await prisma.resume.findUnique({ where: { studentId: req.user.id } });
    if (!resume) {
      resume = await prisma.resume.create({ data: { studentId: req.user.id } });
    }
    const config = await getFieldConfig();
    const feedback = await prisma.resumeFeedback.findMany({ where: { studentId: req.user.id }, orderBy: { createdAt: "desc" }, take: 20 });
    res.json({ resume, completion: computeCompletion(resume, config.mandatorySections), feedback });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load resume" });
  }
});

// STUDENT: save any subset of resume fields (personal details, template choice, or a whole
// section array). The frontend sends only what changed; whole-array sections are replaced
// wholesale (add/edit/delete within a section all happen client-side, then the full array is
// saved), matching "save the whole resume as one draft" rather than per-item CRUD endpoints.
router.patch("/me", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const data = {};
    for (const f of ALLOWED_FIELDS) if (req.body[f] !== undefined) data[f] = req.body[f];

    const resume = await prisma.resume.upsert({
      where: { studentId: req.user.id },
      update: data,
      create: { studentId: req.user.id, ...data },
    });
    const config = await getFieldConfig();
    res.json({ resume, completion: computeCompletion(resume, config.mandatorySections) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save resume" });
  }
});

// STUDENT: fill in whichever fields/sections are still empty using platform data (profile,
// class/institute, solved-language skills, course certificates, gamification badges). Never
// overwrites something the student has already filled in themselves.
router.post("/me/autofill", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const auto = await buildAutofillData(req.user.id);
    if (!auto) return res.status(404).json({ error: "Student not found" });
    const existing = await prisma.resume.findUnique({ where: { studentId: req.user.id } });

    const data = {};
    if (!existing?.fullName && auto.fullName) data.fullName = auto.fullName;
    if (!existing?.email && auto.email) data.email = auto.email;
    if (!existing?.mobile && auto.mobile) data.mobile = auto.mobile;
    if ((!existing?.education || existing.education.length === 0) && auto.education.length) data.education = auto.education;
    if ((!existing?.skills || existing.skills.length === 0) && auto.skills.length) data.skills = auto.skills;
    if ((!existing?.certifications || existing.certifications.length === 0) && auto.certifications.length) data.certifications = auto.certifications;
    if ((!existing?.achievements || existing.achievements.length === 0) && auto.achievements.length) data.achievements = auto.achievements;

    const resume = await prisma.resume.upsert({
      where: { studentId: req.user.id },
      update: data,
      create: { studentId: req.user.id, ...data },
    });
    const config = await getFieldConfig();
    res.json({ resume, filledFields: Object.keys(data), completion: computeCompletion(resume, config.mandatorySections) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to auto-fill resume" });
  }
});

// STUDENT: recompute the ATS score on demand ("regenerate after making improvements").
router.get("/me/ats-score", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({ where: { studentId: req.user.id } });
    if (!resume) return res.status(404).json({ error: "No resume found — save your resume first" });
    res.json(computeAtsScore(resume));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to compute ATS score" });
  }
});

router.get("/me/pdf", authenticate, requireRole("STUDENT"), async (req, res) => {
  try {
    const resume = await prisma.resume.findUnique({ where: { studentId: req.user.id } });
    if (!resume) return res.status(404).json({ error: "No resume found — save your resume first" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdfFilename(resume)}"`);
    generateResumePdf(resume, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// =========================== Admin/Staff ===========================

router.get("/admin/stats", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const where = req.requesterInstituteId ? { instituteId: req.requesterInstituteId, role: "STUDENT" } : { role: "STUDENT" };
    const students = await prisma.user.findMany({ where, select: { id: true } });
    const ids = students.map((s) => s.id);
    const resumes = ids.length ? await prisma.resume.findMany({ where: { studentId: { in: ids } } }) : [];
    const config = await getFieldConfig();
    const completions = resumes.map((r) => computeCompletion(r, config.mandatorySections).percent);
    res.json({
      totalStudents: ids.length,
      resumesStarted: resumes.length,
      averageCompletion: completions.length ? Math.round(completions.reduce((a, b) => a + b, 0) / completions.length) : 0,
      fullyComplete: completions.filter((c) => c === 100).length,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load resume statistics" });
  }
});

router.get("/admin/students", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const where = req.requesterInstituteId ? { instituteId: req.requesterInstituteId, role: "STUDENT" } : { role: "STUDENT" };
    const students = await prisma.user.findMany({ where, select: { id: true, name: true, email: true, rollNumber: true } });
    const resumes = students.length
      ? await prisma.resume.findMany({ where: { studentId: { in: students.map((s) => s.id) } } })
      : [];
    const resumeMap = new Map(resumes.map((r) => [r.studentId, r]));
    const config = await getFieldConfig();

    const rows = students
      .map((s) => {
        const r = resumeMap.get(s.id);
        return {
          studentId: s.id, name: s.name, email: s.email, rollNumber: s.rollNumber,
          hasResume: !!r, completion: r ? computeCompletion(r, config.mandatorySections).percent : 0,
        };
      })
      .sort((a, b) => b.completion - a.completion);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load student resume list" });
  }
});

async function authorizeStudentResumeAccess(req, res) {
  const target = await prisma.user.findUnique({ where: { id: req.params.studentId } });
  if (!target || target.role !== "STUDENT") {
    res.status(404).json({ error: "Student not found" });
    return null;
  }
  if (req.requesterInstituteId && target.instituteId !== req.requesterInstituteId) {
    res.status(403).json({ error: "You can only manage students under your own institute" });
    return null;
  }
  return target;
}

router.get("/admin/:studentId", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const target = await authorizeStudentResumeAccess(req, res);
    if (!target) return;
    const resume = await prisma.resume.findUnique({ where: { studentId: req.params.studentId } });
    if (!resume) return res.status(404).json({ error: "This student hasn't started a resume yet" });
    const config = await getFieldConfig();
    res.json({ resume, completion: computeCompletion(resume, config.mandatorySections), atsScore: computeAtsScore(resume) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load student resume" });
  }
});

router.get("/admin/:studentId/pdf", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const target = await authorizeStudentResumeAccess(req, res);
    if (!target) return;
    const resume = await prisma.resume.findUnique({ where: { studentId: req.params.studentId } });
    if (!resume) return res.status(404).json({ error: "This student hasn't started a resume yet" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${pdfFilename(resume)}"`);
    generateResumePdf(resume, res);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate PDF" });
  }
});

// ADMIN/STAFF: leave a feedback note on a student's resume ("Suggest improvements") — separate
// from the auto-generated ATS suggestions, visible to the student on their own resume page.
router.post("/admin/:studentId/feedback", authenticate, requireRole("ADMIN", "STAFF"), attachRequesterInstitute, async (req, res) => {
  try {
    const target = await authorizeStudentResumeAccess(req, res);
    if (!target) return;
    const message = String(req.body.message || "").trim();
    if (!message) return res.status(400).json({ error: "message is required" });
    const author = await prisma.user.findUnique({ where: { id: req.user.id } });
    const feedback = await prisma.resumeFeedback.create({
      data: { studentId: req.params.studentId, authorName: author?.name || "Staff", message },
    });
    res.json(feedback);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

router.get("/field-config", authenticate, requireRole("ADMIN", "STAFF"), async (req, res) => {
  res.json(await getFieldConfig());
});

router.patch("/field-config", authenticate, requireRole("ADMIN"), async (req, res) => {
  try {
    const { mandatorySections } = req.body;
    if (!Array.isArray(mandatorySections)) return res.status(400).json({ error: "mandatorySections must be an array" });
    const config = await prisma.resumeFieldConfig.upsert({
      where: { id: "default" },
      update: { mandatorySections },
      create: { id: "default", mandatorySections },
    });
    res.json(config);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update resume field configuration" });
  }
});

module.exports = router;

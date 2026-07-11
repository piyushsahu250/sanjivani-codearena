const PDFDocument = require("pdfkit");

// Every template shares the same single-column, text-first layout — deliberately, since
// multi-column/graphical resumes are notoriously bad for ATS parsers (the whole point of this
// feature). "Template" only varies the accent color and font, not the structure.
const TEMPLATE_STYLES = {
  modern: { accent: "#4F9D6E", font: "Helvetica", headerFont: "Helvetica-Bold" },
  professional: { accent: "#1C3D5A", font: "Helvetica", headerFont: "Helvetica-Bold" },
  minimal: { accent: "#333333", font: "Helvetica", headerFont: "Helvetica-Bold" },
  classic: { accent: "#3B2F2F", font: "Times-Roman", headerFont: "Times-Bold" },
  "software-engineer": { accent: "#2C5B45", font: "Helvetica", headerFont: "Helvetica-Bold" },
  fresher: { accent: "#C7852A", font: "Helvetica", headerFont: "Helvetica-Bold" },
  experienced: { accent: "#1C3D5A", font: "Times-Roman", headerFont: "Times-Bold" },
};

function arr(x) {
  return Array.isArray(x) ? x : [];
}

function generateResumePdf(resume, res) {
  const style = TEMPLATE_STYLES[resume.template] || TEMPLATE_STYLES.modern;
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);

  doc.font(style.headerFont).fontSize(22).fillColor(style.accent).text(resume.fullName || "Your Name");
  doc.font(style.font).fontSize(10).fillColor("#333");
  const contactLine = [resume.email, resume.mobile, resume.address].filter(Boolean).join("   |   ");
  if (contactLine) doc.text(contactLine);
  const linksLine = [resume.linkedin, resume.github, resume.portfolio].filter(Boolean).join("   |   ");
  if (linksLine) doc.text(linksLine);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor(style.accent).lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  function sectionHeader(title) {
    if (doc.y > 760) doc.addPage();
    doc.font(style.headerFont).fontSize(13).fillColor(style.accent).text(title.toUpperCase());
    doc.moveTo(40, doc.y + 2).lineTo(555, doc.y + 2).strokeColor("#cccccc").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.font(style.font).fontSize(10).fillColor("#1C1B18");
  }

  if (resume.summary) {
    sectionHeader("Professional Summary");
    doc.text(resume.summary);
    doc.moveDown(0.8);
  }

  const education = arr(resume.education);
  if (education.length) {
    sectionHeader("Education");
    for (const e of education) {
      doc.font(style.headerFont).fontSize(10.5).fillColor("#1C1B18").text(`${e.degree || ""}${e.specialization ? ` in ${e.specialization}` : ""}`);
      doc.font(style.font).fontSize(10).text(`${e.institution || ""}${e.board ? ` (${e.board})` : ""}`);
      doc.fontSize(9).fillColor("#555555").text(`${e.startYear || ""} – ${e.endYear || e.status || ""}${e.score ? `   ·   ${e.score}` : ""}`);
      doc.fillColor("#1C1B18");
      doc.moveDown(0.5);
    }
  }

  const skills = arr(resume.skills);
  if (skills.length) {
    sectionHeader("Skills");
    const byCategory = {};
    for (const s of skills) {
      const cat = s.category || "Other";
      (byCategory[cat] = byCategory[cat] || []).push(s.proficiency ? `${s.name} (${s.proficiency})` : s.name);
    }
    for (const [cat, names] of Object.entries(byCategory)) {
      doc.font(style.headerFont).fontSize(9.5).fillColor("#1C1B18").text(`${cat}: `, { continued: true });
      doc.font(style.font).fontSize(9.5).text(names.join(", "));
    }
    doc.moveDown(0.6);
  }

  const projects = arr(resume.projects);
  if (projects.length) {
    sectionHeader("Projects");
    for (const p of projects) {
      doc.font(style.headerFont).fontSize(10.5).fillColor("#1C1B18").text(p.title || "");
      const meta = [p.role, p.duration].filter(Boolean).join("   ·   ");
      if (meta) doc.font(style.font).fontSize(9.5).fillColor("#555555").text(meta);
      if (p.description) doc.fillColor("#1C1B18").fontSize(10).text(p.description);
      if (p.technologies) doc.fontSize(9).fillColor("#555555").text(`Tech: ${p.technologies}`);
      const links = [p.githubUrl, p.liveUrl].filter(Boolean).join("   |   ");
      if (links) doc.fontSize(9).fillColor("#555555").text(links);
      doc.fillColor("#1C1B18");
      doc.moveDown(0.5);
    }
  }

  const experience = arr(resume.experience);
  if (experience.length) {
    sectionHeader("Experience");
    for (const e of experience) {
      doc.font(style.headerFont).fontSize(10.5).fillColor("#1C1B18").text(`${e.title || ""}${e.company ? ` — ${e.company}` : ""}`);
      const meta = [e.employmentType, [e.startDate, e.endDate].filter(Boolean).join(" – ")].filter(Boolean).join("   ·   ");
      if (meta) doc.font(style.font).fontSize(9.5).fillColor("#555555").text(meta);
      if (e.responsibilities) doc.fillColor("#1C1B18").fontSize(10).text(e.responsibilities);
      if (e.technologies) doc.fontSize(9).fillColor("#555555").text(`Tech: ${e.technologies}`);
      doc.fillColor("#1C1B18");
      doc.moveDown(0.5);
    }
  }

  const certifications = arr(resume.certifications);
  if (certifications.length) {
    sectionHeader("Certifications");
    for (const c of certifications) {
      doc.font(style.headerFont).fontSize(10).fillColor("#1C1B18").text(`${c.name || ""}${c.org ? ` — ${c.org}` : ""}`);
      const meta = [c.issueDate, c.credentialId ? `ID: ${c.credentialId}` : null].filter(Boolean).join("   ·   ");
      if (meta) doc.font(style.font).fontSize(9).fillColor("#555555").text(meta);
      doc.fillColor("#1C1B18");
      doc.moveDown(0.4);
    }
  }

  const achievements = arr(resume.achievements);
  if (achievements.length) {
    sectionHeader("Achievements");
    for (const a of achievements) {
      doc.fontSize(10).fillColor("#1C1B18").text(`•  ${a.text || a}`);
    }
    doc.moveDown(0.4);
  }

  const languages = arr(resume.languages);
  if (languages.length) {
    sectionHeader("Languages");
    doc.fontSize(10).fillColor("#1C1B18").text(languages.map((l) => `${l.name} (${l.proficiency})`).join(", "));
  }

  doc.end();
}

module.exports = { generateResumePdf, TEMPLATE_STYLES };

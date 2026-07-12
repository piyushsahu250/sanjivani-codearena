const PDFDocument = require("pdfkit");
const { drawReportLogoBadge } = require("./pdfBranding");

const CATEGORY_LABEL = { HR: "HR", TECHNICAL: "Technical", CODING: "Coding", APTITUDE: "Aptitude", SYSTEM_DESIGN: "System Design", BEHAVIORAL: "Behavioral" };

function sessionTitle(session) {
  if (session.isMock) return "Mock Interview";
  if (session.isResumeBased) return "Resume-based Interview";
  return `${CATEGORY_LABEL[session.category] || session.category} Interview`;
}

// Full detail report: interview metadata, overall score + breakdown, strengths/weaknesses,
// improvement plan, then every question with the student's own answer/code and its score —
// exactly the "Questions Asked / Student Answers / Scores / Strengths / Weaknesses /
// Improvement Plan" structure requested, laid out with pdfkit like every other PDF this
// platform generates (certificates, resumes, performance reports).
function generateInterviewReportPdf({ studentName, session, questions, report }, res) {
  const doc = new PDFDocument({ margin: 40, size: "A4" });
  doc.pipe(res);
  drawReportLogoBadge(doc);

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#1C3D5A").text("Interview Performance Report");
  doc.font("Helvetica").fontSize(10).fillColor("#333");
  doc.text(`Candidate: ${studentName}`);
  doc.text(`Interview Type: ${sessionTitle(session)}`);
  if (session.config?.company) doc.text(`Company Focus: ${session.config.company}`);
  doc.text(`Date: ${session.submittedAt ? new Date(session.submittedAt).toLocaleString() : "—"}`);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor("#1C3D5A").lineWidth(1.5).stroke();
  doc.moveDown(0.8);

  const status = report.overallScore >= 90 ? "Excellent" : report.overallScore >= 75 ? "Good" : report.overallScore >= 60 ? "Fair" : "Needs Improvement";
  doc.font("Helvetica-Bold").fontSize(18).fillColor("#1C3D5A").text(`Overall Score: ${report.overallScore}/100 — ${status}`);
  doc.moveDown(0.6);

  const breakdown = Object.entries(report.scoreBreakdown || {});
  if (breakdown.length) {
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1C1B18").text("Score Breakdown");
    doc.font("Helvetica").fontSize(10);
    for (const [k, v] of breakdown) doc.text(`${k[0].toUpperCase()}${k.slice(1)}: ${v}%`);
    doc.moveDown(0.5);
  }

  doc.font("Helvetica-Bold").fontSize(12).fillColor("#1C1B18").text("Strengths");
  doc.font("Helvetica").fontSize(10).text(report.strongAreas?.length ? report.strongAreas.join(", ") : "None identified yet.");
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).text("Weaknesses");
  doc.font("Helvetica").fontSize(10).text(report.weakAreas?.length ? report.weakAreas.join(", ") : "None — evenly balanced across topics.");
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").fontSize(12).text("Improvement Plan");
  doc.font("Helvetica").fontSize(10);
  for (const r of report.recommendations || []) doc.text(`•  ${r}`);
  doc.moveDown(1);

  doc.font("Helvetica-Bold").fontSize(14).fillColor("#1C3D5A").text("Questions & Answers");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor("#1C1B18");

  questions.forEach((q, i) => {
    if (doc.y > 700) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#1C1B18")
      .text(`Q${i + 1}. [${CATEGORY_LABEL[q.category] || q.category}${q.subject ? " · " + q.subject : ""}] ${q.prompt}`);

    const answer = q.answer;
    doc.font("Helvetica").fontSize(9.5).fillColor("#333333");
    if (!answer || answer.skipped) {
      doc.fillColor("#999999").text("Skipped");
    } else if (q.category === "CODING") {
      doc.text(`Language: ${answer.language || "—"}`);
      doc.font("Courier").fontSize(8).fillColor("#1C1B18").text(answer.code || "(no code submitted)");
    } else if (q.category === "APTITUDE") {
      const selectedIdx = answer.answerText != null && answer.answerText !== "" ? Number(answer.answerText) : null;
      doc.text(`Selected answer: ${selectedIdx != null && q.options?.[selectedIdx] ? q.options[selectedIdx] : "—"}`);
    } else {
      doc.text(answer.answerText || "(no answer)");
    }

    doc.fillColor("#555555").fontSize(9).text(`Score: ${answer?.score ?? 0}/100`);
    doc.fillColor("#1C1B18");
    doc.moveDown(0.6);
  });

  doc.end();
}

module.exports = { generateInterviewReportPdf };

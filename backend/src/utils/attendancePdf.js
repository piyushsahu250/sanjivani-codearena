const PDFDocument = require("pdfkit");
const { drawReportLogoBadge } = require("./pdfBranding");

// Streams a paginated attendance report table directly to `res`. Modeled on reportPdf.js's Test
// History table (same colX layout + doc.y > 780 pagination pattern) — takes the exact same `rows`
// array /reports already builds for Excel/CSV, just rendered with a condensed column set since all
// 14 report columns won't fit a single page width at a readable font size.
function generateAttendancePdf(rows, res) {
  const doc = new PDFDocument({ margin: 40, size: "A4", layout: "landscape" });
  doc.pipe(res);
  drawReportLogoBadge(doc);

  doc.font("Helvetica-Bold").fontSize(18).text("Attendance Report", { align: "center" });
  doc.font("Helvetica").fontSize(10).fillColor("#666").text(`Generated ${new Date().toLocaleString()} · ${rows.length} record(s)`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1);

  const colX = [40, 100, 180, 320, 350, 400, 470, 570, 680, 802];
  const headers = ["Date", "Department", "Division", "Sem", "Lec#", "Subject", "Roll No.", "Student", "Type", "Status"];
  doc.font("Helvetica-Bold").fontSize(9);
  headers.forEach((h, i) => doc.text(h, colX[i], doc.y, { width: (colX[i + 1] || 802) - colX[i] - 4 }));
  doc.moveDown(0.3);
  doc.moveTo(40, doc.y).lineTo(802, doc.y).strokeColor("#ccc").stroke();
  doc.moveDown(0.3);

  doc.font("Helvetica").fontSize(8);
  for (const r of rows) {
    if (doc.y > 520) { doc.addPage({ margin: 40, size: "A4", layout: "landscape" }); doc.y = 40; }
    const y = doc.y;
    doc.text(r.Date, colX[0], y, { width: colX[1] - colX[0] - 4 });
    doc.text(r.Department || "—", colX[1], y, { width: colX[2] - colX[1] - 4 });
    doc.text(r.Division || "—", colX[2], y, { width: colX[3] - colX[2] - 4 });
    doc.text(r.Semester || "—", colX[3], y, { width: colX[4] - colX[3] - 4 });
    doc.text(String(r["Lecture #"]), colX[4], y, { width: colX[5] - colX[4] - 4 });
    doc.text(r.Subject || "—", colX[5], y, { width: colX[6] - colX[5] - 4 });
    doc.text(r["Roll Number"] || "—", colX[6], y, { width: colX[7] - colX[6] - 4 });
    doc.text(r["Student Name"], colX[7], y, { width: colX[8] - colX[7] - 4 });
    doc.text(r["Lecture Type"], colX[8], y, { width: colX[9] - colX[8] - 4 });
    const statusColor = r.Status === "ABSENT" ? "#c0392b" : r.Status === "LATE" ? "#b8860b" : r.Status === "LEAVE" ? "#4a5568" : "#1e7e34";
    doc.fillColor(statusColor).text(r.Status, colX[9], y, { width: 802 - colX[9] }).fillColor("#000");
    doc.moveDown(0.5);
  }

  if (rows.length === 0) {
    doc.font("Helvetica").fontSize(10).fillColor("#666").text("No records match these filters.");
  }

  doc.end();
}

module.exports = { generateAttendancePdf };

const PDFDocument = require("pdfkit");
const { drawCertificateLogo } = require("./pdfBranding");

// Streams a simple landscape course-completion certificate directly to `res`.
function generateCertificatePdf({ studentName, courseName, certificateCode, issuedAt }, res) {
  const doc = new PDFDocument({ layout: "landscape", size: "A4", margin: 0 });
  doc.pipe(res);

  const { width, height } = doc.page;

  doc.rect(0, 0, width, height).fill("#FBF9F4");
  doc.lineWidth(3).strokeColor("#E8A33D").rect(24, 24, width - 48, height - 48).stroke();
  doc.lineWidth(1).strokeColor("#C7852A").rect(34, 34, width - 68, height - 68).stroke();

  drawCertificateLogo(doc, { width, y: 22, logoWidth: 100 });
  doc.font("Helvetica").fontSize(12).fillColor("#6B6A5F").text("Learning Module", 0, 128, { align: "center" });

  doc.font("Helvetica-Bold").fontSize(28).fillColor("#1C1B18").text("Certificate of Completion", 0, 158, { align: "center" });

  doc.font("Helvetica").fontSize(13).fillColor("#6B6A5F").text("This is to certify that", 0, 215, { align: "center" });
  doc.font("Helvetica-Bold").fontSize(26).fillColor("#4F9D6E").text(studentName, 0, 240, { align: "center" });
  doc.font("Helvetica").fontSize(13).fillColor("#6B6A5F")
    .text(`has successfully completed the`, 0, 285, { align: "center" });
  doc.font("Helvetica-Bold").fontSize(20).fillColor("#1C1B18").text(`${courseName} Learning Course`, 0, 307, { align: "center" });

  doc.font("Helvetica").fontSize(11).fillColor("#6B6A5F")
    .text(`Completion Date: ${new Date(issuedAt).toLocaleDateString()}`, 0, 365, { align: "center" });
  doc.font("Helvetica").fontSize(11).fillColor("#6B6A5F")
    .text(`Certificate ID: ${certificateCode}`, 0, 383, { align: "center" });

  doc.end();
}

module.exports = { generateCertificatePdf };

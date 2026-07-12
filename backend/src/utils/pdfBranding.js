const path = require("path");

const LOGO_PATH = path.join(__dirname, "../assets/logo.png");

// Centered logo for ceremonial landscape certificates (course completion, interview-ready).
// Caller is responsible for shifting the rest of its layout down to clear the reserved height.
function drawCertificateLogo(doc, { width, y = 20, logoWidth = 100 }) {
  doc.image(LOGO_PATH, (width - logoWidth) / 2, y, { width: logoWidth });
}

// Small corner-badge logo for flowing portrait reports — doesn't touch doc.x/doc.y, so it
// never interferes with the existing top-left text flow of the report body.
function drawReportLogoBadge(doc, { logoWidth = 55 } = {}) {
  const { width } = doc.page;
  doc.image(LOGO_PATH, width - 40 - logoWidth, 30, { width: logoWidth });
}

module.exports = { LOGO_PATH, drawCertificateLogo, drawReportLogoBadge };

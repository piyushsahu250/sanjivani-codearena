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

// Institute logo alongside the CodeArena one, for certificates that need dual branding.
// `logoDataUrl` is whatever's stored in Institute.logoUrl (a data URL — this platform has no
// object storage, see the field's schema comment) — pdfkit accepts a data URL string directly,
// same as the QR codes already embedded elsewhere in these certificate generators. Silently
// skipped if missing or if pdfkit can't decode it (e.g. an unsupported image format pasted in).
function drawInstituteLogo(doc, logoDataUrl, { x, y, logoWidth = 70 }) {
  if (!logoDataUrl) return;
  try {
    doc.image(logoDataUrl, x, y, { width: logoWidth });
  } catch (e) {
    console.error("Institute logo render failed", e);
  }
}

module.exports = { LOGO_PATH, drawCertificateLogo, drawReportLogoBadge, drawInstituteLogo };

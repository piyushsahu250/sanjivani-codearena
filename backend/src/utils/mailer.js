/**
 * Minimal email sender using the Resend REST API (https://resend.com).
 * No SDK dependency — plain fetch, since Node 18+ (and our Docker image) has
 * it globally.
 *
 * Until RESEND_API_KEY is configured, sendMail() doesn't fail — it logs the
 * would-be email (including any reset link) to the server logs, so the
 * password-reset flow is fully testable before the email service is wired up.
 */

const FROM = process.env.MAIL_FROM || "CodeArena <onboarding@resend.dev>";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://sanjivani-codearena.vercel.app";
const LOGO_URL = `${FRONTEND_URL}/branding/logo.png`;

// Wraps an email body with a consistent CodeArena-branded header/footer. The logo is referenced
// by its deployed frontend URL (not embedded) since that's how email clients reliably load
// images — inline attachments/data-URIs are stripped or degraded by most webmail providers.
function wrapBranded(bodyHtml) {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <div style="text-align: center; padding: 24px 0 8px;">
        <img src="${LOGO_URL}" alt="CodeArena" width="160" style="width:160px; max-width:100%; height:auto;" />
      </div>
      <div style="padding: 8px 24px 24px; color: #1C1B18; line-height: 1.6; font-size: 14px;">
        ${bodyHtml}
      </div>
      <div style="text-align: center; padding: 16px; color: #999; font-size: 11px; border-top: 1px solid #eee;">
        CodeArena — Code · Learn · Assess · Succeed
      </div>
    </div>
  `;
}

async function sendMail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[mailer] RESEND_API_KEY not set — would have sent email:\n  to: ${to}\n  subject: ${subject}\n  ${html}`);
    return { ok: true, simulated: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[mailer] Resend API error:", res.status, body);
    return { ok: false };
  }
  return { ok: true };
}

module.exports = { sendMail, wrapBranded };

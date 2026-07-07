/**
 * Minimal email sender using the Resend REST API (https://resend.com).
 * No SDK dependency — plain fetch, since Node 18+ (and our Docker image) has
 * it globally.
 *
 * Until RESEND_API_KEY is configured, sendMail() doesn't fail — it logs the
 * would-be email (including any reset link) to the server logs, so the
 * password-reset flow is fully testable before the email service is wired up.
 */

const FROM = process.env.MAIL_FROM || "Sanjivani CodeArena <onboarding@resend.dev>";

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

module.exports = { sendMail };

/**
 * Minimal email sender using the Resend REST API (https://resend.com).
 * No SDK dependency — plain fetch, since Node 18+ (and our Docker image) has
 * it globally. This project has no traditional SMTP transport (no host/port/
 * username/password/TLS config) — Resend's HTTPS API is the only transport,
 * so "SMTP config" here means one thing: RESEND_API_KEY.
 */

const FROM = process.env.MAIL_FROM || "CodeArena <onboarding@resend.dev>";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://codearena-app.vercel.app";
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns { ok: boolean, error?: string, messageId?: string, simulated?: true }.
// `ok: true` is only ever returned once Resend's API has actually accepted the message —
// there is no path that reports success without a confirmed 2xx response from the provider.
async function sendMail({ to, subject, html }) {
  console.log(`[mailer] Sending "${subject}" to ${to}…`);

  if (!to || !EMAIL_RE.test(String(to).trim())) {
    console.error(`[mailer] Invalid recipient email: "${to}"`);
    return { ok: false, error: "Invalid recipient email address" };
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error(`[mailer] RESEND_API_KEY is not set — email NOT sent (logging content only):\n  to: ${to}\n  subject: ${subject}`);
    return { ok: false, simulated: true, error: "Email service is not configured on the server (RESEND_API_KEY is missing) — no email was actually sent." };
  }

  console.log("[mailer] Connecting to Resend API...");
  let res;
  try {
    res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    });
  } catch (err) {
    console.error("[mailer] Network error contacting Resend:", err.message);
    return { ok: false, error: `Network error while contacting the email provider: ${err.message}` };
  }

  if (!res.ok) {
    let message = `Email provider returned HTTP ${res.status}`;
    try {
      const body = await res.json();
      message = body?.message || message;
    } catch {
      // response wasn't JSON — keep the generic status-based message
    }
    console.error(`[mailer] Resend API error (${res.status}):`, message);
    if (res.status === 401 || res.status === 403) {
      return { ok: false, error: `Email provider authentication failed: ${message}` };
    }
    if (res.status === 429) {
      return { ok: false, error: `Email provider rate limit exceeded: ${message}` };
    }
    return { ok: false, error: message };
  }

  const data = await res.json().catch(() => ({}));
  console.log(`[mailer] Email accepted by provider. Message ID: ${data.id || "(none returned)"} — Status: SUCCESS`);
  return { ok: true, messageId: data.id || null };
}

// Same as sendMail(), but writes an EmailLog row so admins can see real delivery status/history
// per student instead of a fire-and-forget send. `prisma` is passed in rather than required at
// module load, since utils/mailer.js has no other dependency on the Prisma client.
async function sendMailLogged(prisma, { to, name, subject, html, emailType, studentId }) {
  const log = await prisma.emailLog.create({
    data: { studentId: studentId || null, recipientName: name || "", recipientEmail: to || "", emailType, status: "PENDING" },
  });
  const result = await sendMail({ to, subject, html });
  await prisma.emailLog.update({
    where: { id: log.id },
    data: {
      status: result.ok ? "SENT" : "FAILED",
      errorMessage: result.ok ? null : result.error || "Unknown error",
      messageId: result.messageId || null,
      sentAt: result.ok ? new Date() : null,
    },
  }).catch(() => {});
  return result;
}

module.exports = { sendMail, sendMailLogged, wrapBranded };

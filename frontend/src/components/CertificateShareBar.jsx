import { useState } from "react";

// Shared certificate action bar: View/Download/Verify + one-click social sharing.
//
// A note on fidelity: LinkedIn and Facebook both stopped honoring pre-filled *post text* via
// share-URL parameters years ago (an anti-spam policy change on their end, not a gap in this
// implementation) — their share dialogs only accept a URL and generate the preview from that
// page's Open Graph tags. X (Twitter) and WhatsApp still support real pre-filled text via URL,
// so "Share on X" / "Share on WhatsApp" genuinely open with the caption already in the box.
// "Share on LinkedIn" opens LinkedIn's official link-share dialog (URL only, no custom text).
// "Share as Post" is the honest equivalent of the spec's "pre-filled, editable LinkedIn post":
// the caption is editable right here, then copied to the clipboard and LinkedIn's own post
// composer opens in a new tab for the student to paste it — LinkedIn does not expose any API or
// URL scheme that lets a third-party site drop text directly into a user's post box.
export default function CertificateShareBar({
  verifyUrl, downloadFn, downloading, studentName, credentialName, orgName = "CodeArena", issueDate, certificateCode,
}) {
  const [showPostEditor, setShowPostEditor] = useState(false);
  const [postText, setPostText] = useState(
    `🎉 Excited to share that I have successfully completed the ${credentialName} on ${orgName}.\n\nThrough this, I strengthened my knowledge, problem-solving, and coding skills.\n\nThank you, ${orgName}, for providing an excellent learning platform.\n\nVerify my certificate:\n${verifyUrl}\n\n#CodeArena #Coding #Learning #SoftwareEngineering`
  );
  const [copied, setCopied] = useState("");

  function copyLink() {
    navigator.clipboard.writeText(verifyUrl).then(() => {
      setCopied("link");
      setTimeout(() => setCopied(""), 2000);
    });
  }

  function copyPostAndOpen() {
    navigator.clipboard.writeText(postText).then(() => {
      setCopied("post");
      setTimeout(() => setCopied(""), 2500);
      window.open("https://www.linkedin.com/feed/?shareActive=true", "_blank", "noopener,noreferrer");
    });
  }

  function shareLinkedIn() {
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(verifyUrl)}`, "_blank", "noopener,noreferrer");
  }
  function shareX() {
    const text = `I just earned the ${credentialName} on ${orgName}! 🎉`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(verifyUrl)}`, "_blank", "noopener,noreferrer");
  }
  function shareFacebook() {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(verifyUrl)}`, "_blank", "noopener,noreferrer");
  }
  function shareWhatsApp() {
    const text = `I just earned the ${credentialName} on ${orgName}! Verify it here: ${verifyUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function addToLinkedInProfile() {
    const d = issueDate ? new Date(issueDate) : new Date();
    const params = new URLSearchParams({
      startTask: "CERTIFICATION_NAME",
      name: credentialName,
      organizationName: orgName,
      issueYear: String(d.getFullYear()),
      issueMonth: String(d.getMonth() + 1),
      certUrl: verifyUrl,
      certId: certificateCode || "",
    });
    window.open(`https://www.linkedin.com/profile/add?${params.toString()}`, "_blank", "noopener,noreferrer");
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
        <button className="btn btn-primary" onClick={downloadFn} disabled={downloading}>
          {downloading ? "Preparing…" : "⬇ Download PDF"}
        </button>
        <a href={verifyUrl} target="_blank" rel="noopener noreferrer" className="btn btn-ghost">🔍 Verify Certificate</a>
        <button className="btn btn-ghost" onClick={shareLinkedIn}>🔗 Share on LinkedIn</button>
        <button className="btn btn-ghost" onClick={() => setShowPostEditor((s) => !s)}>📝 Share as Post</button>
        <button className="btn btn-ghost" onClick={addToLinkedInProfile}>➕ Add to LinkedIn Profile</button>
        <button className="btn btn-ghost" onClick={copyLink}>{copied === "link" ? "✓ Copied!" : "📋 Copy Certificate Link"}</button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 10 }}>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={shareX}>𝕏 X (Twitter)</button>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={shareFacebook}>Facebook</button>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={shareWhatsApp}>WhatsApp</button>
      </div>

      {showPostEditor && (
        <div className="card" style={{ padding: 16, marginTop: 16, textAlign: "left" }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Edit your post before sharing</div>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            style={{ width: "100%", minHeight: 160, marginTop: 8, fontFamily: "var(--font-body)", fontSize: 13, padding: 10, borderRadius: 8, border: "1px solid var(--line, #ccc)" }}
          />
          <p style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
            LinkedIn doesn't allow other sites to drop text directly into your post box — click below to copy this
            text and open LinkedIn's post composer, then paste (Ctrl/Cmd+V) it in.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={copyPostAndOpen}>
            {copied === "post" ? "✓ Copied — opening LinkedIn…" : "Copy Text & Open LinkedIn"}
          </button>
        </div>
      )}
    </div>
  );
}

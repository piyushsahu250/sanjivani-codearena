import { useEffect, useState } from "react";
import { GraduationCap, ClipboardList, Trophy, Mic } from "lucide-react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import CertificateShareBar from "../components/CertificateShareBar";

const TYPE_META = {
  LEARNING_MODULE: { label: "Learning Module", icon: GraduationCap },
  CODING_ASSESSMENT: { label: "Coding Assessment", icon: ClipboardList },
  MANUAL: { label: "Certificate", icon: Trophy },
  AI_INTERVIEW: { label: "AI Mock Interview", icon: Mic },
};

// Unified "My Certificates" — merges the Certificate model (Learning Module / Coding Assessment
// / Manual) and the separate InterviewCertificate model into one list, per GET /certificates/me.
export default function MyCertificates() {
  const [certs, setCerts] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    api.get("/certificates/me").then((res) => setCerts(res.data)).catch(() => setCerts([]));
  }, []);

  async function download(cert) {
    setDownloadingId(cert.id);
    try {
      const { data } = await api.get(cert.downloadUrl, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${cert.certificateCode}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download certificate");
    } finally {
      setDownloadingId(null);
    }
  }

  const verifyUrlFor = (cert) =>
    cert.source === "interview"
      ? `${window.location.origin}/interview/certificate/verify/${cert.certificateCode}`
      : `${window.location.origin}/certificate/verify/${cert.certificateCode}`;

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <h1>My Certificates</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", fontSize: 14, marginTop: 12 }}>
          Every certificate you've earned across Learning Modules, Coding Assessments, AI Mock Interviews, and
          institute-issued programs, all in one place.
        </p>

        {certs === null && <p className="mono" style={{ marginTop: 24, color: "var(--ink-dim)" }}>Loading…</p>}
        {certs?.length === 0 && (
          <div className="card" style={{ padding: 32, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            No certificates yet — complete a Learning Module, pass a Coding Assessment, or finish an AI Mock
            Interview to earn your first one.
          </div>
        )}

        <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
          {certs?.map((cert) => {
            const meta = TYPE_META[cert.type] || TYPE_META.MANUAL;
            const Icon = meta.icon;
            const isOpen = expandedId === cert.id;
            const revoked = cert.status === "REVOKED";
            return (
              <div key={cert.id} className="card" style={{ padding: 20, opacity: revoked ? 0.6 : 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <Icon size={28} style={{ flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{cert.programName || cert.title}</div>
                      <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
                        {meta.label} · {cert.certificateCode} · Issued {new Date(cert.issuedAt).toLocaleDateString()}
                      </div>
                      {revoked && <div style={{ fontSize: 12, color: "var(--rust)", fontWeight: 700, marginTop: 4 }}>Revoked{cert.revokedReason ? `: ${cert.revokedReason}` : ""}</div>}
                    </div>
                  </div>
                  {!revoked && (
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }} onClick={() => setExpandedId(isOpen ? null : cert.id)}>
                      {isOpen ? "Hide options" : "Share / Download"}
                    </button>
                  )}
                </div>

                {isOpen && !revoked && (
                  <CertificateShareBar
                    verifyUrl={verifyUrlFor(cert)}
                    downloadFn={() => download(cert)}
                    downloading={downloadingId === cert.id}
                    studentName=""
                    credentialName={cert.programName || cert.title}
                    issueDate={cert.issuedAt}
                    certificateCode={cert.certificateCode}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

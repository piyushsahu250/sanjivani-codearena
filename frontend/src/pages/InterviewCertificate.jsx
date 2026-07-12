import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import CertificateShareBar from "../components/CertificateShareBar";
import "./interviewPrep.css";

export default function InterviewCertificate() {
  const [cert, setCert] = useState(null);
  const [error, setError] = useState("");
  const [downloading, setDownloading] = useState(false);
  const dark = localStorage.getItem("interviewPrepDark") === "1";

  useEffect(() => {
    api.get("/interview/certificate").then((res) => setCert(res.data)).catch((err) => setError(err.response?.data?.error || "Failed to load certificate"));
  }, []);

  async function download() {
    setDownloading(true);
    try {
      const { data } = await api.get("/interview/certificate/pdf", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url; a.download = "interview-ready-certificate.pdf";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download certificate");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className={`interview-prep ${dark ? "dark" : ""}`}>
      <Navbar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>Interview Ready Certificate</h1><ChalkUnderline /></div>
          <Link to="/interview" className="btn btn-ghost">← AI Mock Interview</Link>
        </div>

        {error && (
          <div className="ip-glass" style={{ padding: 24, marginTop: 24, textAlign: "center" }}>
            <p>{error}</p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>Complete interviews and reach an average score above 80% to unlock this certificate.</p>
          </div>
        )}

        {cert && (
          <div className="ip-glass" style={{ padding: 32, marginTop: 24, textAlign: "center" }}>
            <div style={{ fontSize: 40 }}>🏆</div>
            <h2 style={{ marginTop: 12 }}>Interview Ready</h2>
            <p style={{ marginTop: 8 }}>Awarded to <strong>{cert.studentName}</strong></p>
            <p className="mono" style={{ fontSize: 12, opacity: 0.7, marginTop: 12 }}>
              Average Score: {cert.averageScore}%<br />
              Certificate ID: {cert.certificateCode}<br />
              Issued: {new Date(cert.issuedAt).toLocaleDateString()}
            </p>
            <CertificateShareBar
              verifyUrl={`${window.location.origin}/interview/verify/${cert.certificateCode}`}
              downloadFn={download}
              downloading={downloading}
              studentName={cert.studentName}
              credentialName="Interview Ready Certificate"
              issueDate={cert.issuedAt}
              certificateCode={cert.certificateCode}
            />
          </div>
        )}
      </div>
    </div>
  );
}

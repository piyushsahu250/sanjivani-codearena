import { useState } from "react";
import { Download } from "lucide-react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

// Admin-only page at /admin/backups. The download itself is gated server-side to platform-level
// Super Admin accounts (an ADMIN with no instituteId — see backend/src/routes/backup.js) since a
// full database dump spans every institute's data; an institute-scoped ADMIN hitting this page
// will get a clear 403 explaining why, surfaced below rather than a silent failure.
export default function Backups() {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [lastDownloaded, setLastDownloaded] = useState(null);

  async function downloadBackup() {
    setDownloading(true);
    setError("");
    try {
      const { data } = await api.get("/backup/database", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([data], { type: "application/sql" }));
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
      const a = document.createElement("a");
      a.href = url;
      a.download = `codearena-backup-${stamp}.sql`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setLastDownloaded(new Date());
    } catch (err) {
      let message = "Failed to generate backup";
      if (err.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await err.response.data.text()).error || message;
        } catch { /* fall through to default message */ }
      } else {
        message = err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Backups</h1>
        <ChalkUnderline />
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 12 }}>
          On-demand full database backup, generated fresh on request and streamed straight to your
          browser — nothing is stored on the server. Restricted to platform-level Super Admin
          accounts (not tied to a specific institute).
        </p>

        <div className="card" style={{ padding: 20, marginTop: 24 }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>Full Database Backup</h3>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
            A complete PostgreSQL SQL dump (schema + data, every institute) — suitable for
            restoring the whole platform. Large; may take a moment to generate.
          </p>
          <button className="btn btn-primary" style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 6 }} disabled={downloading} onClick={downloadBackup}>
            <Download size={16} />
            {downloading ? "Generating…" : "Download Backup (.sql)"}
          </button>
          {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 10 }}>{error}</p>}
          {lastDownloaded && !error && (
            <p className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10 }}>
              Last downloaded {lastDownloaded.toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { Link } from "react-router-dom";
import { Download } from "lucide-react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

// Renders at /admin/exports and /staff/exports (basePath controls the back link) — Staff get an
// institute-scoped export (see attachRequesterInstitute in backend/src/routes/exports.js), Admin
// gets institute-scoped or, for a platform-level Super Admin account, everything.
const ENTITIES = [
  { value: "students", label: "Students" },
  { value: "staff", label: "Staff & Admins" },
  { value: "results", label: "Test Results" },
  { value: "reports", label: "AI Interview Reports" },
  { value: "certificates", label: "Certificates" },
  { value: "questions", label: "Question Bank" },
];
const FORMATS = [
  { value: "csv", label: "CSV" },
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "json", label: "JSON" },
];

export default function ExportCenter({ basePath }) {
  const [entity, setEntity] = useState("students");
  const [format, setFormat] = useState("csv");
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  async function runExport() {
    setExporting(true);
    setError("");
    try {
      const { data } = await api.get(`/export/${entity}`, { params: { format }, responseType: "blob" });
      const mime = format === "json" ? "application/json" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
      const url = URL.createObjectURL(new Blob([data], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `codearena-${entity}-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let message = "Export failed";
      if (err.response?.data instanceof Blob) {
        try {
          message = JSON.parse(await err.response.data.text()).error || message;
        } catch { /* fall through to default message */ }
      } else {
        message = err.response?.data?.error || message;
      }
      setError(message);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div><h1>Export Center</h1><ChalkUnderline /></div>
          <Link to={basePath || "/admin"} className="btn btn-ghost">← Back</Link>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 12 }}>
          Export platform data as CSV, Excel, or JSON — capped at 5,000 rows per export, newest
          first. For a complete untruncated copy of everything, see the full database backup.
        </p>

        <div className="card" style={{ padding: 20, marginTop: 24, display: "grid", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Data</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {ENTITIES.map((e) => (
                <button
                  key={e.value}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px", background: entity === e.value ? "var(--amber)" : undefined }}
                  onClick={() => setEntity(e.value)}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Format</label>
            <div style={{ display: "flex", gap: 8 }}>
              {FORMATS.map((f) => (
                <button
                  key={f.value}
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: "6px 12px", background: format === f.value ? "var(--amber)" : undefined }}
                  onClick={() => setFormat(f.value)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <button className="btn btn-primary" style={{ justifySelf: "start", display: "inline-flex", alignItems: "center", gap: 6 }} disabled={exporting} onClick={runExport}>
            <Download size={16} />
            {exporting ? "Exporting…" : "Export"}
          </button>
          {error && <p style={{ color: "var(--rust)", fontSize: 13 }}>{error}</p>}
        </div>
      </div>
    </div>
  );
}

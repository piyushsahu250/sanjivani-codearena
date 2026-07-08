import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function BulkUpload() {
  const [file, setFile] = useState(null);
  const [sendCredentials, setSendCredentials] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function downloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const res = await api.get("/users/bulk-template", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "student-upload-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Failed to download template");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sendCredentials", sendCredentials ? "true" : "false");
      const { data } = await api.post("/users/bulk-upload", formData);
      setResult(data);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err.response?.data?.error || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Bulk student upload</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
        </div>

        <p style={{ color: "var(--ink-dim)", marginTop: 16, fontSize: 14 }}>
          Upload an Excel (.xlsx) or CSV file to create student accounts for an entire batch at once. Every account
          gets the default password <strong className="mono">Sanjivani@1</strong> — students should change it after
          first login.
        </p>

        <div className="card" style={{ padding: 24, marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Required columns</div>
              <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 4 }}>
                Student Name, Roll Number, Official Email ID — plus optional Mobile Number, Department, Program,
                Batch/Year, Section.
              </p>
            </div>
            <button className="btn btn-ghost" onClick={downloadTemplate} disabled={downloadingTemplate}>
              {downloadingTemplate ? "Downloading…" : "⬇ Download sample template"}
            </button>
          </div>

          <form onSubmit={handleUpload} style={{ marginTop: 20 }}>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              style={{ display: "block" }}
            />

            <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13 }}>
              <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
              Email login credentials to each student's official email
            </label>

            {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{error}</p>}

            <button className="btn btn-primary" style={{ marginTop: 16 }} disabled={!file || uploading}>
              {uploading ? "Uploading…" : "Upload and create accounts"}
            </button>
          </form>
        </div>

        {result && (
          <div style={{ marginTop: 24 }}>
            <div className="card" style={{ padding: 20 }}>
              <p style={{ fontSize: 15 }}>
                <strong>{result.createdCount}</strong> student account{result.createdCount === 1 ? "" : "s"} created
                successfully out of {result.total} record{result.total === 1 ? "" : "s"}.
                {result.duplicateCount > 0 && ` ${result.duplicateCount} skipped as duplicates.`}
                {result.errorCount > 0 && ` ${result.errorCount} failed validation.`}
              </p>
            </div>

            {result.duplicates.length > 0 && (
              <ResultTable title="Duplicate records (skipped)" rows={result.duplicates} color="var(--amber-dark)" />
            )}
            {result.errors.length > 0 && (
              <ResultTable title="Failed records" rows={result.errors} color="var(--rust)" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({ title, rows, color }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14, color }}>{title}</div>
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
            <th style={{ padding: "6px 4px" }}>Row</th>
            <th>Name</th>
            <th>Email</th>
            <th>Roll no.</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
              <td className="mono" style={{ padding: "6px 4px" }}>{r.row}</td>
              <td>{r.name || "—"}</td>
              <td className="mono">{r.email || "—"}</td>
              <td className="mono">{r.rollNumber || "—"}</td>
              <td style={{ color }}>{r.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

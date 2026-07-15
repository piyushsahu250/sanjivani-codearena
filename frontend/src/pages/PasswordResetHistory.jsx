import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

// Renders at /admin/password-reset-history and /staff/password-reset-history (basePath controls
// the back link). Backend scopes the data itself — Staff only ever receives resets for students
// under their own institute, an unscoped platform Admin sees every institute.
export default function PasswordResetHistory({ basePath }) {
  const [logs, setLogs] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/users/password-reset-history")
      .then((res) => setLogs(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load password reset history"));
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h1>Password Reset History</h1>
            <ChalkUnderline />
          </div>
          <Link to={basePath || "/admin"} className="btn btn-ghost">← Back</Link>
        </div>

        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 16 }}>
          Every password reset performed for students under your institute, most recent first.
          Each reset generates a new, unique password and forces the student to set their own on next login.
        </p>

        {error && <p style={{ color: "var(--rust)", marginTop: 24 }}>{error}</p>}

        <div className="card" style={{ marginTop: 16, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
                <th style={{ padding: "10px 12px" }}>Student</th>
                <th style={{ padding: "10px 12px" }}>Reset By</th>
                <th style={{ padding: "10px 12px" }}>Date & Time</th>
                <th style={{ padding: "10px 12px" }}>Email Sent</th>
              </tr>
            </thead>
            <tbody>
              {logs === null && !error && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }} className="mono">Loading…</td></tr>
              )}
              {logs?.map((log) => (
                <tr key={log.id} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                  <td style={{ padding: "10px 12px" }}>{log.studentName || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{log.resetBy}</td>
                  <td className="mono" style={{ padding: "10px 12px" }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td style={{ padding: "10px 12px" }}>
                    {log.emailSent === true && <span style={{ color: "var(--mint)", fontWeight: 600 }}>Sent</span>}
                    {log.emailSent === false && <span style={{ color: "var(--rust)", fontWeight: 600 }}>Failed</span>}
                    {log.emailSent === null && <span style={{ color: "var(--ink-dim)" }}>Not requested</span>}
                  </td>
                </tr>
              ))}
              {logs?.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>No password resets yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

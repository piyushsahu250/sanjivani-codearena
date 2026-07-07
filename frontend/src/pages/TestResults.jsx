import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

export default function TestResults() {
  const { id } = useParams();
  const [test, setTest] = useState(null);
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    api.get(`/tests/${id}/results`).then((res) => setAttempts(res.data));
    api.get(`/tests/${id}`).then((res) => setTest(res.data));
  }, [id]);

  function downloadCsv() {
    const header = ["Rank", "Student", "Email", "Roll no.", "Score", "Status", "Tab switches"];
    const rows = attempts.map((a, idx) => [
      idx + 1,
      a.student.name,
      a.student.email,
      a.student.rollNumber || "",
      a.totalScore,
      a.status,
      a.tabSwitchCount ?? 0,
    ]);
    const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${(test?.title || "test-results").replace(/[^a-z0-9]+/gi, "-")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1>Leaderboard</h1>
          <button className="btn btn-primary" onClick={downloadCsv} disabled={attempts.length === 0}>
            ⬇ Download results (Excel/CSV)
          </button>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 13, color: "var(--ink-dim)" }}>
              <th style={{ padding: "8px 4px" }}>Rank</th>
              <th>Student</th>
              <th>Roll no.</th>
              <th>Score</th>
              <th>Status</th>
              <th>Tab switches</th>
            </tr>
          </thead>
          <tbody>
            {attempts.map((a, idx) => (
              <tr key={a.id} style={{ borderBottom: "1px solid var(--line)" }}>
                <td className="mono" style={{ padding: "10px 4px" }}>{idx + 1}</td>
                <td>{a.student.name}<br /><span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{a.student.email}</span></td>
                <td className="mono">{a.student.rollNumber || "—"}</td>
                <td className="mono" style={{ fontWeight: 700 }}>{a.totalScore}</td>
                <td className="mono" style={{ fontSize: 12 }}>{a.status}</td>
                <td className="mono" style={{ fontSize: 12, color: a.tabSwitchCount > 0 ? "var(--rust)" : "var(--ink-dim)" }}>{a.tabSwitchCount ?? 0}</td>
              </tr>
            ))}
            {attempts.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>No attempts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

export default function TestResults() {
  const { id } = useParams();
  const [attempts, setAttempts] = useState([]);

  useEffect(() => {
    api.get(`/tests/${id}/results`).then((res) => setAttempts(res.data));
  }, [id]);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Leaderboard</h1>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 24 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 13, color: "var(--ink-dim)" }}>
              <th style={{ padding: "8px 4px" }}>Rank</th>
              <th>Student</th>
              <th>Roll no.</th>
              <th>Score</th>
              <th>Status</th>
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
              </tr>
            ))}
            {attempts.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>No attempts yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

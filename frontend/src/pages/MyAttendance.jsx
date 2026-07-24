import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import api from "../api";

const LECTURE_TYPE_LABELS = { REGULAR: "Regular Class", PRACTICE_TEST: "Practice Test", EXAM: "Exam" };
const STATUS_COLORS = { PRESENT: "var(--mint)", ABSENT: "var(--rust)", LATE: "var(--amber)", LEAVE: "#64748b" };

// Student's own attendance — self-scoped entirely server-side (GET /attendance/my-records never
// accepts a studentId param), so there's nothing to filter or pick here, just display.
export default function MyAttendance() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/attendance/my-records")
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load your attendance"));
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <h1>My Attendance</h1>
        <ChalkUnderline />

        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 16 }}>{error}</p>}
        {!data && !error && <p style={{ marginTop: 24, color: "var(--ink-dim)", fontSize: 13 }}>Loading…</p>}

        {data && data.bySubject.length === 0 && (
          <div className="card" style={{ padding: 24, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            No attendance has been recorded for you yet.
          </div>
        )}

        {data && data.bySubject.length > 0 && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
              {data.bySubject.map((s) => {
                const belowMin = data.attendanceMinPercent != null && s.percentage != null && s.percentage < data.attendanceMinPercent;
                return (
                  <div key={s.subject} className="card" style={{ padding: 18 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{s.subject}</div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 28, fontWeight: 700, color: belowMin ? "var(--rust)" : "var(--mint)" }}>
                        {s.percentage != null ? `${s.percentage}%` : "—"}
                      </span>
                      {belowMin && (
                        <span className="badge" style={{ background: "var(--rust)", color: "#fff", fontSize: 11 }}>
                          Below {data.attendanceMinPercent}%
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <span style={{ color: "var(--mint)" }}>P: {s.counts.PRESENT || 0}</span>
                      <span style={{ color: "var(--rust)" }}>A: {s.counts.ABSENT || 0}</span>
                      <span style={{ color: "var(--amber)" }}>L: {s.counts.LATE || 0}</span>
                      <span style={{ color: "#64748b" }}>Lv: {s.counts.LEAVE || 0}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <h3 style={{ fontSize: 15, marginTop: 32 }}>Lecture History</h3>
            <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
              {data.records.map((r, i) => (
                <div key={i} className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <div style={{ fontSize: 13 }}>
                    <strong>{r.subject}</strong> · Lecture {r.lectureNumber} · {r.date}
                    <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                      {r.department} · {r.section} · {r.batch} · {LECTURE_TYPE_LABELS[r.lectureType] || r.lectureType}
                      {r.test ? ` · ${r.test}` : ""}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 12, color: STATUS_COLORS[r.status] || "var(--ink)" }}>{r.status}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

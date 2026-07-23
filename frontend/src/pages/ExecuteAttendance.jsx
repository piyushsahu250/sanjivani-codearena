import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const LECTURE_TYPE_LABELS = { REGULAR: "Regular Class", PRACTICE_TEST: "Practice Test", EXAM: "Exam" };

// Modern ON/OFF toggle — ON (right, green) = Present (the default for every student), OFF (left,
// red) = Absent. Staff only needs to flip the students who were actually absent.
function Toggle({ present, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={present}
      onClick={onChange}
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
        background: present ? "var(--mint)" : "var(--rust)", position: "relative", transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: present ? 23 : 3, width: 20, height: 20, borderRadius: "50%",
        background: "#fff", transition: "left 0.15s",
      }} />
    </button>
  );
}

export default function ExecuteAttendance() {
  const { assignmentId, planId } = useParams();

  const [plan, setPlan] = useState(null);
  const [roster, setRoster] = useState([]);
  const [eligibleTests, setEligibleTests] = useState([]);
  const [statuses, setStatuses] = useState({}); // studentId -> present(boolean)
  const [testId, setTestId] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [auditNote, setAuditNote] = useState("");

  useEffect(() => {
    setLoading(true);
    api.get(`/attendance/assignments/${assignmentId}/plans/${planId}/execute`)
      .then((res) => {
        const { plan, roster, eligibleTests } = res.data;
        setPlan(plan);
        setRoster(roster);
        setEligibleTests(eligibleTests);
        const next = {};
        roster.forEach((s) => (next[s.id] = true));
        if (plan.session) {
          plan.session.records.forEach((r) => (next[r.studentId] = r.status === "PRESENT"));
          setTestId(plan.session.testId || "");
          const who = plan.session.updatedBy?.name || plan.session.markedBy?.name;
          const when = plan.session.updatedBy ? plan.session.updatedAt : plan.session.markedAt;
          if (who) setAuditNote(`Last updated by ${who} at ${new Date(when).toLocaleString()}`);
        }
        setStatuses(next);
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to load this lecture"))
      .finally(() => setLoading(false));
  }, [assignmentId, planId]);

  const filteredRoster = useMemo(() => {
    if (!search.trim()) return roster;
    const q = search.trim().toLowerCase();
    return roster.filter((s) => s.name.toLowerCase().includes(q) || (s.rollNumber || "").toLowerCase().includes(q));
  }, [roster, search]);

  const presentCount = roster.filter((s) => statuses[s.id] !== false).length;
  const absentCount = roster.length - presentCount;

  const requiresTest = plan && plan.lectureType !== "REGULAR";
  const canSave = !requiresTest || !!testId;

  function toggle(studentId) {
    setStatuses((prev) => ({ ...prev, [studentId]: prev[studentId] === false }));
  }

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const records = roster.map((s) => ({ studentId: s.id, status: statuses[s.id] === false ? "ABSENT" : "PRESENT" }));
      await api.post(`/attendance/assignments/${assignmentId}/plans/${planId}/attendance`, {
        testId: requiresTest ? testId : undefined,
        records,
      });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div>
        <Navbar />
        <div style={{ padding: 48 }} className="mono">Loading…</div>
      </div>
    );
  }

  if (error && !plan) {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>
          <p style={{ color: "var(--rust)" }}>{error}</p>
          <Link to={`/staff/attendance/${assignmentId}`} className="btn btn-ghost" style={{ marginTop: 16 }}>Back</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
        <Link to={`/staff/attendance/${assignmentId}`} className="btn btn-ghost" style={{ fontSize: 12 }}>← Back</Link>
        <div style={{ marginTop: 12 }}>
          <h1 style={{ fontSize: 20 }}>{plan.topic}</h1>
          <ChalkUnderline />
          <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>
            {plan.subject} · Lecture {plan.lectureNumber} · {plan.scheduleDate.slice(0, 10)} · {plan.slotLabel} ({plan.startTime}–{plan.endTime}) · {LECTURE_TYPE_LABELS[plan.lectureType] || plan.lectureType}
          </p>
          {auditNote && <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 6 }}>{auditNote}</p>}
        </div>

        {requiresTest && (
          <div className="card" style={{ padding: 16, marginTop: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Select Test</label>
            <select
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
            >
              <option value="">Select test…</option>
              {eligibleTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {eligibleTests.length === 0 && (
              <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6 }}>
                No currently-active, attendance-mandatory tests are available for this class right now.
              </p>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: 16, marginTop: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 12, fontSize: 13 }}>
            <span>Total: <strong>{roster.length}</strong></span>
            <span style={{ color: "var(--mint)" }}>Present: <strong>{presentCount}</strong></span>
            <span style={{ color: "var(--rust)" }}>Absent: <strong>{absentCount}</strong></span>
          </div>
          <input
            style={{ flex: 1, minWidth: 180, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 }}
            placeholder="Search by name or roll number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{error}</p>}
        {saved && <p style={{ color: "var(--mint)", fontSize: 13, marginTop: 12 }}>Attendance saved.</p>}

        <div style={{ display: "grid", gap: 6, marginTop: 16 }}>
          {filteredRoster.map((s) => {
            const present = statuses[s.id] !== false;
            return (
              <div key={s.id} className="card" style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginRight: 10 }}>{s.rollNumber || "—"}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12, color: present ? "var(--mint)" : "var(--rust)", fontWeight: 600 }}>{present ? "Present" : "Absent"}</span>
                  <Toggle present={present} onChange={() => toggle(s.id)} />
                </div>
              </div>
            );
          })}
          {filteredRoster.length === 0 && (
            <p style={{ fontSize: 13, color: "var(--ink-dim)", textAlign: "center", padding: 24 }}>No students match "{search}".</p>
          )}
        </div>
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--bg, #fff)", borderTop: "1px solid var(--line)", padding: "12px 24px", display: "flex", justifyContent: "center" }}>
        <button className="btn btn-primary" style={{ padding: "10px 32px" }} onClick={save} disabled={saving || !canSave || roster.length === 0}>
          {saving ? "Saving…" : "Save Attendance"}
        </button>
      </div>
    </div>
  );
}

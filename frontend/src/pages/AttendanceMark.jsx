import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Speed-optimized attendance form: cascading Department -> Division -> Class dropdowns built
// entirely from this user's own assigned classes (my-classes already enforces "staff only sees
// what they're assigned to" — nothing extra to filter here), then Date/Lecture Number/Lecture
// Type/Active Test, then a roster defaulting every student to Present. Selecting an already-
// marked date+lecture combination transparently switches this into edit mode (same form,
// pre-filled) rather than being a separate flow.
export default function AttendanceMark() {
  const [myClasses, setMyClasses] = useState(null);
  const [departmentId, setDepartmentId] = useState("");
  const [divisionId, setDivisionId] = useState("");
  const [classId, setClassId] = useState("");
  const [date, setDate] = useState(todayStr());
  const [lectureNumber, setLectureNumber] = useState("");
  const [lectureType, setLectureType] = useState("REGULAR");
  const [testId, setTestId] = useState("");
  const [semester, setSemester] = useState("");

  const [roster, setRoster] = useState([]);
  const [activeTests, setActiveTests] = useState([]);
  const [statuses, setStatuses] = useState({}); // studentId -> "PRESENT" | "ABSENT"
  const [isEditingExisting, setIsEditingExisting] = useState(false);

  const [loadingContext, setLoadingContext] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    api.get("/attendance/my-classes").then((res) => setMyClasses(res.data)).catch(() => setMyClasses([]));
  }, []);

  const departments = useMemo(() => {
    const map = new Map();
    (myClasses || []).forEach((c) => {
      if (c.division?.department) map.set(c.division.department.id, c.division.department.name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [myClasses]);

  const divisions = useMemo(() => {
    const map = new Map();
    (myClasses || []).forEach((c) => {
      if (c.division && (!departmentId || c.division.departmentId === departmentId)) {
        map.set(c.division.id, c.division.name);
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [myClasses, departmentId]);

  const filteredClasses = useMemo(() => {
    return (myClasses || []).filter((c) => (!departmentId || c.division?.departmentId === departmentId) && (!divisionId || c.divisionId === divisionId));
  }, [myClasses, departmentId, divisionId]);

  const selectedClass = filteredClasses.find((c) => c.id === classId) || (myClasses || []).find((c) => c.id === classId);

  // Class chosen -> load roster, the suggested next lecture number, and currently-active tests.
  useEffect(() => {
    if (!classId) {
      setRoster([]);
      setActiveTests([]);
      return;
    }
    setLoadingContext(true);
    setError("");
    api
      .get(`/attendance/classes/${classId}/context`)
      .then((res) => {
        setRoster(res.data.roster);
        setActiveTests(res.data.activeTests);
        setLectureNumber(String(res.data.suggestedLectureNumber));
        const defaults = {};
        res.data.roster.forEach((s) => (defaults[s.id] = "PRESENT"));
        setStatuses(defaults);
        setIsEditingExisting(false);
      })
      .catch((err) => setError(err.response?.data?.error || "Failed to load class"))
      .finally(() => setLoadingContext(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  // Date/lecture-number changed -> check whether that lecture was already marked, and if so
  // pre-fill the form with what's already there instead of blank Present-for-everyone. Depends
  // on `roster` too (not just classId/date/lectureNumber): the class-context effect above fetches
  // the roster asynchronously, and seeding `next` from a stale/empty roster closure here would
  // silently mis-fill the edit flow — this must re-run once the current class's roster has
  // actually arrived, not just when the identifying fields change.
  useEffect(() => {
    if (!classId || !date || !lectureNumber || roster.length === 0) return;
    setLoadingSession(true);
    api
      .get(`/attendance/classes/${classId}/session`, { params: { date, lectureNumber } })
      .then((res) => {
        const session = res.data.session;
        if (session) {
          setLectureType(session.lectureType);
          setTestId(session.testId || "");
          setSemester(session.semester || "");
          const next = {};
          roster.forEach((s) => (next[s.id] = "PRESENT"));
          session.records.forEach((r) => (next[r.studentId] = r.status));
          setStatuses(next);
          setIsEditingExisting(true);
        } else {
          setIsEditingExisting(false);
        }
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, lectureNumber, roster]);

  function toggleStatus(studentId) {
    setStatuses((prev) => ({ ...prev, [studentId]: prev[studentId] === "ABSENT" ? "PRESENT" : "ABSENT" }));
  }

  const presentCount = roster.filter((s) => statuses[s.id] !== "ABSENT").length;

  async function save() {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const records = roster.map((s) => ({ studentId: s.id, status: statuses[s.id] === "ABSENT" ? "ABSENT" : "PRESENT" }));
      await api.post(`/attendance/classes/${classId}/session`, {
        date, lectureNumber: Number(lectureNumber), lectureType, testId: lectureType === "EXAM" ? testId : undefined, semester, records,
      });
      setMessage(isEditingExisting ? "Attendance updated." : "Attendance saved.");
      setIsEditingExisting(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save attendance");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Mark Attendance</h1>
            <ChalkUnderline />
          </div>
          <Link to="/staff/attendance/reports" className="btn btn-ghost">View Reports</Link>
        </div>

        {myClasses !== null && myClasses.length === 0 && (
          <div className="card" style={{ padding: 24, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            You haven't been assigned to any classes for attendance yet. Ask an admin to assign you a class.
          </div>
        )}

        {myClasses && myClasses.length > 0 && (
          <>
            <div className="card" style={{ padding: 20, marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
              <div>
                <label style={labelStyle}>Department</label>
                <select style={inputStyle} value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setDivisionId(""); setClassId(""); }}>
                  <option value="">All</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Division</label>
                <select style={inputStyle} value={divisionId} onChange={(e) => { setDivisionId(e.target.value); setClassId(""); }}>
                  <option value="">All</option>
                  {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Class</label>
                <select style={inputStyle} value={classId} onChange={(e) => setClassId(e.target.value)}>
                  <option value="">Select class…</option>
                  {filteredClasses.map((c) => <option key={c.id} value={c.id}>{c.name}{c.batchYear ? ` (${c.batchYear})` : ""}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Academic Year</label>
                <input style={inputStyle} value={selectedClass?.batchYear || ""} disabled placeholder="—" />
              </div>
              <div>
                <label style={labelStyle}>Semester (optional)</label>
                <input style={inputStyle} value={semester} onChange={(e) => setSemester(e.target.value)} placeholder="e.g. 3" />
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" style={inputStyle} value={date} onChange={(e) => setDate(e.target.value)} max={todayStr()} />
              </div>
              <div>
                <label style={labelStyle}>Lecture Number</label>
                <input type="number" min="1" style={inputStyle} value={lectureNumber} onChange={(e) => setLectureNumber(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Lecture Type</label>
                <select style={inputStyle} value={lectureType} onChange={(e) => setLectureType(e.target.value)}>
                  <option value="REGULAR">Regular Class</option>
                  <option value="PRACTICE_TEST">Practice Test</option>
                  <option value="EXAM">Exam</option>
                </select>
              </div>
              {lectureType === "EXAM" && (
                <div>
                  <label style={labelStyle}>Active Test</label>
                  <select style={inputStyle} value={testId} onChange={(e) => setTestId(e.target.value)}>
                    <option value="">Select test…</option>
                    {activeTests.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
                  </select>
                  {activeTests.length === 0 && <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>No tests are currently active for this class.</p>}
                </div>
              )}
            </div>

            {isEditingExisting && !loadingSession && (
              <p style={{ fontSize: 12, color: "var(--amber)", marginTop: 10 }}>
                Attendance for this date/lecture is already marked — editing it below.
              </p>
            )}
            {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 10 }}>{error}</p>}
            {message && <p style={{ color: "var(--mint)", fontSize: 13, marginTop: 10 }}>{message}</p>}

            {classId && (loadingContext || loadingSession) && (
              <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 20 }}>Loading…</p>
            )}

            {classId && !loadingContext && roster.length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h3 style={{ fontSize: 15 }}>Students ({roster.length}) — {presentCount} present, {roster.length - presentCount} absent</h3>
                  <button className="btn btn-primary" onClick={save} disabled={saving || (lectureType === "EXAM" && !testId)}>
                    {saving ? "Saving…" : isEditingExisting ? "Update Attendance" : "Save Attendance"}
                  </button>
                </div>
                <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                  {roster.map((s) => {
                    const absent = statuses[s.id] === "ABSENT";
                    return (
                      <div
                        key={s.id}
                        className="card"
                        style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", background: absent ? "#F7E4E0" : undefined }}
                      >
                        <div>
                          <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginRight: 10 }}>{s.rollNumber || "—"}</span>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                        </div>
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: "4px 12px", background: absent ? "var(--rust)" : "var(--mint)", color: "#fff", border: "none" }}
                          onClick={() => toggleStatus(s.id)}
                        >
                          {absent ? "Absent" : "Present"}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div style={{ marginTop: 16, textAlign: "right" }}>
                  <button className="btn btn-primary" onClick={save} disabled={saving || (lectureType === "EXAM" && !testId)}>
                    {saving ? "Saving…" : isEditingExisting ? "Update Attendance" : "Save Attendance"}
                  </button>
                </div>
              </div>
            )}

            {classId && !loadingContext && roster.length === 0 && (
              <div className="card" style={{ padding: 24, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
                No students in this class yet.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

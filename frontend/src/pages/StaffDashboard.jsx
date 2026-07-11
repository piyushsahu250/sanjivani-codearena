import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

function statusOf(test) {
  const now = new Date();
  const start = new Date(test.startTime);
  const end = new Date(test.endTime);
  if (!test.isPublished) return { label: "Draft", color: "var(--ink-dim)" };
  if (now < start) return { label: "Scheduled", color: "var(--amber-dark)" };
  if (now > end) return { label: "Completed", color: "var(--ink-dim)" };
  return { label: "Active", color: "var(--mint)" };
}

export default function StaffDashboard() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);

  const [nameFilter, setNameFilter] = useState("");
  const [instituteFilter, setInstituteFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [batchFilter, setBatchFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    api.get("/tests").then((res) => setTests(res.data));
  }

  async function togglePublish(test) {
    await api.patch(`/tests/${test.id}/publish`, { isPublished: !test.isPublished });
    refresh();
  }

  async function deleteTest(test) {
    await api.delete(`/tests/${test.id}`);
    refresh();
  }

  async function duplicateTest(test) {
    await api.post(`/tests/${test.id}/duplicate`);
    refresh();
  }

  // Distinct filter option lists, derived from whatever assignments actually exist
  const { instituteOptions, classOptions, batchOptions } = useMemo(() => {
    const institutes = new Map();
    const classes = new Map();
    const batches = new Set();
    for (const t of tests) {
      for (const tc of t.classes) {
        if (tc.class?.institute) institutes.set(tc.class.institute.id, tc.class.institute.name);
        if (tc.class) classes.set(tc.class.id, tc.class.name);
        if (tc.class?.batchYear) batches.add(tc.class.batchYear);
      }
    }
    return {
      instituteOptions: [...institutes.entries()],
      classOptions: [...classes.entries()],
      batchOptions: [...batches].sort(),
    };
  }, [tests]);

  const filtered = tests.filter((t) => {
    if (nameFilter && !t.title.toLowerCase().includes(nameFilter.toLowerCase())) return false;
    if (instituteFilter && !t.classes.some((tc) => tc.class?.institute?.id === instituteFilter)) return false;
    if (classFilter && !t.classes.some((tc) => tc.class?.id === classFilter)) return false;
    if (batchFilter && !t.classes.some((tc) => tc.class?.batchYear === batchFilter)) return false;
    if (statusFilter && statusOf(t).label !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Staff control room</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/staff/questions" className="btn btn-ghost">Question Bank</Link>
            <Link to="/staff/learning" className="btn btn-ghost">Learning Management</Link>
            <Link to="/staff/gamification" className="btn btn-ghost">🏆 Gamification</Link>
            <Link to="/staff/resumes" className="btn btn-ghost">📄 Resumes</Link>
            <Link to="/staff/interviews" className="btn btn-ghost">🎤 Interview Prep</Link>
            <Link to="/staff/students" className="btn btn-ghost">Student Performance</Link>
            <Link to="/staff/tests/new" className="btn btn-primary">+ New test</Link>
          </div>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 24, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, flex: "2 1 200px" }}
            placeholder="Search by test name…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
          />
          <select style={{ ...inputStyle, flex: "1 1 160px" }} value={instituteFilter} onChange={(e) => { setInstituteFilter(e.target.value); setClassFilter(""); }}>
            <option value="">All institutes</option>
            {instituteOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select style={{ ...inputStyle, flex: "1 1 140px" }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">All classes</option>
            {classOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <select style={{ ...inputStyle, flex: "1 1 120px" }} value={batchFilter} onChange={(e) => setBatchFilter(e.target.value)}>
            <option value="">All batches</option>
            {batchOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select style={{ ...inputStyle, flex: "1 1 130px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Active">Active</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          {filtered.map((test) => {
            const status = statusOf(test);
            const studentCount = test.classes.length > 0
              ? test.classes.reduce((sum, tc) => sum + (tc.class?._count?.users || 0), 0)
              : null;
            return (
              <div key={test.id} className="card" style={{ padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <h3 style={{ fontSize: 18 }}>{test.title}</h3>
                      <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: status.color }}>● {status.label}</span>
                    </div>
                    <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                      {test._count?.questions || 0} questions · {test._count?.attempts || 0} attempts
                      {studentCount !== null && ` · ${studentCount} assigned student${studentCount === 1 ? "" : "s"}`}
                    </p>
                    <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                      Created by {test.createdBy?.name || "—"} · {new Date(test.createdAt).toLocaleDateString()}
                    </p>

                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                      {test.classes.length === 0 ? (
                        <span className="badge">All classes</span>
                      ) : (
                        test.classes.map((tc) => (
                          <span key={tc.id} className="badge">
                            {tc.class?.institute?.name || "—"} · {tc.class?.name || "—"}
                            {tc.class?.batchYear ? ` (${tc.class.batchYear})` : ""}
                          </span>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link to={`/staff/tests/${test.id}/preview`} className="btn btn-ghost">Preview</Link>
                    <Link to={`/staff/tests/${test.id}/edit`} className="btn btn-ghost">Edit</Link>
                    <button className="btn btn-ghost" onClick={() => duplicateTest(test)}>Duplicate</button>
                    <Link to={`/staff/tests/${test.id}/results`} className="btn btn-ghost">Results</Link>
                    <button className="btn btn-dark" onClick={() => togglePublish(test)}>
                      {test.isPublished ? "Unpublish" : "Publish"}
                    </button>
                    {user.role === "ADMIN" && (
                      <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => deleteTest(test)}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              {tests.length === 0 ? "No tests yet. Create a question bank first, then assemble a test." : "No tests match these filters."}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

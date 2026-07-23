import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };
const TABS = ["Departments & Divisions", "Assign Classes", "Attendance Assignment", "Attendance Rules"];

// Admin-only structural setup for Attendance Management: this platform's existing hierarchy was
// Institute -> Class -> Student, with no Department/Division concept — this page is where an
// admin builds that new layer (Department -> Division), then assigns *existing* Class rows into
// a Division (never creating duplicate class/student data) and assigns staff to classes so they
// can mark attendance only for what they're given access to.
export default function AttendanceStructure() {
  const [tab, setTab] = useState(0);
  const [departments, setDepartments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [staff, setStaff] = useState([]);
  const [error, setError] = useState("");

  function loadAll() {
    api.get("/attendance/admin/departments").then((res) => setDepartments(res.data));
    api.get("/attendance/admin/divisions").then((res) => setDivisions(res.data));
    api.get("/attendance/admin/classes").then((res) => setClasses(res.data));
    api.get("/attendance/admin/staff").then((res) => setStaff(res.data));
  }
  useEffect(loadAll, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Attendance Setup</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
        </div>
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Departments and Divisions are new — everything else (institutes, classes, students) is reused from your
          existing data, never duplicated. A class only becomes available for attendance once it's assigned to a
          Division here.
        </p>

        <div style={{ display: "flex", gap: 8, marginTop: 24, borderBottom: "1px solid var(--line)" }}>
          {TABS.map((t, i) => (
            <button
              key={t}
              className="btn btn-ghost"
              style={{ borderRadius: "8px 8px 0 0", borderBottom: tab === i ? "2px solid var(--ink)" : "2px solid transparent", fontWeight: tab === i ? 700 : 400 }}
              onClick={() => setTab(i)}
            >
              {t}
            </button>
          ))}
        </div>
        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{error}</p>}

        {tab === 0 && (
          <DepartmentsDivisionsTab departments={departments} divisions={divisions} onChange={loadAll} setError={setError} />
        )}
        {tab === 1 && (
          <AssignClassesTab classes={classes} divisions={divisions} onChange={loadAll} setError={setError} />
        )}
        {tab === 2 && (
          <DivisionAssignmentTab staff={staff} setError={setError} />
        )}
        {tab === 3 && <AttendanceRulesTab setError={setError} />}
      </div>
    </div>
  );
}

// Display-only warning threshold: shown on a student's own attendance view when their per-subject
// percentage falls below it. Never blocks anything (no test/login enforcement) — purely
// informational, per the explicit scope decided for this feature.
function AttendanceRulesTab({ setError }) {
  const [value, setValue] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get("/attendance/admin/rules")
      .then((res) => setValue(res.data.attendanceMinPercent != null ? String(res.data.attendanceMinPercent) : ""))
      .catch((err) => setError(err.response?.data?.error || "Failed to load attendance rules"))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      await api.patch("/attendance/admin/rules", { attendanceMinPercent: value === "" ? null : value });
      setSaved(true);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to save attendance rules");
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return <p style={{ marginTop: 20, color: "var(--ink-dim)", fontSize: 13 }}>Loading…</p>;

  return (
    <div className="card" style={{ padding: 20, marginTop: 20, maxWidth: 420 }}>
      <label style={labelStyle}>Minimum Attendance Percentage</label>
      <p style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 10 }}>
        Students below this percentage (per subject) see a warning badge on their own Attendance page. This is
        informational only — it never blocks a test or any other feature. Leave blank to turn the warning off.
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="number" min="0" max="100" style={{ ...inputStyle, maxWidth: 120 }}
          placeholder="e.g. 75" value={value} onChange={(e) => setValue(e.target.value)}
        />
        <span style={{ fontSize: 13 }}>%</span>
        <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      </div>
      {saved && <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8 }}>Saved.</p>}
    </div>
  );
}

function DepartmentsDivisionsTab({ departments, divisions, onChange, setError }) {
  const [deptName, setDeptName] = useState("");
  const [savingDept, setSavingDept] = useState(false);
  const [divForm, setDivForm] = useState({ name: "", departmentId: "" });
  const [savingDiv, setSavingDiv] = useState(false);

  async function addDepartment(e) {
    e.preventDefault();
    if (!deptName.trim()) return;
    setSavingDept(true);
    setError("");
    try {
      await api.post("/attendance/admin/departments", { name: deptName.trim() });
      setDeptName("");
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add department");
    } finally {
      setSavingDept(false);
    }
  }

  async function addDivision(e) {
    e.preventDefault();
    if (!divForm.name.trim() || !divForm.departmentId) return;
    setSavingDiv(true);
    setError("");
    try {
      await api.post("/attendance/admin/divisions", { name: divForm.name.trim(), departmentId: divForm.departmentId });
      setDivForm({ name: "", departmentId: divForm.departmentId });
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add division");
    } finally {
      setSavingDiv(false);
    }
  }

  async function deleteDept(id) {
    try {
      await api.delete(`/attendance/admin/departments/${id}`);
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete department");
    }
  }

  async function deleteDiv(id) {
    try {
      await api.delete(`/attendance/admin/divisions/${id}`);
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to delete division");
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginTop: 20 }}>
      <div>
        <h3 style={{ fontSize: 15 }}>Departments</h3>
        <form onSubmit={addDepartment} style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input style={inputStyle} placeholder="e.g. Computer Science" value={deptName} onChange={(e) => setDeptName(e.target.value)} />
          <button className="btn btn-primary" disabled={savingDept}>Add</button>
        </form>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {departments.map((d) => (
            <div key={d.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{d._count?.divisions ?? 0} division(s)</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--rust)" }} onClick={() => deleteDept(d.id)}>Delete</button>
            </div>
          ))}
          {departments.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No departments yet.</p>}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: 15 }}>Divisions</h3>
        <form onSubmit={addDivision} style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <select style={{ ...inputStyle, flex: "1 1 150px" }} value={divForm.departmentId} onChange={(e) => setDivForm({ ...divForm, departmentId: e.target.value })}>
            <option value="">Select department…</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <input style={{ ...inputStyle, flex: "1 1 140px" }} placeholder="e.g. A" value={divForm.name} onChange={(e) => setDivForm({ ...divForm, name: e.target.value })} />
          <button className="btn btn-primary" disabled={savingDiv}>Add</button>
        </form>
        <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
          {divisions.map((d) => (
            <div key={d.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{d.department?.name} · {d._count?.classes ?? 0} class(es)</div>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--rust)" }} onClick={() => deleteDiv(d.id)}>Delete</button>
            </div>
          ))}
          {divisions.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No divisions yet.</p>}
        </div>
      </div>
    </div>
  );
}

function AssignClassesTab({ classes, divisions, onChange, setError }) {
  async function setDivision(classId, divisionId) {
    try {
      await api.patch(`/attendance/admin/classes/${classId}/division`, { divisionId: divisionId || null });
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to update class");
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
        Assign each existing class into a division. A class with no division isn't available for attendance yet.
      </p>
      <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
        {classes.map((cls) => (
          <div key={cls.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13 }}>{cls.name} {cls.batchYear && <span className="badge" style={{ marginLeft: 6 }}>{cls.batchYear}</span>}</div>
              <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{cls.institute?.name} · {cls._count?.users ?? 0} student(s)</div>
            </div>
            <select style={{ ...inputStyle, maxWidth: 260 }} value={cls.divisionId || ""} onChange={(e) => setDivision(cls.id, e.target.value)}>
              <option value="">— No division —</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.department?.name} / {d.name}</option>)}
            </select>
          </div>
        ))}
        {classes.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No classes yet.</p>}
      </div>
    </div>
  );
}

// Admin Attendance Assignment: Batch -> Fetch -> table of every division in that batch, one row
// each, "Assigned Staff" as a searchable field (native <datalist>, filters as you type) scoped to
// this institute's staff. Assigning/re-assigning takes effect immediately — POST /staff-assignments
// finds any existing assignment for that division and updates its staff in place (one staff per
// division), so there's never a second row to reconcile.
function DivisionAssignmentTab({ staff, setError }) {
  const [batches, setBatches] = useState([]);
  const [batchYear, setBatchYear] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchDrafts, setSearchDrafts] = useState({}); // classId -> in-progress search text

  useEffect(() => {
    api.get("/attendance/admin/batches").then((res) => setBatches(res.data)).catch(() => setBatches([]));
  }, []);

  async function fetchTable() {
    if (!batchYear) return;
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/attendance/admin/division-table", { params: { batchYear } });
      setRows(data);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load divisions");
    } finally {
      setLoading(false);
    }
  }

  async function assignStaff(row, staffId) {
    if (!staffId) return;
    try {
      await api.post("/attendance/admin/staff-assignments", { staffId, classId: row.classId, semester: row.assignment?.semester || "1" });
      setSearchDrafts((prev) => { const next = { ...prev }; delete next[row.classId]; return next; });
      fetchTable();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to assign staff");
    }
  }

  function handleSearchInput(row, text) {
    setSearchDrafts((prev) => ({ ...prev, [row.classId]: text }));
    const match = staff.find((s) => `${s.name} (${s.email})` === text);
    if (match) assignStaff(row, match.id);
  }

  return (
    <div style={{ marginTop: 20 }}>
      <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
        Each division gets exactly one assigned staff member. Assigning a new staff member replaces the current one.
      </p>
      <div className="card" style={{ padding: 16, marginTop: 10, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label style={labelStyle}>Batch</label>
          <select style={inputStyle} value={batchYear} onChange={(e) => setBatchYear(e.target.value)}>
            <option value="">Select batch…</option>
            {batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={fetchTable} disabled={!batchYear || loading}>{loading ? "Fetching…" : "Fetch"}</button>
      </div>

      <datalist id="attendance-staff-options">
        {staff.map((s) => <option key={s.id} value={`${s.name} (${s.email})`} />)}
      </datalist>

      {rows && (
        <div style={{ marginTop: 20, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", color: "var(--ink-dim)" }}>
                {["Department", "Division", "Assigned Staff", "Action"].map((h) => <th key={h} style={{ padding: "8px 10px" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.classId} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "8px 10px" }}>{r.department.name}</td>
                  <td style={{ padding: "8px 10px" }}>{r.division.name}</td>
                  <td style={{ padding: "8px 10px" }}>
                    {r.assignment ? r.assignment.staff.name : <span style={{ color: "var(--ink-dim)" }}>Not Assigned</span>}
                  </td>
                  <td style={{ padding: "8px 10px" }}>
                    <input
                      style={{ ...inputStyle, maxWidth: 240 }}
                      list="attendance-staff-options"
                      placeholder={r.assignment ? "Change Staff…" : "Select Staff…"}
                      value={searchDrafts[r.classId] ?? ""}
                      onChange={(e) => handleSearchInput(r, e.target.value)}
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>No divisions found for this batch.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

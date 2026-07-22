import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };
const TABS = ["Departments & Divisions", "Assign Classes", "Assign Staff"];

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
          <AssignStaffTab classes={classes} staff={staff} onChange={loadAll} setError={setError} />
        )}
      </div>
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

function AssignStaffTab({ classes, staff, onChange, setError }) {
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedStaffId, setSelectedStaffId] = useState("");
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  async function assign() {
    if (!selectedClassId || !selectedStaffId) return;
    try {
      await api.post("/attendance/admin/staff-assignments", { staffId: selectedStaffId, classId: selectedClassId });
      setSelectedStaffId("");
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to assign staff");
    }
  }

  async function unassign(id) {
    try {
      await api.delete(`/attendance/admin/staff-assignments/${id}`);
      onChange();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to remove assignment");
    }
  }

  return (
    <div style={{ marginTop: 20 }}>
      <div className="card" style={{ padding: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px" }}>
          <label style={labelStyle}>Class</label>
          <select style={inputStyle} value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)}>
            <option value="">Select class…</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name} {c.batchYear ? `(${c.batchYear})` : ""}{c.division ? ` — ${c.division.department?.name}/${c.division.name}` : " — no division"}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 220px" }}>
          <label style={labelStyle}>Staff member</label>
          <select style={inputStyle} value={selectedStaffId} onChange={(e) => setSelectedStaffId(e.target.value)}>
            <option value="">Select staff…</option>
            {staff.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.email})</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={assign} disabled={!selectedClassId || !selectedStaffId}>Assign</button>
      </div>

      {selectedClass && (
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: 15 }}>Staff assigned to {selectedClass.name}</h3>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {(selectedClass.staffAssignments || []).map((a) => (
              <div key={a.id} className="card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13 }}>{a.staff.name} <span className="mono" style={{ color: "var(--ink-dim)", fontSize: 11 }}>({a.staff.email})</span></span>
                <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--rust)" }} onClick={() => unassign(a.id)}>Remove</button>
              </div>
            ))}
            {(!selectedClass.staffAssignments || selectedClass.staffAssignments.length === 0) && (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No staff assigned to this class yet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 };

// Filterable attendance report — STAFF automatically sees only their assigned classes (enforced
// server-side; the department/division/class filter options here are derived from the same
// scoped my-classes list the marking form uses, so a staff member never even sees a filter option
// for a class they can't access). ADMIN sees everything in their institute scope.
export default function AttendanceReports() {
  const [myClasses, setMyClasses] = useState([]);
  const [filters, setFilters] = useState({
    date: "", dateFrom: "", dateTo: "", departmentId: "", divisionId: "", classId: "", lectureType: "", studentId: "",
  });
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    api.get("/attendance/my-classes").then((res) => setMyClasses(res.data)).catch(() => setMyClasses([]));
  }, []);

  const departments = useMemo(() => {
    const map = new Map();
    myClasses.forEach((c) => c.division?.department && map.set(c.division.department.id, c.division.department.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [myClasses]);

  const divisions = useMemo(() => {
    const map = new Map();
    myClasses.forEach((c) => {
      if (c.division && (!filters.departmentId || c.division.departmentId === filters.departmentId)) map.set(c.division.id, c.division.name);
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [myClasses, filters.departmentId]);

  const classOptions = useMemo(() => {
    return myClasses.filter((c) => (!filters.departmentId || c.division?.departmentId === filters.departmentId) && (!filters.divisionId || c.divisionId === filters.divisionId));
  }, [myClasses, filters.departmentId, filters.divisionId]);

  function set(field, value) {
    setFilters((f) => ({ ...f, [field]: value }));
  }

  function activeParams() {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    return params;
  }

  async function runReport() {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/attendance/reports", { params: activeParams() });
      setRows(data.rows);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  async function exportAs(format) {
    setExporting(format);
    try {
      const { data } = await api.get("/attendance/reports", { params: { ...activeParams(), format }, responseType: "blob" });
      const mime = format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "text/csv";
      const url = URL.createObjectURL(new Blob([data], { type: mime }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${new Date().toISOString().slice(0, 10)}.${format}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || "Export failed");
    } finally {
      setExporting("");
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Attendance Reports</h1>
            <ChalkUnderline />
          </div>
          <Link to="/staff/attendance" className="btn btn-ghost">Mark Attendance</Link>
        </div>

        <div className="card" style={{ padding: 16, marginTop: 24, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          <div>
            <label style={labelStyle}>Date</label>
            <input type="date" style={inputStyle} value={filters.date} onChange={(e) => set("date", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>From</label>
            <input type="date" style={inputStyle} value={filters.dateFrom} onChange={(e) => set("dateFrom", e.target.value)} disabled={!!filters.date} />
          </div>
          <div>
            <label style={labelStyle}>To</label>
            <input type="date" style={inputStyle} value={filters.dateTo} onChange={(e) => set("dateTo", e.target.value)} disabled={!!filters.date} />
          </div>
          <div>
            <label style={labelStyle}>Department</label>
            <select style={inputStyle} value={filters.departmentId} onChange={(e) => { set("departmentId", e.target.value); set("divisionId", ""); set("classId", ""); }}>
              <option value="">All</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Division</label>
            <select style={inputStyle} value={filters.divisionId} onChange={(e) => { set("divisionId", e.target.value); set("classId", ""); }}>
              <option value="">All</option>
              {divisions.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Class</label>
            <select style={inputStyle} value={filters.classId} onChange={(e) => set("classId", e.target.value)}>
              <option value="">All</option>
              {classOptions.map((c) => <option key={c.id} value={c.id}>{c.name}{c.batchYear ? ` (${c.batchYear})` : ""}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Lecture Type</label>
            <select style={inputStyle} value={filters.lectureType} onChange={(e) => set("lectureType", e.target.value)}>
              <option value="">All</option>
              <option value="REGULAR">Regular Class</option>
              <option value="PRACTICE_TEST">Practice Test</option>
              <option value="EXAM">Exam</option>
            </select>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap" }}>
          <button className="btn btn-primary" onClick={runReport} disabled={loading}>{loading ? "Loading…" : "Run Report"}</button>
          <button className="btn btn-ghost" onClick={() => exportAs("csv")} disabled={!!exporting}>{exporting === "csv" ? "Exporting…" : "Export CSV"}</button>
          <button className="btn btn-ghost" onClick={() => exportAs("xlsx")} disabled={!!exporting}>{exporting === "xlsx" ? "Exporting…" : "Export Excel"}</button>
        </div>
        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 10 }}>{error}</p>}

        {rows && (
          <div style={{ marginTop: 24, overflowX: "auto" }}>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>{rows.length} record(s)</p>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8, fontSize: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", color: "var(--ink-dim)" }}>
                  {["Date", "Department", "Division", "Class", "Semester", "Lecture #", "Lecture Type", "Test", "Roll Number", "Student Name", "Status"].map((h) => (
                    <th key={h} style={{ padding: "6px 8px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    {["Date", "Department", "Division", "Class", "Semester", "Lecture #", "Lecture Type", "Test", "Roll Number", "Student Name"].map((k) => (
                      <td key={k} style={{ padding: "6px 8px" }} className={k === "Roll Number" ? "mono" : undefined}>{r[k]}</td>
                    ))}
                    <td style={{ padding: "6px 8px", fontWeight: 700, color: r.Status === "ABSENT" ? "var(--rust)" : "var(--mint)" }}>{r.Status}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={11} style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>No records match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

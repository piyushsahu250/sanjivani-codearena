import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

// Landing page for Attendance — no more manual Department/Division/Class dropdowns. Every card is
// one staff-class-subject assignment (my-assignments already enforces "staff only sees what
// they're assigned to"), showing exactly the fields the redesign asked for, with the two primary
// actions routing straight into the assignment's detail page.
export default function AttendanceHome() {
  const [assignments, setAssignments] = useState(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/attendance/my-assignments")
      .then((res) => setAssignments(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load your classes"));
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Attendance</h1>
            <ChalkUnderline />
          </div>
          <Link to="/staff/attendance/reports" className="btn btn-ghost">View Reports</Link>
        </div>

        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 16 }}>{error}</p>}

        {assignments === null && !error && <p style={{ marginTop: 24, color: "var(--ink-dim)", fontSize: 13 }}>Loading…</p>}

        {assignments !== null && assignments.length === 0 && (
          <div className="card" style={{ padding: 24, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            You haven't been assigned to any classes for attendance yet. Ask an admin to assign you a class and subject.
          </div>
        )}

        {assignments && assignments.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16, marginTop: 24 }}>
            {assignments.map((a) => (
              <div key={a.id} className="card" style={{ padding: 20, display: "flex", flexDirection: "column" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{a.subject}</div>
                <div style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8, display: "grid", gap: 3 }}>
                  <div>Department: {a.class.division?.department?.name || "—"}</div>
                  <div>Division: {a.class.division?.name || "—"}</div>
                  <div>Class: {a.class.name}</div>
                  <div>Academic Year: {a.class.batchYear || "—"}</div>
                  <div>Semester: {a.semester}</div>
                  <div>Faculty: {a.staff.name}</div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => navigate(`/staff/attendance/${a.id}?tab=plans&addPlan=1`)}>Add Plan</button>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => navigate(`/staff/attendance/${a.id}?tab=mark`)}>Mark Attendance</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

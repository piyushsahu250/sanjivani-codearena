import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import { useConfirm } from "../context/ConfirmContext";

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

// Read-only by design — academic groups (Institute -> Batch -> Department -> Section) are derived
// automatically from registered students (Bulk Upload/Registration, or the one-time migration from
// the old Class system). There's no "create a group" flow here; a typo'd Department/Section is
// corrected via the per-student edit form instead, which re-resolves the group on save.
export default function AcademicGroups() {
  const confirmDialog = useConfirm();
  const [groups, setGroups] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [filterInstituteId, setFilterInstituteId] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [roster, setRoster] = useState(null);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [resettingId, setResettingId] = useState(null);
  const [resetResult, setResetResult] = useState(null);

  function load(instituteId) {
    api.get("/academic-groups", { params: instituteId ? { instituteId } : {} }).then((res) => setGroups(res.data));
  }

  useEffect(() => {
    api.get("/institutes").then((res) => setInstitutes(res.data));
    load();
  }, []);

  useEffect(() => {
    load(filterInstituteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInstituteId]);

  async function toggleRoster(group) {
    if (expandedId === group.id) {
      setExpandedId(null);
      setRoster(null);
      return;
    }
    setExpandedId(group.id);
    setRoster(null);
    setRosterLoading(true);
    try {
      const { data } = await api.get(`/academic-groups/${group.id}/students`);
      setRoster(data.students);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to load students");
    } finally {
      setRosterLoading(false);
    }
  }

  async function bulkResetPasswords(group) {
    const label = `${group.department.name} · ${group.section} (${group.batch})`;
    const ok = await confirmDialog({
      title: "Reset all passwords",
      message: `Reset every student's password in ${label}? Each gets their own new unique password.`,
      confirmLabel: "Reset all",
      danger: true,
    });
    if (!ok) return;
    setResettingId(group.id);
    try {
      const { data } = await api.post(`/academic-groups/${group.id}/bulk-reset-password`);
      if (data.resetCount === 0) {
        alert(`No students in ${label} to reset.`);
      } else {
        setResetResult({ groupLabel: label, students: data.students });
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to reset passwords");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Academic Groups</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
        </div>
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Every unique Institute · Batch · Department · Section combination, created automatically the moment a
          student is registered with it — via Bulk Upload or manual account creation. There's nothing to set up
          here; this is a read-only view of what's already been derived from your student data.
        </p>

        <div style={{ marginTop: 20 }}>
          <label style={{ ...labelStyle, marginTop: 0 }}>Filter by institute</label>
          <select style={{ ...inputStyle, maxWidth: 300 }} value={filterInstituteId} onChange={(e) => setFilterInstituteId(e.target.value)}>
            <option value="">All institutes</option>
            {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </div>

        {resetResult && (
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "var(--mint)" }}>
                  Reset {resetResult.students.length} password{resetResult.students.length === 1 ? "" : "s"} in {resetResult.groupLabel}
                </div>
                <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                  Each student got their own new temporary password — share these individually. They'll be asked to
                  set a new one on next login.
                </p>
              </div>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setResetResult(null)}>Dismiss</button>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
                  <th style={{ padding: "6px 4px" }}>Name</th>
                  <th>Email</th>
                  <th>Roll no.</th>
                  <th>New temporary password</th>
                </tr>
              </thead>
              <tbody>
                {resetResult.students.map((s) => (
                  <tr key={s.id} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                    <td style={{ padding: "6px 4px" }}>{s.name}</td>
                    <td className="mono">{s.email}</td>
                    <td className="mono">{s.rollNumber}</td>
                    <td className="mono" style={{ fontWeight: 700 }}>{s.newPassword}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {groups.map((g) => (
            <div key={g.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{g.department.name} · {g.section}</span>
                  <span className="badge" style={{ marginLeft: 8 }}>{g.batch}</span>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                    {g.institute?.name || "No institute"} · {g._count?.users ?? 0} student{g._count?.users === 1 ? "" : "s"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-ghost" onClick={() => toggleRoster(g)}>
                    {expandedId === g.id ? "Hide students" : "View students"}
                  </button>
                  <button className="btn btn-ghost" onClick={() => bulkResetPasswords(g)} disabled={resettingId === g.id}>
                    {resettingId === g.id ? "Resetting…" : "Reset all passwords"}
                  </button>
                </div>
              </div>

              {expandedId === g.id && (
                <div style={{ marginTop: 14, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
                  {rosterLoading && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>Loading…</p>}
                  {roster && roster.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No students in this group.</p>}
                  {roster && roster.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
                          <th style={{ padding: "6px 4px" }}>Name</th>
                          <th>Email</th>
                          <th>Roll no.</th>
                          <th>Mobile</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster.map((s) => (
                          <tr key={s.id} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                            <td style={{ padding: "6px 4px" }}>{s.name}</td>
                            <td className="mono">{s.email}</td>
                            <td className="mono">{s.rollNumber || "—"}</td>
                            <td className="mono">{s.mobile || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              No academic groups yet — they'll appear here as soon as students are registered.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

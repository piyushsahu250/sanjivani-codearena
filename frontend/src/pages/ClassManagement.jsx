import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [filterInstituteId, setFilterInstituteId] = useState("");
  const [form, setForm] = useState({ name: "", code: "", batchYear: "", instituteId: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", code: "", batchYear: "", instituteId: "" });
  const [resettingId, setResettingId] = useState(null);

  function load(instituteId) {
    api.get("/classes", { params: instituteId ? { instituteId } : {} }).then((res) => setClasses(res.data));
  }

  useEffect(() => {
    api.get("/institutes").then((res) => setInstitutes(res.data));
    load();
  }, []);

  useEffect(() => {
    load(filterInstituteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInstituteId]);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    if (!form.instituteId) return setError("Please choose an institute");
    if (!form.batchYear.trim()) return setError("Please enter a batch year");
    setSaving(true);
    try {
      await api.post("/classes", form);
      setForm({ name: "", code: "", batchYear: "", instituteId: form.instituteId });
      load(filterInstituteId);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add class");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cls) {
    setEditingId(cls.id);
    setEditForm({ name: cls.name, code: cls.code || "", batchYear: cls.batchYear || "", instituteId: cls.instituteId || "" });
  }

  async function saveEdit(id) {
    if (!editForm.batchYear.trim()) return alert("Batch year is required");
    try {
      await api.patch(`/classes/${id}`, editForm);
      setEditingId(null);
      load(filterInstituteId);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update class");
    }
  }

  async function toggleActive(cls) {
    try {
      await api.patch(`/classes/${cls.id}`, { isActive: !cls.isActive });
      load(filterInstituteId);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update class");
    }
  }

  async function handleDelete(cls) {
    try {
      await api.delete(`/classes/${cls.id}`);
      load(filterInstituteId);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete class");
    }
  }

  async function bulkResetPasswords(cls) {
    setResettingId(cls.id);
    try {
      const { data } = await api.post(`/classes/${cls.id}/bulk-reset-password`);
      alert(`Reset password for ${data.resetCount} student${data.resetCount === 1 ? "" : "s"} in ${cls.name} (${cls.batchYear}) to the default password. Each will be asked to set a new one on next login.`);
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
            <h1>Class Management</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/admin/institutes" className="btn btn-ghost">Institute Management</Link>
            <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
          </div>
        </div>
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Create the classes/programs offered under an institute (e.g. MCA, BCA, CSE, IT, AI &amp; DS, AIML, ECE,
          Mechanical, Civil, MBA), each tied to a batch year — the same program name can recur across batches
          (e.g. MCA 2025, MCA 2026). Deactivate a class instead of deleting it to keep it out of new assignments
          without losing history.
        </p>

        {institutes.length === 0 ? (
          <div className="card" style={{ padding: 24, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            No institutes yet. <Link to="/admin/institutes">Add an institute first</Link> before creating classes.
          </div>
        ) : (
          <>
            <form onSubmit={handleCreate} className="card" style={{ padding: 20, marginTop: 24, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={labelStyle}>Institute</label>
                <select style={inputStyle} required value={form.instituteId} onChange={(e) => setForm({ ...form, instituteId: e.target.value })}>
                  <option value="">Select institute…</option>
                  {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "2 1 200px" }}>
                <label style={labelStyle}>Class / Program name</label>
                <input style={inputStyle} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MCA" />
              </div>
              <div style={{ flex: "1 1 110px" }}>
                <label style={labelStyle}>Batch year</label>
                <input style={inputStyle} required value={form.batchYear} onChange={(e) => setForm({ ...form, batchYear: e.target.value })} placeholder="e.g. 2025" />
              </div>
              <div style={{ flex: "1 1 120px" }}>
                <label style={labelStyle}>Code (optional)</label>
                <input style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MCA24" />
              </div>
              <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "+ Add class"}</button>
            </form>
            {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}

            <div style={{ marginTop: 24 }}>
              <label style={{ ...labelStyle, marginTop: 0 }}>Filter by institute</label>
              <select style={{ ...inputStyle, maxWidth: 300 }} value={filterInstituteId} onChange={(e) => setFilterInstituteId(e.target.value)}>
                <option value="">All institutes</option>
                {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
          </>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
          {classes.map((cls) => (
            <div key={cls.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: cls.isActive ? 1 : 0.55, flexWrap: "wrap", gap: 10 }}>
              {editingId === cls.id ? (
                <div style={{ display: "flex", gap: 10, flex: 1, alignItems: "center", flexWrap: "wrap" }}>
                  <select style={{ ...inputStyle, maxWidth: 200 }} value={editForm.instituteId} onChange={(e) => setEditForm({ ...editForm, instituteId: e.target.value })}>
                    {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                  </select>
                  <input style={inputStyle} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
                  <input style={{ ...inputStyle, maxWidth: 100 }} value={editForm.batchYear} onChange={(e) => setEditForm({ ...editForm, batchYear: e.target.value })} placeholder="Batch year" />
                  <input style={{ ...inputStyle, maxWidth: 140 }} value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="Code" />
                  <button className="btn btn-primary" onClick={() => saveEdit(cls.id)}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cls.name}</span>
                    {cls.batchYear && <span className="badge" style={{ marginLeft: 8 }}>{cls.batchYear}</span>}
                    {cls.code && <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginLeft: 8 }}>{cls.code}</span>}
                    <span className="badge" style={{ marginLeft: 10, color: cls.isActive ? "var(--mint)" : "var(--ink-dim)" }}>
                      {cls.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                      {cls.institute?.name || "No institute"} · {cls._count?.users ?? 0} student{cls._count?.users === 1 ? "" : "s"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Link to={`/admin/classes/${cls.id}/students`} className="btn btn-ghost">View students</Link>
                    <button className="btn btn-ghost" onClick={() => bulkResetPasswords(cls)} disabled={resettingId === cls.id}>
                      {resettingId === cls.id ? "Resetting…" : "Reset all passwords"}
                    </button>
                    <button className="btn btn-ghost" onClick={() => startEdit(cls)}>Edit</button>
                    <button className="btn btn-dark" onClick={() => toggleActive(cls)}>
                      {cls.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => handleDelete(cls)}>
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {classes.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              No classes yet. Add your first one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

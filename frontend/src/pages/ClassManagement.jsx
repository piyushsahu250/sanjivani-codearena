import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function ClassManagement() {
  const [classes, setClasses] = useState([]);
  const [form, setForm] = useState({ name: "", code: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });

  function load() {
    api.get("/classes").then((res) => setClasses(res.data));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/classes", form);
      setForm({ name: "", code: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add class");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(cls) {
    setEditingId(cls.id);
    setEditForm({ name: cls.name, code: cls.code || "" });
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/classes/${id}`, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update class");
    }
  }

  async function toggleActive(cls) {
    await api.patch(`/classes/${cls.id}`, { isActive: !cls.isActive });
    load();
  }

  async function handleDelete(id) {
    await api.delete(`/classes/${id}`);
    load();
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Class Management</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
        </div>
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Create the classes/programs offered by the institute (e.g. MCA, BCA, CSE, IT, AI &amp; DS, AIML, ECE,
          Mechanical, Civil, MBA). Deactivate a class instead of deleting it to keep it out of new assignments
          without losing history.
        </p>

        <form onSubmit={handleCreate} className="card" style={{ padding: 20, marginTop: 24, display: "flex", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Class / Program name</label>
            <input style={inputStyle} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. MCA" />
          </div>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Code (optional)</label>
            <input style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MCA24" />
          </div>
          <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "+ Add class"}</button>
        </form>
        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          {classes.map((cls) => (
            <div key={cls.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", opacity: cls.isActive ? 1 : 0.55 }}>
              {editingId === cls.id ? (
                <div style={{ display: "flex", gap: 10, flex: 1, alignItems: "center" }}>
                  <input style={inputStyle} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                  <input style={{ ...inputStyle, maxWidth: 140 }} value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="Code" />
                  <button className="btn btn-primary" onClick={() => saveEdit(cls.id)}>Save</button>
                  <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              ) : (
                <>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{cls.name}</span>
                    {cls.code && <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginLeft: 8 }}>{cls.code}</span>}
                    <span className="badge" style={{ marginLeft: 10, color: cls.isActive ? "var(--mint)" : "var(--ink-dim)" }}>
                      {cls.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => startEdit(cls)}>Edit</button>
                    <button className="btn btn-dark" onClick={() => toggleActive(cls)}>
                      {cls.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => handleDelete(cls.id)}>
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

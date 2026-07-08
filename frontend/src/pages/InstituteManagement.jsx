import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const emptyForm = { name: "", code: "", address: "", contact: "" };

export default function InstituteManagement() {
  const [institutes, setInstitutes] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);

  function load() {
    api.get("/institutes").then((res) => setInstitutes(res.data));
  }

  useEffect(load, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/institutes", form);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add institute");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(inst) {
    setEditingId(inst.id);
    setEditForm({ name: inst.name, code: inst.code || "", address: inst.address || "", contact: inst.contact || "" });
  }

  async function saveEdit(id) {
    try {
      await api.patch(`/institutes/${id}`, editForm);
      setEditingId(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update institute");
    }
  }

  async function toggleActive(inst) {
    await api.patch(`/institutes/${inst.id}`, { isActive: !inst.isActive });
    load();
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/institutes/${id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete institute");
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Institute Management</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin" className="btn btn-ghost">← Back to Admin</Link>
        </div>
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Create an institute before adding classes or users under it. Deactivate an institute to hide it from new
          assignments without losing history; deleting is only allowed once it has no classes or users left.
        </p>

        <form onSubmit={handleCreate} className="card" style={{ padding: 20, marginTop: 24 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Institute name</label>
              <input style={inputStyle} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Engineering College" />
            </div>
            <div>
              <label style={labelStyle}>Code (optional)</label>
              <input style={inputStyle} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. ABC001" />
            </div>
            <div>
              <label style={labelStyle}>Address (optional)</label>
              <input style={inputStyle} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label style={labelStyle}>Contact details (optional)</label>
              <input style={inputStyle} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} placeholder="Phone / email" />
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} disabled={saving}>{saving ? "Adding…" : "+ Add institute"}</button>
        </form>
        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}

        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          {institutes.map((inst) => (
            <div key={inst.id} className="card" style={{ padding: 16, opacity: inst.isActive ? 1 : 0.55 }}>
              {editingId === inst.id ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <input style={inputStyle} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Name" />
                  <input style={inputStyle} value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} placeholder="Code" />
                  <input style={inputStyle} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Address" />
                  <input style={inputStyle} value={editForm.contact} onChange={(e) => setEditForm({ ...editForm, contact: e.target.value })} placeholder="Contact" />
                  <div style={{ display: "flex", gap: 8, gridColumn: "1 / -1" }}>
                    <button className="btn btn-primary" onClick={() => saveEdit(inst.id)}>Save</button>
                    <button className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{inst.name}</span>
                    {inst.code && <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginLeft: 8 }}>{inst.code}</span>}
                    <span className="badge" style={{ marginLeft: 10, color: inst.isActive ? "var(--mint)" : "var(--ink-dim)" }}>
                      {inst.isActive ? "Active" : "Inactive"}
                    </span>
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                      {inst._count?.classes || 0} classes · {inst._count?.users || 0} users
                      {inst.address && ` · ${inst.address}`}
                      {inst.contact && ` · ${inst.contact}`}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="btn btn-ghost" onClick={() => startEdit(inst)}>Edit</button>
                    <button className="btn btn-dark" onClick={() => toggleActive(inst)}>
                      {inst.isActive ? "Deactivate" : "Activate"}
                    </button>
                    <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => handleDelete(inst.id)}>
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {institutes.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              No institutes yet. Add your first one above.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

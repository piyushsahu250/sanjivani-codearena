import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const ROLES = ["STUDENT", "STAFF", "ADMIN"];

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "STAFF", rollNumber: "", department: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api.get("/users").then((res) => setUsers(res.data));
  }

  useEffect(load, []);

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await api.post("/users", form);
      setForm({ name: "", email: "", password: "", role: "STAFF", rollNumber: "", department: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this account?")) return;
    await api.delete(`/users/${id}`);
    load();
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Admin control room</h1>
            <ChalkUnderline />
          </div>
          <Link to="/staff" className="btn btn-ghost">Manage tests &amp; questions →</Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 32, marginTop: 32, alignItems: "start" }}>
          <form onSubmit={handleCreate} className="card" style={{ padding: 24 }}>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>Create account</h3>

            <label style={labelStyle}>Full name</label>
            <input style={inputStyle} required value={form.name} onChange={updateField("name")} />

            <label style={labelStyle}>Email</label>
            <input style={inputStyle} type="email" required value={form.email} onChange={updateField("email")} />

            <label style={labelStyle}>Password</label>
            <input style={inputStyle} type="password" required minLength={6} value={form.password} onChange={updateField("password")} />

            <label style={labelStyle}>Role</label>
            <select style={inputStyle} value={form.role} onChange={updateField("role")}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>

            {form.role === "STUDENT" && (
              <>
                <label style={labelStyle}>Roll number</label>
                <input style={inputStyle} value={form.rollNumber} onChange={updateField("rollNumber")} />
              </>
            )}

            <label style={labelStyle}>Department</label>
            <input style={inputStyle} value={form.department} onChange={updateField("department")} />

            {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}

            <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={saving}>
              {saving ? "Creating…" : "Create account"}
            </button>
          </form>

          <div>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>All accounts ({users.length})</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {users.map((u) => (
                <div key={u.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{u.email}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="badge">{u.role}</span>
                    <button
                      onClick={() => handleDelete(u.id)}
                      style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

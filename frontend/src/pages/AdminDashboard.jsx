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

  const [rollQuery, setRollQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

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

  async function handleRollLookup(e) {
    e.preventDefault();
    if (!rollQuery.trim()) return;
    setLookingUp(true);
    setLookupError("");
    setLookupResult(null);
    try {
      const { data } = await api.get(`/users/by-roll/${encodeURIComponent(rollQuery.trim())}`);
      setLookupResult(data);
    } catch (err) {
      setLookupError(err.response?.data?.error || "Lookup failed");
    } finally {
      setLookingUp(false);
    }
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

        <div className="card" style={{ padding: 24, marginTop: 32 }}>
          <h3 style={{ fontSize: 16, marginBottom: 4 }}>Check test completion by roll number</h3>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 16 }}>
            Look up a student by roll number to see every test they've started, finished, or not touched yet.
          </p>
          <form onSubmit={handleRollLookup} style={{ display: "flex", gap: 10 }}>
            <input
              style={{ ...inputStyle, marginTop: 0 }}
              placeholder="e.g. CS2023045"
              value={rollQuery}
              onChange={(e) => setRollQuery(e.target.value)}
            />
            <button className="btn btn-primary" disabled={lookingUp}>
              {lookingUp ? "Searching…" : "Search"}
            </button>
          </form>

          {lookupError && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{lookupError}</p>}

          {lookupResult && (
            <div style={{ marginTop: 20 }}>
              <div style={{ fontWeight: 600 }}>{lookupResult.name} <span className="mono" style={{ fontWeight: 400, color: "var(--ink-dim)", fontSize: 13 }}>· {lookupResult.rollNumber} · {lookupResult.email}</span></div>
              <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                {lookupResult.attempts.map((a, idx) => (
                  <div key={idx} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{a.test.title}</div>
                      <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                        started {new Date(a.startedAt).toLocaleString()}
                        {a.tabSwitchCount > 0 && ` · ${a.tabSwitchCount} tab switch${a.tabSwitchCount > 1 ? "es" : ""}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span
                        className="mono"
                        style={{
                          fontWeight: 700,
                          color: a.status === "IN_PROGRESS" ? "var(--amber-dark)" : "var(--mint)",
                        }}
                      >
                        {a.status === "IN_PROGRESS" ? "Not completed" : "Completed"}
                      </span>
                      <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{a.totalScore} pts</div>
                    </div>
                  </div>
                ))}
                {lookupResult.attempts.length === 0 && (
                  <div className="card" style={{ padding: 16, textAlign: "center", color: "var(--ink-dim)", fontSize: 13 }}>
                    This student hasn't started any test yet.
                  </div>
                )}
              </div>
            </div>
          )}
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

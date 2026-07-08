import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const ROLES = ["STUDENT", "STAFF", "ADMIN"];
const emptyForm = { name: "", email: "", role: "STUDENT", instituteId: "", classId: "", rollNumber: "", department: "" };

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [institutes, setInstitutes] = useState([]);
  const [classes, setClasses] = useState([]);
  const [stats, setStats] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdCredential, setCreatedCredential] = useState(null);

  const [rollQuery, setRollQuery] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError, setLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);

  function load() {
    api.get("/users").then((res) => setUsers(res.data));
    api.get("/admin/stats").then((res) => setStats(res.data));
  }

  useEffect(() => {
    load();
    api.get("/institutes").then((res) => setInstitutes(res.data));
  }, []);

  useEffect(() => {
    if (!form.instituteId) return setClasses([]);
    api.get("/classes", { params: { instituteId: form.instituteId } }).then((res) => setClasses(res.data));
  }, [form.instituteId]);

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value, ...(field === "instituteId" ? { classId: "" } : {}) });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    setCreatedCredential(null);
    if (!form.instituteId) return setError("Please choose an institute");
    if (form.role === "STUDENT" && !form.classId) return setError("Please choose a class for this student");
    setSaving(true);
    try {
      const { data } = await api.post("/users", form);
      setCreatedCredential({ name: data.name, email: data.email, password: data.generatedPassword });
      setForm({ ...emptyForm, instituteId: form.instituteId, role: form.role });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Admin control room</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link to="/admin/institutes" className="btn btn-ghost">Institute Management</Link>
            <Link to="/admin/classes" className="btn btn-ghost">Class Management</Link>
            <Link to="/admin/bulk-upload" className="btn btn-primary">⬆ Bulk student upload</Link>
            <Link to="/staff" className="btn btn-ghost">Manage tests &amp; questions →</Link>
          </div>
        </div>

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 12, marginTop: 28 }}>
            <StatCard label="Institutes" value={stats.totalInstitutes} />
            <StatCard label="Classes" value={stats.totalClasses} />
            <StatCard label="Users" value={stats.totalUsers} />
            <StatCard label="Students" value={stats.totalStudents} />
            <StatCard label="Staff" value={stats.totalStaff} />
            <StatCard label="Questions" value={stats.totalQuestions} />
            <StatCard label="Tests" value={stats.totalTests} />
            <StatCard label="Active tests" value={stats.activeTests} accent="var(--mint)" />
            <StatCard label="Scheduled" value={stats.scheduledTests} accent="var(--amber-dark)" />
            <StatCard label="Completed" value={stats.completedTests} accent="var(--ink-dim)" />
          </div>
        )}

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

            {institutes.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                <Link to="/admin/institutes">Add an institute first</Link> before creating accounts.
              </p>
            ) : (
              <>
                <label style={labelStyle}>Full name</label>
                <input style={inputStyle} required value={form.name} onChange={updateField("name")} />

                <label style={labelStyle}>Email</label>
                <input style={inputStyle} type="email" required value={form.email} onChange={updateField("email")} />

                <label style={labelStyle}>Role</label>
                <select style={inputStyle} value={form.role} onChange={updateField("role")}>
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                <label style={labelStyle}>Institute</label>
                <select style={inputStyle} required value={form.instituteId} onChange={updateField("instituteId")}>
                  <option value="">Select institute…</option>
                  {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>

                {(form.role === "STUDENT" || form.instituteId) && (
                  <>
                    <label style={labelStyle}>Class{form.role === "STUDENT" ? "" : " (optional)"}</label>
                    <select style={inputStyle} required={form.role === "STUDENT"} value={form.classId} onChange={updateField("classId")} disabled={!form.instituteId}>
                      <option value="">Select class…</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </>
                )}

                {form.role === "STUDENT" && (
                  <>
                    <label style={labelStyle}>Roll number</label>
                    <input style={inputStyle} value={form.rollNumber} onChange={updateField("rollNumber")} />
                  </>
                )}

                <label style={labelStyle}>Department</label>
                <input style={inputStyle} value={form.department} onChange={updateField("department")} />

                <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 12 }}>
                  A password is generated automatically from the institute name. The account must change it on first login.
                </p>

                {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}

                {createdCredential && (
                  <div className="card" style={{ padding: 12, marginTop: 12, background: "var(--mint-bg, rgba(76,175,80,0.08))" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>Account created for {createdCredential.name}</div>
                    <div className="mono" style={{ fontSize: 12, marginTop: 4 }}>
                      {createdCredential.email} — password: <strong>{createdCredential.password}</strong>
                    </div>
                  </div>
                )}

                <button className="btn btn-primary" style={{ width: "100%", marginTop: 18 }} disabled={saving}>
                  {saving ? "Creating…" : "Create account"}
                </button>
              </>
            )}
          </form>

          <div>
            <h3 style={{ fontSize: 16, marginBottom: 16 }}>All accounts ({users.length})</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {users.map((u) => (
                <div key={u.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{u.email}</div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                      {u.institute?.name || "—"}{u.class?.name ? ` · ${u.class.name}` : ""}
                    </div>
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

function StatCard({ label, value, accent }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: accent || "var(--ink)" }}>{value ?? "—"}</div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

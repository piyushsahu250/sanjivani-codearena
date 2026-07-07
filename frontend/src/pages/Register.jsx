import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "", rollNumber: "", department: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/register", form);
      login(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "64px 24px", minHeight: "100vh", background: "var(--paper)" }}>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 400 }}>
        <h2>Create your student account</h2>
        <p style={{ color: "var(--ink-dim)", fontSize: 14, marginTop: -4 }}>
          Register with your Sanjivani University details.
        </p>

        <label style={labelStyle}>Full name</label>
        <input style={inputStyle} required value={form.name} onChange={update("name")} />

        <label style={labelStyle}>Email</label>
        <input style={inputStyle} type="email" required value={form.email} onChange={update("email")} />

        <label style={labelStyle}>Password</label>
        <input style={inputStyle} type="password" required minLength={6} value={form.password} onChange={update("password")} />

        <label style={labelStyle}>Roll number</label>
        <input style={inputStyle} value={form.rollNumber} onChange={update("rollNumber")} />

        <label style={labelStyle}>Department</label>
        <input style={inputStyle} placeholder="e.g. Computer Engineering" value={form.department} onChange={update("department")} />

        {error && <p style={{ color: "var(--rust)", fontSize: 13 }}>{error}</p>}

        <button className="btn btn-primary" style={{ width: "100%", marginTop: 18, padding: "12px 0" }} disabled={loading}>
          {loading ? "Creating account…" : "Create account"}
        </button>

        <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-dim)" }}>
          Already registered? <Link to="/login" style={{ color: "var(--amber-dark)", fontWeight: 600 }}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

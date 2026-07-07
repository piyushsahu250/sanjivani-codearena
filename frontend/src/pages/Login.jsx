import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import ChalkUnderline from "../components/ChalkUnderline";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      navigate(data.user.role === "STUDENT" ? "/dashboard" : "/admin");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", minHeight: "100vh" }}>
      {/* Blackboard panel */}
      <div
        style={{
          background: "var(--slate-900)",
          color: "var(--chalk)",
          padding: "64px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <span className="mono" style={{ color: "var(--amber)", fontSize: 13, letterSpacing: "0.08em" }}>
          SANJIVANI UNIVERSITY
        </span>
        <h1 style={{ fontSize: 44, color: "var(--chalk)", marginTop: 10 }}>
          CodeArena
        </h1>
        <ChalkUnderline width={160} />
        <p style={{ color: "var(--chalk-dim)", maxWidth: 420, marginTop: 20, lineHeight: 1.6 }}>
          The department's coding test platform — attend live assessments,
          write and run code in-browser, and get scored instantly against
          hidden test cases.
        </p>
        <div style={{ marginTop: 48, display: "flex", gap: 28 }}>
          <Stat label="Languages" value="JS · Python" />
          <Stat label="Grading" value="Auto-judged" />
          <Stat label="Access" value="24/7" />
        </div>
      </div>

      {/* Form panel */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 32 }}>
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360 }}>
          <h2 style={{ fontSize: 26, color: "var(--ink)" }}>Sign in</h2>
          <p style={{ color: "var(--ink-dim)", marginTop: -4, marginBottom: 24, fontSize: 14 }}>
            Use your university email to continue.
          </p>

          <label style={labelStyle}>Email</label>
          <input
            style={inputStyle}
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@sanjivani.edu.in"
          />

          <label style={labelStyle}>Password</label>
          <input
            style={inputStyle}
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          {error && (
            <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 4 }}>{error}</p>
          )}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18, padding: "12px 0" }} disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p style={{ marginTop: 20, fontSize: 14, color: "var(--ink-dim)" }}>
            New student?{" "}
            <Link to="/register" style={{ color: "var(--amber-dark)", fontWeight: 600 }}>
              Create an account
            </Link>
          </p>
          <p style={{ marginTop: 32, fontSize: 12, color: "var(--ink-dim)" }} className="mono">
            demo admin: admin@sanjivani.edu.in / Admin@123
          </p>
        </form>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 15, color: "var(--amber)" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--chalk-dim)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6, color: "var(--ink)" };
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid var(--line)",
  fontSize: 14,
  fontFamily: "var(--font-body)",
};

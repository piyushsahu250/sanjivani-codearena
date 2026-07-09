import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

// Shared by /admin/students and /staff/students — basePath controls where a result's
// profile link points, since Admin and Staff sit under different route prefixes.
export default function StudentSearch({ basePath }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError("");
    try {
      const { data } = await api.get("/users/search", { params: { q: q.trim() } });
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Student performance dashboard</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Search for a student by Student ID, Roll Number, Name, or Official Email to view their
          overall performance across all tests.
        </p>

        <form onSubmit={handleSearch} className="card" style={{ padding: 16, marginTop: 20, display: "flex", gap: 10 }}>
          <input
            style={{ ...inputStyle, marginTop: 0, flex: 1 }}
            placeholder="Student ID, roll number, name, or official email"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary" disabled={searching}>
            {searching ? "Searching…" : "Search"}
          </button>
        </form>

        {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 12 }}>{error}</p>}

        {results && (
          <div style={{ display: "grid", gap: 10, marginTop: 20 }}>
            {results.map((s) => (
              <Link
                key={s.id}
                to={`${basePath}/students/${s.id}`}
                className="card"
                style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", textDecoration: "none", color: "inherit" }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    {s.rollNumber || "—"} · {s.email}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                    {s.institute?.name || "—"}{s.class?.name ? ` · ${s.class.name}${s.class.batchYear ? ` (${s.class.batchYear})` : ""}` : ""}
                  </div>
                </div>
                <span className="btn btn-ghost" style={{ pointerEvents: "none" }}>View dashboard →</span>
              </Link>
            ))}
            {results.length === 0 && (
              <div className="card" style={{ padding: 24, textAlign: "center", color: "var(--ink-dim)" }}>
                No student found matching "{q}".
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

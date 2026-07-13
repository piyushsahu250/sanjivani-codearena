import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

function downloadCsv(filename, headers, rows) {
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Shared by /admin/students and /staff/students — basePath controls where a result's
// profile link points, since Admin and Staff sit under different route prefixes.
export default function StudentSearch({ basePath }) {
  const confirmDialog = useConfirm();
  const toast = useToast();
  const { user } = useAuth();
  const canRegenerate = user?.role === "ADMIN"; // matches the backend's ADMIN-only bulk-regenerate-password route
  const [q, setQ] = useState("");
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState([]);
  const [regenerating, setRegenerating] = useState(false);

  async function handleSearch(e) {
    e.preventDefault();
    if (!q.trim()) return;
    setSearching(true);
    setError("");
    setSelected([]);
    try {
      const { data } = await api.get("/users/search", { params: { q: q.trim() } });
      setResults(data);
    } catch (err) {
      setError(err.response?.data?.error || "Search failed");
    } finally {
      setSearching(false);
    }
  }

  function toggle(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === results.length ? [] : results.map((s) => s.id)));
  }

  // Regenerates a fresh, unique random password per selected student (never a shared fixed
  // value — see the note on generateTempPassword) and immediately offers the results as a CSV
  // download, since these plaintext passwords are never stored anywhere and this is the only
  // moment they're ever visible.
  async function regeneratePasswords() {
    const ok = await confirmDialog({
      title: `Regenerate ${selected.length} password${selected.length === 1 ? "" : "s"}?`,
      message: "Each selected student gets a new, unique temporary password and will be asked to set their own on next login. This action cannot be undone.",
      confirmLabel: "Regenerate",
      danger: true,
    });
    if (!ok) return;
    setRegenerating(true);
    try {
      const { data } = await api.post("/users/bulk-regenerate-password", { studentIds: selected });
      downloadCsv(
        "regenerated-passwords.csv",
        ["Name", "Email", "Roll Number", "New Temporary Password"],
        data.results.map((u) => [u.name, u.email, u.rollNumber, u.generatedPassword])
      );
      toast.success(`${data.results.length} password${data.results.length === 1 ? "" : "s"} regenerated — CSV downloaded.`);
      setSelected([]);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to regenerate passwords");
    } finally {
      setRegenerating(false);
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

        {results && results.length > 0 && canRegenerate && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 20, flexWrap: "wrap", gap: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
              <input type="checkbox" checked={selected.length === results.length} onChange={toggleAll} />
              Select all ({selected.length} selected)
            </label>
            <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={regeneratePasswords} disabled={selected.length === 0 || regenerating}>
              {regenerating ? "Regenerating…" : `Regenerate Passwords${selected.length ? ` (${selected.length})` : ""}`}
            </button>
          </div>
        )}

        {results && (
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {results.map((s) => (
              <div key={s.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  {canRegenerate && <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggle(s.id)} />}
                  <Link to={`${basePath}/students/${s.id}`} style={{ textDecoration: "none", color: "inherit", flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{s.name}</div>
                    <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                      {s.rollNumber || "—"} · {s.email}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                      {s.institute?.name || "—"}{s.class?.name ? ` · ${s.class.name}${s.class.batchYear ? ` (${s.class.batchYear})` : ""}` : ""}
                    </div>
                  </Link>
                </div>
                <Link to={`${basePath}/students/${s.id}`} className="btn btn-ghost">View dashboard →</Link>
              </div>
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

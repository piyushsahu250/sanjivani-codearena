import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

export default function CreateQuestion() {
  const [form, setForm] = useState({
    title: "", description: "", difficulty: "EASY", points: 10, timeLimitMs: 2000, starterCode: "",
  });
  const [testCases, setTestCases] = useState([{ input: "", expected: "", isHidden: false }]);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function updateCase(idx, field, value) {
    const next = [...testCases];
    next[idx] = { ...next[idx], [field]: value };
    setTestCases(next);
  }

  function addCase() {
    setTestCases([...testCases, { input: "", expected: "", isHidden: true }]);
  }

  function removeCase(idx) {
    setTestCases(testCases.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/questions", { ...form, points: Number(form.points), timeLimitMs: Number(form.timeLimitMs), testCases });
      navigate("/admin");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>New coding question</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} required value={form.title} onChange={updateField("title")} />

          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 140 }} required value={form.description} onChange={updateField("description")} placeholder="Problem statement, input/output format, constraints…" />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Difficulty</label>
              <select style={inputStyle} value={form.difficulty} onChange={updateField("difficulty")}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Points</label>
              <input style={inputStyle} type="number" value={form.points} onChange={updateField("points")} />
            </div>
            <div>
              <label style={labelStyle}>Time limit (ms)</label>
              <input style={inputStyle} type="number" value={form.timeLimitMs} onChange={updateField("timeLimitMs")} />
            </div>
          </div>

          <label style={labelStyle}>Starter code (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "var(--font-mono)" }} value={form.starterCode} onChange={updateField("starterCode")} />

          <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>Test cases</div>
            <button type="button" className="btn btn-ghost" onClick={addCase}>+ Add test case</button>
          </div>

          {testCases.map((tc, idx) => (
            <div key={idx} className="card" style={{ padding: 16, marginTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <label style={labelStyle}>Input (stdin)</label>
                  <textarea style={{ ...inputStyle, fontFamily: "var(--font-mono)", minHeight: 60 }} value={tc.input} onChange={(e) => updateCase(idx, "input", e.target.value)} />
                </div>
                <div>
                  <label style={labelStyle}>Expected stdout</label>
                  <textarea style={{ ...inputStyle, fontFamily: "var(--font-mono)", minHeight: 60 }} value={tc.expected} onChange={(e) => updateCase(idx, "expected", e.target.value)} />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="checkbox" checked={tc.isHidden} onChange={(e) => updateCase(idx, "isHidden", e.target.checked)} />
                  Hidden (not shown to students as a sample)
                </label>
                {testCases.length > 1 && (
                  <button type="button" onClick={() => removeCase(idx)} style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}>Remove</button>
                )}
              </div>
            </div>
          ))}

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Saving…" : "Save question"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontFamily: "var(--font-body)" };

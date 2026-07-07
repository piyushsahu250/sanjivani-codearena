import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

export default function CreateTest() {
  const [questions, setQuestions] = useState([]);
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState({ title: "", description: "", durationMin: 60, startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/questions").then((res) => setQuestions(res.data));
  }, []);

  function toggle(qId) {
    setSelected((prev) => (prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]));
  }

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return alert("Select at least one question");
    setSaving(true);
    try {
      await api.post("/tests", { ...form, durationMin: Number(form.durationMin), questionIds: selected });
      navigate("/admin");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create test");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>New test</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} required value={form.title} onChange={updateField("title")} />

          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={updateField("description")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Duration (min)</label>
              <input style={inputStyle} type="number" value={form.durationMin} onChange={updateField("durationMin")} />
            </div>
            <div>
              <label style={labelStyle}>Start time</label>
              <input style={inputStyle} type="datetime-local" required value={form.startTime} onChange={updateField("startTime")} />
            </div>
            <div>
              <label style={labelStyle}>End time</label>
              <input style={inputStyle} type="datetime-local" required value={form.endTime} onChange={updateField("endTime")} />
            </div>
          </div>

          <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>Select questions from the bank</div>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {questions.map((q) => (
              <label key={q.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                {q.title} <span className={`badge badge-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}>{q.points} pts · {q._count.testCases} cases</span>
              </label>
            ))}
            {questions.length === 0 && <p style={{ color: "var(--ink-dim)" }}>No questions in the bank yet — create one first.</p>}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Creating…" : "Create test"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

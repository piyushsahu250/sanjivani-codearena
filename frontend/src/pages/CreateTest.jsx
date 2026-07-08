import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

const DEFAULT_MINUTES_PER_QUESTION = 15;
const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };

export default function CreateTest() {
  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [minutesById, setMinutesById] = useState({});
  const [form, setForm] = useState({ title: "", description: "", durationMin: 60, startTime: "", endTime: "" });
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/questions", { params: search ? { q: search } : {} }).then((res) => setQuestions(res.data));
  }, [search]);

  function toggle(qId) {
    setSelected((prev) => (prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]));
    setMinutesById((prev) => (prev[qId] ? prev : { ...prev, [qId]: DEFAULT_MINUTES_PER_QUESTION }));
  }

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return alert("Select at least one question");
    setSaving(true);
    try {
      const questionTimeLimits = {};
      selected.forEach((qId) => {
        questionTimeLimits[qId] = (Number(minutesById[qId]) || DEFAULT_MINUTES_PER_QUESTION) * 60;
      });
      await api.post("/tests", {
        ...form,
        durationMin: Number(form.durationMin),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        questionIds: selected,
        questionTimeLimits,
      });
      navigate("/staff");
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
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>Add as many as you need — coding and quiz questions can be mixed. Each gets its own time allowance — the test auto-advances to the next question when a question's time runs out.</p>
          <input
            style={{ ...inputStyle, marginTop: 10 }}
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {questions.map((q) => (
              <label key={q.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                {q.title || "(untitled)"}
                <span className="badge">{TYPE_LABELS[q.questionType]}</span>
                <span className={`badge badge-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}>
                  {q.points} pts{q.questionType === "CODING" ? ` · ${q._count.testCases} cases` : ""}
                </span>
                {selected.includes(q.id) && (
                  <span className="mono" style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                    <input
                      type="number"
                      min={1}
                      style={{ width: 48, padding: "4px 6px", borderRadius: 6, border: "1px solid var(--line)" }}
                      value={minutesById[q.id] ?? DEFAULT_MINUTES_PER_QUESTION}
                      onClick={(e) => e.preventDefault()}
                      onChange={(e) => setMinutesById((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    />
                    min
                  </span>
                )}
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

import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };

const emptyForm = { title: "", code: "", description: "", instructions: "", durationMin: 60, passingMarks: "", showResults: true, startTime: "", endTime: "" };

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateTest() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState([]);
  const [classIds, setClassIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    api.get("/classes").then((res) => setClasses(res.data));
  }, []);

  useEffect(() => {
    api.get("/questions", { params: search ? { q: search } : {} }).then((res) => setQuestions(res.data));
  }, [search]);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/tests/${id}`).then((res) => {
      const t = res.data;
      setForm({
        title: t.title || "", code: t.code || "", description: t.description || "",
        instructions: t.instructions || "", durationMin: t.durationMin, passingMarks: t.passingMarks ?? "",
        showResults: t.showResults, startTime: toLocalInputValue(t.startTime), endTime: toLocalInputValue(t.endTime),
      });
      setClassIds((t.classes || []).map((c) => c.classId));
      const qIds = t.questions.map((tq) => tq.question.id);
      setSelected(qIds);
      setQuestions((prev) => {
        const known = new Set(prev.map((q) => q.id));
        const extra = t.questions.map((tq) => tq.question).filter((q) => !known.has(q.id));
        return [...extra, ...prev];
      });
      setLoading(false);
    });
  }, [id, isEdit]);

  function toggle(qId) {
    setSelected((prev) => (prev.includes(qId) ? prev.filter((id2) => id2 !== qId) : [...prev, qId]));
  }

  function toggleClass(classId) {
    setClassIds((prev) => (prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]));
  }

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  const totalMarks = selected.reduce((sum, qId) => {
    const q = questions.find((qq) => qq.id === qId);
    return sum + (q?.points || 0);
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return alert("Select at least one question");
    setSaving(true);
    try {
      const payload = {
        ...form,
        durationMin: Number(form.durationMin),
        passingMarks: form.passingMarks === "" ? "" : Number(form.passingMarks),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        questionIds: selected,
        classIds,
      };
      if (isEdit) {
        await api.patch(`/tests/${id}`, payload);
      } else {
        await api.post("/tests", payload);
      }
      navigate("/staff");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save test");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div><Navbar /><div style={{ maxWidth: 720, margin: "0 auto", padding: 48 }}>Loading…</div></div>;

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{isEdit ? "Edit test" : "New test"}</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} required value={form.title} onChange={updateField("title")} />

          <label style={labelStyle}>Test code (optional)</label>
          <input style={inputStyle} value={form.code} onChange={updateField("code")} placeholder="e.g. MCA-DS-MID1" />

          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={updateField("description")} />

          <label style={labelStyle}>Instructions for students (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.instructions} onChange={updateField("instructions")} />

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

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Passing marks (optional)</label>
              <input style={inputStyle} type="number" value={form.passingMarks} onChange={updateField("passingMarks")} placeholder={`Total: ${totalMarks}`} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.showResults} onChange={(e) => setForm({ ...form, showResults: e.target.checked })} />
                Show results to students after submission
              </label>
            </div>
          </div>

          <div style={{ marginTop: 20, fontWeight: 700, fontSize: 14 }}>Assign to classes</div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>Leave all unchecked to make this test visible to every class (default/legacy behavior).</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {classes.map((c) => (
              <label key={c.id} className="badge" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: classIds.includes(c.id) ? "var(--amber)" : undefined }}>
                <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                {c.institute?.name ? `${c.institute.name} · ` : ""}{c.name}
              </label>
            ))}
            {classes.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>No classes yet.</span>}
          </div>

          <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>
            Select questions from the bank <span className="mono" style={{ fontWeight: 400, color: "var(--ink-dim)" }}>· Total marks: {totalMarks}</span>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>Add as many as you need — coding and quiz questions can be mixed. Candidates get the full test duration to split across all questions however they like, and can move between questions freely.</p>
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
                  {q.points} pts{q.questionType === "CODING" && q._count ? ` · ${q._count.testCases} cases` : ""}
                </span>
              </label>
            ))}
            {questions.length === 0 && <p style={{ color: "var(--ink-dim)" }}>No questions in the bank yet — create one first.</p>}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create test"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

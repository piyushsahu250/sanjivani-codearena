import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import FolderPicker from "../components/FolderPicker";

const QUESTION_TYPES = [
  { value: "CODING", label: "Coding" },
  { value: "MCQ", label: "Multiple Choice" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "MULTISELECT", label: "Multiple Select" },
];

const emptyForm = {
  title: "", subject: "", topic: "", description: "", questionType: "CODING",
  difficulty: "EASY", points: 10, explanation: "",
  timeLimitMs: 2000, starterCode: "",
};

export default function CreateQuestion() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [testCases, setTestCases] = useState([{ input: "", expected: "", isHidden: false }]);
  const [options, setOptions] = useState(["", ""]);
  const [correctIndices, setCorrectIndices] = useState([]);
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/questions/${id}`).then((res) => {
      const q = res.data;
      setForm({
        title: q.title || "", subject: q.subject || "", topic: q.topic || "",
        description: q.description || "", questionType: q.questionType,
        difficulty: q.difficulty, points: q.points, explanation: q.explanation || "",
        timeLimitMs: q.timeLimitMs ?? 2000, starterCode: q.starterCode || "",
      });
      if (q.questionType === "CODING") {
        setTestCases(q.testCases?.length ? q.testCases.map((tc) => ({ input: tc.input, expected: tc.expected, isHidden: tc.isHidden })) : [{ input: "", expected: "", isHidden: false }]);
      } else {
        setOptions(q.options?.length ? q.options : ["", ""]);
        setCorrectIndices(q.correctAnswer || []);
      }
      setFolderId(q.folderId || "");
      setLoading(false);
    });
  }, [id, isEdit]);

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

  function updateOption(idx, value) {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
  }

  function addOption() {
    setOptions([...options, ""]);
  }

  function removeOption(idx) {
    setOptions(options.filter((_, i) => i !== idx));
    setCorrectIndices(correctIndices.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  }

  function toggleCorrect(idx) {
    const isMulti = form.questionType === "MULTISELECT";
    if (isMulti) {
      setCorrectIndices((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
    } else {
      setCorrectIndices([idx]);
    }
  }

  function changeType(newType) {
    setForm({ ...form, questionType: newType });
    setCorrectIndices([]);
    if (newType === "TRUE_FALSE") setOptions(["True", "False"]);
    else if (options.length < 2 || (form.questionType === "TRUE_FALSE" && newType !== "TRUE_FALSE")) setOptions(["", ""]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        points: Number(form.points),
        timeLimitMs: Number(form.timeLimitMs),
        folderId: folderId || null,
      };
      if (form.questionType === "CODING") {
        payload.testCases = testCases;
      } else {
        payload.options = options.map((o) => o.trim()).filter(Boolean);
        payload.correctAnswer = correctIndices;
      }

      if (isEdit) {
        await api.patch(`/questions/${id}`, payload);
      } else {
        await api.post("/questions", payload);
      }
      navigate("/staff/questions");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 48 }} className="mono">Loading…</div>;

  const isQuiz = form.questionType !== "CODING";
  const isMulti = form.questionType === "MULTISELECT";
  const isTrueFalse = form.questionType === "TRUE_FALSE";

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{isEdit ? "Edit question" : "New question"}</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Question Type</label>
          <select style={inputStyle} value={form.questionType} onChange={(e) => changeType(e.target.value)}>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <label style={labelStyle}>Question Name (optional)</label>
          <input style={inputStyle} value={form.title} onChange={updateField("title")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <input style={inputStyle} value={form.subject} onChange={updateField("subject")} />
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input style={inputStyle} value={form.topic} onChange={updateField("topic")} />
            </div>
          </div>

          <label style={labelStyle}>Question Text</label>
          <textarea style={{ ...inputStyle, minHeight: 140 }} required value={form.description} onChange={updateField("description")} placeholder="Problem statement / question text…" />

          <div style={{ display: "grid", gridTemplateColumns: isQuiz ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Difficulty Level</label>
              <select style={inputStyle} value={form.difficulty} onChange={updateField("difficulty")}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Marks</label>
              <input style={inputStyle} type="number" value={form.points} onChange={updateField("points")} />
            </div>
            {!isQuiz && (
              <div>
                <label style={labelStyle}>Time limit (ms)</label>
                <input style={inputStyle} type="number" value={form.timeLimitMs} onChange={updateField("timeLimitMs")} />
              </div>
            )}
          </div>

          {!isQuiz && (
            <>
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
            </>
          )}

          {isQuiz && (
            <>
              <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Options — {isMulti ? "check all correct answers" : "select the correct answer"}
                </div>
                {!isTrueFalse && <button type="button" className="btn btn-ghost" onClick={addOption}>+ Add option</button>}
              </div>

              {options.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name="correctOption"
                    checked={correctIndices.includes(idx)}
                    onChange={() => toggleCorrect(idx)}
                  />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={opt}
                    disabled={isTrueFalse}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                  />
                  {!isTrueFalse && options.length > 2 && (
                    <button type="button" onClick={() => removeOption(idx)} style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}>Remove</button>
                  )}
                </div>
              ))}

              <label style={labelStyle}>Explanation (optional)</label>
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.explanation} onChange={updateField("explanation")} placeholder="Shown to staff for review; not shown to students during the test." />
            </>
          )}

          <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>Question Bank</div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
            File this question into a bank so it's easy to find and reuse later, or leave it uncategorized.
          </p>
          <div style={{ marginTop: 10 }}>
            <FolderPicker value={folderId} onChange={setFolderId} />
          </div>

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save question"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontFamily: "var(--font-body)" };

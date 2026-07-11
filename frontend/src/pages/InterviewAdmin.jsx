import { useEffect, useRef, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, marginTop: 4 };
const labelStyle = { fontSize: 11, fontWeight: 600, color: "var(--ink-dim)" };
const CATEGORIES = ["HR", "TECHNICAL", "CODING", "APTITUDE"];
const APTITUDE_CATS = ["QUANTITATIVE", "LOGICAL", "VERBAL", "DATA_INTERPRETATION"];

const EMPTY_Q = { category: "HR", subject: "", aptitudeCategory: "", difficulty: "EASY", prompt: "", expectedKeywords: "", modelAnswer: "", options: "", correctAnswer: "", explanation: "", starterCode: "", testCases: "", language: "java" };

export default function InterviewAdmin() {
  const [stats, setStats] = useState(null);
  const [students, setStudents] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [filterCategory, setFilterCategory] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_Q);
  const fileRef = useRef(null);

  function loadAll() {
    api.get("/interview/admin/stats").then((res) => setStats(res.data));
    api.get("/interview/admin/students").then((res) => setStudents(res.data));
    loadQuestions();
  }
  function loadQuestions() {
    api.get("/interview/admin/questions", { params: filterCategory ? { category: filterCategory } : {} }).then((res) => setQuestions(res.data));
  }
  useEffect(loadAll, []);
  useEffect(loadQuestions, [filterCategory]);

  async function createQuestion(e) {
    e.preventDefault();
    try {
      const payload = {
        category: form.category, subject: form.subject || null,
        aptitudeCategory: form.category === "APTITUDE" ? (form.aptitudeCategory || null) : null,
        difficulty: form.difficulty, prompt: form.prompt,
        expectedKeywords: form.expectedKeywords ? form.expectedKeywords.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        modelAnswer: form.modelAnswer || null,
        options: form.options ? form.options.split("|").map((s) => s.trim()).filter(Boolean) : undefined,
        correctAnswer: form.correctAnswer !== "" ? Number(form.correctAnswer) : undefined,
        explanation: form.explanation || null,
        starterCode: form.starterCode || null,
        testCases: form.testCases ? JSON.parse(form.testCases) : undefined,
        language: form.language || null,
      };
      await api.post("/interview/admin/questions", payload);
      setForm(EMPTY_Q);
      setAdding(false);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create question (check JSON fields like Test Cases)");
    }
  }

  async function deleteQuestion(id) {
    if (!confirm("Delete this question?")) return;
    await api.delete(`/interview/admin/questions/${id}`);
    loadQuestions();
  }

  async function exportCsv() {
    const { data } = await api.get("/interview/admin/questions/export", { params: filterCategory ? { category: filterCategory } : {}, responseType: "blob" });
    const url = URL.createObjectURL(new Blob([data], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "interview-questions.csv";
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  async function importCsv(e) {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const { data } = await api.post("/interview/admin/questions/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      alert(`Imported ${data.created}/${data.total} questions.${data.errorCount ? ` ${data.errorCount} row(s) had errors.` : ""}`);
      loadAll();
    } catch (err) {
      alert(err.response?.data?.error || "Import failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Interview Prep — Admin</h1>
        <ChalkUnderline />

        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 24 }}>
            <StatCard label="Students" value={stats.totalStudents} />
            <StatCard label="Participated" value={`${stats.studentsParticipated} (${stats.completionPercent}%)`} />
            <StatCard label="Sessions" value={`${stats.completedSessions}/${stats.totalSessions}`} />
            <StatCard label="Average Score" value={`${stats.averageScore}%`} />
            <StatCard label="Total Questions" value={stats.totalQuestions} />
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 32, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ fontSize: 16 }}>Question Bank</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <select style={{ ...inputStyle, marginTop: 0 }} value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <option value="">All categories</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={exportCsv}>⬇ Export CSV</button>
            <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>⬆ Import CSV</button>
            <input ref={fileRef} type="file" accept=".csv,.xlsx" style={{ display: "none" }} onChange={importCsv} />
            <button className="btn btn-primary" onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add Question"}</button>
          </div>
        </div>

        {adding && (
          <form onSubmit={createQuestion} className="card" style={{ padding: 20, marginTop: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px,1fr))", gap: 10 }}>
              <div>
                <label style={labelStyle}>Category</label>
                <select style={inputStyle} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              {form.category === "TECHNICAL" || form.category === "CODING" ? (
                <div><label style={labelStyle}>Subject / Topic</label><input style={inputStyle} value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></div>
              ) : form.category === "APTITUDE" ? (
                <div>
                  <label style={labelStyle}>Aptitude Category</label>
                  <select style={inputStyle} value={form.aptitudeCategory} onChange={(e) => setForm({ ...form, aptitudeCategory: e.target.value })}>
                    <option value="">Select…</option>
                    {APTITUDE_CATS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
              ) : null}
              <div>
                <label style={labelStyle}>Difficulty</label>
                <select style={inputStyle} value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                  <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                </select>
              </div>
            </div>

            <label style={labelStyle}>Prompt</label>
            <textarea style={{ ...inputStyle, minHeight: 60 }} required value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />

            {(form.category === "HR" || form.category === "TECHNICAL") && (
              <>
                <label style={labelStyle}>Expected Keywords (comma-separated)</label>
                <input style={inputStyle} value={form.expectedKeywords} onChange={(e) => setForm({ ...form, expectedKeywords: e.target.value })} />
                <label style={labelStyle}>Model Answer (optional)</label>
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={form.modelAnswer} onChange={(e) => setForm({ ...form, modelAnswer: e.target.value })} />
              </>
            )}

            {form.category === "APTITUDE" && (
              <>
                <label style={labelStyle}>Options (pipe-separated: A|B|C|D)</label>
                <input style={inputStyle} value={form.options} onChange={(e) => setForm({ ...form, options: e.target.value })} />
                <label style={labelStyle}>Correct Answer Index (0-based)</label>
                <input style={inputStyle} type="number" min="0" value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
                <label style={labelStyle}>Explanation</label>
                <textarea style={{ ...inputStyle, minHeight: 50 }} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />
              </>
            )}

            {form.category === "CODING" && (
              <>
                <label style={labelStyle}>Starter Code</label>
                <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "var(--font-mono)", fontSize: 12 }} value={form.starterCode} onChange={(e) => setForm({ ...form, starterCode: e.target.value })} />
                <label style={labelStyle}>Language</label>
                <select style={inputStyle} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                  <option value="java">Java</option><option value="python">Python</option><option value="javascript">JavaScript</option><option value="c">C</option><option value="cpp">C++</option>
                </select>
                <label style={labelStyle}>Test Cases (JSON array: [{"{"}"input":"...","expected":"..."{"}"}])</label>
                <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "var(--font-mono)", fontSize: 12 }} value={form.testCases} onChange={(e) => setForm({ ...form, testCases: e.target.value })} placeholder='[{"input":"4","expected":"24"}]' />
              </>
            )}

            <button className="btn btn-primary" style={{ marginTop: 14 }}>Save Question</button>
          </form>
        )}

        <div style={{ display: "grid", gap: 8, marginTop: 16, maxHeight: 400, overflowY: "auto" }}>
          {(questions || []).map((q) => (
            <div key={q.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
              <div>
                <span className="badge">{q.category}{q.subject ? ` · ${q.subject}` : ""}{q.aptitudeCategory ? ` · ${q.aptitudeCategory}` : ""}</span>
                <div style={{ marginTop: 4 }}>{q.prompt}</div>
              </div>
              <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 12 }} onClick={() => deleteQuestion(q.id)}>Delete</button>
            </div>
          ))}
          {questions && questions.length === 0 && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No questions in this category yet.</p>}
        </div>

        <h3 style={{ fontSize: 16, marginTop: 32 }}>Student Reports</h3>
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          {(students || []).map((s) => (
            <div key={s.studentId} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{s.name}</div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{s.rollNumber || s.email}</div>
              </div>
              <div className="mono" style={{ textAlign: "right" }}>
                <div>{s.averageScore}%</div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{s.sessionsCompleted} sessions</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{label}</div>
    </div>
  );
}

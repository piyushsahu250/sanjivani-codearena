import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };

export default function QuestionBank() {
  const [questions, setQuestions] = useState([]);
  const [meta, setMeta] = useState({ subjects: [], topics: [] });
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    api.get("/questions/meta/filters").then((res) => setMeta(res.data));
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, subject, topic, difficulty, questionType]);

  function load() {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (subject) params.subject = subject;
    if (topic) params.topic = topic;
    if (difficulty) params.difficulty = difficulty;
    if (questionType) params.questionType = questionType;
    api.get("/questions", { params }).then((res) => {
      setQuestions(res.data);
      setLoading(false);
    });
  }

  async function handleDelete(question) {
    if (!confirm(`Delete "${question.title || "this question"}"?`)) return;
    try {
      await api.delete(`/questions/${question.id}`);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete question");
    }
  }

  async function downloadFile(url, filename) {
    const res = await api.get(url, { responseType: "blob", params: { q, subject, topic, difficulty, questionType } });
    const blobUrl = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const { data } = await api.post("/questions/bulk-import", formData);
      setImportResult(data);
      setImportFile(null);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Question Bank</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/staff" className="btn btn-ghost">← Staff control room</Link>
            <Link to="/staff/questions/new" className="btn btn-primary">+ Add question</Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
          <input
            style={{ ...inputStyle, flex: "1 1 220px" }}
            placeholder="Search questions…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select style={selectStyle} value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">All subjects</option>
            {meta.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select style={selectStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
            <option value="">All topics</option>
            {meta.topics.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select style={selectStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
            <option value="">All difficulties</option>
            <option value="EASY">Easy</option>
            <option value="MEDIUM">Medium</option>
            <option value="HARD">Hard</option>
          </select>
          <select style={selectStyle} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
            <option value="">All types</option>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button className="btn btn-ghost" onClick={() => downloadFile("/questions/export", "question-bank-export.xlsx")}>
            ⬇ Export ({questions.length})
          </button>
          <button className="btn btn-ghost" onClick={() => downloadFile("/questions/bulk-template", "question-bank-template.xlsx")}>
            ⬇ Download import template
          </button>
          <button className="btn btn-ghost" onClick={() => setShowImport((s) => !s)}>
            {showImport ? "Hide import" : "⬆ Bulk import (quiz types)"}
          </button>
        </div>

        {showImport && (
          <div className="card" style={{ padding: 20, marginTop: 12 }}>
            <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
              Import Multiple Choice, True/False, and Multiple Select questions from an .xlsx/.csv file. Coding
              questions aren't supported via import — use "+ Add question" for those.
            </p>
            <form onSubmit={handleImport} style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
              <button className="btn btn-primary" disabled={!importFile || importing}>
                {importing ? "Importing…" : "Import"}
              </button>
            </form>
            {importResult && (
              <div style={{ marginTop: 12 }}>
                <p style={{ fontSize: 14 }}>
                  <strong>{importResult.createdCount}</strong> question{importResult.createdCount === 1 ? "" : "s"} created
                  out of {importResult.total}.{importResult.errorCount > 0 && ` ${importResult.errorCount} failed.`}
                </p>
                {importResult.errors.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    {importResult.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--rust)" }} className="mono">Row {e.row}: {e.reason}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          {loading && <p className="mono" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
          {!loading && questions.map((question) => (
            <div key={question.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>Q{question.questionNumber}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{question.title || "(untitled)"}</span>
                  <span className="badge">{TYPE_LABELS[question.questionType]}</span>
                  <span className={`badge badge-${question.difficulty.toLowerCase()}`}>{question.difficulty}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {[question.subject, question.topic].filter(Boolean).join(" · ") || "—"} · {question.description}
                </p>
              </div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", whiteSpace: "nowrap" }}>
                {question.points} marks{question.questionType === "CODING" ? ` · ${question._count.testCases} cases` : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Link to={`/staff/questions/${question.id}/edit`} className="btn btn-ghost">Edit</Link>
                <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => handleDelete(question)}>Delete</button>
              </div>
            </div>
          ))}
          {!loading && questions.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              No questions match. Try clearing filters, or add your first question.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };
const selectStyle = { ...inputStyle, minWidth: 140 };

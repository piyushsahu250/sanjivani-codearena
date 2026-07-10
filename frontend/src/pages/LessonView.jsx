import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const LANGUAGES = [
  { id: "java", label: "Java", monaco: "java" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

const TYPE_LABEL = { MCQ: "Multiple Choice", FILL_BLANK: "Fill in the Blank", CODING: "Coding", DEBUG: "Debugging", OUTPUT_PREDICTION: "Output Prediction" };

export default function LessonView() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [completing, setCompleting] = useState(false);
  const [bookmarking, setBookmarking] = useState(false);

  function load() {
    api.get(`/learning/lessons/${lessonId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load lesson"));
  }

  useEffect(() => { setData(null); load(); }, [lessonId]);

  async function toggleComplete() {
    setCompleting(true);
    try {
      const nextStatus = data.progress?.status === "COMPLETED" ? "IN_PROGRESS" : "COMPLETED";
      const { data: progress } = await api.post(`/learning/lessons/${lessonId}/progress`, { status: nextStatus });
      setData((d) => ({ ...d, progress: { status: progress.status, bookmarked: progress.bookmarked } }));
    } catch {
      alert("Failed to update progress");
    } finally {
      setCompleting(false);
    }
  }

  async function toggleBookmark() {
    setBookmarking(true);
    try {
      const { data: progress } = await api.post(`/learning/lessons/${lessonId}/progress`, { bookmarked: !data.progress?.bookmarked });
      setData((d) => ({ ...d, progress: { status: progress.status, bookmarked: progress.bookmarked } }));
    } catch {
      alert("Failed to update bookmark");
    } finally {
      setBookmarking(false);
    }
  }

  if (error) {
    return <div><Navbar /><div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p></div></div>;
  }
  if (!data) {
    return <div><Navbar /><div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;
  }

  const { lesson, module, course, prevLessonId, nextLessonId, progress, questions } = data;
  const completed = progress?.status === "COMPLETED";

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
              <Link to={`/learning/${slug}`} style={{ color: "var(--ink-dim)" }}>{course.name}</Link> · {module.title}
            </div>
            <h1 style={{ marginTop: 6 }}>{lesson.title}</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/learning/${slug}`} className="btn btn-ghost">← Course</Link>
            <button className="btn btn-ghost" onClick={toggleBookmark} disabled={bookmarking}>
              {progress?.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </button>
            <button className={completed ? "btn btn-dark" : "btn btn-primary"} onClick={toggleComplete} disabled={completing}>
              {completed ? "✓ Completed" : "Mark as Complete"}
            </button>
          </div>
        </div>

        <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 12 }}>~{lesson.estimatedMinutes} min read</p>

        <div className="card lesson-content" style={{ padding: 24, marginTop: 20 }} dangerouslySetInnerHTML={{ __html: lesson.content || "<p><em>No content yet.</em></p>" }} />

        {lesson.videoUrl && (
          <div className="card" style={{ padding: 16, marginTop: 16 }}>
            <strong style={{ fontSize: 13 }}>📺 Video: </strong>
            <a href={lesson.videoUrl} target="_blank" rel="noreferrer">{lesson.videoUrl}</a>
          </div>
        )}
        {lesson.pdfUrl && (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>📄 Notes (PDF): </strong>
            <a href={lesson.pdfUrl} target="_blank" rel="noreferrer">Download / view</a>
          </div>
        )}
        {Array.isArray(lesson.externalLinks) && lesson.externalLinks.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 12 }}>
            <strong style={{ fontSize: 13 }}>🔗 External resources</strong>
            <ul style={{ marginTop: 8 }}>
              {lesson.externalLinks.map((l, i) => (
                <li key={i}><a href={l.url} target="_blank" rel="noreferrer">{l.label || l.url}</a></li>
              ))}
            </ul>
          </div>
        )}

        {questions.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>Practice</h3>
            <div style={{ display: "grid", gap: 16 }}>
              {questions.map((q) => <PracticeQuestionCard key={q.id} question={q} />)}
            </div>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          {prevLessonId ? (
            <button className="btn btn-ghost" onClick={() => navigate(`/learning/${slug}/lesson/${prevLessonId}`)}>← Previous</button>
          ) : <span />}
          {nextLessonId ? (
            <button className="btn btn-primary" onClick={() => navigate(`/learning/${slug}/lesson/${nextLessonId}`)}>Next →</button>
          ) : (
            <Link to={`/learning/${slug}`} className="btn btn-primary">Back to course</Link>
          )}
        </div>
      </div>
    </div>
  );
}

function PracticeQuestionCard({ question }) {
  const [selected, setSelected] = useState(null);
  const [textAnswer, setTextAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);

  const [language, setLanguage] = useState(question.language || "java");
  const [code, setCode] = useState(question.starterCode || "");
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);

  async function checkAnswer() {
    setChecking(true);
    try {
      const answer = question.type === "FILL_BLANK" ? textAnswer : selected;
      const { data } = await api.post(`/learning/practice/${question.id}/check`, { answer });
      setResult(data);
    } catch {
      alert("Failed to check answer");
    } finally {
      setChecking(false);
    }
  }

  async function runCode() {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post(`/learning/practice/${question.id}/run`, { language, code });
      setRunResult(data);
    } catch (err) {
      alert(err.response?.data?.error || "Execution failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span className="badge">{TYPE_LABEL[question.type] || question.type}</span>
      </div>
      <p style={{ marginTop: 10, fontWeight: 600 }}>{question.prompt}</p>

      {question.type === "CODING" ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--line)" }}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button className="btn btn-primary" onClick={runCode} disabled={running}>{running ? "Running…" : "Run"}</button>
          </div>
          <div style={{ marginTop: 10, border: "1px solid var(--line)", borderRadius: 8, overflow: "hidden" }}>
            <Editor
              height="240px"
              language={LANGUAGES.find((l) => l.id === language)?.monaco}
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{ fontSize: 13, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
            />
          </div>
          {runResult && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: runResult.verdict === "ACCEPTED" ? "#E7F3EB" : "#F7E4E0" }}>
              <div className="mono" style={{ fontWeight: 700, color: runResult.verdict === "ACCEPTED" ? "var(--mint)" : "var(--rust)" }}>
                {runResult.verdict} — {runResult.passedCases}/{runResult.totalCases} cases passed
              </div>
              {runResult.errorSummary && (
                <div className="mono" style={{ fontSize: 12, marginTop: 6 }}>
                  {runResult.errorSummary.type}{runResult.errorSummary.line ? ` (line ${runResult.errorSummary.line})` : ""}: {runResult.errorSummary.message}
                </div>
              )}
            </div>
          )}
        </>
      ) : question.type === "FILL_BLANK" ? (
        <>
          <input
            style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", marginTop: 10 }}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            placeholder="Type your answer…"
            disabled={!!result}
          />
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={checkAnswer} disabled={checking || !!result || !textAnswer.trim()}>
            {checking ? "Checking…" : "Check answer"}
          </button>
        </>
      ) : (
        <>
          <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
            {(question.options || []).map((opt, idx) => (
              <label key={idx} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: result ? "default" : "pointer" }}>
                <input type="radio" name={question.id} checked={selected === idx} onChange={() => setSelected(idx)} disabled={!!result} />
                {opt}
              </label>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={checkAnswer} disabled={checking || !!result || selected === null}>
            {checking ? "Checking…" : "Check answer"}
          </button>
        </>
      )}

      {result && (
        <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: result.correct ? "#E7F3EB" : "#F7E4E0" }}>
          <div className="mono" style={{ fontWeight: 700, color: result.correct ? "var(--mint)" : "var(--rust)" }}>
            {result.correct ? "✓ Correct" : "✗ Not quite"}
          </div>
          {result.explanation && <p style={{ fontSize: 13, marginTop: 6 }}>{result.explanation}</p>}
        </div>
      )}
    </div>
  );
}

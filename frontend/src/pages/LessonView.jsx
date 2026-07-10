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
  const [advancing, setAdvancing] = useState(false);

  function load() {
    api.get(`/learning/lessons/${lessonId}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load lesson"));
  }

  useEffect(() => { setData(null); setError(""); load(); }, [lessonId]);

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

  // Progress auto-saves as soon as this lesson is viewed (GET /lessons/:id marks it
  // IN_PROGRESS server-side) and again here — clicking Next marks the lesson COMPLETED
  // without the student needing to press a separate "Save"/"Mark complete" button first.
  async function goNext(nextLessonId) {
    setAdvancing(true);
    try {
      if (data.progress?.status !== "COMPLETED") {
        await api.post(`/learning/lessons/${lessonId}/progress`, { status: "COMPLETED" });
      }
      navigate(`/learning/${slug}/lesson/${nextLessonId}`);
    } catch {
      alert("Failed to save progress");
    } finally {
      setAdvancing(false);
    }
  }

  function handlePassed() {
    setData((d) => ({ ...d, progress: { ...(d.progress || {}), status: "COMPLETED" } }));
  }

  if (error) {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }}>
          <p style={{ color: "var(--rust)" }}>{error}</p>
          <Link to={`/learning/${slug}`} className="btn btn-ghost" style={{ marginTop: 12, display: "inline-block" }}>← Back to course</Link>
        </div>
      </div>
    );
  }
  if (!data) {
    return <div><Navbar /><div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;
  }

  const { lesson, module, course, prevLessonId, nextLessonId, progress, questions } = data;
  const completed = progress?.status === "COMPLETED";
  const codingQuestions = questions.filter((q) => q.type === "CODING");
  const testQuestions = questions.filter((q) => q.type !== "CODING");

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
              <Link to={`/learning/${slug}`} style={{ color: "var(--ink-dim)" }}>{course.name}</Link> · {module.title}
            </div>
            <h1 style={{ marginTop: 6 }}>{lesson.isModuleTest && "📝 "}{lesson.title}</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to={`/learning/${slug}`} className="btn btn-ghost">← Course</Link>
            <button className="btn btn-ghost" onClick={toggleBookmark} disabled={bookmarking}>
              {progress?.bookmarked ? "★ Bookmarked" : "☆ Bookmark"}
            </button>
            {!lesson.isModuleTest && (
              <button className={completed ? "btn btn-dark" : "btn btn-primary"} onClick={toggleComplete} disabled={completing}>
                {completed ? "✓ Completed" : "Mark as Complete"}
              </button>
            )}
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

        {lesson.isModuleTest && testQuestions.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>
              Practice Test {completed && <span style={{ color: "var(--mint)", fontSize: 13 }}>— ✓ Passed</span>}
            </h3>
            <ModuleTestBlock lessonId={lessonId} questions={testQuestions} alreadyPassed={completed} onPassed={handlePassed} />
          </>
        )}

        {codingQuestions.length > 0 && (
          <>
            <h3 style={{ fontSize: 16, marginTop: 32, marginBottom: 12 }}>
              {lesson.isModuleTest ? "Bonus Coding Practice (optional, not required to pass)" : "Practice"}
            </h3>
            <div style={{ display: "grid", gap: 16 }}>
              {codingQuestions.map((q) => <PracticeQuestionCard key={q.id} question={q} />)}
            </div>
          </>
        )}

        {!lesson.isModuleTest && testQuestions.length > 0 && (
          <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
            {testQuestions.map((q) => <PracticeQuestionCard key={q.id} question={q} />)}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          {prevLessonId ? (
            <button className="btn btn-ghost" onClick={() => navigate(`/learning/${slug}/lesson/${prevLessonId}`)}>← Previous</button>
          ) : <span />}
          {lesson.isModuleTest && !completed ? (
            <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", alignSelf: "center" }}>Pass the practice test above to continue →</span>
          ) : nextLessonId ? (
            <button className="btn btn-primary" onClick={() => goNext(nextLessonId)} disabled={advancing}>
              {advancing ? "Saving…" : "Next →"}
            </button>
          ) : (
            <Link to={`/learning/${slug}`} className="btn btn-primary">Back to course</Link>
          )}
        </div>
      </div>
    </div>
  );
}

// The gating practice test for a module: every non-coding question is answered together and
// submitted as one batch (not checked one at a time), then reviewed — selected answers
// highlighted correct/incorrect, with the right answer + explanation shown for anything missed.
// Passing unlocks the next module; failing just lets the student retry, no cap or cooldown.
function ModuleTestBlock({ lessonId, questions, alreadyPassed, onPassed }) {
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [retaking, setRetaking] = useState(false);

  const allAnswered = questions.every((q) => {
    const a = answers[q.id];
    return a !== undefined && a !== null && String(a).trim() !== "";
  });

  async function submit() {
    setSubmitting(true);
    try {
      const { data } = await api.post(`/learning/lessons/${lessonId}/test-submit`, { answers });
      setResult(data);
      if (data.passed) onPassed();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to submit test");
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    setResult(null);
    setAnswers({});
    setRetaking(true);
  }

  if (alreadyPassed && !result && !retaking) {
    return (
      <div className="card" style={{ padding: 20, textAlign: "center" }}>
        <div style={{ color: "var(--mint)", fontWeight: 700 }}>✓ You've already passed this practice test.</div>
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={() => setRetaking(true)}>Retake for practice</button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <div style={{ textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 32, fontWeight: 700, color: result.passed ? "var(--mint)" : "var(--rust)" }}>{result.score}%</div>
          <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            {result.correctCount}/{result.totalCount} correct — {result.passed ? "Passed!" : `Need ${result.passThreshold}% to pass`}
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
          {result.results.map((r, i) => (
            <div key={r.questionId} className="card" style={{ padding: 16, borderLeft: `4px solid ${r.correct ? "var(--mint)" : "var(--rust)"}` }}>
              <div style={{ fontWeight: 600 }}>{i + 1}. {r.prompt}</div>
              {r.options ? (
                <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                  {r.options.map((opt, idx) => {
                    const isSelected = Number(r.selected) === idx;
                    const isCorrectOpt = Number(r.correctAnswer) === idx;
                    const bg = isCorrectOpt ? "#E7F3EB" : isSelected && !r.correct ? "#F7E4E0" : "transparent";
                    const color = isCorrectOpt ? "var(--mint)" : isSelected && !r.correct ? "var(--rust)" : "var(--ink)";
                    return (
                      <div key={idx} style={{ padding: "8px 12px", borderRadius: 8, background: bg, color, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                        <span>{opt}</span>
                        {isSelected && <span className="mono" style={{ fontSize: 11 }}>Your answer</span>}
                        {isCorrectOpt && !isSelected && <span className="mono" style={{ fontSize: 11 }}>Correct answer</span>}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <div>Your answer: <span className="mono">{r.selected || "(blank)"}</span></div>
                  {!r.correct && <div>Correct answer: <span className="mono" style={{ color: "var(--mint)" }}>{r.correctAnswer}</span></div>}
                </div>
              )}
              {r.explanation && <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>{r.explanation}</p>}
            </div>
          ))}
        </div>

        {!result.passed && <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} onClick={retry}>Retry Test</button>}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 24 }}>
      <div style={{ display: "grid", gap: 20 }}>
        {questions.map((q, i) => (
          <div key={q.id}>
            <div style={{ fontWeight: 600 }}>{i + 1}. {q.prompt}</div>
            {q.type === "FILL_BLANK" ? (
              <input
                style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", marginTop: 8 }}
                value={answers[q.id] || ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                placeholder="Type your answer…"
              />
            ) : (
              <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                {(q.options || []).map((opt, idx) => (
                  <label key={idx} className="card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input type="radio" name={q.id} checked={answers[q.id] === idx} onChange={() => setAnswers((a) => ({ ...a, [q.id]: idx }))} />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <button className="btn btn-primary" style={{ marginTop: 20, width: "100%" }} onClick={submit} disabled={!allAnswered || submitting}>
        {submitting ? "Submitting…" : "Submit Test"}
      </button>
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

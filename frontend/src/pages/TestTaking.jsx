import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
];

export default function TestTaking() {
  const { id: testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [language, setLanguage] = useState("javascript");
  const [code, setCode] = useState("");
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const timerRef = useRef(null);

  useEffect(() => {
    async function load() {
      const startRes = await api.post(`/tests/${testId}/start`);
      setAttemptId(startRes.data.id);
      const testRes = await api.get(`/tests/${testId}`);
      setTest(testRes.data);
      const end = new Date(testRes.data.endTime).getTime();
      setSecondsLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    }
    load();
  }, [testId]);

  useEffect(() => {
    if (secondsLeft === null) return;
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          finalizeAndExit(true);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft !== null]);

  const questions = test?.questions || [];
  const current = questions[activeIdx]?.question;

  useEffect(() => {
    if (current) setCode(current.starterCode || defaultStarter(language));
    setRunResult(null);
  }, [activeIdx, current, language]);

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return "--:--:--";
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [secondsLeft]);

  async function handleRun() {
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post("/submissions/run", { questionId: current.id, language, code });
      setRunResult(data);
    } catch (err) {
      setRunResult({ error: err.response?.data?.error || "Run failed" });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const { data } = await api.post("/submissions/submit", { attemptId, questionId: current.id, language, code });
      setSubmitResult(data);
      setSubmittedQuestions((prev) => ({ ...prev, [current.id]: data.result.verdict }));
    } catch (err) {
      alert(err.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizeAndExit(auto = false) {
    if (!attemptId) return;
    if (!auto && !confirm("Submit and end the test now? You won't be able to make further changes.")) return;
    await api.post(`/submissions/finalize/${attemptId}`);
    navigate("/dashboard");
  }

  if (!test) return <div style={{ padding: 48 }} className="mono">Loading test…</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "var(--slate-900)", color: "var(--chalk)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{test.title}</strong>
        </div>
        <div className="mono" style={{ fontSize: 20, color: secondsLeft < 300 ? "var(--rust)" : "var(--amber)" }}>
          {timeLabel} <span style={{ opacity: 0.6 }}>▊</span>
        </div>
        <button className="btn btn-primary" onClick={() => finalizeAndExit(false)}>End test</button>
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Question navigator */}
        <div style={{ width: 220, borderRight: "1px solid var(--line)", padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)", marginBottom: 10 }}>QUESTIONS</div>
          {questions.map((tq, idx) => {
            const verdict = submittedQuestions[tq.question.id];
            return (
              <button
                key={tq.id}
                onClick={() => setActiveIdx(idx)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "10px 12px",
                  marginBottom: 6,
                  borderRadius: 8,
                  border: idx === activeIdx ? "1px solid var(--amber)" : "1px solid var(--line)",
                  background: idx === activeIdx ? "#FCEFD9" : "#fff",
                  fontSize: 13,
                }}
              >
                Q{idx + 1}. {tq.question.title}
                {verdict && (
                  <span style={{ display: "block", fontSize: 11, marginTop: 2, color: verdict === "ACCEPTED" ? "var(--mint)" : "var(--rust)" }} className="mono">
                    {verdict}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Question description */}
        <div style={{ width: "38%", padding: 24, overflowY: "auto", borderRight: "1px solid var(--line)" }}>
          {current && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <h2 style={{ fontSize: 20 }}>{current.title}</h2>
                <span className={`badge badge-${current.difficulty.toLowerCase()}`}>{current.difficulty}</span>
              </div>
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{current.points} points</p>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, marginTop: 16 }}>{current.description}</p>

              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>SAMPLE TEST CASES</div>
                {current.testCases.map((tc, i) => (
                  <div key={tc.id} className="card" style={{ padding: 12, marginTop: 8, fontSize: 13 }}>
                    <div className="mono"><strong>Input:</strong> {tc.input}</div>
                    <div className="mono"><strong>Expected:</strong> {tc.expected}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Editor + results */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mono" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
              {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" onClick={handleRun} disabled={running}>{running ? "Running…" : "▶ Run sample"}</button>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>{submitting ? "Submitting…" : "Submit answer"}</button>
            </div>
          </div>

          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={LANGUAGES.find((l) => l.id === language)?.monaco}
              value={code}
              onChange={(v) => setCode(v || "")}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
            />
          </div>

          <div style={{ maxHeight: "30%", overflowY: "auto", borderTop: "1px solid var(--line)", padding: 16, background: "#FBF9F4" }}>
            {runResult && (
              <ResultBlock title="Sample run result" result={runResult} />
            )}
            {submitResult && (
              <ResultBlock title="Submission result" result={submitResult.result} score={submitResult.submission.score} />
            )}
            {!runResult && !submitResult && (
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                Run against sample cases before submitting. Submission is graded against all (including hidden) test cases.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultBlock({ title, result, score }) {
  if (result.error) {
    return <p style={{ color: "var(--rust)" }} className="mono">{title}: {result.error}</p>;
  }
  const color = result.verdict === "ACCEPTED" ? "var(--mint)" : result.verdict === "PARTIAL" ? "var(--amber-dark)" : "var(--rust)";
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, color }}>
        {title}: {result.verdict} — {result.passedCases}/{result.totalCases} test cases passed
        {score !== undefined && ` · ${score} points`}
      </div>
      {result.details?.map((d, i) => (
        <div key={i} style={{ fontSize: 12, marginTop: 6 }} className="mono">
          <span style={{ color: d.verdict === "PASSED" ? "var(--mint)" : "var(--rust)" }}>[{d.verdict}]</span>{" "}
          input: {d.input} | expected: {d.expected} | got: {d.actual ?? d.error}
        </div>
      ))}
    </div>
  );
}

function defaultStarter(language) {
  if (language === "python") return "# Read input via input(), print your answer\n";
  return "// Read input via require('fs').readFileSync(0, 'utf8'), console.log your answer\n";
}

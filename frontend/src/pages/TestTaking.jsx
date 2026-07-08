import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";

const LANGUAGES = [
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
  { id: "java", label: "Java", monaco: "java" },
];

const MAX_TAB_VIOLATIONS = 3;

export default function TestTaking() {
  const { id: testId } = useParams();
  const navigate = useNavigate();

  const [testMeta, setTestMeta] = useState(null);
  const [metaError, setMetaError] = useState(null);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);

  const [test, setTest] = useState(null);
  const [attemptId, setAttemptId] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: { language, code } | { selected: number[] } }
  const [runResult, setRunResult] = useState(null);
  const [submitResult, setSubmitResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedQuestions, setSubmittedQuestions] = useState({});
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [questionSecondsLeft, setQuestionSecondsLeft] = useState(null);
  const [tabWarning, setTabWarning] = useState(null);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const timerRef = useRef(null);
  const attemptIdRef = useRef(null);
  const finalizedRef = useRef(false);

  const [mediaGranted, setMediaGranted] = useState(false);
  const [mediaError, setMediaError] = useState(null);
  const [requestingMedia, setRequestingMedia] = useState(false);
  const mediaStreamRef = useRef(null);
  const preflightVideoRef = useRef(null);
  const liveVideoRef = useRef(null);

  // Load basic test info up front so we can show a "Begin Test" screen
  // (fullscreen must be requested from a direct click, not on page load).
  useEffect(() => {
    api
      .get(`/tests/${testId}`)
      .then((res) => setTestMeta(res.data))
      .catch((err) => setMetaError(err.response?.data?.error || "Could not load this test"));
  }, [testId]);

  async function requestMedia() {
    setRequestingMedia(true);
    setMediaError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      mediaStreamRef.current = stream;
      setMediaGranted(true);
      if (preflightVideoRef.current) preflightVideoRef.current.srcObject = stream;
    } catch (err) {
      const reason =
        err.name === "NotAllowedError"
          ? "Camera and microphone access was denied. Please allow both to begin this test."
          : err.name === "NotFoundError"
          ? "No camera or microphone was found on this device. Both are required to begin this test."
          : "Could not access your camera/microphone. Please check your device and browser permissions.";
      setMediaError(reason);
      setMediaGranted(false);
    } finally {
      setRequestingMedia(false);
    }
  }

  // Keep the live self-view (shown during the test) in sync with the granted stream
  useEffect(() => {
    if (started && liveVideoRef.current && mediaStreamRef.current) {
      liveVideoRef.current.srcObject = mediaStreamRef.current;
    }
  }, [started]);

  // Continuously monitor that the webcam/mic stay live — a device going 'ended' (unplugged,
  // permission revoked mid-session, etc.) or dropping out of the "live" state counts as a violation.
  useEffect(() => {
    if (!started) return;
    const stream = mediaStreamRef.current;
    if (!stream) return;

    const tracks = stream.getTracks();
    function handleEnded() {
      reportViolation("your camera or microphone was turned off or disconnected");
    }
    tracks.forEach((t) => t.addEventListener("ended", handleEnded));

    const pollInterval = setInterval(() => {
      const stillLive = stream.getTracks().every((t) => t.readyState === "live");
      if (!stillLive) reportViolation("your camera or microphone was turned off or disconnected");
    }, 5000);

    return () => {
      tracks.forEach((t) => t.removeEventListener("ended", handleEnded));
      clearInterval(pollInterval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Release camera/mic when the test ends or the component unmounts
  useEffect(() => {
    return () => {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function beginTest() {
    setStarting(true);
    // Request fullscreen synchronously in response to the click, before any awaits.
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      // Fullscreen can be denied/unsupported — proceed with the test regardless.
    }
    try {
      const startRes = await api.post(`/tests/${testId}/start`);
      setAttemptId(startRes.data.id);
      attemptIdRef.current = startRes.data.id;
      const testRes = await api.get(`/tests/${testId}`);
      setTest(testRes.data);
      const end = new Date(testRes.data.endTime).getTime();
      setSecondsLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
      setStarted(true);
    } catch (err) {
      setLoadError(err.response?.data?.error || "Could not start this test");
    } finally {
      setStarting(false);
    }
  }

  const questions = test?.questions || [];
  const current = questions[activeIdx]?.question;
  const currentTq = questions[activeIdx];
  const isQuiz = current && current.questionType !== "CODING";
  const isMulti = current?.questionType === "MULTISELECT";

  // Overall test timer
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

  // Per-question timer: resets whenever the active question changes, auto-advances on expiry
  useEffect(() => {
    if (!currentTq) return;
    setQuestionSecondsLeft(currentTq.timeLimitSec ?? 900);
    const interval = setInterval(() => {
      setQuestionSecondsLeft((s) => {
        if (s === null) return s;
        if (s <= 1) {
          clearInterval(interval);
          setActiveIdx((idx) => (idx < questions.length - 1 ? idx + 1 : idx));
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx, currentTq?.id]);

  // Initialize/restore the answer for the active question, and reset the run result panel
  useEffect(() => {
    if (!current) return;
    setAnswers((prev) => {
      if (prev[current.id]) return prev;
      if (current.questionType === "CODING") {
        return { ...prev, [current.id]: { language: "javascript", code: current.starterCode || defaultStarter("javascript") } };
      }
      return { ...prev, [current.id]: { selected: [] } };
    });
    setRunResult(null);
    setSubmitResult(null);
  }, [current]);

  function reportViolation(reason) {
    if (!attemptIdRef.current || finalizedRef.current) return;
    api
      .post(`/tests/attempts/${attemptIdRef.current}/violation`)
      .then(({ data }) => {
        if (data.autoSubmitted) {
          finalizedRef.current = true;
          setAutoSubmitted(true);
          if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
          mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
          alert("Your test has been auto-submitted due to repeated integrity violations (tab switching, exiting fullscreen, or disabling your camera/microphone).");
        } else {
          const message = `Warning ${data.tabSwitchCount}/${MAX_TAB_VIOLATIONS}: ${reason}. The test will auto-submit if this happens ${MAX_TAB_VIOLATIONS} times.`;
          setTabWarning(message);
          alert(message);
        }
      })
      .catch(() => {});
  }

  // Tab-switch / focus-loss detection
  useEffect(() => {
    if (!started) return;
    function handleVisibilityChange() {
      if (document.hidden) reportViolation("switching tabs during a test is not allowed");
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [started]);

  // Fullscreen-exit detection
  useEffect(() => {
    if (!started) return;
    function handleFullscreenChange() {
      if (!document.fullscreenElement && !finalizedRef.current) {
        reportViolation("exiting fullscreen during a test is not allowed");
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [started]);

  const answer = current ? answers[current.id] : null;

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return "--:--:--";
    const h = String(Math.floor(secondsLeft / 3600)).padStart(2, "0");
    const m = String(Math.floor((secondsLeft % 3600) / 60)).padStart(2, "0");
    const s = String(secondsLeft % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [secondsLeft]);

  const questionTimeLabel = useMemo(() => {
    if (questionSecondsLeft === null) return "--:--";
    const m = String(Math.floor(questionSecondsLeft / 60)).padStart(2, "0");
    const s = String(questionSecondsLeft % 60).padStart(2, "0");
    return `${m}:${s}`;
  }, [questionSecondsLeft]);

  function setLanguage(language) {
    if (!current) return;
    setAnswers((prev) => ({
      ...prev,
      [current.id]: { language, code: prev[current.id]?.code || current.starterCode || defaultStarter(language) },
    }));
  }

  function setCode(code) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: { ...prev[current.id], code } }));
  }

  function toggleOption(idx) {
    if (!current) return;
    setAnswers((prev) => {
      const prevSelected = prev[current.id]?.selected || [];
      const nextSelected = isMulti
        ? (prevSelected.includes(idx) ? prevSelected.filter((i) => i !== idx) : [...prevSelected, idx])
        : [idx];
      return { ...prev, [current.id]: { ...prev[current.id], selected: nextSelected } };
    });
  }

  async function handleRun() {
    if (!answer || isQuiz) return;
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post("/submissions/run", { questionId: current.id, language: answer.language, code: answer.code });
      setRunResult(data);
    } catch (err) {
      setRunResult({ error: err.response?.data?.error || "Run failed" });
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!answer) return;
    setSubmitting(true);
    setSubmitResult(null);
    try {
      const payload = { attemptId, questionId: current.id };
      if (isQuiz) {
        payload.selectedOptions = answer.selected || [];
      } else {
        payload.language = answer.language;
        payload.code = answer.code;
      }
      const { data } = await api.post("/submissions/submit", payload);
      setSubmitResult(data);
      setSubmittedQuestions((prev) => ({ ...prev, [current.id]: data.result.verdict }));
    } catch (err) {
      alert(err.response?.data?.error || "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizeAndExit(auto = false) {
    if (!attemptId || finalizedRef.current) return;
    if (!auto && !confirm("Submit and end the test now? You won't be able to make further changes.")) return;
    finalizedRef.current = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    await api.post(`/submissions/finalize/${attemptId}`);
    navigate("/dashboard");
  }

  async function resumeFullscreen() {
    try {
      await document.documentElement.requestFullscreen?.();
      setTabWarning(null);
    } catch {
      // ignore
    }
  }

  if (metaError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16 }}>{metaError}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16 }}>{loadError}</p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (autoSubmitted) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 16, color: "var(--rust)" }}>
            Your test was automatically submitted after repeated integrity violations (leaving the test window,
            exiting fullscreen, or your camera/microphone being turned off).
          </p>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => navigate("/dashboard")}>
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!started) {
    if (!testMeta) return <div style={{ padding: 48 }} className="mono">Loading test…</div>;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", padding: 24 }}>
        <div className="card" style={{ padding: 32, maxWidth: 480, textAlign: "center" }}>
          <h2>{testMeta.title}</h2>
          {testMeta.description && <p style={{ color: "var(--ink-dim)", marginTop: 8 }}>{testMeta.description}</p>}
          <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 16 }}>
            {testMeta.questions?.length || 0} questions · {testMeta.durationMin} minutes
          </p>
          <p style={{ fontSize: 13, marginTop: 20 }}>
            This test runs in fullscreen with your camera and microphone on for the full duration. Switching tabs,
            exiting fullscreen, or disabling your camera/mic is tracked and will auto-submit your test after{" "}
            {MAX_TAB_VIOLATIONS} violations.
          </p>

          <div style={{ marginTop: 20, padding: 16, border: "1px solid var(--line)", borderRadius: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Camera &amp; microphone check</div>
            {mediaGranted ? (
              <>
                <video
                  ref={preflightVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{ width: 160, height: 120, borderRadius: 8, marginTop: 10, background: "#000", objectFit: "cover" }}
                />
                <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>✓ Camera and microphone are ready</p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6 }}>
                  Both are required before you can begin — they stay on for the whole test.
                </p>
                <button className="btn btn-dark" style={{ marginTop: 10 }} onClick={requestMedia} disabled={requestingMedia}>
                  {requestingMedia ? "Requesting access…" : "Grant camera & microphone access"}
                </button>
                {mediaError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 8 }}>{mediaError}</p>}
              </>
            )}
          </div>

          <button
            className="btn btn-primary"
            style={{ marginTop: 20, padding: "12px 24px", opacity: mediaGranted ? 1 : 0.4 }}
            onClick={beginTest}
            disabled={starting || !mediaGranted}
          >
            {starting ? "Starting…" : "Begin Test (Fullscreen)"}
          </button>
        </div>
      </div>
    );
  }

  if (!test) return <div style={{ padding: 48 }} className="mono">Loading test…</div>;

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Top bar */}
      <div style={{ background: "var(--slate-900)", color: "var(--chalk)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <strong>{test.title}</strong>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div className="mono" style={{ fontSize: 13, color: "var(--chalk-dim)" }}>
            Question: {questionTimeLabel}
          </div>
          <div className="mono" style={{ fontSize: 20, color: secondsLeft < 300 ? "var(--rust)" : "var(--amber)" }}>
            {timeLabel} <span style={{ opacity: 0.6 }}>▊</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => finalizeAndExit(false)}>End test</button>
      </div>

      <video
        ref={liveVideoRef}
        autoPlay
        muted
        playsInline
        style={{
          position: "fixed", bottom: 16, right: 16, width: 140, height: 105, borderRadius: 8,
          objectFit: "cover", background: "#000", border: "2px solid var(--amber)", zIndex: 50,
        }}
      />

      {tabWarning && (
        <div style={{ background: "#FCEFD9", color: "var(--rust)", padding: "8px 24px", fontSize: 13, fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }} className="mono">
          <span>{tabWarning}</span>
          {!document.fullscreenElement && (
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={resumeFullscreen}>
              Resume fullscreen
            </button>
          )}
        </div>
      )}

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
                Q{idx + 1}. {tq.question.title || "(untitled)"}
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
                <h2 style={{ fontSize: 20 }}>{current.title || "(untitled)"}</h2>
                <span className={`badge badge-${current.difficulty.toLowerCase()}`}>{current.difficulty}</span>
              </div>
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{current.points} points</p>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, marginTop: 16 }}>{current.description}</p>

              {!isQuiz && (
                <div style={{ marginTop: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>SAMPLE TEST CASES</div>
                  {current.testCases.map((tc, i) => (
                    <div key={tc.id} className="card" style={{ padding: 12, marginTop: 8, fontSize: 13 }}>
                      <div className="mono"><strong>Input:</strong> {tc.input}</div>
                      <div className="mono"><strong>Expected:</strong> {tc.expected}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Answer panel: code editor for Coding, options for quiz types */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {isQuiz ? (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                  {isMulti ? "Select all that apply" : "Select one answer"}
                </span>
                <button className="btn btn-primary" onClick={handleSubmit} disabled={submitting || !(answer?.selected?.length)}>
                  {submitting ? "Submitting…" : "Submit answer"}
                </button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
                {(current.options || []).map((opt, idx) => (
                  <label
                    key={idx}
                    className="card"
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, cursor: "pointer" }}
                  >
                    <input
                      type={isMulti ? "checkbox" : "radio"}
                      name="quiz-option"
                      checked={(answer?.selected || []).includes(idx)}
                      onChange={() => toggleOption(idx)}
                    />
                    <span style={{ fontSize: 14 }}>{opt}</span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <select value={answer?.language || "javascript"} onChange={(e) => setLanguage(e.target.value)} className="mono" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
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
                  language={LANGUAGES.find((l) => l.id === answer?.language)?.monaco}
                  value={answer?.code || ""}
                  onChange={(v) => setCode(v || "")}
                  theme="vs-dark"
                  options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
                />
              </div>
            </>
          )}

          <div style={{ maxHeight: "30%", overflowY: "auto", borderTop: "1px solid var(--line)", padding: 16, background: "#FBF9F4" }}>
            {runResult && (
              <ResultBlock title="Sample run result" result={runResult} />
            )}
            {submitResult && (
              <ResultBlock title="Submission result" result={submitResult.result} score={submitResult.submission.score} isQuiz={isQuiz} />
            )}
            {!runResult && !submitResult && (
              <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                {isQuiz
                  ? "Choose an answer and submit — quiz questions are graded instantly."
                  : "Run against sample cases before submitting. Submission is graded against all (including hidden) test cases."}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultBlock({ title, result, score, isQuiz }) {
  if (result.error) {
    return <p style={{ color: "var(--rust)" }} className="mono">{title}: {result.error}</p>;
  }
  const color = result.verdict === "ACCEPTED" ? "var(--mint)" : result.verdict === "PARTIAL" ? "var(--amber-dark)" : "var(--rust)";
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, color }}>
        {title}: {result.verdict === "ACCEPTED" ? "Correct" : result.verdict === "PARTIAL" ? "Partially correct" : "Incorrect"}
        {isQuiz
          ? (score !== undefined && ` · ${score} points`)
          : ` — ${result.passedCases}/${result.totalCases} test cases passed${score !== undefined ? ` · ${score} points` : ""}`}
      </div>
      {!isQuiz && result.details?.map((d, i) => (
        <div key={i} style={{ fontSize: 12, marginTop: 6 }} className="mono">
          <span style={{ color: d.verdict === "PASSED" ? "var(--mint)" : "var(--rust)" }}>[{d.verdict}]</span>{" "}
          input: {d.input} | expected: {d.expected} | got: {d.actual ?? d.error}
        </div>
      ))}
    </div>
  );
}

function defaultStarter(language) {
  switch (language) {
    case "python":
      return "# Read input via input(), print your answer\n";
    case "c":
      return '#include <stdio.h>\n\nint main() {\n    // read input with scanf, print your answer with printf\n    return 0;\n}\n';
    case "cpp":
      return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // read input with cin, print your answer with cout\n    return 0;\n}\n';
    case "java":
      return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // read input via sc, print your answer with System.out\n    }\n}\n';
    default:
      return "// Read input via require('fs').readFileSync(0, 'utf8'), console.log your answer\n";
  }
}

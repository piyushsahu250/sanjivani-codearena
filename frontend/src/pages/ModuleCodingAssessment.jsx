import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";
import { useGamification } from "../context/GamificationContext";
import { useProctoring } from "../hooks/useProctoring";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const ALL_LANGUAGES = [
  { id: "java", label: "Java", monaco: "java" },
  { id: "python", label: "Python", monaco: "python" },
  { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "c", label: "C", monaco: "c" },
  { id: "cpp", label: "C++", monaco: "cpp" },
];

const AUTOSAVE_INTERVAL_MS = 10000; // spec: auto-save every 10 seconds

const VIOLATION_LABEL = {
  TAB_SWITCH: "switching tabs",
  FULLSCREEN_EXIT: "exiting fullscreen",
  COPY: "copying text",
  PASTE: "pasting text",
  CUT: "cutting text",
  RIGHT_CLICK: "right-clicking",
  DEVTOOLS: "opening developer tools",
  PRINT_SCREEN_ATTEMPT: "attempting a screenshot",
  REFRESH_ATTEMPT: "attempting to refresh/leave the page",
  MULTI_MONITOR: "using multiple monitors",
  FACE_MISSING: "no face being detected in the camera frame",
  MULTIPLE_FACES: "multiple faces being detected in the camera frame",
  CAMERA_DROPPED: "your camera being turned off or disconnected",
};

export default function ModuleCodingAssessment() {
  const { slug, moduleId } = useParams();
  const { notify } = useGamification();

  const [status, setStatus] = useState(null); // GET /module-coding/module/:moduleId response
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | preflight | starting | active | result
  const [result, setResult] = useState(null);

  const [attemptId, setAttemptId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [allowedLanguages, setAllowedLanguages] = useState(["java"]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { [questionId]: { language, code } }
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [autoSubmitReasonMsg, setAutoSubmitReasonMsg] = useState("");
  const [violationWarning, setViolationWarning] = useState(null);
  const [violationCount, setViolationCount] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState(null);

  const deadlineRef = useRef(null);
  const attemptIdRef = useRef(null);
  const finalizedRef = useRef(false);
  const lastSavedCodeRef = useRef({});
  const timerRef = useRef(null);

  function load() {
    setPhase("loading");
    api.get(`/module-coding/module/${moduleId}`)
      .then((res) => { setStatus(res.data); setPhase("preflight"); })
      .catch((err) => setError(err.response?.data?.error || "Failed to load coding assessment"));
  }
  useEffect(() => { load(); }, [moduleId]);

  async function onViolation(type) {
    if (!attemptIdRef.current || finalizedRef.current) return;
    try {
      const { data } = await api.post(`/module-coding/attempts/${attemptIdRef.current}/violation`, { type });
      setViolationCount(data.violationCount);
      if (data.autoSubmitted) {
        finalizedRef.current = true;
        setAutoSubmitted(true);
        setAutoSubmitReasonMsg(VIOLATION_LABEL[type] || "a proctoring violation");
        proctor.stopMedia();
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } else {
        const msg = `Warning ${data.violationCount}/${data.maxViolations}: ${VIOLATION_LABEL[type] || type}. The assessment will auto-submit if this continues.`;
        setViolationWarning(msg);
        setTimeout(() => setViolationWarning((m) => (m === msg ? null : m)), 6000);
      }
    } catch {
      // best-effort
    }
  }

  const proctor = useProctoring({
    active: phase === "active",
    requireFullscreen: status?.test?.requireFullscreen !== false,
    requireWebcam: !!status?.test?.requireWebcam,
    onViolation,
  });

  async function beginOrResume() {
    setPhase("starting");
    try {
      if (status?.test?.requireFullscreen !== false) {
        try { await document.documentElement.requestFullscreen?.(); } catch { /* best-effort */ }
      }
      const { data } = await api.post(`/module-coding/module/${moduleId}/start`);
      setAttemptId(data.attemptId);
      attemptIdRef.current = data.attemptId;
      deadlineRef.current = data.deadline;
      setQuestions(data.questions);
      setAllowedLanguages(Array.isArray(data.allowedLanguages) ? data.allowedLanguages : ["java"]);

      const initialAnswers = {};
      data.questions.forEach((q) => {
        const lang = (Array.isArray(data.allowedLanguages) && data.allowedLanguages[0]) || "java";
        initialAnswers[q.id] = { language: lang, code: q.starterCode || defaultStarter(lang) };
      });
      setAnswers(initialAnswers);
      setSecondsLeft(Math.max(0, Math.floor((data.deadline - Date.now()) / 1000)));
      setPhase("active");
    } catch (err) {
      setError(err.response?.data?.error || "Could not start this assessment");
      setPhase("preflight");
    }
  }

  // Countdown timer, self-correcting against the fixed deadline.
  useEffect(() => {
    if (phase !== "active" || secondsLeft === null) return;
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((deadlineRef.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timerRef.current);
        finalize("TIME_EXPIRED");
      }
    }, 1000);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft !== null]);

  // Auto-save every 10 seconds (spec-required interval) — only the active question's code, only
  // if it changed since the last save.
  useEffect(() => {
    if (phase !== "active") return;
    const interval = setInterval(() => flushAutosave(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, activeIdx, answers]);

  async function flushAutosave() {
    const q = questions[activeIdx];
    if (!q || !attemptIdRef.current || finalizedRef.current) return;
    const a = answers[q.id];
    if (!a) return;
    const key = `${a.language}:${a.code}`;
    if (lastSavedCodeRef.current[q.id] === key) return;
    try {
      await api.post(`/module-coding/attempts/${attemptIdRef.current}/autosave`, { questionId: q.id, language: a.language, code: a.code });
      lastSavedCodeRef.current[q.id] = key;
      setLastSavedAt(new Date());
    } catch {
      // best-effort — retried on the next interval tick
    }
  }

  // Flush the outgoing question's code the moment the candidate navigates away from it.
  useEffect(() => {
    return () => { if (phase === "active") flushAutosave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  const current = questions[activeIdx];
  const answer = current ? answers[current.id] : null;

  const timeLabel = useMemo(() => {
    if (secondsLeft === null) return "--:--";
    const h = Math.floor(secondsLeft / 3600);
    const m = Math.floor((secondsLeft % 3600) / 60);
    const s = secondsLeft % 60;
    const mm = String(m).padStart(2, "0");
    const ss = String(s).padStart(2, "0");
    return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
  }, [secondsLeft]);

  function setCode(code) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: { ...prev[current.id], code } }));
  }

  function setLanguage(language) {
    if (!current) return;
    setAnswers((prev) => ({ ...prev, [current.id]: { language, code: current.starterCode || defaultStarter(language) } }));
    setRunResult(null);
  }

  async function handleRun() {
    if (!current || !answer) return;
    setRunning(true);
    setRunResult(null);
    try {
      const { data } = await api.post(`/module-coding/attempts/${attemptId}/run`, { questionId: current.id, language: answer.language, code: answer.code });
      setRunResult(data);
    } catch (err) {
      setRunResult({ error: err.response?.data?.error || "Run failed" });
    } finally {
      setRunning(false);
    }
  }

  async function finalize(reason) {
    if (finalizedRef.current) return;
    if (!reason && !confirm("Submit this assessment? You won't be able to change your answers afterward.")) return;
    await flushAutosave();
    finalizedRef.current = true;
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    proctor.stopMedia();
    setFinalizing(true);
    try {
      const { data } = await api.post(`/module-coding/attempts/${attemptId}/finalize`);
      setResult(data);
      notify(data.gamification);
    } catch {
      // best-effort — still show whatever we can
    } finally {
      setFinalizing(false);
      setPhase("result");
    }
  }

  if (error && phase !== "active") {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: 48 }}>
          <p style={{ color: "var(--rust)" }}>{error}</p>
          <Link to={`/learning/${slug}`} className="btn btn-ghost" style={{ marginTop: 12, display: "inline-block" }}>← Back to course</Link>
        </div>
      </div>
    );
  }

  if (phase === "loading" || !status) {
    return <div><Navbar /><div style={{ maxWidth: 700, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;
  }

  if (!status.exists) {
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: 700, margin: "0 auto", padding: 48 }}>
          <p>No coding assessment is configured for this module.</p>
          <Link to={`/learning/${slug}`} className="btn btn-ghost" style={{ marginTop: 12, display: "inline-block" }}>← Back to course</Link>
        </div>
      </div>
    );
  }

  if (phase === "result" || autoSubmitted) {
    const passed = autoSubmitted ? false : !!result?.passed;
    return (
      <div>
        <Navbar />
        <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
          <div className="card" style={{ padding: 32, textAlign: "center" }}>
            {autoSubmitted ? (
              <>
                <div style={{ fontSize: 32 }}>⚠️</div>
                <h2 style={{ marginTop: 12, color: "var(--rust)" }}>Auto-submitted</h2>
                <p style={{ marginTop: 10, color: "var(--ink-dim)" }}>
                  Your assessment was automatically submitted after repeated proctoring violations, most recently{" "}
                  {autoSubmitReasonMsg}.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: 32 }}>{passed ? "✅" : "❌"}</div>
                <h2 style={{ marginTop: 12, color: passed ? "var(--mint)" : "var(--rust)" }}>
                  {passed ? "Assessment Passed" : "Assessment Failed"}
                </h2>
                <div className="mono" style={{ fontSize: 28, fontWeight: 700, marginTop: 10 }}>{result?.score ?? 0}%</div>
                <p style={{ marginTop: 10, color: "var(--ink-dim)" }}>
                  {passed
                    ? "The next module is now unlocked."
                    : `You need ${status.test.passingPercent}% to pass. You can retry once your attempts/cooldown allow.`}
                </p>
              </>
            )}
            <Link to={`/learning/${slug}`} className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>
              ← Back to course
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (finalizing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <div className="card" style={{ padding: 32, maxWidth: 440, textAlign: "center" }}>
          <p className="mono">⏳ Grading your assessment — this can take a few seconds. Please don't close this tab.</p>
        </div>
      </div>
    );
  }

  if (phase === "preflight" || phase === "starting") {
    const t = status.test;
    return (
      <div>
        <Navbar />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div className="card" style={{ padding: 32, maxWidth: 560, marginTop: 24 }}>
            <h2>{t.title}</h2>
            <ChalkUnderline />
            {t.instructions && <p style={{ color: "var(--ink-dim)", marginTop: 10 }}>{t.instructions}</p>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20, fontSize: 13 }}>
              <InfoRow label="Questions" value={t.questionCount} />
              <InfoRow label="Time limit" value={`${t.timeLimitMin} min`} />
              <InfoRow label="Passing score" value={`${t.passingPercent}%`} />
              <InfoRow label="Max violations" value={t.maxViolations} />
              <InfoRow label="Attempts" value={t.maxAttempts == null ? "Unlimited" : `${status.attemptsUsed}/${t.maxAttempts} used`} />
              {status.bestScore != null && <InfoRow label="Best score so far" value={`${status.bestScore}%`} />}
            </div>

            <p style={{ fontSize: 13, marginTop: 16, color: "var(--ink-dim)" }}>
              This assessment runs in fullscreen. Switching tabs, exiting fullscreen, copy/paste, right-click, and
              devtools shortcuts are blocked or logged{t.requireWebcam ? ", and your face must stay visible in the camera" : ""}.
              Exceeding {t.maxViolations} violations auto-submits your assessment.
            </p>

            {!status.lessonsComplete ? (
              <Banner color="var(--amber-dark)">Complete this module's lessons and practice test first.</Banner>
            ) : status.alreadyPassed ? (
              <Banner color="var(--mint)">✓ You've already passed this assessment (best score {status.bestScore}%).</Banner>
            ) : !status.activeAttemptId && status.attemptsRemaining === 0 ? (
              <Banner color="var(--rust)">You've used all allowed attempts. Contact your instructor for an additional attempt.</Banner>
            ) : !status.activeAttemptId && status.cooldownRemainingSec > 0 ? (
              <Banner color="var(--amber-dark)">Please wait {Math.ceil(status.cooldownRemainingSec / 60)} more minute(s) before retrying.</Banner>
            ) : t.requireWebcam && !status.activeAttemptId ? (
              <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--line)", borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>Camera check</div>
                {proctor.mediaGranted ? (
                  <>
                    <video ref={proctor.videoRef} autoPlay muted playsInline style={{ width: 160, height: 120, borderRadius: 8, marginTop: 10, background: "#000", objectFit: "cover" }} />
                    <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>✓ Camera ready</p>
                  </>
                ) : (
                  <>
                    <button className="btn btn-dark" style={{ marginTop: 10 }} onClick={proctor.requestMedia} disabled={proctor.requestingMedia}>
                      {proctor.requestingMedia ? "Requesting access…" : "Grant camera access"}
                    </button>
                    {proctor.mediaError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 8 }}>{proctor.mediaError}</p>}
                  </>
                )}
              </div>
            ) : null}

            <button
              className="btn btn-primary"
              style={{ marginTop: 20, width: "100%", padding: "12px 24px", opacity: status.canStart && (!t.requireWebcam || proctor.mediaGranted || status.activeAttemptId) ? 1 : 0.4 }}
              onClick={beginOrResume}
              disabled={phase === "starting" || !status.canStart || (t.requireWebcam && !status.activeAttemptId && !proctor.mediaGranted)}
            >
              {phase === "starting" ? "Starting…" : status.activeAttemptId ? "Resume Assessment (Fullscreen)" : "Begin Assessment (Fullscreen)"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // phase === "active"
  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ background: "var(--slate-900)", color: "var(--chalk)", padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong>{status.test.title}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span className="mono" style={{ fontSize: 12, color: violationCount > 0 ? "var(--rust)" : "var(--ink-dim)" }}>
            ⚠ Violations: {violationCount}/{status.test.maxViolations}
          </span>
          <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{lastSavedAt ? `● Saved ${lastSavedAt.toLocaleTimeString()}` : "● Auto-save every 10s"}</span>
          <div className="mono" style={{ fontSize: 20, color: secondsLeft < 120 ? "var(--rust)" : "var(--amber)" }}>{timeLabel}</div>
        </div>
        <button className="btn btn-primary" onClick={() => finalize(null)}>Submit Assessment</button>
      </div>

      {status.test.requireWebcam && (
        <video ref={proctor.videoRef} autoPlay muted playsInline style={{
          position: "fixed", bottom: 16, right: 16, width: 140, height: 105, borderRadius: 8,
          objectFit: "cover", background: "#000", zIndex: 50,
          border: proctor.faceStatus !== "OK" ? "3px solid var(--rust)" : "2px solid var(--amber)",
        }} />
      )}

      {proctor.faceStatus === "MISSING" && (
        <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
          ⚠ No face detected — please stay visible in the camera frame.
        </div>
      )}
      {proctor.faceStatus === "MULTIPLE" && (
        <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
          ⚠ Multiple faces detected — only you may be in frame during this assessment.
        </div>
      )}
      {violationWarning && (
        <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", fontSize: 13, fontWeight: 700, textAlign: "center" }}>
          ⚠ {violationWarning}
        </div>
      )}

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <div style={{ width: 200, borderRight: "1px solid var(--line)", padding: 16, overflowY: "auto" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)", marginBottom: 10 }}>QUESTIONS</div>
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setActiveIdx(idx)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 12px", marginBottom: 6, borderRadius: 8,
                border: idx === activeIdx ? "1px solid var(--amber)" : "1px solid var(--line)",
                background: idx === activeIdx ? "#FCEFD9" : "#fff", fontSize: 13,
              }}
            >
              Q{idx + 1}. {q.title || "(untitled)"}
            </button>
          ))}
        </div>

        <div style={{ width: 380, padding: 24, overflowY: "auto", flexShrink: 0, borderRight: "1px solid var(--line)" }}>
          {current && (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <h2 style={{ fontSize: 18 }}>{current.title || "(untitled)"}</h2>
                <span className={`badge badge-${(current.difficulty || "easy").toLowerCase()}`}>{current.difficulty}</span>
              </div>
              <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, marginTop: 14 }}>{current.description}</p>
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>SAMPLE TEST CASES</div>
                {(current.testCases || []).map((tc, i) => (
                  <div key={i} className="card" style={{ padding: 10, marginTop: 8, fontSize: 12 }}>
                    <div className="mono"><strong>Input:</strong> {tc.input}</div>
                    <div className="mono"><strong>Expected:</strong> {tc.expected}</div>
                  </div>
                ))}
                {(!current.testCases || current.testCases.length === 0) && (
                  <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6 }}>All test cases are hidden for this question.</p>
                )}
              </div>
            </>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <select value={answer?.language || allowedLanguages[0]} onChange={(e) => setLanguage(e.target.value)} className="mono" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
              {ALL_LANGUAGES.filter((l) => allowedLanguages.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={handleRun} disabled={running}>{running ? "Running…" : "▶ Run sample"}</button>
          </div>
          <p className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", padding: "6px 16px 0" }}>
            Your code is auto-saved every 10 seconds. "Run sample" checks against sample cases only — your saved code
            is graded against all (including hidden) test cases when you submit.
          </p>
          <div style={{ flex: 1, minHeight: 0 }}>
            <Editor
              height="100%"
              language={ALL_LANGUAGES.find((l) => l.id === answer?.language)?.monaco}
              value={answer?.code || ""}
              onChange={(v) => setCode(v || "")}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
            />
          </div>
          <div style={{ height: 160, overflowY: "auto", padding: 16, background: "#FBF9F4", flexShrink: 0 }}>
            {running && <p className="mono" style={{ fontSize: 12, color: "var(--amber-dark)", fontWeight: 600 }}>⏳ Compiling and running…</p>}
            {!running && runResult && <ResultBlock result={runResult} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{label}</div>
      <div className="mono" style={{ fontWeight: 700 }}>{value}</div>
    </div>
  );
}

function Banner({ color, children }) {
  return (
    <div style={{ marginTop: 16, padding: 14, borderRadius: 8, border: `1px solid ${color}`, color, fontSize: 13, fontWeight: 600 }}>
      {children}
    </div>
  );
}

function ResultBlock({ result }) {
  if (result.error) return <p style={{ color: "var(--rust)" }} className="mono">{result.error}</p>;
  if (result.errorSummary) {
    return (
      <div>
        <div className="mono" style={{ fontWeight: 700, color: "var(--rust)" }}>
          {result.errorSummary.type}{result.errorSummary.line ? ` (line ${result.errorSummary.line})` : ""}
        </div>
        {result.errorSummary.message && <div className="mono" style={{ fontSize: 12, marginTop: 6, whiteSpace: "pre-wrap" }}>{result.errorSummary.message}</div>}
      </div>
    );
  }
  const color = result.verdict === "ACCEPTED" ? "var(--mint)" : result.verdict === "PARTIAL" ? "var(--amber-dark)" : "var(--rust)";
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, color }}>
        {result.verdict} — {result.passedCases}/{result.totalCases} sample cases passed
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
  switch (language) {
    case "python": return "# Read input via input(), print your answer\n";
    case "c": return '#include <stdio.h>\n\nint main() {\n    return 0;\n}\n';
    case "cpp": return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n';
    case "java": return 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n    }\n}\n';
    default: return "// Read input via require('fs').readFileSync(0, 'utf8'), console.log your answer\n";
  }
}

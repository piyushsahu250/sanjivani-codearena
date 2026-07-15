import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";
import { useGamification } from "../context/GamificationContext";
import { useProctoring } from "../hooks/useProctoring";
import useIsMobile from "../hooks/useIsMobile";
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
  MIC_DROPPED: "your microphone being turned off or disconnected",
  BROWSER_SHORTCUT: "using a restricted keyboard shortcut",
};

export default function ModuleCodingAssessment() {
  const { slug, moduleId } = useParams();
  const { notify } = useGamification();
  const isMobile = useIsMobile();

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
  const [editorHeight, setEditorHeight] = useState(() => Number(localStorage.getItem("moduleCodingEditorHeight")) || 420);
  const resizingRef = useRef(false);

  const deadlineRef = useRef(null);
  const attemptIdRef = useRef(null);
  const finalizedRef = useRef(false);
  const lastSavedCodeRef = useRef({});
  const timerRef = useRef(null);
  // Mirrors of state, kept current via effects below — flushAutosave reads through these refs
  // (not the state variables directly) specifically so it never sees stale data no matter when
  // its enclosing closure was created. This is what fixes a real scoring bug: the previous
  // version's autosave only ever flushed the single currently-active question, and its
  // "flush when switching away" effect closed over `answers` from whenever `activeIdx` last
  // changed — not the latest keystrokes — so a question's actual final code could silently never
  // reach the server (or reach it as stale starter code) while another question's did, producing
  // exactly the "solved everything but scored 33%" pattern (100% on the one question that did
  // save, 0% on two that didn't/couldn't).
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { questionsRef.current = questions; }, [questions]);

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
    requireMicrophone: !!status?.test?.requireMicrophone,
    onViolation,
  });
  const micBlocked = !!status?.test?.requireMicrophone && proctor.micStatus === "UNAVAILABLE";

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

      // On resume (page refresh, dropped connection, etc.), the server returns whatever was last
      // autosaved per question — restore that instead of wiping back to starter code, otherwise
      // real, already-saved progress would appear to vanish from the editor.
      const initialAnswers = {};
      data.questions.forEach((q) => {
        const saved = data.savedAnswers?.[q.id];
        const lang = saved?.language || (Array.isArray(data.allowedLanguages) && data.allowedLanguages[0]) || "java";
        const code = saved?.code ?? (q.starterCode || defaultStarter(lang));
        initialAnswers[q.id] = { language: lang, code };
        if (saved) lastSavedCodeRef.current[q.id] = `${lang}:${code}`;
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

  // Auto-save every 10 seconds (spec-required interval) — flushes EVERY question's latest code,
  // not just the active one, reading through refs so this timer never needs `answers` in its
  // deps (which would otherwise reset the interval on every keystroke and could go long stretches
  // without ever actually firing while a student types continuously).
  useEffect(() => {
    if (phase !== "active") return;
    const interval = setInterval(() => flushAutosave(), AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [phase]);

  // questionId omitted = flush every question currently held in state; specify one to flush just
  // that question (used for the "leaving this question" nicety below). Always reads the latest
  // values via refs, so it's correct regardless of when the calling closure was created.
  async function flushAutosave(questionId) {
    if (!attemptIdRef.current || finalizedRef.current) return;
    const ids = questionId ? [questionId] : questionsRef.current.map((q) => q.id);
    await Promise.all(ids.map(async (qid) => {
      const a = answersRef.current[qid];
      if (!a) return;
      const key = `${a.language}:${a.code}`;
      if (lastSavedCodeRef.current[qid] === key) return;
      try {
        await api.post(`/module-coding/attempts/${attemptIdRef.current}/autosave`, { questionId: qid, language: a.language, code: a.code });
        lastSavedCodeRef.current[qid] = key;
        setLastSavedAt(new Date());
      } catch {
        // best-effort — retried on the next interval tick, and unconditionally again at finalize()
      }
    }));
  }

  // Flush the outgoing question's code the moment the candidate navigates away from it — a
  // latency nicety, not the safety net (finalize() below flushes everything unconditionally).
  useEffect(() => {
    const outgoingId = questions[activeIdx]?.id;
    return () => { if (outgoingId) flushAutosave(outgoingId); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdx]);

  // Best-effort save fired from beforeunload/pagehide — a normal axios POST can be aborted
  // mid-flight when the page is actually torn down, so this uses fetch's `keepalive` flag
  // (unlike navigator.sendBeacon, it still supports the Authorization header this API requires).
  function keepaliveSave(path, body) {
    try {
      const token = localStorage.getItem("token");
      const base = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
      fetch(`${base}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // best-effort only
    }
  }

  // Spec: "never lose work" on page refresh/close or a temporary network drop. The 10s interval
  // + question-switch flush above already cover typing/switching questions; these two effects
  // cover closing/refreshing the tab, and retrying a save that failed while offline the moment
  // connectivity returns.
  useEffect(() => {
    function flushOnUnload() {
      if (finalizedRef.current || !attemptIdRef.current) return;
      for (const q of questionsRef.current) {
        const a = answersRef.current[q.id];
        if (!a) continue;
        const key = `${a.language}:${a.code}`;
        if (lastSavedCodeRef.current[q.id] === key) continue;
        keepaliveSave(`/module-coding/attempts/${attemptIdRef.current}/autosave`, { questionId: q.id, language: a.language, code: a.code });
      }
    }
    window.addEventListener("beforeunload", flushOnUnload);
    window.addEventListener("pagehide", flushOnUnload);
    return () => {
      window.removeEventListener("beforeunload", flushOnUnload);
      window.removeEventListener("pagehide", flushOnUnload);
    };
  }, []);

  useEffect(() => {
    function onOnline() {
      if (phase === "active") flushAutosave();
    }
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [phase]);

  // Resizable editor — drag the handle between editor and results panel. Height persists across
  // questions (it's a single piece of state, never reset by activeIdx) and across sessions via
  // localStorage. Min/max clamp keeps the editor from being dragged unusably small or off-screen.
  function startResize(e) {
    resizingRef.current = true;
    document.body.style.cursor = "row-resize";
    e.preventDefault();
  }
  useEffect(() => {
    function onMove(e) {
      if (!resizingRef.current) return;
      setEditorHeight((h) => Math.min(800, Math.max(200, h + e.movementY)));
    }
    function onUp() {
      if (!resizingRef.current) return;
      resizingRef.current = false;
      document.body.style.cursor = "";
      setEditorHeight((h) => { localStorage.setItem("moduleCodingEditorHeight", String(h)); return h; });
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

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
        <div style={{ maxWidth: 640, margin: "80px auto", padding: 24 }}>
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
                {result?.submittedAt && (
                  <p style={{ marginTop: 4, fontSize: 12, color: "var(--ink-dim)" }}>Submitted {new Date(result.submittedAt).toLocaleString()}</p>
                )}
                {Array.isArray(result?.questionBreakdown) && result.questionBreakdown.length > 0 && (
                  <div style={{ marginTop: 24, textAlign: "left" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Per-Question Result</div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {result.questionBreakdown.map((q, i) => (
                        <div key={q.questionId} className="card" style={{ padding: 12, fontSize: 13 }}>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span className="mono">{q.title || `Question ${i + 1}`}</span>
                            <span className="mono" style={{ fontWeight: 700 }}>{q.score}%</span>
                          </div>
                          <div style={{ marginTop: 6, fontSize: 12, color: "var(--ink-dim)" }} className="mono">
                            {q.verdict} — {q.passedCases}/{q.totalCases} hidden test case{q.totalCases === 1 ? "" : "s"} passed
                            {q.timeMs != null && ` · ⏱ ${q.timeMs} ms`}
                            {q.memoryKb != null && ` · 💾 ${(q.memoryKb / 1024).toFixed(1)} MB`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
            <span className="badge" style={{ background: "var(--amber)" }}>📝 Official Test — graded{t.maxAttempts != null ? `, ${t.maxAttempts} attempt${t.maxAttempts === 1 ? "" : "s"} allowed` : ""}</span>
            <h2 style={{ marginTop: 10 }}>{t.title}</h2>
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
              devtools shortcuts are blocked or logged{t.requireWebcam ? ", your face must stay visible in the camera" : ""}
              {t.requireMicrophone ? ", and your microphone must stay enabled" : ""}.
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
            ) : (t.requireWebcam || t.requireMicrophone) && !status.activeAttemptId ? (
              <div style={{ marginTop: 16, padding: 16, border: "1px solid var(--line)", borderRadius: 10 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {t.requireWebcam && t.requireMicrophone ? "Camera & microphone check" : t.requireMicrophone ? "Microphone check" : "Camera check"}
                </div>
                {proctor.mediaGranted ? (
                  <>
                    {t.requireWebcam && <video ref={proctor.videoRef} autoPlay muted playsInline style={{ width: 160, height: 120, borderRadius: 8, marginTop: 10, background: "#000", objectFit: "cover" }} />}
                    <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>✓ Ready</p>
                  </>
                ) : (
                  <>
                    <button className="btn btn-dark" style={{ marginTop: 10 }} onClick={proctor.requestMedia} disabled={proctor.requestingMedia}>
                      {proctor.requestingMedia ? "Requesting access…" : t.requireWebcam && t.requireMicrophone ? "Grant camera & microphone access" : t.requireMicrophone ? "Grant microphone access" : "Grant camera access"}
                    </button>
                    {proctor.mediaError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 8 }}>{proctor.mediaError}</p>}
                  </>
                )}
              </div>
            ) : null}

            <button
              className="btn btn-primary"
              style={{ marginTop: 20, width: "100%", padding: "12px 24px", opacity: status.canStart && (!(t.requireWebcam || t.requireMicrophone) || proctor.mediaGranted || status.activeAttemptId) ? 1 : 0.4 }}
              onClick={beginOrResume}
              disabled={phase === "starting" || !status.canStart || ((t.requireWebcam || t.requireMicrophone) && !status.activeAttemptId && !proctor.mediaGranted)}
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
      <div style={{ background: "var(--slate-900)", color: "var(--chalk)", padding: isMobile ? "10px 12px" : "12px 24px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <strong style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: isMobile ? "1 1 100%" : "0 1 auto" }}>{status.test.title}</strong>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <span className="mono" style={{ fontSize: 12, color: violationCount > 0 ? "var(--rust)" : "var(--ink-dim)" }}>
            ⚠ Violations: {violationCount}/{status.test.maxViolations}
          </span>
          {!isMobile && (
            <span className="mono" style={{ fontSize: 11, opacity: 0.7 }}>{lastSavedAt ? `● Saved ${lastSavedAt.toLocaleTimeString()}` : "● Auto-save every 10s"}</span>
          )}
          <div className="mono" style={{ fontSize: isMobile ? 16 : 20, color: secondsLeft < 120 ? "var(--rust)" : "var(--amber)" }}>{timeLabel}</div>
        </div>
        <button className="btn btn-primary" onClick={() => finalize(null)}>Submit Assessment</button>
      </div>

      {micBlocked && (
        <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "12px 24px", fontSize: 13, fontWeight: 700, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
          <span>🎙 Microphone is disabled. Please enable your microphone to continue.</span>
          <button className="btn btn-ghost" style={{ borderColor: "#fff", color: "#fff" }} onClick={proctor.requestMedia} disabled={proctor.requestingMedia}>
            {proctor.requestingMedia ? "Reconnecting…" : "Re-enable Microphone"}
          </button>
        </div>
      )}

      {status.test.requireWebcam && (
        <video ref={proctor.videoRef} autoPlay muted playsInline style={{
          position: "fixed", bottom: 16, right: 16, width: isMobile ? 84 : 140, height: isMobile ? 63 : 105, borderRadius: 8,
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

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", flex: 1, overflow: isMobile ? "auto" : "hidden" }}>
        <div
          style={
            isMobile
              ? { width: "100%", borderBottom: "1px solid var(--line)", padding: "10px 12px", display: "flex", gap: 8, overflowX: "auto", flexShrink: 0 }
              : { width: 200, borderRight: "1px solid var(--line)", padding: 16, overflowY: "auto" }
          }
        >
          {!isMobile && <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)", marginBottom: 10 }}>QUESTIONS</div>}
          {questions.map((q, idx) => (
            <button
              key={q.id}
              onClick={() => setActiveIdx(idx)}
              style={{
                display: isMobile ? "inline-block" : "block",
                width: isMobile ? "auto" : "100%",
                minWidth: isMobile ? 150 : undefined,
                flexShrink: isMobile ? 0 : undefined,
                textAlign: "left", padding: "10px 12px", marginBottom: isMobile ? 0 : 6, borderRadius: 8,
                border: idx === activeIdx ? "1px solid var(--amber)" : "1px solid var(--line)",
                background: idx === activeIdx ? "#FCEFD9" : "var(--card-bg)", fontSize: 13,
                color: idx === activeIdx ? "var(--amber-dark)" : "var(--ink)",
              }}
            >
              Q{idx + 1}. {q.title || "(untitled)"}
            </button>
          ))}
        </div>

        <div style={{ width: isMobile ? "100%" : 380, padding: isMobile ? 16 : 24, overflowY: "auto", flexShrink: 0, borderRight: isMobile ? "none" : "1px solid var(--line)", borderBottom: isMobile ? "1px solid var(--line)" : "none" }}>
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
          <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <select value={answer?.language || allowedLanguages[0]} onChange={(e) => setLanguage(e.target.value)} className="mono" style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--line)" }}>
              {ALL_LANGUAGES.filter((l) => allowedLanguages.includes(l.id)).map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={handleRun} disabled={running || micBlocked}>{running ? "Running…" : "▶ Run sample"}</button>
          </div>
          <p className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", padding: "6px 16px 0" }}>
            Your code is auto-saved every 10 seconds. "Run sample" checks against sample cases only — your saved code
            is graded against all (including hidden) test cases when you submit.
          </p>
          <div style={{ height: isMobile ? Math.min(editorHeight, 320) : editorHeight, minHeight: 0, flexShrink: 0 }}>
            <Editor
              height="100%"
              language={ALL_LANGUAGES.find((l) => l.id === answer?.language)?.monaco}
              value={answer?.code || ""}
              onChange={(v) => setCode(v || "")}
              theme="vs-dark"
              options={{ fontSize: 14, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
            />
          </div>
          <div
            onMouseDown={isMobile ? undefined : startResize}
            title="Drag to resize editor"
            style={{ height: 9, cursor: "row-resize", background: "var(--line)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div style={{ width: 40, height: 3, borderRadius: 2, background: "var(--ink-dim)" }} />
          </div>
          <div style={{ flex: 1, minHeight: 80, overflowY: "auto", padding: 16, background: "#FBF9F4" }}>
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
        {result.errorSummary.hint && (
          <div style={{ fontSize: 12, marginTop: 6, color: "var(--ink-dim)" }}>💡 Suggested fix: {result.errorSummary.hint}</div>
        )}
      </div>
    );
  }
  const color = result.verdict === "ACCEPTED" ? "var(--mint)" : result.verdict === "PARTIAL" ? "var(--amber-dark)" : "var(--rust)";
  return (
    <div>
      <div className="mono" style={{ fontWeight: 700, color }}>
        {result.verdict} — {result.passedCases}/{result.totalCases} sample cases passed
      </div>
      <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 4 }}>
        {result.maxTimeMs != null && `⏱ ${result.maxTimeMs} ms`}
        {result.maxMemoryKb != null && ` · 💾 ${(result.maxMemoryKb / 1024).toFixed(1)} MB`}
      </div>
      {result.details?.map((d, i) => (
        <div key={i} style={{ fontSize: 12, marginTop: 6 }} className="mono">
          <span style={{ color: d.verdict === "PASSED" ? "var(--mint)" : "var(--rust)" }}>[{d.verdict}]</span>{" "}
          input: {d.input}
          {d.verdict === "PASSED" ? (
            <> | output: {d.actual}</>
          ) : d.verdict === "WRONG_ANSWER" ? (
            <> | expected: {d.expected} | your output: {d.actual}</>
          ) : (
            <> | {d.error || "no output"}</>
          )}
          {d.timeMs != null && <span style={{ color: "var(--ink-dim)" }}> ({d.timeMs} ms)</span>}
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

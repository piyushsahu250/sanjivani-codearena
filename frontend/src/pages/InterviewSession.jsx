import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";
import { useProctoring } from "../hooks/useProctoring";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import "./interviewPrep.css";

const LANGUAGES = [
  { id: "java", label: "Java", monaco: "java" }, { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" }, { id: "c", label: "C", monaco: "c" }, { id: "cpp", label: "C++", monaco: "cpp" },
];
const CATEGORY_LABEL = { HR: "HR", TECHNICAL: "Technical", CODING: "Coding", APTITUDE: "Aptitude", SYSTEM_DESIGN: "System Design", BEHAVIORAL: "Behavioral", MANAGERIAL: "Managerial" };
const FREE_TEXT_CATEGORIES = ["HR", "TECHNICAL", "SYSTEM_DESIGN", "BEHAVIORAL", "MANAGERIAL"];
const VIOLATION_LABEL = {
  TAB_SWITCH: "switching tabs",
  FULLSCREEN_EXIT: "exiting fullscreen",
  CAMERA_DROPPED: "your camera being turned off or disconnected",
  MIC_DROPPED: "your microphone being turned off or disconnected",
  BROWSER_SHORTCUT: "using a restricted keyboard shortcut",
};

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [phase, setPhase] = useState("preflight"); // preflight | active | terminated
  const [activeIdx, setActiveIdx] = useState(0);
  const [drafts, setDrafts] = useState({}); // questionId -> {answerText, code, language, selected}
  const [saving, setSaving] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [recording, setRecording] = useState(false);
  const [violationCount, setViolationCount] = useState(0);
  const [maxViolations, setMaxViolations] = useState(3);
  const [violationWarning, setViolationWarning] = useState(null);
  const recognitionRef = useRef(null);
  const finalizedRef = useRef(false);
  const dark = localStorage.getItem("interviewPrepDark") === "1";

  useEffect(() => {
    api.get(`/interview/sessions/${id}`).then((res) => {
      setData(res.data);
      setViolationCount(res.data.session.violationCount || 0);
      const initial = {};
      for (const q of res.data.questions) {
        initial[q.id] = {
          answerText: q.category !== "APTITUDE" ? (q.answer?.answerText || "") : "",
          code: q.answer?.code || q.starterCode || "",
          language: q.answer?.language || q.language || "java",
          selected: q.category === "APTITUDE" && q.answer?.answerText != null && q.answer.answerText !== "" ? Number(q.answer.answerText) : null,
        };
      }
      setDrafts(initial);
      const durationMin = res.data.session.config?.durationMin;
      if (durationMin && res.data.session.status === "IN_PROGRESS") {
        const elapsedSec = Math.floor((Date.now() - new Date(res.data.session.startedAt).getTime()) / 1000);
        setSecondsLeft(Math.max(0, durationMin * 60 - elapsedSec));
      }
    }).catch((err) => setError(err.response?.data?.error || "Failed to load session"));
  }, [id]);

  useEffect(() => {
    if (phase !== "active" || secondsLeft === null) return;
    if (secondsLeft <= 0) { finalize(); return; }
    const t = setInterval(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, secondsLeft === 0]);

  // Every violation type is reported to the server, which decides — never trusted client-side —
  // whether it's penalized (tab switch, fullscreen exit, camera/mic dropped: counts toward the
  // 3-strike auto-terminate) or logged only (face missing briefly, multiple faces detected: per
  // spec, "future ready, log don't penalize"). Noise/silent-environment reminders never reach
  // here at all — they're pure client-side UI state from useProctoring's `noiseWarning`.
  async function onViolation(type) {
    if (finalizedRef.current) return;
    try {
      const { data: res } = await api.post(`/interview/sessions/${id}/violation`, { type });
      if (res.penalized) setViolationCount(res.violationCount);
      setMaxViolations(res.maxViolations);
      if (res.terminated) {
        finalizedRef.current = true;
        setPhase("terminated");
        proctor.stopMedia();
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      } else if (res.penalized) {
        const msg = `Warning ${res.violationCount}/${res.maxViolations}: ${VIOLATION_LABEL[type] || type}. The interview will be terminated if this continues.`;
        setViolationWarning(msg);
        setTimeout(() => setViolationWarning((m) => (m === msg ? null : m)), 6000);
      }
    } catch {
      // best-effort
    }
  }

  const proctor = useProctoring({
    active: phase === "active",
    requireFullscreen: true,
    requireWebcam: true,
    requireMicrophone: true,
    onViolation,
  });

  async function begin() {
    try { await document.documentElement.requestFullscreen?.(); } catch { /* best-effort */ }
    setPhase("active");
  }

  if (error) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p><Link to="/interview" className="btn btn-ghost">← AI Mock Interview</Link></div></div>;
  if (!data) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;

  const { session, questions } = data;

  if (phase === "terminated") {
    return (
      <div className={`interview-prep ${dark ? "dark" : ""}`}>
        <Navbar />
        <div style={{ maxWidth: 560, margin: "80px auto", padding: 24 }}>
          <div className="ip-glass" style={{ padding: 32, textAlign: "center" }}>
            <div style={{ fontSize: 32 }}>⚠️</div>
            <h2 style={{ marginTop: 12, color: "var(--rust)" }}>Proctoring Rules Violated</h2>
            <p style={{ marginTop: 10, opacity: 0.8 }}>
              This interview was automatically terminated after {maxViolations} proctoring violations. A report
              was generated from whatever was answered before termination.
            </p>
            <Link to={`/interview/report/${id}`} className="btn btn-primary" style={{ marginTop: 20, display: "inline-block" }}>View Report</Link>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "preflight") {
    return (
      <div className={`interview-prep ${dark ? "dark" : ""}`}>
        <Navbar />
        <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
          <div className="ip-glass" style={{ padding: 32, maxWidth: 560, marginTop: 24 }}>
            <h2>{session.isMock ? "Mock Interview" : session.isCompanyRound ? `${session.config?.company || ""} Company Round` : session.isResumeBased ? "Resume-based Interview" : `${CATEGORY_LABEL[session.category]} Interview`}</h2>
            <ChalkUnderline />
            <p style={{ fontSize: 13, marginTop: 14, opacity: 0.85 }}>
              This interview is fully proctored and runs in fullscreen with your camera and microphone on for the
              whole duration. Switching tabs, exiting fullscreen, or turning off your camera/microphone is tracked
              and logged; after {maxViolations} such violations the interview is automatically terminated. Your face
              should stay visible in frame — briefly stepping away or multiple people appearing in frame is logged
              for review but won't end your interview. Background noise triggers a friendly reminder only, never a
              violation.
            </p>

            <div style={{ marginTop: 20, padding: 16, border: "1px solid var(--ip-glass-border)", borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Camera &amp; microphone check</div>
              {proctor.mediaGranted ? (
                <>
                  <video ref={proctor.videoRef} autoPlay muted playsInline style={{ width: 160, height: 120, borderRadius: 8, marginTop: 10, background: "#000", objectFit: "cover" }} />
                  <p style={{ fontSize: 12, color: "var(--mint)", marginTop: 8, fontWeight: 600 }}>✓ Camera and microphone are ready</p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 12, opacity: 0.75, marginTop: 6 }}>Both are required before you can begin — they stay on for the whole interview.</p>
                  <button className="btn btn-dark" style={{ marginTop: 10 }} onClick={proctor.requestMedia} disabled={proctor.requestingMedia}>
                    {proctor.requestingMedia ? "Requesting access…" : "Grant camera & microphone access"}
                  </button>
                  {proctor.mediaError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 8 }}>{proctor.mediaError}</p>}
                </>
              )}
            </div>

            <button className="btn btn-primary" style={{ marginTop: 20, width: "100%", padding: "12px 24px", opacity: proctor.mediaGranted ? 1 : 0.4 }} onClick={begin} disabled={!proctor.mediaGranted}>
              Begin Interview (Fullscreen)
            </button>
          </div>
        </div>
      </div>
    );
  }

  const q = questions[activeIdx];
  const draft = drafts[q.id] || {};
  const micBlocked = proctor.micStatus === "UNAVAILABLE";

  function updateDraft(patch) {
    setDrafts((d) => ({ ...d, [q.id]: { ...d[q.id], ...patch } }));
  }

  async function saveAnswer(skipped = false) {
    setSaving(true);
    try {
      const body = { questionId: q.id, skipped };
      if (q.category === "APTITUDE") body.answerText = draft.selected != null ? String(draft.selected) : null;
      else if (q.category === "CODING") { body.code = draft.code; body.language = draft.language; }
      else body.answerText = draft.answerText;
      const { data: res } = await api.post(`/interview/sessions/${id}/answer`, body);
      if (res.immediateResult) setRunResult(res.immediateResult);
      if (res.followUpQuestion) {
        setData((d) => (d.questions.some((qq) => qq.id === res.followUpQuestion.id) ? d : { ...d, questions: [...d.questions, res.followUpQuestion] }));
        setDrafts((dr) => ({
          ...dr,
          [res.followUpQuestion.id]: { answerText: "", code: res.followUpQuestion.starterCode || "", language: res.followUpQuestion.language || "java", selected: null },
        }));
      }
      return res;
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save answer");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function runCode() {
    setRunning(true);
    setRunResult(null);
    await saveAnswer(false);
    setRunning(false);
  }

  async function go(delta) {
    await saveAnswer(false);
    setRunResult(null);
    setActiveIdx((i) => Math.max(0, Math.min(questions.length - 1, i + delta)));
  }

  async function skip() {
    await saveAnswer(true);
    setRunResult(null);
    if (activeIdx < questions.length - 1) setActiveIdx((i) => i + 1);
  }

  async function finalize() {
    if (finalizedRef.current) return;
    finalizedRef.current = true;
    setSaving(true);
    try {
      await saveAnswer(false);
      const { data: res } = await api.post(`/interview/sessions/${id}/finalize`);
      proctor.stopMedia();
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
      navigate(`/interview/report/${id}`, { state: { report: res.report, recommendedLearning: res.recommendedLearning } });
    } catch (err) {
      finalizedRef.current = false;
      alert(err.response?.data?.error || "Failed to submit interview");
    } finally {
      setSaving(false);
    }
  }

  function toggleRecording() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition isn't supported in this browser (try Chrome). You can type your answer instead.");
      return;
    }
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      let transcript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) transcript += e.results[i][0].transcript + " ";
      updateDraft({ answerText: ((draft.answerText || "") + " " + transcript).trim() });
    };
    rec.onend = () => setRecording(false);
    rec.start();
    recognitionRef.current = rec;
    setRecording(true);
  }

  const mm = secondsLeft != null ? String(Math.floor(secondsLeft / 60)).padStart(2, "0") : null;
  const ss = secondsLeft != null ? String(secondsLeft % 60).padStart(2, "0") : null;

  return (
    <div className={`interview-prep ${dark ? "dark" : ""}`}>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>{session.isMock ? "Mock Interview" : session.isCompanyRound ? `${session.config?.company || ""} Company Round` : session.isResumeBased ? "Resume-based Interview" : `${CATEGORY_LABEL[session.category]} Interview`}</h1>
            {session.config?.company && !session.isCompanyRound && <span className="badge" style={{ marginRight: 8 }}>{session.config.company}</span>}
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span className="mono" style={{ fontSize: 12, color: violationCount > 0 ? "var(--rust)" : "inherit", opacity: violationCount > 0 ? 1 : 0.6 }}>
              ⚠ {violationCount}/{maxViolations}
            </span>
            {secondsLeft != null && <span className="mono ip-glass" style={{ padding: "6px 12px", fontWeight: 700 }}>⏱ {mm}:{ss}</span>}
            <Link to="/interview" className="btn btn-ghost">Exit</Link>
          </div>
        </div>

        <video ref={proctor.videoRef} autoPlay muted playsInline style={{
          position: "fixed", bottom: 16, right: 16, width: 140, height: 105, borderRadius: 8,
          objectFit: "cover", background: "#000", zIndex: 50,
          border: proctor.faceStatus !== "OK" ? "3px solid var(--rust)" : "2px solid var(--ip-accent)",
        }} />

        {proctor.faceStatus === "MISSING" && (
          <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "10px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8 }}>
            Face not detected. Please position yourself in front of the camera.
          </div>
        )}
        {proctor.faceStatus === "MULTIPLE" && (
          <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "10px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8 }}>
            Multiple faces detected — only you should be visible during this interview.
          </div>
        )}
        {proctor.cameraStatus === "UNAVAILABLE" && (
          <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "10px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8 }}>
            Camera is unavailable — it may be off, blocked, or permission was revoked. Please reconnect it.
          </div>
        )}
        {proctor.micStatus === "UNAVAILABLE" && (
          <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "14px 20px", fontSize: 13, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <span>🎙 Microphone is disabled. Please enable your microphone to continue the interview.</span>
            <button className="btn btn-ghost" style={{ borderColor: "#fff", color: "#fff" }} onClick={proctor.requestMedia} disabled={proctor.requestingMedia}>
              {proctor.requestingMedia ? "Reconnecting…" : "Re-enable Microphone"}
            </button>
          </div>
        )}
        {proctor.noiseWarning && (
          <div className="mono" style={{ background: "var(--amber)", color: "#3a2c00", padding: "10px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8 }}>
            Please maintain a quiet interview environment.
          </div>
        )}
        {violationWarning && (
          <div className="mono" style={{ background: "var(--rust)", color: "#fff", padding: "10px 20px", fontSize: 12, fontWeight: 700, textAlign: "center", marginTop: 12, borderRadius: 8 }}>
            ⚠ {violationWarning}
          </div>
        )}

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 16 }}>
          {questions.map((qq, i) => (
            <button key={qq.id} onClick={() => setActiveIdx(i)} className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px", opacity: i === activeIdx ? 1 : 0.5, fontWeight: i === activeIdx ? 700 : 400 }}>
              {i + 1}
            </button>
          ))}
        </div>

        <div className="ip-glass" style={{ padding: 24, marginTop: 16 }}>
          <span className="badge">{CATEGORY_LABEL[q.category]}{q.subject ? ` · ${q.subject}` : ""}{q.aptitudeCategory ? ` · ${q.aptitudeCategory}` : ""}</span>
          <p style={{ marginTop: 12, fontWeight: 600, fontSize: 16 }}>{q.prompt}</p>

          {FREE_TEXT_CATEGORIES.includes(q.category) && (
            <>
              <textarea
                className="ip-select"
                style={{ width: "100%", minHeight: 140, marginTop: 14, fontFamily: "var(--font-body)", fontSize: 14 }}
                value={draft.answerText || ""}
                onChange={(e) => updateDraft({ answerText: e.target.value })}
                placeholder="Type your answer, or use the mic below to speak it…"
              />
              <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={toggleRecording}>
                {recording ? "⏹ Stop recording" : "🎙 Record answer (speech-to-text)"}
              </button>
              {recording && <span className="mono" style={{ fontSize: 11, marginLeft: 8, opacity: 0.7 }}>Listening… click Stop, then edit the transcript before moving on if needed.</span>}
            </>
          )}

          {q.category === "APTITUDE" && (
            <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
              {(q.options || []).map((opt, idx) => (
                <label key={idx} className="ip-glass" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                  <input type="radio" name={q.id} checked={draft.selected === idx} onChange={() => updateDraft({ selected: idx })} />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {q.category === "CODING" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14 }}>
                <select className="ip-select" value={draft.language} onChange={(e) => updateDraft({ language: e.target.value })}>
                  {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
                </select>
                <button className="btn btn-primary" onClick={runCode} disabled={running || micBlocked}>{running ? "Running…" : "Run"}</button>
              </div>
              <div style={{ marginTop: 10, border: "1px solid var(--ip-glass-border)", borderRadius: 8, overflow: "hidden" }}>
                <Editor
                  height="260px"
                  language={LANGUAGES.find((l) => l.id === draft.language)?.monaco}
                  value={draft.code}
                  onChange={(v) => updateDraft({ code: v || "" })}
                  theme={dark ? "vs-dark" : "light"}
                  options={{ fontSize: 13, minimap: { enabled: false }, fontFamily: "JetBrains Mono, monospace" }}
                />
              </div>
              {runResult && (
                <div className="ip-glass" style={{ marginTop: 12, padding: 12 }}>
                  <div className="mono" style={{ fontWeight: 700, color: runResult.verdict === "ACCEPTED" ? "var(--ip-accent)" : "var(--rust)" }}>
                    {runResult.verdict} — {runResult.passedCases}/{runResult.totalCases} cases passed
                  </div>
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-ghost" disabled={activeIdx === 0 || micBlocked} onClick={() => go(-1)}>← Previous</button>
              <button className="btn btn-ghost" onClick={skip} disabled={micBlocked}>Skip</button>
            </div>
            {activeIdx < questions.length - 1 ? (
              <button className="btn btn-primary" onClick={() => go(1)} disabled={saving || micBlocked}>{saving ? "Saving…" : "Next →"}</button>
            ) : (
              <button className="btn btn-primary" onClick={finalize} disabled={saving}>{saving ? "Submitting…" : "Submit Interview"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

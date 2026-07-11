import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import Editor from "@monaco-editor/react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import "./interviewPrep.css";

const LANGUAGES = [
  { id: "java", label: "Java", monaco: "java" }, { id: "javascript", label: "JavaScript", monaco: "javascript" },
  { id: "python", label: "Python", monaco: "python" }, { id: "c", label: "C", monaco: "c" }, { id: "cpp", label: "C++", monaco: "cpp" },
];
const CATEGORY_LABEL = { HR: "HR", TECHNICAL: "Technical", CODING: "Coding", APTITUDE: "Aptitude" };

export default function InterviewSession() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const [drafts, setDrafts] = useState({}); // questionId -> {answerText, code, language, selected}
  const [saving, setSaving] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [running, setRunning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);
  const dark = localStorage.getItem("interviewPrepDark") === "1";

  useEffect(() => {
    api.get(`/interview/sessions/${id}`).then((res) => {
      setData(res.data);
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
    if (secondsLeft === null) return;
    if (secondsLeft <= 0) { finalize(); return; }
    const t = setInterval(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft === 0]);

  if (error) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p><Link to="/interview" className="btn btn-ghost">← Interview Prep</Link></div></div>;
  if (!data) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;

  const { session, questions } = data;
  const q = questions[activeIdx];
  const draft = drafts[q.id] || {};

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
    setSaving(true);
    try {
      await saveAnswer(false);
      const { data: res } = await api.post(`/interview/sessions/${id}/finalize`);
      navigate(`/interview/report/${id}`, { state: { report: res.report } });
    } catch (err) {
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
            <h1>{session.isMock ? "Mock Interview" : session.isResumeBased ? "Resume-based Interview" : `${CATEGORY_LABEL[session.category]} Interview`}</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {secondsLeft != null && <span className="mono ip-glass" style={{ padding: "6px 12px", fontWeight: 700 }}>⏱ {mm}:{ss}</span>}
            <Link to="/interview" className="btn btn-ghost">Exit</Link>
          </div>
        </div>

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

          {(q.category === "HR" || q.category === "TECHNICAL") && (
            <>
              <textarea
                className="ip-select"
                style={{ width: "100%", minHeight: 140, marginTop: 14, fontFamily: "var(--font-body)", fontSize: 14 }}
                value={draft.answerText || ""}
                onChange={(e) => updateDraft({ answerText: e.target.value })}
                placeholder="Type your answer…"
              />
              {q.category === "HR" && (
                <button className="btn btn-ghost" style={{ marginTop: 8 }} onClick={toggleRecording}>
                  {recording ? "⏹ Stop recording" : "🎙 Record answer (speech-to-text)"}
                </button>
              )}
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
                <button className="btn btn-primary" onClick={runCode} disabled={running}>{running ? "Running…" : "Run"}</button>
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
              <button className="btn btn-ghost" disabled={activeIdx === 0} onClick={() => go(-1)}>← Previous</button>
              <button className="btn btn-ghost" onClick={skip}>Skip</button>
            </div>
            {activeIdx < questions.length - 1 ? (
              <button className="btn btn-primary" onClick={() => go(1)} disabled={saving}>{saving ? "Saving…" : "Next →"}</button>
            ) : (
              <button className="btn btn-primary" onClick={finalize} disabled={saving}>{saving ? "Submitting…" : "Submit Interview"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

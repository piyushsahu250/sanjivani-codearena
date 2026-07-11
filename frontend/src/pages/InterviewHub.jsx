import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import "./interviewPrep.css";

const CARDS = [
  { key: "HR", title: "HR Interview", icon: "🗣️", desc: "Practice common HR questions — type or speak your answer." },
  { key: "TECHNICAL", title: "Technical Interview", icon: "💡", desc: "Subject-based Q&A across 11 core CS subjects." },
  { key: "CODING", title: "Coding Interview", icon: "💻", desc: "Solve real coding problems, graded by the judge." },
  { key: "APTITUDE", title: "Aptitude Interview", icon: "🧮", desc: "Timed quantitative, logical, verbal & DI questions." },
  { key: "MOCK", title: "Mock Interview", icon: "🎯", desc: "A 30-minute mixed HR + Technical + Coding session." },
  { key: "RESUME_BASED", title: "Resume-based Interview", icon: "📄", desc: "Questions generated from your own resume." },
];

const SUBJECTS = ["C", "C++", "Java", "Python", "JavaScript", "SQL", "DBMS", "OS", "CN", "OOP", "DSA"];
const TOPICS = ["Arrays", "Strings", "Stack", "Queue", "Trees", "Graphs", "DP", "Linked List", "Recursion", "Sorting", "Searching", "Hashing", "Backtracking"];
const APTITUDE_CATS = [
  { id: "QUANTITATIVE", label: "Quantitative" }, { id: "LOGICAL", label: "Logical" },
  { id: "VERBAL", label: "Verbal" }, { id: "DATA_INTERPRETATION", label: "Data Interpretation" },
];
const LANGUAGES = ["java", "python", "javascript", "c", "cpp"];

export default function InterviewHub() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [dark, setDark] = useState(() => localStorage.getItem("interviewPrepDark") === "1");
  const [setupCard, setSetupCard] = useState(null);
  const [starting, setStarting] = useState(false);
  const [config, setConfig] = useState({ subject: "Java", topic: "Arrays", difficulty: "EASY", language: "java", aptitudeCategory: "QUANTITATIVE", negativeMarking: false });

  useEffect(() => {
    api.get("/interview/summary").then((res) => setSummary(res.data));
  }, []);

  useEffect(() => {
    localStorage.setItem("interviewPrepDark", dark ? "1" : "0");
  }, [dark]);

  async function start(category, extraConfig) {
    setStarting(true);
    try {
      const body = category === "MOCK"
        ? { isMock: true, config: {} }
        : category === "RESUME_BASED"
          ? { isResumeBased: true, config: {} }
          : { category, config: extraConfig || {} };
      const { data } = await api.post("/interview/sessions", body);
      navigate(`/interview/session/${data.session.id}`);
    } catch (err) {
      alert(err.response?.data?.error || "Could not start interview");
    } finally {
      setStarting(false);
    }
  }

  function handleCardClick(key) {
    if (key === "TECHNICAL" || key === "CODING" || key === "APTITUDE") {
      setSetupCard(setupCard === key ? null : key);
    } else {
      start(key);
    }
  }

  return (
    <div className={`interview-prep ${dark ? "dark" : ""}`}>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Interview Prep</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link to="/interview/history" className="btn btn-ghost">History</Link>
            <Link to="/interview/leaderboard" className="btn btn-ghost">Leaderboard</Link>
            <Link to="/interview/progress" className="btn btn-ghost">Progress</Link>
            <Link to="/interview/certificate" className="btn btn-ghost">🎓 Certificate</Link>
            <button className="btn btn-ghost" onClick={() => setDark((d) => !d)}>{dark ? "☀️ Light" : "🌙 Dark"}</button>
          </div>
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginTop: 24 }}>
            <StatTile label="Interviews Attempted" value={summary.totalAttempted} />
            <StatTile label="Average Score" value={`${summary.averageScore}%`} />
            <StatTile label="Strong Areas" value={summary.strongAreas.length ? summary.strongAreas.join(", ") : "—"} small />
            <StatTile label="Weak Areas" value={summary.weakAreas.length ? summary.weakAreas.join(", ") : "—"} small />
          </div>
        )}
        {summary?.improvementSuggestions?.length > 0 && (
          <div className="ip-glass" style={{ padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>Improvement Suggestions</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13 }}>
              {summary.improvementSuggestions.map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16, marginTop: 28 }}>
          {CARDS.map((c) => (
            <div key={c.key} className="ip-glass ip-card" onClick={() => handleCardClick(c.key)}>
              <div style={{ fontSize: 28 }}>{c.icon}</div>
              <h3 style={{ fontSize: 17, marginTop: 8 }}>{c.title}</h3>
              <p style={{ fontSize: 13, opacity: 0.8, marginTop: 4 }}>{c.desc}</p>

              {setupCard === c.key && (
                <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 12, display: "grid", gap: 8 }}>
                  {c.key === "TECHNICAL" && (
                    <>
                      <select className="ip-select" value={config.subject} onChange={(e) => setConfig({ ...config, subject: e.target.value })}>
                        {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <select className="ip-select" value={config.difficulty} onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}>
                        <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                      </select>
                    </>
                  )}
                  {c.key === "CODING" && (
                    <>
                      <select className="ip-select" value={config.topic} onChange={(e) => setConfig({ ...config, topic: e.target.value })}>
                        {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select className="ip-select" value={config.language} onChange={(e) => setConfig({ ...config, language: e.target.value })}>
                        {LANGUAGES.map((l) => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <select className="ip-select" value={config.difficulty} onChange={(e) => setConfig({ ...config, difficulty: e.target.value })}>
                        <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
                      </select>
                    </>
                  )}
                  {c.key === "APTITUDE" && (
                    <>
                      <select className="ip-select" value={config.aptitudeCategory} onChange={(e) => setConfig({ ...config, aptitudeCategory: e.target.value })}>
                        {APTITUDE_CATS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                      <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
                        <input type="checkbox" checked={config.negativeMarking} onChange={(e) => setConfig({ ...config, negativeMarking: e.target.checked })} />
                        Enable negative marking
                      </label>
                    </>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={starting}
                    onClick={() =>
                      start(c.key, c.key === "TECHNICAL"
                        ? { subject: config.subject, difficulty: config.difficulty }
                        : c.key === "CODING"
                          ? { subject: config.topic, difficulty: config.difficulty, language: config.language }
                          : { aptitudeCategory: config.aptitudeCategory, negativeMarking: config.negativeMarking, durationMin: 10 })
                    }
                  >
                    {starting ? "Starting…" : "Start"}
                  </button>
                </div>
              )}

              {setupCard !== c.key && (c.key === "HR" || c.key === "MOCK" || c.key === "RESUME_BASED") && (
                <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={starting} onClick={(e) => { e.stopPropagation(); start(c.key); }}>
                  {starting ? "Starting…" : "Start"}
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value, small }) {
  return (
    <div className="ip-glass" style={{ padding: "14px 16px" }}>
      <div className="mono" style={{ fontSize: small ? 13 : 20, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{label}</div>
    </div>
  );
}

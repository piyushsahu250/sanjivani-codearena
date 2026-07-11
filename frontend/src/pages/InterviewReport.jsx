import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import "./interviewPrep.css";

const SCORE_LABELS = {
  completeness: "Completeness", vocabulary: "Vocabulary", communication: "Communication", confidence: "Confidence",
  professionalism: "Professionalism", correctness: "Correctness", codeQuality: "Code Quality",
};

export default function InterviewReport() {
  const { id } = useParams();
  const location = useLocation();
  const [report, setReport] = useState(location.state?.report || null);
  const [error, setError] = useState("");
  const dark = localStorage.getItem("interviewPrepDark") === "1";

  useEffect(() => {
    if (report) return;
    api.get(`/interview/sessions/${id}`).then((res) => {
      if (res.data.session.report) setReport(res.data.session.report);
      else setError("This interview hasn't been submitted yet.");
    }).catch((err) => setError(err.response?.data?.error || "Failed to load report"));
  }, [id, report]);

  if (error) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p></div></div>;
  if (!report) return <div className={`interview-prep ${dark ? "dark" : ""}`}><Navbar /><div style={{ maxWidth: 800, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;

  return (
    <div className={`interview-prep ${dark ? "dark" : ""}`}>
      <Navbar />
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1>Feedback Report</h1><ChalkUnderline /></div>
          <Link to="/interview" className="btn btn-ghost">← Interview Prep</Link>
        </div>

        <div className="ip-glass" style={{ padding: 28, marginTop: 20, textAlign: "center" }}>
          <div className="mono" style={{ fontSize: 44, fontWeight: 700, color: "var(--ip-accent)" }}>{report.overallScore}%</div>
          <div style={{ opacity: 0.7 }}>Overall Score</div>
        </div>

        {Object.keys(report.scoreBreakdown || {}).length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 16 }}>
            {Object.entries(report.scoreBreakdown).filter(([k]) => SCORE_LABELS[k]).map(([k, v]) => (
              <div key={k} className="ip-glass" style={{ padding: 14 }}>
                <div className="mono" style={{ fontSize: 20, fontWeight: 700 }}>{v}%</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{SCORE_LABELS[k]}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
          <div className="ip-glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ip-accent)" }}>Strong Areas</div>
            {report.strongAreas?.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>{report.strongAreas.map((a, i) => <li key={i}>{a}</li>)}</ul>
            ) : <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>None identified yet.</p>}
          </div>
          <div className="ip-glass" style={{ padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--rust)" }}>Weak Areas</div>
            {report.weakAreas?.length ? (
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>{report.weakAreas.map((a, i) => <li key={i}>{a}</li>)}</ul>
            ) : <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8 }}>None — nice and even!</p>}
          </div>
        </div>

        <div className="ip-glass" style={{ padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Recommendations</div>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13 }}>
            {(report.recommendations || []).map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 20 }}>
          <Link to="/interview" className="btn btn-primary">Practice Again</Link>
          <Link to="/interview/history" className="btn btn-ghost">View History</Link>
        </div>
      </div>
    </div>
  );
}

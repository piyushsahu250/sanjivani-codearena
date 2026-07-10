import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const STATUS_ICON = { COMPLETED: "✓", IN_PROGRESS: "◐", NOT_STARTED: "○" };
const STATUS_COLOR = { COMPLETED: "var(--mint)", IN_PROGRESS: "var(--amber-dark)", NOT_STARTED: "var(--ink-dim)" };

export default function CourseOverview() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const isStudent = user.role === "STUDENT";

  useEffect(() => {
    setData(null);
    api.get(`/learning/courses/${slug}`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load course"));
  }, [slug]);

  if (error) return <div><Navbar /><div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p></div></div>;
  if (!data) return <div><Navbar /><div style={{ maxWidth: 900, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;

  const { course, modules, overall } = data;
  const complete = isStudent && overall.percent === 100;

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>{course.name} Learning Path</h1>
            <ChalkUnderline />
          </div>
          <Link to="/learning" className="btn btn-ghost">← All courses</Link>
        </div>
        {course.description && <p style={{ color: "var(--ink-dim)", marginTop: 12 }}>{course.description}</p>}

        {isStudent && (
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="mono" style={{ fontSize: 22, fontWeight: 700, color: "var(--mint)" }}>{overall.percent}%</div>
                <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{overall.completedLessons} / {overall.totalLessons} lessons completed</div>
              </div>
              {complete && <Link to={`/learning/${slug}/certificate`} className="btn btn-primary">🎓 View Certificate</Link>}
            </div>
            <div style={{ height: 8, borderRadius: 4, background: "var(--line)", marginTop: 14, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${overall.percent}%`, background: "var(--mint)", transition: "width 0.3s" }} />
            </div>
          </div>
        )}

        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          {modules.map((m, mi) => (
            <div key={m.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ fontSize: 16 }}>Module {mi + 1}: {m.title}</h3>
                {isStudent && (
                  <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{m.completedCount}/{m.totalCount}</span>
                )}
              </div>
              <div style={{ display: "grid", gap: 6, marginTop: 12 }}>
                {m.lessons.map((l) => (
                  <Link
                    key={l.id}
                    to={`/learning/${slug}/lesson/${l.id}`}
                    style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      padding: "8px 12px", borderRadius: 8, textDecoration: "none", color: "var(--ink)",
                      border: "1px solid var(--line)", fontSize: 13,
                    }}
                  >
                    <span>
                      {isStudent && <span className="mono" style={{ color: STATUS_COLOR[l.status], marginRight: 8 }}>{STATUS_ICON[l.status]}</span>}
                      {l.title}
                      {isStudent && l.bookmarked && <span style={{ marginLeft: 6 }}>★</span>}
                    </span>
                    <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{l.estimatedMinutes} min</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

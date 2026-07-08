import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function StudentDashboard() {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/tests").then((res) => {
      setTests(res.data);
      setLoading(false);
    });
  }, []);

  const now = new Date();

  function statusOf(test) {
    if (test.myStatus === "SUBMITTED" || test.myStatus === "AUTO_SUBMITTED") {
      return { label: "Completed", color: "var(--mint)", completed: true };
    }
    const start = new Date(test.startTime);
    const end = new Date(test.endTime);
    if (now < start) return { label: "Upcoming", color: "var(--ink-dim)" };
    if (now > end) return { label: "Closed", color: "var(--rust)" };
    return { label: "Live now", color: "var(--mint)" };
  }

  async function attend(test) {
    try {
      await api.post(`/tests/${test.id}/start`);
      navigate(`/test/${test.id}`);
    } catch (err) {
      alert(err.response?.data?.error || "Could not start test");
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Your coding tests</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", marginTop: 16 }}>
          Assessments published by your department. Live tests can be attended
          within their scheduled window only.
        </p>

        {loading && <p className="mono">Loading tests…</p>}
        {!loading && tests.length === 0 && (
          <div className="card" style={{ padding: 32, marginTop: 24, textAlign: "center", color: "var(--ink-dim)" }}>
            No tests have been published yet. Check back once your faculty schedules one.
          </div>
        )}

        <div style={{ display: "grid", gap: 16, marginTop: 24 }}>
          {tests.map((test) => {
            const status = statusOf(test);
            return (
              <div key={test.id} className="card" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <h3 style={{ fontSize: 18 }}>{test.title}</h3>
                    <span className="mono" style={{ fontSize: 12, color: status.color, fontWeight: 700 }}>
                      ● {status.label}
                    </span>
                  </div>
                  <p style={{ color: "var(--ink-dim)", fontSize: 14, margin: "6px 0" }}>{test.description}</p>
                  {status.completed && (
                    <p className="mono" style={{ fontSize: 12, color: "var(--mint)", fontWeight: 600, margin: "0 0 6px" }}>
                      You have already completed this test.
                    </p>
                  )}
                  <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                    {test._count?.questions || 0} questions · {test.durationMin} min ·{" "}
                    {new Date(test.startTime).toLocaleString()} → {new Date(test.endTime).toLocaleString()}
                  </p>
                </div>
                {status.completed || status.label === "Closed" ? (
                  <Link to={`/test/${test.id}/result`} className="btn btn-ghost">View result →</Link>
                ) : (
                  <button
                    className="btn btn-dark"
                    disabled={status.label !== "Live now"}
                    style={{ opacity: status.label !== "Live now" ? 0.4 : 1 }}
                    onClick={() => attend(test)}
                  >
                    {status.label === "Live now" ? "Attend test →" : status.label}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

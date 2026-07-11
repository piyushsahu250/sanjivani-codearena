import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const CARD_DEFS = [
  { key: "testsAssigned", label: "Tests Assigned", icon: "📋", color: "var(--ink)" },
  { key: "testsCompleted", label: "Tests Completed", icon: "✅", color: "var(--mint)" },
  { key: "testsPending", label: "Tests Pending", icon: "⏳", color: "var(--amber-dark)" },
  { key: "averageScorePercent", label: "Average Score", icon: "📊", color: "var(--mint)", suffix: "%" },
  { key: "rank", label: "Class Rank", icon: "🏆", color: "var(--amber-dark)" },
  { key: "codingSolved", label: "Coding Solved", icon: "💻", color: "var(--ink)" },
  { key: "mcqCorrect", label: "MCQs Correct", icon: "✔️", color: "var(--mint)" },
  { key: "learningProgressPercent", label: "Learning Progress", icon: "📚", color: "var(--mint)", suffix: "%" },
  { key: "codingStreak", label: "Coding Streak", icon: "🔥", color: "var(--rust)", suffix: " days" },
  { key: "certificatesEarned", label: "Certificates", icon: "🎓", color: "var(--amber-dark)" },
];

export default function StudentDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dash, setDash] = useState(null);
  const [tests, setTests] = useState(null);
  const [learning, setLearning] = useState(null);
  const [gami, setGami] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/dashboard/student").then((res) => setDash(res.data)).catch(() => setError("Failed to load dashboard summary"));
    api.get("/tests").then((res) => setTests(res.data)).catch(() => setTests([]));
    api.get("/learning/courses/java").then((res) => setLearning(res.data)).catch(() => setLearning(null));
    api.get("/gamification/me").then((res) => setGami(res.data)).catch(() => setGami(null));
  }, []);

  const now = new Date();
  function statusOf(test) {
    if (test.myStatus === "SUBMITTED" || test.myStatus === "AUTO_SUBMITTED") return { label: "Completed", color: "var(--mint)", completed: true };
    const start = new Date(test.startTime), end = new Date(test.endTime);
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

  const upcomingTests = (tests || [])
    .filter((t) => !statusOf(t).completed)
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  const loading = !dash || tests === null;

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Welcome back, {user.name.split(" ")[0]}</h1>
            <ChalkUnderline />
          </div>
          <QuickActions learningResumeId={learning?.resumeLessonId} />
        </div>

        {error && <p style={{ color: "var(--rust)", marginTop: 16 }}>{error}</p>}

        {/* Level & XP banner */}
        {gami && (
          <div className="card" style={{ padding: 20, marginTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>Level {gami.level.level} — {gami.level.name}</div>
              <div className="mono" style={{ fontSize: 26, fontWeight: 700, color: "var(--mint)" }}>{gami.level.totalXp} XP</div>
              {gami.level.nextLevelName && (
                <div style={{ height: 6, borderRadius: 3, background: "var(--line)", marginTop: 6, width: 180, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${gami.level.progressPercent}%`, background: "var(--mint)" }} />
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>Recent Badge</div>
                <div style={{ fontSize: 14 }}>{gami.badges.earned[0] ? `${gami.badges.earned[0].icon} ${gami.badges.earned[0].name}` : "None yet"}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>Leaderboard Rank</div>
                <div style={{ fontSize: 14 }}>{gami.leaderboardRank.rank ? `#${gami.leaderboardRank.rank} / ${gami.leaderboardRank.totalStudents}` : "—"}</div>
              </div>
              <Link to="/achievements" className="btn btn-primary" style={{ alignSelf: "center" }}>🏆 View Achievements</Link>
            </div>
          </div>
        )}

        {/* Summary cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginTop: 24 }}>
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 72 }} />)
            : CARD_DEFS.map((c) => (
                <DashboardCard
                  key={c.key}
                  icon={c.icon}
                  label={c.label}
                  color={c.color}
                  value={
                    c.key === "rank"
                      ? dash.cards.rank ? `#${dash.cards.rank}/${dash.cards.totalStudentsInClass}` : "—"
                      : `${dash.cards[c.key] ?? 0}${c.suffix || ""}`
                  }
                />
              ))}
        </div>

        {/* Recent activity + notifications */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20, marginTop: 32 }}>
          <Section title="Recent Activity">
            {loading ? (
              <SkeletonLines count={4} />
            ) : dash.recentActivity.length === 0 ? (
              <EmptyState text="No activity yet — start a test or a lesson to see it here." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {dash.recentActivity.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                    <span>{a.text}</span>
                    <span className="mono" style={{ color: "var(--ink-dim)", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(a.date).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Notifications">
            {loading ? (
              <SkeletonLines count={4} />
            ) : dash.notifications.length === 0 ? (
              <EmptyState text="You're all caught up — no new notifications." />
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {dash.notifications.map((n, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13, borderBottom: "1px solid var(--line)", paddingBottom: 8 }}>
                    <span>{notificationIcon(n.type)} {n.text}</span>
                    <span className="mono" style={{ color: "var(--ink-dim)", fontSize: 11, whiteSpace: "nowrap" }}>{new Date(n.date).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>

        {/* Upcoming tests */}
        <Section title="Upcoming Tests" style={{ marginTop: 24 }}>
          {tests === null ? (
            <SkeletonLines count={3} />
          ) : upcomingTests.length === 0 ? (
            <EmptyState text="No upcoming tests. Check back once your faculty schedules one." />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {upcomingTests.map((test) => {
                const status = statusOf(test);
                return (
                  <div key={test.id} className="card" style={{ padding: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <strong>{test.title}</strong>
                        <span className="mono" style={{ fontSize: 12, color: status.color, fontWeight: 700 }}>● {status.label}</span>
                      </div>
                      <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
                        {test._count?.questions || 0} questions · {test.durationMin} min · {new Date(test.startTime).toLocaleString()}
                      </p>
                    </div>
                    <button
                      className="btn btn-dark"
                      disabled={status.label !== "Live now"}
                      style={{ opacity: status.label !== "Live now" ? 0.4 : 1 }}
                      onClick={() => attend(test)}
                    >
                      {status.label === "Live now" ? "Start Test →" : status.label}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Learning progress */}
        <Section title="Learning Progress" style={{ marginTop: 24 }}>
          {learning === null ? (
            <SkeletonLines count={3} />
          ) : (
            <LearningProgressBlock learning={learning} />
          )}
        </Section>

        {/* Performance summary */}
        <Section title="Performance Summary" style={{ marginTop: 24 }}>
          {loading ? (
            <SkeletonLines count={2} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 16 }}>
              <MiniStat label="Highest Score" value={dash.performanceSummary.highest ? `${dash.performanceSummary.highest.percentage}%` : "—"} />
              <MiniStat label="Lowest Score" value={dash.performanceSummary.lowest ? `${dash.performanceSummary.lowest.percentage}%` : "—"} />
              <MiniStat label="Average Score" value={`${dash.performanceSummary.averageScorePercent}%`} />
              <MiniStat label="Time Spent" value={`${dash.performanceSummary.totalTimeSpentMin} min`} />
              <MiniStat label="Last Attempt" value={dash.performanceSummary.lastAttemptDate ? new Date(dash.performanceSummary.lastAttemptDate).toLocaleDateString() : "—"} />
            </div>
          )}
        </Section>

        {/* Recent test results */}
        <Section title="Recent Test Results" style={{ marginTop: 24 }}>
          {loading ? (
            <SkeletonLines count={3} />
          ) : dash.recentTestResults.length === 0 ? (
            <EmptyState text="No completed tests yet." />
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
                    <th style={{ padding: "8px 6px" }}>Test Name</th>
                    <th style={{ padding: "8px 6px" }}>Score</th>
                    <th style={{ padding: "8px 6px" }}>Percentage</th>
                    <th style={{ padding: "8px 6px" }}>Time Taken</th>
                    <th style={{ padding: "8px 6px" }}>Status</th>
                    <th style={{ padding: "8px 6px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {dash.recentTestResults.map((h) => (
                    <tr key={h.testId} style={{ borderBottom: "1px solid var(--line)", fontSize: 13 }}>
                      <td style={{ padding: "10px 6px" }}>{h.testName}</td>
                      <td className="mono" style={{ padding: "10px 6px" }}>{h.resultsPending ? "—" : `${h.score}/${h.maxScore}`}</td>
                      <td className="mono" style={{ padding: "10px 6px" }}>{h.resultsPending ? "Pending" : `${h.percentage}%`}</td>
                      <td className="mono" style={{ padding: "10px 6px" }}>{h.timeTakenMin != null ? `${h.timeTakenMin} min` : "—"}</td>
                      <td style={{ padding: "10px 6px" }}>{h.status === "AUTO_SUBMITTED" ? "Auto-submitted" : "Completed"}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>
                        <Link to={`/test/${h.testId}/result`} className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }}>View Details</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function notificationIcon(type) {
  return { test_assigned: "🆕", test_reminder: "⏰", module_unlocked: "🔓", certificate: "🎓" }[type] || "🔔";
}

function DashboardCard({ icon, label, value, color }) {
  return (
    <div className="card" style={{ padding: "14px 16px" }}>
      <div style={{ fontSize: 20 }}>{icon}</div>
      <div className="mono" style={{ fontSize: 20, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{label}</div>
    </div>
  );
}

function Section({ title, children, style }) {
  return (
    <div style={style}>
      <h3 style={{ fontSize: 16, marginBottom: 12 }}>{title}</h3>
      <div className="card" style={{ padding: 20 }}>{children}</div>
    </div>
  );
}

function EmptyState({ text }) {
  return <p style={{ color: "var(--ink-dim)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>{text}</p>;
}

function SkeletonLines({ count }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {Array.from({ length: count }).map((_, i) => <div key={i} className="skeleton" style={{ height: 16 }} />)}
    </div>
  );
}

function QuickActions({ learningResumeId }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <Link to={learningResumeId ? `/learning/java/lesson/${learningResumeId}` : "/learning"} className="btn btn-primary">▶ Continue Learning</Link>
      <Link to="/learning" className="btn btn-ghost">💻 Practice Coding</Link>
      <Link to="/dashboard/performance" className="btn btn-ghost">📈 My Performance</Link>
      <Link to="/achievements" className="btn btn-ghost">🏆 Achievements</Link>
      <Link to="/resume" className="btn btn-ghost">📄 Resume Builder</Link>
      <Link to="/account" className="btn btn-ghost">👤 Profile</Link>
    </div>
  );
}

const STATUS_ICON = { COMPLETED: "✓", IN_PROGRESS: "◐", NOT_STARTED: "○" };

function LearningProgressBlock({ learning }) {
  const { course, modules, overall, resumeLessonId } = learning;
  const completedModules = modules.filter((m) => m.completed);
  const currentModule = modules.find((m) => !m.locked && !m.completed);
  const lockedModules = modules.filter((m) => m.locked);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div>
          <strong>{course.name} Course</strong>
          <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{overall.completedLessons}/{overall.totalLessons} lessons</div>
        </div>
        {resumeLessonId && (
          <Link to={`/learning/${course.slug}/lesson/${resumeLessonId}`} className="btn btn-primary">Continue Learning →</Link>
        )}
      </div>
      <div style={{ height: 10, borderRadius: 5, background: "var(--line)", marginTop: 12, overflow: "hidden" }}>
        <div className="mono" style={{ height: "100%", width: `${overall.percent}%`, background: "var(--mint)", transition: "width 0.3s" }} />
      </div>
      <div className="mono" style={{ fontSize: 12, color: "var(--mint)", fontWeight: 700, marginTop: 4 }}>{overall.percent}%</div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginTop: 16 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 6 }}>Completed</div>
          {completedModules.length === 0 ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>None yet</span> : completedModules.map((m) => (
            <div key={m.id} style={{ fontSize: 13 }}><span style={{ color: "var(--mint)" }}>{STATUS_ICON.COMPLETED}</span> {m.title}</div>
          ))}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 6 }}>Current Module</div>
          {currentModule ? (
            <Link to={`/learning/${course.slug}/lesson/${currentModule.lessons[0]?.id}`} style={{ fontSize: 13, color: "var(--amber-dark)" }}>◐ {currentModule.title}</Link>
          ) : <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>Course complete!</span>}
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-dim)", marginBottom: 6 }}>Locked</div>
          {lockedModules.length === 0 ? <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>None</span> : lockedModules.map((m) => (
            <div key={m.id} style={{ fontSize: 13, color: "var(--ink-dim)" }}>🔒 {m.title}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

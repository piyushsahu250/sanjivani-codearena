import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const SEGMENT_LABELS = {
  dashboard: "Dashboard", performance: "Performance", learning: "Learning", lesson: "Lesson",
  certificate: "Certificate", interview: "AI Mock Interview", session: "Session", report: "Report",
  history: "History", leaderboard: "Leaderboard", progress: "Progress", resume: "Resume Builder",
  achievements: "Achievements", account: "Settings", staff: "Staff", admin: "Admin",
  students: "Students", classes: "Classes", institutes: "Institutes", questions: "Question Bank",
  new: "New", edit: "Edit", results: "Results", preview: "Preview", tests: "Tests",
  "bulk-upload": "Bulk Upload", gamification: "Gamification", resumes: "Resumes",
  interviews: "Mock Interview Admin", module: "Module", "coding-assessment": "Coding Assessment",
  test: "Test", verify: "Verify",
};

const DASHBOARD_PATHS = new Set(["/dashboard", "/staff", "/admin"]);

// True for opaque ids (UUIDs and similar) — these have no human-readable name available from the
// URL alone, so they're skipped rather than shown as a raw id. Readable slugs (e.g. course slugs
// like "java") fall through to the titlecase fallback below instead.
function isOpaqueId(seg) {
  return /^[0-9a-f-]{16,}$/i.test(seg);
}

// Best-effort, path-derived breadcrumb — no per-page wiring required, so it's automatically
// present on every route. The tradeoff: dynamic segments that aren't opaque ids (course slugs,
// etc.) are shown titlecased rather than with their true display name (e.g. a lesson's actual
// title), since that data isn't available from the URL alone. A richer version would need each
// page to report its current item's display name via a small context — not built in this pass.
export default function Breadcrumb() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  if (DASHBOARD_PATHS.has(location.pathname)) return null;

  const homePath = user?.role === "ADMIN" ? "/admin" : user?.role === "STAFF" ? "/staff" : "/dashboard";
  const segments = location.pathname.split("/").filter(Boolean);
  let path = "";
  const crumbs = [{ label: "Dashboard", to: homePath }];
  for (const seg of segments) {
    path += `/${seg}`;
    if (isOpaqueId(seg)) continue;
    const label = SEGMENT_LABELS[seg] || seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    crumbs.push({ label, to: path });
  }

  return (
    <div className="ca-breadcrumb-row">
      <button className="ca-back-btn" onClick={() => navigate(-1)}>
        <ArrowLeft size={14} /> Back
      </button>
      <span style={{ opacity: 0.3 }}>|</span>
      {crumbs.map((c, i) => (
        <span key={c.to} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {i > 0 && <span style={{ opacity: 0.4 }}>›</span>}
          {i === crumbs.length - 1 ? (
            <span className="ca-crumb-current">{c.label}</span>
          ) : (
            <Link className="ca-crumb-link" to={c.to}>{c.label}</Link>
          )}
        </span>
      ))}
    </div>
  );
}

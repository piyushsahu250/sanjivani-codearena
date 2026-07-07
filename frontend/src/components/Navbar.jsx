import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 32px",
        background: "var(--slate-900)",
        color: "var(--chalk)",
      }}
    >
      <Link to="/" style={{ textDecoration: "none", color: "var(--chalk)" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="mono" style={{ color: "var(--amber)", fontWeight: 700 }}>&gt;_</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 18 }}>
            Sanjivani CodeArena
          </span>
        </div>
      </Link>
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="mono" style={{ fontSize: 13, color: "var(--chalk-dim)" }}>
            {user.name} · {user.role}
          </span>
          <button
            className="btn btn-ghost"
            style={{ borderColor: "var(--slate-700)", color: "var(--chalk)" }}
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </nav>
  );
}

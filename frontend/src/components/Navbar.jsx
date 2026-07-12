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
        <div style={{ background: "#fdfbf5", borderRadius: 8, padding: "3px 10px", display: "flex", alignItems: "center" }}>
          <img src="/branding/logo.png" alt="CodeArena" style={{ height: 40, width: "auto", display: "block" }} />
        </div>
      </Link>
      {user && (
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <span className="mono" style={{ fontSize: 13, color: "var(--chalk-dim)" }}>
            {user.name} · {user.role}
          </span>
          <Link to="/account" className="btn btn-ghost" style={{ borderColor: "var(--slate-700)", color: "var(--chalk)", textDecoration: "none" }}>
            Account
          </Link>
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

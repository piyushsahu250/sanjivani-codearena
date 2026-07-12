export default function LoadingScreen({ label = "Loading…" }) {
  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: 48,
      }}
    >
      <img
        src="/branding/logo.png"
        alt="CodeArena"
        style={{ width: 120, height: "auto", animation: "ca-logo-pulse 1.6s ease-in-out infinite" }}
      />
      <span className="mono" style={{ fontSize: 13, color: "var(--ink-dim, #666)" }}>{label}</span>
      <style>{`
        @keyframes ca-logo-pulse {
          0%, 100% { opacity: 0.55; transform: scale(0.97); }
          50% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

import { Play, Upload } from "lucide-react";

// Shared Run/Submit button pair for every coding surface on the platform — same look, same
// meaning everywhere: Run checks the visible sample cases only (free, unlimited, no score);
// Submit grades against the hidden test cases (never shown to the student) and records the score.
export default function RunSubmitButtons({ onRun, onSubmit, running, submitting, runDisabled, submitDisabled }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={onRun}
        disabled={running || runDisabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#2b2b2b", color: "#e6e6e6", border: "1px solid #3d3d3d",
          borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 600,
          cursor: running || runDisabled ? "default" : "pointer", opacity: running || runDisabled ? 0.6 : 1,
        }}
      >
        <Play size={14} fill="#e6e6e6" />
        {running ? "Running…" : "Run"}
      </button>
      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || submitDisabled}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#2b2b2b", color: "#3ddc73", border: "1px solid #2f6b45",
          borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 700,
          cursor: submitting || submitDisabled ? "default" : "pointer", opacity: submitting || submitDisabled ? 0.6 : 1,
        }}
      >
        <Upload size={14} />
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}

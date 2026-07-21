const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontFamily: "var(--font-body)" };
const hintStyle = { fontSize: 11, color: "var(--ink-dim)", marginTop: 2 };

// Shared "professional problem statement" admin fields — the write-side counterpart to
// ProblemStatement.jsx's read-side rendering. Embedded identically in every coding-question
// admin form (CreateQuestion.jsx, LearningManagement.jsx's two panels, InterviewAdmin.jsx, and
// the Daily/Weekly Challenge scheduling panels) so admins get the same authoring experience
// everywhere, and so no surface silently lacks a field another one has.
//
// `value` is the subset of the question object holding these fields; `onChange(patch)` merges a
// partial update the same way each embedding form's own field setters already work.
export default function ProblemStatementFields({ value, onChange }) {
  const v = value || {};
  function set(field) {
    return (e) => onChange({ [field]: e.target.value });
  }
  return (
    <div>
      <label style={labelStyle}>Estimated time (minutes, optional)</label>
      <input type="number" min="1" style={{ ...inputStyle, maxWidth: 160 }} value={v.estimatedTimeMin ?? ""} onChange={(e) => onChange({ estimatedTimeMin: e.target.value ? Number(e.target.value) : null })} />

      <label style={labelStyle}>Real-world scenario (optional)</label>
      <p style={hintStyle}>A short framing of where this problem shows up in practice — helps students see why it matters before diving in.</p>
      <textarea style={{ ...inputStyle, minHeight: 60 }} value={v.realWorldScenario || ""} onChange={set("realWorldScenario")} />

      <label style={labelStyle}>Beginner-friendly explanation (optional)</label>
      <p style={hintStyle}>What the problem is really asking, step by step — shown to students before they attempt it, separate from the problem statement itself.</p>
      <textarea style={{ ...inputStyle, minHeight: 90 }} value={v.problemExplanation || ""} onChange={set("problemExplanation")} />

      <label style={labelStyle}>Constraints (optional)</label>
      <textarea style={{ ...inputStyle, minHeight: 60, fontFamily: "var(--font-mono)", fontSize: 13 }} value={v.constraints || ""} onChange={set("constraints")} placeholder={"1 <= n <= 10^5\n-10^9 <= nums[i] <= 10^9"} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={labelStyle}>Input format (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={v.inputFormat || ""} onChange={set("inputFormat")} />
        </div>
        <div>
          <label style={labelStyle}>Output format (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={v.outputFormat || ""} onChange={set("outputFormat")} />
        </div>
      </div>

      <label style={labelStyle}>Notes (optional)</label>
      <textarea style={{ ...inputStyle, minHeight: 50 }} value={v.notes || ""} onChange={set("notes")} />

      <label style={labelStyle}>Edge cases to consider (optional)</label>
      <p style={hintStyle}>Called out for students, not test-case data — e.g. "empty input", "all duplicate values", "n = 1".</p>
      <textarea style={{ ...inputStyle, minHeight: 60 }} value={v.edgeCases || ""} onChange={set("edgeCases")} />
    </div>
  );
}

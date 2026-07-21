// Shared student-facing problem-statement renderer — the read-side counterpart to
// ProblemStatementFields.jsx. Used by every coding surface (formal Tests, Module Coding Tests,
// Learning Module practice, Mock Interview coding, and Daily/Weekly Challenges) so a student sees
// the same structure and section order everywhere, per the platform-wide-consistency requirement.
//
// Every field is optional and simply omitted from render when absent — a legacy or
// not-yet-backfilled question with only title/description/testCases still renders correctly, it
// just has fewer sections. `question` accepts the shape any of this platform's sanitizeQuestion()
// functions already return (title, description/prompt, difficulty, tags, estimatedTimeMin,
// realWorldScenario, constraints, inputFormat, outputFormat, notes, edgeCases,
// problemExplanation, testCases: [{input, expected, explanation}] — visible cases only).
export default function ProblemStatement({ question }) {
  const q = question || {};
  const description = q.description ?? q.prompt ?? "";
  const testCases = Array.isArray(q.testCases) ? q.testCases : [];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {q.title && <h2 style={{ fontSize: 20 }}>{q.title}</h2>}
        {q.difficulty && <span className={`badge badge-${String(q.difficulty).toLowerCase()}`}>{q.difficulty}</span>}
        {q.estimatedTimeMin != null && (
          <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>⏱ ~{q.estimatedTimeMin} min</span>
        )}
      </div>

      {Array.isArray(q.tags) && q.tags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
          {q.tags.map((t, i) => (
            <span key={i} className="mono" style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--card-bg, #F7F7F5)", border: "1px solid var(--line)", color: "var(--ink-dim)" }}>
              {t}
            </span>
          ))}
        </div>
      )}

      <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.6, fontSize: 14, marginTop: 16 }}>{description}</p>

      {q.realWorldScenario && (
        <div className="card" style={{ padding: 14, marginTop: 16, background: "var(--card-bg, #F7F7F5)" }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>REAL-WORLD SCENARIO</div>
          <p style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.realWorldScenario}</p>
        </div>
      )}

      {q.problemExplanation && (
        <details style={{ marginTop: 16 }}>
          <summary style={{ cursor: "pointer", fontSize: 13, fontWeight: 700, color: "var(--ink-dim)" }}>📖 Explanation — read this if you're not sure where to start</summary>
          <p style={{ fontSize: 13, marginTop: 8, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.problemExplanation}</p>
        </details>
      )}

      {(q.inputFormat || q.outputFormat) && (
        <div style={{ display: "grid", gridTemplateColumns: q.inputFormat && q.outputFormat ? "1fr 1fr" : "1fr", gap: 12, marginTop: 16 }}>
          {q.inputFormat && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>INPUT FORMAT</div>
              <p style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{q.inputFormat}</p>
            </div>
          )}
          {q.outputFormat && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>OUTPUT FORMAT</div>
              <p style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{q.outputFormat}</p>
            </div>
          )}
        </div>
      )}

      {q.constraints && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>CONSTRAINTS</div>
          <p className="mono" style={{ fontSize: 12.5, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.constraints}</p>
        </div>
      )}

      {q.edgeCases && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>EDGE CASES TO CONSIDER</div>
          <p style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.edgeCases}</p>
        </div>
      )}

      {q.notes && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>NOTES</div>
          <p style={{ fontSize: 13, marginTop: 6, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{q.notes}</p>
        </div>
      )}

      {testCases.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink-dim)" }}>SAMPLE TEST CASES</div>
          {testCases.map((tc, i) => (
            <div key={i} className="card" style={{ padding: 12, marginTop: 8, fontSize: 13 }}>
              <div className="mono"><strong>Input:</strong> {tc.input}</div>
              <div className="mono"><strong>Expected:</strong> {tc.expected}</div>
              {tc.explanation && <div style={{ marginTop: 6, color: "var(--ink-dim)" }}>{tc.explanation}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

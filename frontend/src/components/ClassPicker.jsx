import { useMemo, useState } from "react";
import { formatClassLabel, groupClassesByBatch } from "../utils/classLabel";

const labelStyle = { display: "block", fontSize: 12, fontWeight: 600, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 };

// Shared cascading Institute -> Batch -> Department/Division class picker, used everywhere a class
// is selected (Test Creation, Attendance staff assignment, Reports) instead of a flat wall of
// hundreds of classes. Classes with no Division assigned yet ("legacy") are never hidden — they
// surface in their own section using a plain flat list, so nothing already relying on them breaks
// while an admin migrates classes into Divisions at their own pace.
//
// multi=true: `value` is an array of classIds, checkboxes. multi=false: `value` is a single
// classId (or ""), radios/select behavior.
export default function ClassPicker({ classes, value, onChange, multi = false }) {
  const institutes = useMemo(() => {
    const map = new Map();
    classes.forEach((c) => c.institute && map.set(c.institute.id, c.institute.name));
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [classes]);

  const [instituteId, setInstituteId] = useState(institutes.length === 1 ? institutes[0].id : "");
  const [batchYear, setBatchYear] = useState("");

  const scopedClasses = useMemo(() => {
    if (institutes.length <= 1) return classes;
    return classes.filter((c) => c.institute?.id === instituteId);
  }, [classes, institutes.length, instituteId]);

  const { batches, byBatch, legacy } = useMemo(() => groupClassesByBatch(scopedClasses), [scopedClasses]);
  const divisionsForBatch = batchYear ? byBatch[batchYear] || [] : [];

  const selectedSet = useMemo(() => new Set(multi ? value || [] : value ? [value] : []), [multi, value]);

  function toggle(classId) {
    if (multi) {
      const next = selectedSet.has(classId) ? [...selectedSet].filter((id) => id !== classId) : [...selectedSet, classId];
      onChange(next);
    } else {
      onChange(selectedSet.has(classId) ? "" : classId);
    }
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {institutes.length > 1 && (
          <div style={{ flex: "1 1 200px" }}>
            <label style={labelStyle}>Institute</label>
            <select style={inputStyle} value={instituteId} onChange={(e) => { setInstituteId(e.target.value); setBatchYear(""); }}>
              <option value="">Select institute…</option>
              {institutes.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
            </select>
          </div>
        )}
        <div style={{ flex: "1 1 160px" }}>
          <label style={labelStyle}>Batch</label>
          <select style={inputStyle} value={batchYear} onChange={(e) => setBatchYear(e.target.value)} disabled={institutes.length > 1 && !instituteId}>
            <option value="">Select batch…</option>
            {batches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {batchYear && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {divisionsForBatch.map((c) => (
            <label
              key={c.id}
              className="badge"
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: selectedSet.has(c.id) ? "var(--amber)" : undefined }}
            >
              <input type={multi ? "checkbox" : "radio"} checked={selectedSet.has(c.id)} onChange={() => toggle(c.id)} />
              {formatClassLabel(c)}
            </label>
          ))}
          {divisionsForBatch.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>No divisions for this batch yet.</span>}
        </div>
      )}

      {legacy.length > 0 && (
        <div>
          <label style={labelStyle}>Legacy / Unassigned classes (no Division set)</label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {legacy.map((c) => (
              <label
                key={c.id}
                className="badge"
                style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: selectedSet.has(c.id) ? "var(--amber)" : undefined }}
              >
                <input type={multi ? "checkbox" : "radio"} checked={selectedSet.has(c.id)} onChange={() => toggle(c.id)} />
                {formatClassLabel(c)}
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

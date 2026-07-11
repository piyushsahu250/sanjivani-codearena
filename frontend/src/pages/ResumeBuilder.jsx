import { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, marginTop: 4 };
const labelStyle = { fontSize: 11, fontWeight: 600, color: "var(--ink-dim)" };

const TEMPLATES = [
  { id: "modern", label: "Modern", accent: "#4F9D6E" },
  { id: "professional", label: "Professional", accent: "#1C3D5A" },
  { id: "minimal", label: "Minimal", accent: "#333333" },
  { id: "classic", label: "Classic", accent: "#3B2F2F" },
  { id: "software-engineer", label: "Software Engineer", accent: "#2C5B45" },
  { id: "fresher", label: "Fresher", accent: "#C7852A" },
  { id: "experienced", label: "Experienced", accent: "#1C3D5A" },
];

const EDUCATION_FIELDS = [
  { key: "degree", label: "Degree" }, { key: "specialization", label: "Specialization" },
  { key: "institution", label: "College / University" }, { key: "board", label: "Board (if applicable)" },
  { key: "startYear", label: "Start Year" }, { key: "endYear", label: "End Year" },
  { key: "score", label: "CGPA / Percentage" },
  { key: "status", label: "Current Status", type: "select", options: ["Pursuing", "Completed"] },
];
const SKILL_FIELDS = [
  { key: "category", label: "Category", type: "select", options: ["Programming Languages", "Frameworks", "Databases", "Tools & Technologies", "Other"] },
  { key: "name", label: "Skill" },
  { key: "proficiency", label: "Proficiency", type: "select", options: ["Beginner", "Intermediate", "Advanced"] },
];
const PROJECT_FIELDS = [
  { key: "title", label: "Project Title" },
  { key: "description", label: "Description", type: "textarea", wide: true },
  { key: "technologies", label: "Technologies Used" }, { key: "role", label: "Role" }, { key: "duration", label: "Duration" },
  { key: "githubUrl", label: "GitHub Repository Link" }, { key: "liveUrl", label: "Live Demo Link (optional)" },
];
const EXPERIENCE_FIELDS = [
  { key: "company", label: "Company Name" }, { key: "title", label: "Job Title" },
  { key: "employmentType", label: "Employment Type", type: "select", options: ["Internship", "Full-Time", "Freelance", "Research Project"] },
  { key: "startDate", label: "Start Date" }, { key: "endDate", label: "End Date" },
  { key: "responsibilities", label: "Responsibilities", type: "textarea", wide: true },
  { key: "technologies", label: "Technologies Used" },
];
const CERT_FIELDS = [
  { key: "name", label: "Certification Name" }, { key: "org", label: "Issuing Organization" },
  { key: "issueDate", label: "Issue Date" }, { key: "expiryDate", label: "Expiry Date (optional)" },
  { key: "credentialId", label: "Credential ID" }, { key: "credentialUrl", label: "Credential URL" },
];
const ACHIEVEMENT_FIELDS = [
  { key: "category", label: "Category", type: "select", options: ["Award", "Hackathon", "Contest Ranking", "Scholarship", "Academic", "Open Source"] },
  { key: "text", label: "Description", type: "textarea", wide: true },
];
const LANGUAGE_FIELDS = [
  { key: "name", label: "Language" },
  { key: "proficiency", label: "Proficiency", type: "select", options: ["Beginner", "Intermediate", "Fluent", "Native"] },
];

export default function ResumeBuilder() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ats, setAts] = useState(null);
  const [checkingAts, setCheckingAts] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(85);

  function load() {
    api.get("/resume/me").then((res) => setData(res.data)).catch(() => setError("Failed to load resume"));
  }
  useEffect(load, []);

  async function save(patch) {
    const { data: res } = await api.patch("/resume/me", patch);
    setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
  }

  async function runAutofill() {
    setAutofilling(true);
    try {
      const { data: res } = await api.post("/resume/me/autofill");
      setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
      alert(res.filledFields.length ? `Auto-filled: ${res.filledFields.join(", ")}` : "Nothing new to auto-fill — your resume already has this data.");
    } catch (err) {
      alert(err.response?.data?.error || "Auto-fill failed");
    } finally {
      setAutofilling(false);
    }
  }

  async function checkAts() {
    setCheckingAts(true);
    try {
      const { data: res } = await api.get("/resume/me/ats-score");
      setAts(res);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to compute ATS score");
    } finally {
      setCheckingAts(false);
    }
  }

  async function downloadPdf() {
    setDownloading(true);
    try {
      const { data: blob } = await api.get("/resume/me/pdf", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.resume.fullName || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  }

  if (error) return <div><Navbar /><div style={{ maxWidth: 1200, margin: "0 auto", padding: 48 }}><p style={{ color: "var(--rust)" }}>{error}</p></div></div>;
  if (!data) return <div><Navbar /><div style={{ maxWidth: 1200, margin: "0 auto", padding: 48 }} className="mono">Loading…</div></div>;

  const { resume, completion, feedback } = data;
  const template = TEMPLATES.find((t) => t.id === resume.template) || TEMPLATES[0];

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1>Resume Builder</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-ghost" onClick={runAutofill} disabled={autofilling}>{autofilling ? "Filling…" : "✨ Auto-fill from Platform"}</button>
            <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
            <button className="btn btn-primary" onClick={downloadPdf} disabled={downloading}>{downloading ? "Preparing…" : "⬇ Download PDF"}</button>
          </div>
        </div>

        {/* Completion */}
        <div className="card" style={{ padding: 16, marginTop: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Resume Completion</span>
            <span className="mono" style={{ fontWeight: 700, color: "var(--mint)" }}>{completion.percent}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: "var(--line)", marginTop: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${completion.percent}%`, background: "var(--mint)" }} />
          </div>
          {completion.missingSections.length > 0 && (
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>Missing: {completion.missingSections.join(", ")}</div>
          )}
        </div>

        {feedback.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 16, background: "#FCEFD9" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Feedback from your institute</div>
            {feedback.map((f) => (
              <div key={f.id} style={{ fontSize: 13, marginTop: 6 }}>
                <strong>{f.authorName}:</strong> {f.message}
                <span className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginLeft: 8 }}>{new Date(f.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 24, marginTop: 24, alignItems: "start" }} className="resume-builder-layout">
          {/* Left: editor */}
          <div style={{ display: "grid", gap: 16 }}>
            {/* Template picker */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Template</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => save({ template: t.id })}
                    className={resume.template === t.id ? "btn btn-dark" : "btn btn-ghost"}
                    style={{ fontSize: 12, borderLeft: `4px solid ${t.accent}` }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ATS score */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>ATS Score Checker</div>
                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={checkAts} disabled={checkingAts}>{checkingAts ? "Checking…" : ats ? "Regenerate" : "Check ATS Score"}</button>
              </div>
              {ats && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                    <span className="mono" style={{ fontSize: 28, fontWeight: 700, color: ats.score >= 75 ? "var(--mint)" : ats.score >= 60 ? "var(--amber-dark)" : "var(--rust)" }}>{ats.score}/100</span>
                    <span style={{ fontSize: 13, color: "var(--ink-dim)" }}>{ats.status}</span>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Suggestions</div>
                    <ul style={{ paddingLeft: 18, margin: 0 }}>
                      {ats.suggestions.map((s, i) => <li key={i} style={{ fontSize: 12, marginBottom: 3 }}>{s}</li>)}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Personal details */}
            <PersonalDetailsForm resume={resume} onSave={save} />

            <ArraySectionEditor title="Education" items={resume.education || []} fields={EDUCATION_FIELDS}
              onChange={(items) => save({ education: items })}
              renderSummary={(e) => `${e.degree || "—"}${e.specialization ? ` (${e.specialization})` : ""} — ${e.institution || "—"}`} />

            <ArraySectionEditor title="Skills" items={resume.skills || []} fields={SKILL_FIELDS}
              onChange={(items) => save({ skills: items })}
              renderSummary={(s) => `${s.name || "—"} — ${s.category || "Other"} (${s.proficiency || "—"})`} />

            <ArraySectionEditor title="Projects" items={resume.projects || []} fields={PROJECT_FIELDS}
              onChange={(items) => save({ projects: items })}
              renderSummary={(p) => `${p.title || "—"}${p.role ? ` — ${p.role}` : ""}`} />

            <ArraySectionEditor title="Experience" items={resume.experience || []} fields={EXPERIENCE_FIELDS}
              onChange={(items) => save({ experience: items })}
              renderSummary={(e) => `${e.title || "—"} at ${e.company || "—"} (${e.employmentType || "—"})`} />

            <ArraySectionEditor title="Certifications" items={resume.certifications || []} fields={CERT_FIELDS}
              onChange={(items) => save({ certifications: items })}
              renderSummary={(c) => `${c.name || "—"} — ${c.org || "—"}`} />

            <ArraySectionEditor title="Achievements" items={resume.achievements || []} fields={ACHIEVEMENT_FIELDS}
              onChange={(items) => save({ achievements: items })}
              renderSummary={(a) => `[${a.category || "—"}] ${a.text || "—"}`} />

            <ArraySectionEditor title="Languages" items={resume.languages || []} fields={LANGUAGE_FIELDS}
              onChange={(items) => save({ languages: items })}
              renderSummary={(l) => `${l.name || "—"} — ${l.proficiency || "—"}`} />
          </div>

          {/* Right: live preview */}
          <div style={{ position: "sticky", top: 20 }}>
            <div className="card" style={{ padding: 12, marginBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Live Preview</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setZoom((z) => Math.max(50, z - 10))}>-</button>
                <span className="mono" style={{ fontSize: 11 }}>{zoom}%</span>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => setZoom((z) => Math.min(150, z + 10))}>+</button>
              </div>
            </div>
            <div style={{ overflow: "auto", maxHeight: "80vh", border: "1px solid var(--line)", borderRadius: 8, background: "#ddd", padding: 16 }}>
              <div id="resume-print-area" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top center", transition: "transform 0.15s" }}>
                <ResumePreview resume={resume} accent={template.accent} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #resume-print-area, #resume-print-area * { visibility: visible; }
          #resume-print-area { position: absolute; top: 0; left: 0; transform: none !important; }
        }
        @media (max-width: 900px) {
          .resume-builder-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function PersonalDetailsForm({ resume, onSave }) {
  const [form, setForm] = useState({
    fullName: resume.fullName || "", photoUrl: resume.photoUrl || "", email: resume.email || "", mobile: resume.mobile || "",
    linkedin: resume.linkedin || "", github: resume.github || "", portfolio: resume.portfolio || "",
    address: resume.address || "", summary: resume.summary || "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Personal Details</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
        <Field label="Full Name" value={form.fullName} onChange={(v) => setForm({ ...form, fullName: v })} />
        <Field label="Profile Photo URL (optional)" value={form.photoUrl} onChange={(v) => setForm({ ...form, photoUrl: v })} />
        <Field label="Email Address" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Field label="Mobile Number" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} />
        <Field label="LinkedIn Profile" value={form.linkedin} onChange={(v) => setForm({ ...form, linkedin: v })} />
        <Field label="GitHub Profile" value={form.github} onChange={(v) => setForm({ ...form, github: v })} />
        <Field label="Portfolio Website (optional)" value={form.portfolio} onChange={(v) => setForm({ ...form, portfolio: v })} />
        <Field label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
      </div>
      <div style={{ marginTop: 10 }}>
        <label style={labelStyle}>Career Objective / Professional Summary</label>
        <textarea style={{ ...inputStyle, minHeight: 70 }} value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} />
      </div>
      <button className="btn btn-primary" style={{ marginTop: 12, fontSize: 12 }} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Personal Details"}</button>
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input style={inputStyle} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ArraySectionEditor({ title, items, fields, onChange, renderSummary }) {
  const [editingIndex, setEditingIndex] = useState(null); // -1 = adding, N = editing index N, null = closed
  const [draft, setDraft] = useState({});

  function startAdd() {
    const empty = {};
    fields.forEach((f) => { empty[f.key] = f.type === "select" ? f.options[0] : ""; });
    setDraft(empty);
    setEditingIndex(-1);
  }
  function startEdit(i) {
    setDraft({ ...items[i] });
    setEditingIndex(i);
  }
  function cancel() { setEditingIndex(null); setDraft({}); }
  function saveItem() {
    const next = editingIndex === -1 ? [...items, draft] : items.map((it, i) => (i === editingIndex ? draft : it));
    onChange(next);
    cancel();
  }
  function remove(i) {
    if (!confirm("Delete this entry?")) return;
    onChange(items.filter((_, idx) => idx !== i));
  }
  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
        {editingIndex === null && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={startAdd}>+ Add</button>}
      </div>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {items.map((item, i) =>
          editingIndex === i ? (
            <ItemForm key={i} fields={fields} draft={draft} setDraft={setDraft} onSave={saveItem} onCancel={cancel} />
          ) : (
            <div key={i} className="card" style={{ padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 13, flex: 1 }}>{renderSummary(item)}</div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 6px" }} onClick={() => move(i, -1)}>↑</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 6px" }} onClick={() => move(i, 1)}>↓</button>
                <button className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={() => startEdit(i)}>Edit</button>
                <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 11 }} onClick={() => remove(i)}>Delete</button>
              </div>
            </div>
          )
        )}
        {editingIndex === -1 && <ItemForm fields={fields} draft={draft} setDraft={setDraft} onSave={saveItem} onCancel={cancel} />}
        {items.length === 0 && editingIndex === null && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>None added yet.</p>}
      </div>
    </div>
  );
}

function ItemForm({ fields, draft, setDraft, onSave, onCancel }) {
  return (
    <div className="card" style={{ padding: 12, background: "#FBFAF6" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
        {fields.map((f) => (
          <div key={f.key} style={{ gridColumn: f.wide ? "1 / -1" : undefined }}>
            <label style={labelStyle}>{f.label}</label>
            {f.type === "textarea" ? (
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={draft[f.key] || ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            ) : f.type === "select" ? (
              <select style={inputStyle} value={draft[f.key] || ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}>
                {f.options.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : (
              <input style={inputStyle} value={draft[f.key] || ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
            )}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={onSave}>Save</button>
        <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function ResumePreview({ resume, accent }) {
  const education = resume.education || [], skills = resume.skills || [], projects = resume.projects || [];
  const experience = resume.experience || [], certifications = resume.certifications || [], achievements = resume.achievements || [], languages = resume.languages || [];
  const skillsByCategory = {};
  for (const s of skills) (skillsByCategory[s.category || "Other"] = skillsByCategory[s.category || "Other"] || []).push(s);

  return (
    <div style={{ width: 700, minHeight: 900, background: "#fff", padding: 40, fontFamily: "var(--font-body)", color: "#1C1B18", boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", color: accent, margin: 0, fontSize: 28 }}>{resume.fullName || "Your Name"}</h1>
      <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>{[resume.email, resume.mobile, resume.address].filter(Boolean).join("   |   ")}</div>
      <div style={{ fontSize: 12, color: "#555" }}>{[resume.linkedin, resume.github, resume.portfolio].filter(Boolean).join("   |   ")}</div>
      <div style={{ height: 2, background: accent, marginTop: 10, marginBottom: 14 }} />

      {resume.summary && <PreviewSection title="Professional Summary" accent={accent}><p style={{ fontSize: 13, margin: 0 }}>{resume.summary}</p></PreviewSection>}

      {education.length > 0 && (
        <PreviewSection title="Education" accent={accent}>
          {education.map((e, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.degree}{e.specialization ? ` in ${e.specialization}` : ""}</div>
              <div style={{ fontSize: 12 }}>{e.institution}{e.board ? ` (${e.board})` : ""}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{e.startYear} – {e.endYear || e.status}{e.score ? ` · ${e.score}` : ""}</div>
            </div>
          ))}
        </PreviewSection>
      )}

      {skills.length > 0 && (
        <PreviewSection title="Skills" accent={accent}>
          {Object.entries(skillsByCategory).map(([cat, list]) => (
            <div key={cat} style={{ fontSize: 12, marginBottom: 3 }}><strong>{cat}:</strong> {list.map((s) => s.proficiency ? `${s.name} (${s.proficiency})` : s.name).join(", ")}</div>
          ))}
        </PreviewSection>
      )}

      {projects.length > 0 && (
        <PreviewSection title="Projects" accent={accent}>
          {projects.map((p, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{p.title}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{[p.role, p.duration].filter(Boolean).join(" · ")}</div>
              {p.description && <div style={{ fontSize: 12 }}>{p.description}</div>}
              {p.technologies && <div style={{ fontSize: 11, color: "#666" }}>Tech: {p.technologies}</div>}
            </div>
          ))}
        </PreviewSection>
      )}

      {experience.length > 0 && (
        <PreviewSection title="Experience" accent={accent}>
          {experience.map((e, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{e.title}{e.company ? ` — ${e.company}` : ""}</div>
              <div style={{ fontSize: 11, color: "#666" }}>{[e.employmentType, [e.startDate, e.endDate].filter(Boolean).join(" – ")].filter(Boolean).join(" · ")}</div>
              {e.responsibilities && <div style={{ fontSize: 12 }}>{e.responsibilities}</div>}
            </div>
          ))}
        </PreviewSection>
      )}

      {certifications.length > 0 && (
        <PreviewSection title="Certifications" accent={accent}>
          {certifications.map((c, i) => <div key={i} style={{ fontSize: 12, marginBottom: 4 }}>{c.name} — {c.org} <span style={{ color: "#666" }}>({c.issueDate})</span></div>)}
        </PreviewSection>
      )}

      {achievements.length > 0 && (
        <PreviewSection title="Achievements" accent={accent}>
          {achievements.map((a, i) => <div key={i} style={{ fontSize: 12, marginBottom: 3 }}>• {a.text}</div>)}
        </PreviewSection>
      )}

      {languages.length > 0 && (
        <PreviewSection title="Languages" accent={accent}>
          <div style={{ fontSize: 12 }}>{languages.map((l) => `${l.name} (${l.proficiency})`).join(", ")}</div>
        </PreviewSection>
      )}
    </div>
  );
}

function PreviewSection({ title, accent, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: accent, textTransform: "uppercase", letterSpacing: "0.03em", borderBottom: "1px solid #ccc", paddingBottom: 3, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

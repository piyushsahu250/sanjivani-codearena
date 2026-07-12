import { useEffect, useRef, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const inputStyle = { width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, marginTop: 4 };
const labelStyle = { fontSize: 11, fontWeight: 600, color: "var(--ink-dim)" };
const SECTION_LABELS = { personal: "Personal Details", summary: "Professional Summary", education: "Education", skills: "Skills", projects: "Projects", experience: "Experience", certifications: "Certifications" };

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
  { key: "description", label: "Description", type: "textarea", wide: true, improvable: "project" },
  { key: "technologies", label: "Technologies Used" }, { key: "role", label: "Role" }, { key: "duration", label: "Duration" },
  { key: "githubUrl", label: "GitHub Repository Link" }, { key: "liveUrl", label: "Live Demo Link (optional)" },
];
const EXPERIENCE_FIELDS = [
  { key: "company", label: "Company Name" }, { key: "title", label: "Job Title" },
  { key: "employmentType", label: "Employment Type", type: "select", options: ["Internship", "Full-Time", "Freelance", "Research Project"] },
  { key: "startDate", label: "Start Date" }, { key: "endDate", label: "End Date" },
  { key: "responsibilities", label: "Responsibilities", type: "textarea", wide: true, improvable: "experience" },
  { key: "technologies", label: "Technologies Used" },
];
const CERT_FIELDS = [
  { key: "name", label: "Certification Name" }, { key: "org", label: "Issuing Organization" },
  { key: "issueDate", label: "Issue Date" }, { key: "expiryDate", label: "Expiry Date (optional)" },
  { key: "credentialId", label: "Credential ID" }, { key: "credentialUrl", label: "Credential URL" },
];
const ACHIEVEMENT_FIELDS = [
  { key: "category", label: "Category", type: "select", options: ["Award", "Hackathon", "Contest Ranking", "Scholarship", "Academic", "Open Source"] },
  { key: "text", label: "Description", type: "textarea", wide: true, improvable: "achievement" },
];
const LANGUAGE_FIELDS = [
  { key: "name", label: "Language" },
  { key: "proficiency", label: "Proficiency", type: "select", options: ["Beginner", "Intermediate", "Fluent", "Native"] },
];

export default function ResumeBuilder() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [ats, setAts] = useState(null);
  const [scoreDelta, setScoreDelta] = useState(null);
  const [checkingAts, setCheckingAts] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [zoom, setZoom] = useState(85);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [lowConfidenceFields, setLowConfidenceFields] = useState([]);
  const [undoUploadVersionId, setUndoUploadVersionId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);
  const fileInputRef = useRef(null);

  function load() {
    api.get("/resume/me").then((res) => setData(res.data)).catch(() => setError("Failed to load resume"));
  }
  useEffect(load, []);

  async function save(patch) {
    const { data: res } = await api.patch("/resume/me", patch);
    setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
    setAts(res.atsScore);
    setScoreDelta(res.scoreDelta);
    // Once the student has touched a section themselves, the parser's original confidence
    // score no longer applies to it — clear that section's "please review" flag.
    const touchedConfidenceKeys = new Set(
      Object.keys(patch).map((k) => (["fullName", "email", "mobile", "linkedin", "github", "portfolio", "address"].includes(k) ? "personal" : k))
    );
    setLowConfidenceFields((prev) => prev.filter((f) => !touchedConfidenceKeys.has(f)));
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

  async function downloadDocx() {
    setDownloadingDocx(true);
    try {
      const { data: blob } = await api.get("/resume/me/docx", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${data.resume.fullName || "resume"}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to download DOCX");
    } finally {
      setDownloadingDocx(false);
    }
  }

  async function handleFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert("File is too large. Maximum size is 10 MB.");
      e.target.value = "";
      return;
    }
    const ext = file.name.toLowerCase().split(".").pop();
    if (!["pdf", "docx"].includes(ext)) {
      alert("Please upload a .pdf or .docx file.");
      e.target.value = "";
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setUploadProgress(0);
    try {
      const { data: res } = await api.post("/resume/me/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (evt) => setUploadProgress(evt.total ? Math.round((evt.loaded / evt.total) * 100) : null),
      });
      setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
      setAts(res.atsScore);
      setScoreDelta(null);
      setLowConfidenceFields(res.lowConfidenceFields || []);
      setUndoUploadVersionId(res.previousVersionId || null);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to upload and parse this resume");
    } finally {
      setUploadProgress(null);
      e.target.value = "";
    }
  }

  async function undoUpload() {
    if (!undoUploadVersionId) return;
    try {
      const { data: res } = await api.post(`/resume/me/versions/${undoUploadVersionId}/restore`);
      setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
      setAts(res.atsScore);
      setScoreDelta(null);
      setLowConfidenceFields([]);
      setUndoUploadVersionId(null);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to undo the upload");
    }
  }

  async function clearAll() {
    if (!confirm("Clear ALL resume data? Your current state is saved to Version History first, so this can be undone.")) return;
    setClearingAll(true);
    try {
      const { data: res } = await api.post("/resume/me/clear-all");
      setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
      setAts(res.atsScore);
      setScoreDelta(null);
      setLowConfidenceFields([]);
      setUndoUploadVersionId(null);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to clear resume data");
    } finally {
      setClearingAll(false);
    }
  }

  async function clearSection(section) {
    if (!confirm(`Clear this section? Your current state is saved to Version History first, so this can be undone.`)) return;
    try {
      const { data: res } = await api.post("/resume/me/clear-section", { section });
      setData((d) => ({ ...d, resume: res.resume, completion: res.completion }));
      setAts(res.atsScore);
      setLowConfidenceFields((prev) => prev.filter((f) => f !== section));
    } catch (err) {
      alert(err.response?.data?.error || "Failed to clear this section");
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
            <input ref={fileInputRef} type="file" accept=".pdf,.docx" style={{ display: "none" }} onChange={handleFileSelected} />
            <button className="btn btn-ghost" onClick={() => fileInputRef.current?.click()} disabled={uploadProgress !== null}>
              {uploadProgress !== null ? `Uploading… ${uploadProgress}%` : "📤 Upload Existing Resume"}
            </button>
            <button className="btn btn-ghost" onClick={runAutofill} disabled={autofilling}>{autofilling ? "Filling…" : "✨ Auto-fill from Platform"}</button>
            <button className="btn btn-ghost" onClick={() => window.print()}>🖨 Print</button>
            <button className="btn btn-ghost" onClick={downloadDocx} disabled={downloadingDocx}>{downloadingDocx ? "Preparing…" : "⬇ Download DOCX"}</button>
            <button className="btn btn-primary" onClick={downloadPdf} disabled={downloading}>{downloading ? "Preparing…" : "⬇ Download PDF"}</button>
            <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={clearAll} disabled={clearingAll}>
              {clearingAll ? "Clearing…" : "🗑 Clear All Resume Data"}
            </button>
          </div>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 6 }}>
          Supported upload formats: .pdf, .docx (max 10 MB). Uploading replaces the fields below with what's extracted — review and edit afterward.
        </p>

        {lowConfidenceFields.length > 0 && (
          <div className="card" style={{ padding: 16, marginTop: 16, background: "#FCEFD9", borderLeft: "4px solid var(--amber-dark)" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              Some information could not be extracted with high confidence. Please review and update the highlighted sections below.
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
              Lower-confidence sections: {lowConfidenceFields.map((f) => SECTION_LABELS[f] || f).join(", ")}
            </div>
            {undoUploadVersionId && (
              <button className="btn btn-ghost" style={{ marginTop: 10, fontSize: 12 }} onClick={undoUpload}>
                ↩ Undo this upload (restore what was here before)
              </button>
            )}
          </div>
        )}
        {!lowConfidenceFields.length && undoUploadVersionId && (
          <div className="card" style={{ padding: 12, marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "var(--mint)" }}>✓ Resume parsed with high confidence across all sections.</span>
            <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={undoUpload}>↩ Undo this upload</button>
          </div>
        )}

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

                  {scoreDelta && (
                    <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: scoreDelta.overall >= 0 ? "#E7F3EB" : "#F7E4E0" }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 700, color: scoreDelta.overall >= 0 ? "var(--mint)" : "var(--rust)" }}>
                        {scoreDelta.previous} → {scoreDelta.current} ({scoreDelta.overall >= 0 ? "+" : ""}{scoreDelta.overall})
                      </div>
                      {scoreDelta.byCategory.length > 0 && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ fontSize: 11, fontWeight: 600 }}>What changed</div>
                          {scoreDelta.byCategory.map((c, i) => (
                            <div key={i} style={{ fontSize: 11, color: c.delta >= 0 ? "var(--mint)" : "var(--rust)" }}>
                              {c.label} {c.delta >= 0 ? "+" : ""}{c.delta}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Section breakdown</div>
                    {ats.breakdown.map((b) => (
                      <div key={b.key} style={{ marginBottom: 4 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                          <span>{b.label}</span>
                          <span className="mono">{b.score}/{b.max}</span>
                        </div>
                        <div style={{ height: 5, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(b.score / b.max) * 100}%`, background: b.score === b.max ? "var(--mint)" : "var(--amber-dark)" }} />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Suggestions</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {ats.suggestions.map((s, i) => (
                        <div key={i} style={{ fontSize: 12 }}>
                          <div style={{ color: "var(--rust)" }}>❌ {s.issue}</div>
                          <div style={{ color: "var(--ink-dim)", marginTop: 1 }}>→ {s.recommendation}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <TargetRoleCard resume={resume} onRoleChange={(targetRole) => setData((d) => ({ ...d, resume: { ...d.resume, targetRole } }))} />

            <VersionHistoryCard onRestore={(res) => { setData((d) => ({ ...d, resume: res.resume, completion: res.completion })); setAts(res.atsScore); setScoreDelta(null); }} />

            {/* Personal details */}
            <PersonalDetailsForm resume={resume} onSave={save} lowConfidence={lowConfidenceFields.includes("personal") || lowConfidenceFields.includes("summary")} />

            <ArraySectionEditor title="Education" items={resume.education || []} fields={EDUCATION_FIELDS}
              onChange={(items) => save({ education: items })}
              onClear={() => clearSection("education")}
              lowConfidence={lowConfidenceFields.includes("education")}
              renderSummary={(e) => `${e.degree || "—"}${e.specialization ? ` (${e.specialization})` : ""} — ${e.institution || "—"}`} />

            <ArraySectionEditor title="Skills" items={resume.skills || []} fields={SKILL_FIELDS}
              onChange={(items) => save({ skills: items })}
              onClear={() => clearSection("skills")}
              lowConfidence={lowConfidenceFields.includes("skills")}
              renderSummary={(s) => `${s.name || "—"} — ${s.category || "Other"} (${s.proficiency || "—"})`} />

            <ArraySectionEditor title="Projects" items={resume.projects || []} fields={PROJECT_FIELDS}
              onChange={(items) => save({ projects: items })}
              onClear={() => clearSection("projects")}
              lowConfidence={lowConfidenceFields.includes("projects")}
              renderSummary={(p) => `${p.title || "—"}${p.role ? ` — ${p.role}` : ""}`} />

            <ArraySectionEditor title="Experience" items={resume.experience || []} fields={EXPERIENCE_FIELDS}
              onChange={(items) => save({ experience: items })}
              onClear={() => clearSection("experience")}
              lowConfidence={lowConfidenceFields.includes("experience")}
              renderSummary={(e) => `${e.title || "—"} at ${e.company || "—"} (${e.employmentType || "—"})`} />

            <ArraySectionEditor title="Certifications" items={resume.certifications || []} fields={CERT_FIELDS}
              onChange={(items) => save({ certifications: items })}
              onClear={() => clearSection("certifications")}
              lowConfidence={lowConfidenceFields.includes("certifications")}
              renderSummary={(c) => `${c.name || "—"} — ${c.org || "—"}`} />

            <ArraySectionEditor title="Achievements" items={resume.achievements || []} fields={ACHIEVEMENT_FIELDS}
              onChange={(items) => save({ achievements: items })}
              onClear={() => clearSection("achievements")}
              renderSummary={(a) => `[${a.category || "—"}] ${a.text || "—"}`} />

            <ArraySectionEditor title="Languages" items={resume.languages || []} fields={LANGUAGE_FIELDS}
              onChange={(items) => save({ languages: items })}
              onClear={() => clearSection("languages")}
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

function PersonalDetailsForm({ resume, onSave, lowConfidence }) {
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
    <div className="card" style={{ padding: 16, border: lowConfidence ? "2px solid var(--amber-dark)" : undefined }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Personal Details</div>
        {lowConfidence && <span className="badge" style={{ background: "#FCEFD9", color: "var(--amber-dark)", fontSize: 11 }}>Please review</span>}
      </div>
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
        <ImproveButton text={form.summary} section="summary" onApply={(improved) => setForm((f) => ({ ...f, summary: improved }))} />
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

function ArraySectionEditor({ title, items, fields, onChange, renderSummary, onClear, lowConfidence }) {
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
    <div className="card" style={{ padding: 16, border: lowConfidence ? "2px solid var(--amber-dark)" : undefined }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
          {lowConfidence && <span className="badge" style={{ background: "#FCEFD9", color: "var(--amber-dark)", fontSize: 11 }}>Please review</span>}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {editingIndex === null && items.length > 0 && onClear && (
            <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 12 }} onClick={() => { if (confirm(`Clear all ${title}?`)) onClear(); }}>
              Clear section
            </button>
          )}
          {editingIndex === null && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={startAdd}>+ Add</button>}
        </div>
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
              <>
                <textarea style={{ ...inputStyle, minHeight: 60 }} value={draft[f.key] || ""} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
                {f.improvable && (
                  <ImproveButton text={draft[f.key]} section={f.improvable} onApply={(improved) => setDraft({ ...draft, [f.key]: improved })} />
                )}
              </>
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

// Rule-based rewrite suggestion (weak-verb replacement, grammar cleanup, quantify-impact
// prompts) — not a real LLM call, but labeled "Improve with AI" per how this is meant to read to
// students, consistent with how the rest of this platform handles "AI" features.
function ImproveButton({ text, section, onApply }) {
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  async function run() {
    if (!text || !text.trim()) return alert("Add some text first.");
    setLoading(true);
    setSuggestion(null);
    try {
      const { data } = await api.post("/resume/me/improve", { text, section });
      setSuggestion(data);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to generate improvement");
    } finally {
      setLoading(false);
    }
  }

  function accept() {
    onApply(suggestion.improved);
    setSuggestion(null);
  }

  return (
    <div style={{ marginTop: 6 }}>
      <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 8px" }} onClick={run} disabled={loading}>
        {loading ? "Improving…" : "✨ Improve with AI"}
      </button>
      {suggestion && (
        <div className="card" style={{ padding: 10, marginTop: 6, background: "#FBFAF6", fontSize: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Suggested rewrite</div>
          <div style={{ marginBottom: 6, whiteSpace: "pre-wrap" }}>{suggestion.improved}</div>
          <ul style={{ paddingLeft: 16, margin: "0 0 8px", color: "var(--ink-dim)" }}>
            {suggestion.changes.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button" className="btn btn-primary" style={{ fontSize: 11, padding: "3px 10px" }} onClick={accept}>Accept</button>
            <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: "3px 10px" }} onClick={() => setSuggestion(null)}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Job-Specific Optimization: pick a target role, see keyword/skill gaps against a fixed
// per-role dictionary (not a real embedding-similarity model — same rule-based approach as the
// rest of the ATS engine).
function TargetRoleCard({ resume, onRoleChange }) {
  const [roles, setRoles] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/resume/job-roles").then((res) => setRoles(res.data)); }, []);

  useEffect(() => {
    if (!resume.targetRole) { setAnalysis(null); return; }
    setLoading(true);
    api.get("/resume/me/role-analysis").then((res) => setAnalysis(res.data)).catch(() => setAnalysis(null)).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resume.targetRole]);

  async function selectRole(role) {
    setLoading(true);
    try {
      const { data } = await api.patch("/resume/me/target-role", { role: role || null });
      onRoleChange(data.resume.targetRole);
      setAnalysis(data.roleAnalysis);
    } catch (err) {
      alert(err.response?.data?.error || "Failed to set target role");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Job-Specific Optimization</div>
      <select style={inputStyle} value={resume.targetRole || ""} onChange={(e) => selectRole(e.target.value)}>
        <option value="">Select a target role…</option>
        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
      </select>
      {loading && <p className="mono" style={{ fontSize: 11, marginTop: 8 }}>Loading…</p>}
      {analysis && !loading && (
        <div style={{ marginTop: 10 }}>
          <div className="mono" style={{ fontSize: 12, fontWeight: 700 }}>{analysis.matchPercent}% keyword match for {analysis.role}</div>
          {analysis.missingKeywords.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Missing keywords</div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{analysis.missingKeywords.join(", ")}</div>
            </div>
          )}
          {analysis.recommendedSkills.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Recommended skills to add</div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{analysis.recommendedSkills.join(", ")}</div>
            </div>
          )}
          {analysis.summaryTip && <p style={{ fontSize: 12, marginTop: 6 }}>{analysis.summaryTip}</p>}
          {analysis.relevantProjects.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, fontWeight: 600 }}>Most relevant projects</div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{analysis.relevantProjects.join(", ")}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Version history — auto-saved on every resume save (capped at the 20 most recent server-side).
// "Compare" fetches two full snapshots client-side and diffs just the ATS score; the snapshots
// themselves are visible via Restore if a student wants to inspect one in full.
function VersionHistoryCard({ onRestore }) {
  const [versions, setVersions] = useState([]);
  const [compareIds, setCompareIds] = useState([]);
  const [compareResult, setCompareResult] = useState(null);

  function load() { api.get("/resume/me/versions").then((res) => setVersions(res.data)); }
  useEffect(load, []);

  async function restore(id) {
    if (!confirm("Restore this version? Your current state is saved first, so this can be undone.")) return;
    try {
      const { data } = await api.post(`/resume/me/versions/${id}/restore`);
      onRestore(data);
      load();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to restore this version");
    }
  }

  function toggleCompare(id) {
    setCompareResult(null);
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : [prev[1], id]));
  }

  async function runCompare() {
    if (compareIds.length !== 2) return;
    const [a, b] = await Promise.all(compareIds.map((id) => api.get(`/resume/me/versions/${id}`)));
    const [older, newer] = [a.data, b.data].sort((x, y) => new Date(x.createdAt) - new Date(y.createdAt));
    setCompareResult({ older, newer });
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 600 }}>Version History</div>
        {compareIds.length === 2 && <button className="btn btn-ghost" style={{ fontSize: 11 }} onClick={runCompare}>Compare selected</button>}
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 10, maxHeight: 220, overflowY: "auto" }}>
        {versions.map((v) => (
          <div key={v.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input type="checkbox" checked={compareIds.includes(v.id)} onChange={() => toggleCompare(v.id)} />
              <span className="mono">{new Date(v.createdAt).toLocaleString()}</span> — {v.atsScore}/100
            </label>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => restore(v.id)}>Restore</button>
          </div>
        ))}
        {versions.length === 0 && <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>No saved versions yet — one is captured automatically each time you save.</p>}
      </div>
      {compareResult && (
        <div style={{ marginTop: 10, fontSize: 12, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
          <div>Older ({new Date(compareResult.older.createdAt).toLocaleString()}): <strong>{compareResult.older.atsScore}/100</strong></div>
          <div>Newer ({new Date(compareResult.newer.createdAt).toLocaleString()}): <strong>{compareResult.newer.atsScore}/100</strong></div>
          <div style={{ marginTop: 4, fontWeight: 700, color: compareResult.newer.atsScore >= compareResult.older.atsScore ? "var(--mint)" : "var(--rust)" }}>
            {compareResult.newer.atsScore - compareResult.older.atsScore >= 0 ? "+" : ""}{compareResult.newer.atsScore - compareResult.older.atsScore} point difference
          </div>
        </div>
      )}
    </div>
  );
}

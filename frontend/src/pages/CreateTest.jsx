import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";

const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };

const emptyForm = { title: "", code: "", description: "", instructions: "", durationMin: 60, passingMarks: "", showResults: true, startTime: "", endTime: "" };

function toLocalInputValue(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateTest() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [classes, setClasses] = useState([]);
  const [classIds, setClassIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [showBankModal, setShowBankModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);

  useEffect(() => {
    api.get("/classes").then((res) => setClasses(res.data));
  }, []);

  useEffect(() => {
    api.get("/questions", { params: search ? { q: search } : {} }).then((res) => setQuestions(res.data));
  }, [search]);

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/tests/${id}`).then((res) => {
      const t = res.data;
      setForm({
        title: t.title || "", code: t.code || "", description: t.description || "",
        instructions: t.instructions || "", durationMin: t.durationMin, passingMarks: t.passingMarks ?? "",
        showResults: t.showResults, startTime: toLocalInputValue(t.startTime), endTime: toLocalInputValue(t.endTime),
      });
      setClassIds((t.classes || []).map((c) => c.classId));
      const qIds = t.questions.map((tq) => tq.question.id);
      setSelected(qIds);
      setQuestions((prev) => {
        const known = new Set(prev.map((q) => q.id));
        const extra = t.questions.map((tq) => tq.question).filter((q) => !known.has(q.id));
        return [...extra, ...prev];
      });
      setLoading(false);
    });
  }, [id, isEdit]);

  function toggle(qId) {
    setSelected((prev) => (prev.includes(qId) ? prev.filter((id2) => id2 !== qId) : [...prev, qId]));
  }

  // Merges questions discovered while browsing the bank modal (which may fetch questions the
  // page's own `questions` list hasn't loaded, e.g. from a different folder) so totalMarks and
  // the submit payload always resolve every selected id to real data, regardless of where it was
  // found.
  function mergeQuestions(found) {
    setQuestions((prev) => {
      const known = new Set(prev.map((q) => q.id));
      const extra = found.filter((q) => !known.has(q.id));
      return extra.length ? [...prev, ...extra] : prev;
    });
  }

  function toggleClass(classId) {
    setClassIds((prev) => (prev.includes(classId) ? prev.filter((c) => c !== classId) : [...prev, classId]));
  }

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  const totalMarks = selected.reduce((sum, qId) => {
    const q = questions.find((qq) => qq.id === qId);
    return sum + (q?.points || 0);
  }, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return alert("Select at least one question");
    setSaving(true);
    try {
      const payload = {
        ...form,
        durationMin: Number(form.durationMin),
        passingMarks: form.passingMarks === "" ? "" : Number(form.passingMarks),
        startTime: new Date(form.startTime).toISOString(),
        endTime: new Date(form.endTime).toISOString(),
        questionIds: selected,
        classIds,
      };
      if (isEdit) {
        await api.patch(`/tests/${id}`, payload);
      } else {
        await api.post("/tests", payload);
      }
      navigate("/staff");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save test");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div><Navbar /><div style={{ maxWidth: 720, margin: "0 auto", padding: 48 }}>Loading…</div></div>;

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{isEdit ? "Edit test" : "New test"}</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Title</label>
          <input style={inputStyle} required value={form.title} onChange={updateField("title")} />

          <label style={labelStyle}>Test code (optional)</label>
          <input style={inputStyle} value={form.code} onChange={updateField("code")} placeholder="e.g. MCA-DS-MID1" />

          <label style={labelStyle}>Description</label>
          <textarea style={{ ...inputStyle, minHeight: 80 }} value={form.description} onChange={updateField("description")} />

          <label style={labelStyle}>Instructions for students (optional)</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.instructions} onChange={updateField("instructions")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Duration (min)</label>
              <input style={inputStyle} type="number" value={form.durationMin} onChange={updateField("durationMin")} />
            </div>
            <div>
              <label style={labelStyle}>Start time</label>
              <input style={inputStyle} type="datetime-local" required value={form.startTime} onChange={updateField("startTime")} />
            </div>
            <div>
              <label style={labelStyle}>End time</label>
              <input style={inputStyle} type="datetime-local" required value={form.endTime} onChange={updateField("endTime")} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Passing marks (optional)</label>
              <input style={inputStyle} type="number" value={form.passingMarks} onChange={updateField("passingMarks")} placeholder={`Total: ${totalMarks}`} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <input type="checkbox" checked={form.showResults} onChange={(e) => setForm({ ...form, showResults: e.target.checked })} />
                Show results to students after submission
              </label>
            </div>
          </div>

          <div style={{ marginTop: 20, fontWeight: 700, fontSize: 14 }}>Assign to classes</div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>Leave all unchecked to make this test visible to every class (default/legacy behavior).</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {classes.map((c) => (
              <label key={c.id} className="badge" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6, background: classIds.includes(c.id) ? "var(--amber)" : undefined }}>
                <input type="checkbox" checked={classIds.includes(c.id)} onChange={() => toggleClass(c.id)} />
                {c.institute?.name ? `${c.institute.name} · ` : ""}{c.name}
              </label>
            ))}
            {classes.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>No classes yet.</span>}
          </div>

          <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>
            Selected questions ({selected.length}) <span className="mono" style={{ fontWeight: 400, color: "var(--ink-dim)" }}>· Total marks: {totalMarks}</span>
          </div>
          {selected.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
              {selected.map((qId) => {
                const q = questions.find((qq) => qq.id === qId);
                return (
                  <span key={qId} className="badge" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {q?.title || q?.description?.slice(0, 30) || "(loading…)"}
                    <button type="button" onClick={() => toggle(qId)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: 0 }}>×</button>
                  </span>
                );
              })}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button type="button" className="btn btn-primary" onClick={() => setShowBankModal(true)}>📁 Add from Question Bank</button>
            <button type="button" className="btn btn-ghost" onClick={() => setShowBulkModal(true)}>⬆ Bulk Upload Questions</button>
          </div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>Add as many as you need — coding and quiz questions can be mixed. Candidates get the full test duration to split across all questions however they like, and can move between questions freely.</p>

          <div style={{ marginTop: 16, fontSize: 13, fontWeight: 600 }}>Quick add (recent questions)</div>
          <input
            style={{ ...inputStyle, marginTop: 8 }}
            placeholder="Search questions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={{ display: "grid", gap: 8, marginTop: 10, maxHeight: 280, overflowY: "auto" }}>
            {questions.map((q) => (
              <label key={q.id} className="card" style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, fontSize: 14 }}>
                <input type="checkbox" checked={selected.includes(q.id)} onChange={() => toggle(q.id)} />
                {q.title || "(untitled)"}
                <span className="badge">{TYPE_LABELS[q.questionType]}</span>
                <span className={`badge badge-${q.difficulty.toLowerCase()}`}>{q.difficulty}</span>
                <span className="mono" style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-dim)" }}>
                  {q.points} pts{q.questionType === "CODING" && q._count ? ` · ${q._count.testCases} cases` : ""}
                </span>
              </label>
            ))}
            {questions.length === 0 && <p style={{ color: "var(--ink-dim)" }}>No questions in the bank yet — create one first.</p>}
          </div>

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Create test"}
          </button>
        </form>
      </div>

      {showBankModal && (
        <QuestionBankPickerModal
          selected={selected}
          onToggle={toggle}
          onQuestionsSeen={mergeQuestions}
          onClose={() => setShowBankModal(false)}
        />
      )}
      {showBulkModal && (
        <BulkUploadModal
          onImported={(created) => {
            mergeQuestions(created);
            setSelected((prev) => [...prev, ...created.map((c) => c.id)]);
          }}
          onClose={() => setShowBulkModal(false)}
        />
      )}
    </div>
  );
}

// Folder-browser modal for "Add from Question Bank" — selections persist in the page's own
// `selected` state (via onToggle), so switching folders never loses what was already picked, and
// closing/reopening the modal (or navigating between folders repeatedly) keeps the running total.
function QuestionBankPickerModal({ selected, onToggle, onQuestionsSeen, onClose }) {
  const [folders, setFolders] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null); // null = folder list
  const [items, setItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    api.get("/questions/folders").then((res) => setFolders(res.data));
  }, []);

  useEffect(() => {
    if (!activeFolder) return;
    setLoadingItems(true);
    const params = { q: q || undefined };
    if (activeFolder.id === "__none__") params.folderId = "__none__";
    else if (activeFolder.id !== "__all__") params.folderId = activeFolder.id;
    api.get("/questions", { params }).then((res) => {
      setItems(res.data);
      onQuestionsSeen(res.data);
      setLoadingItems(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder, q]);

  return (
    <div className="ca-modal-overlay" onClick={onClose}>
      <div className="ca-modal" style={{ maxWidth: 640, maxHeight: "80vh", display: "flex", flexDirection: "column" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>{activeFolder ? activeFolder.name : "Question Bank Folders"}</h3>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <div className="mono" style={{ fontSize: 12, color: "var(--mint)", fontWeight: 700, marginTop: 6 }}>
          {selected.length} question{selected.length === 1 ? "" : "s"} selected so far
        </div>

        <div style={{ flex: 1, overflowY: "auto", marginTop: 14 }}>
          {!activeFolder ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10 }}>
              <button type="button" className="card" style={{ padding: 14, textAlign: "left", cursor: "pointer" }} onClick={() => setActiveFolder({ id: "__all__", name: "All Questions" })}>
                <div style={{ fontSize: 22 }}>📋</div>
                <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>All Questions</div>
              </button>
              <button type="button" className="card" style={{ padding: 14, textAlign: "left", cursor: "pointer" }} onClick={() => setActiveFolder({ id: "__none__", name: "Uncategorized" })}>
                <div style={{ fontSize: 22 }}>📂</div>
                <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>Uncategorized</div>
              </button>
              {folders === null && <p className="mono" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
              {folders?.map((f) => (
                <button type="button" key={f.id} className="card" style={{ padding: 14, textAlign: "left", cursor: "pointer" }} onClick={() => setActiveFolder(f)}>
                  <div style={{ fontSize: 22 }}>📁</div>
                  <div style={{ fontWeight: 700, marginTop: 4, fontSize: 13 }}>{f.name}</div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>{f._count.questions} question{f._count.questions === 1 ? "" : "s"}</div>
                </button>
              ))}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setActiveFolder(null)}>← Back to folders</button>
                <input style={{ ...inputStyle, flex: 1 }} placeholder="Search this folder…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
                {loadingItems && <p className="mono" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
                {!loadingItems && items.map((qq) => (
                  <label key={qq.id} className="card" style={{ padding: 10, display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <input type="checkbox" checked={selected.includes(qq.id)} onChange={() => onToggle(qq.id)} />
                    {qq.title || qq.description?.slice(0, 40) || "(untitled)"}
                    <span className="badge">{TYPE_LABELS[qq.questionType]}</span>
                    <span className="mono" style={{ marginLeft: "auto", fontSize: 11, color: "var(--ink-dim)" }}>{qq.points} pts</span>
                  </label>
                ))}
                {!loadingItems && items.length === 0 && <p style={{ color: "var(--ink-dim)", fontSize: 13 }}>No questions here yet.</p>}
              </div>
            </>
          )}
        </div>

        {activeFolder && (
          <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => setActiveFolder(null)}>
            Add Selected Questions — Back to Folders
          </button>
        )}
      </div>
    </div>
  );
}

// Bulk-upload modal — always creates real question rows (they must exist to attach to this
// test), the "save to bank" checkbox only controls whether they're filed into a folder for
// future reuse or left unfiled.
function BulkUploadModal({ onImported, onClose }) {
  const [file, setFile] = useState(null);
  const [saveToBank, setSaveToBank] = useState(true);
  const [folders, setFolders] = useState(null);
  const [folderId, setFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get("/questions/folders").then((res) => setFolders(res.data));
  }, []);

  async function downloadTemplate() {
    const res = await api.get("/questions/bulk-template", { responseType: "blob" });
    const url = URL.createObjectURL(res.data);
    const a = document.createElement("a");
    a.href = url; a.download = "question-bank-template.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setImporting(true);
    setResult(null);
    try {
      let targetFolderId = saveToBank ? folderId : "";
      if (saveToBank && !targetFolderId && newFolderName.trim()) {
        const { data: folder } = await api.post("/questions/folders", { name: newFolderName.trim() });
        targetFolderId = folder.id;
      }
      const formData = new FormData();
      formData.append("file", file);
      if (targetFolderId) formData.append("folderId", targetFolderId);
      const { data } = await api.post("/questions/bulk-import", formData);
      setResult(data);
      if (data.created?.length) onImported(data.created);
    } catch (err) {
      alert(err.response?.data?.error || "Bulk upload failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="ca-modal-overlay" onClick={onClose}>
      <div className="ca-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0 }}>Bulk Upload Questions</h3>
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 8 }}>
          Multiple Choice, True/False, and Multiple Select questions from an .xlsx/.csv file. Coding questions
          aren't supported via bulk upload — add those individually. Uploaded questions are added to this test
          immediately either way.
        </p>
        <button type="button" className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12 }} onClick={downloadTemplate}>⬇ Download template</button>

        <form onSubmit={handleUpload} style={{ marginTop: 14 }}>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginTop: 14 }}>
            <input type="checkbox" checked={saveToBank} onChange={(e) => setSaveToBank(e.target.checked)} />
            Save uploaded questions to Question Bank
          </label>

          {saveToBank && (
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              <select style={{ ...inputStyle, flex: 1 }} value={folderId} onChange={(e) => { setFolderId(e.target.value); setNewFolderName(""); }}>
                <option value="">Uncategorized (no folder)</option>
                {folders?.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <input
                style={{ ...inputStyle, flex: 1 }}
                placeholder="…or new folder name"
                value={newFolderName}
                onChange={(e) => { setNewFolderName(e.target.value); setFolderId(""); }}
              />
            </div>
          )}

          <button className="btn btn-primary" style={{ marginTop: 16, width: "100%" }} disabled={!file || importing}>
            {importing ? "Uploading…" : "Upload"}
          </button>
        </form>

        {result && (
          <div style={{ marginTop: 14 }}>
            <p style={{ fontSize: 13 }}>
              <strong>{result.createdCount}</strong> question{result.createdCount === 1 ? "" : "s"} created and added to
              this test, out of {result.total}.{result.errorCount > 0 && ` ${result.errorCount} failed.`}
            </p>
            {result.errors?.length > 0 && (
              <div style={{ marginTop: 6 }}>
                {result.errors.map((e, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--rust)" }} className="mono">Row {e.row}: {e.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

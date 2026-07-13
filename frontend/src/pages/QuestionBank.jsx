import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const TYPE_LABELS = { CODING: "Coding", MCQ: "Multiple Choice", TRUE_FALSE: "True/False", MULTISELECT: "Multiple Select" };

// activeFolder: null = folder-picker view; { id: "__all__", name: "All Questions" };
// { id: "__none__", name: "Uncategorized" }; or a real folder object { id, name, _count }.
export default function QuestionBank() {
  const [folders, setFolders] = useState(null);
  const [activeFolder, setActiveFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");

  const [questions, setQuestions] = useState([]);
  const [meta, setMeta] = useState({ subjects: [], topics: [] });
  const [q, setQ] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [questionType, setQuestionType] = useState("");
  const [loading, setLoading] = useState(true);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [showImport, setShowImport] = useState(false);

  function loadFolders() {
    api.get("/questions/folders").then((res) => setFolders(res.data));
  }
  useEffect(loadFolders, []);

  useEffect(() => {
    api.get("/questions/meta/filters").then((res) => setMeta(res.data));
  }, []);

  useEffect(() => {
    if (activeFolder) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, subject, topic, difficulty, questionType, activeFolder]);

  function load() {
    setLoading(true);
    const params = {};
    if (q) params.q = q;
    if (subject) params.subject = subject;
    if (topic) params.topic = topic;
    if (difficulty) params.difficulty = difficulty;
    if (questionType) params.questionType = questionType;
    if (activeFolder?.id === "__none__") params.folderId = "__none__";
    else if (activeFolder && activeFolder.id !== "__all__") params.folderId = activeFolder.id;
    api.get("/questions", { params }).then((res) => {
      setQuestions(res.data);
      setLoading(false);
    });
  }

  async function createFolder(e) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      await api.post("/questions/folders", { name: newFolderName.trim() });
      setNewFolderName("");
      loadFolders();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create folder");
    } finally {
      setCreatingFolder(false);
    }
  }

  async function renameFolder(id) {
    if (!renameValue.trim()) return;
    try {
      await api.patch(`/questions/folders/${id}`, { name: renameValue.trim() });
      setRenamingId(null);
      loadFolders();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to rename folder");
    }
  }

  async function deleteFolder(folder) {
    if (!confirm(`Delete "${folder.name}"? Its questions will be moved to Uncategorized, not deleted.`)) return;
    try {
      await api.delete(`/questions/folders/${folder.id}`);
      loadFolders();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete folder");
    }
  }

  async function handleDelete(question) {
    try {
      await api.delete(`/questions/${question.id}`);
      load();
      loadFolders();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete question");
    }
  }

  async function downloadFile(url, filename) {
    const params = { q, subject, topic, difficulty, questionType };
    if (activeFolder?.id === "__none__") params.folderId = "__none__";
    else if (activeFolder && activeFolder.id !== "__all__") params.folderId = activeFolder.id;
    const res = await api.get(url, { responseType: "blob", params });
    const blobUrl = URL.createObjectURL(res.data);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(blobUrl);
  }

  async function handleImport(e) {
    e.preventDefault();
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      if (activeFolder && activeFolder.id !== "__all__" && activeFolder.id !== "__none__") {
        formData.append("folderId", activeFolder.id);
      }
      const { data } = await api.post("/questions/bulk-import", formData);
      setImportResult(data);
      setImportFile(null);
      load();
      loadFolders();
    } catch (err) {
      alert(err.response?.data?.error || "Import failed");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Question Bank</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/staff" className="btn btn-ghost">← Staff control room</Link>
            <Link to="/staff/questions/new" className="btn btn-primary">+ Add question</Link>
          </div>
        </div>

        {!activeFolder ? (
          <>
            <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 20 }}>
              Question banks are private to your institute. Open a folder to browse its questions, or create a new one.
            </p>
            <form onSubmit={createFolder} style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <input
                style={{ ...inputStyle, flex: "0 1 260px" }}
                placeholder="New folder name (e.g. Java, DBMS Midterm)…"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
              <button className="btn btn-primary" disabled={!newFolderName.trim() || creatingFolder}>
                {creatingFolder ? "Creating…" : "+ New Folder"}
              </button>
            </form>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginTop: 20 }}>
              <FolderCard folder={{ id: "__all__", name: "📋 All Questions" }} onClick={() => setActiveFolder({ id: "__all__", name: "All Questions" })} />
              <FolderCard folder={{ id: "__none__", name: "📂 Uncategorized" }} onClick={() => setActiveFolder({ id: "__none__", name: "Uncategorized" })} />
              {folders === null && <p className="mono" style={{ color: "var(--ink-dim)" }}>Loading folders…</p>}
              {folders?.map((f) => (
                <div key={f.id} className="card" style={{ padding: 16 }}>
                  {renamingId === f.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input style={{ ...inputStyle, flex: 1, padding: "6px 8px" }} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus />
                      <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => renameFolder(f.id)}>Save</button>
                    </div>
                  ) : (
                    <>
                      <div onClick={() => setActiveFolder(f)} style={{ cursor: "pointer" }}>
                        <div style={{ fontSize: 28 }}>📁</div>
                        <div style={{ fontWeight: 700, marginTop: 6 }}>{f.name}</div>
                        <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{f._count.questions} question{f._count.questions === 1 ? "" : "s"}</div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => { setRenamingId(f.id); setRenameValue(f.name); }}>Rename</button>
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: "4px 8px", color: "var(--rust)" }} onClick={() => deleteFolder(f)}>Delete</button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <button className="btn btn-ghost" style={{ marginTop: 20 }} onClick={() => setActiveFolder(null)}>← Back to folders</button>
            <h3 style={{ fontSize: 16, marginTop: 12 }}>{activeFolder.name}</h3>

            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <input
                style={{ ...inputStyle, flex: "1 1 220px" }}
                placeholder="Search questions…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select style={selectStyle} value={subject} onChange={(e) => setSubject(e.target.value)}>
                <option value="">All subjects</option>
                {meta.subjects.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select style={selectStyle} value={topic} onChange={(e) => setTopic(e.target.value)}>
                <option value="">All topics</option>
                {meta.topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={selectStyle} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                <option value="">All difficulties</option>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
              <select style={selectStyle} value={questionType} onChange={(e) => setQuestionType(e.target.value)}>
                <option value="">All types</option>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn btn-ghost" onClick={() => downloadFile("/questions/export", "question-bank-export.xlsx")}>
                ⬇ Export ({questions.length})
              </button>
              <button className="btn btn-ghost" onClick={() => downloadFile("/questions/bulk-template", "question-bank-template.xlsx")}>
                ⬇ Download import template
              </button>
              <button className="btn btn-ghost" onClick={() => setShowImport((s) => !s)}>
                {showImport ? "Hide import" : "⬆ Bulk import (quiz types)"}
              </button>
            </div>

            {showImport && (
              <div className="card" style={{ padding: 20, marginTop: 12 }}>
                <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>
                  Import Multiple Choice, True/False, and Multiple Select questions from an .xlsx/.csv file. Coding
                  questions aren't supported via import — use "+ Add question" for those.
                  {activeFolder.id !== "__all__" && activeFolder.id !== "__none__" && ` Imported questions will be saved into "${activeFolder.name}".`}
                </p>
                <form onSubmit={handleImport} style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "center" }}>
                  <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setImportFile(e.target.files?.[0] || null)} />
                  <button className="btn btn-primary" disabled={!importFile || importing}>
                    {importing ? "Importing…" : "Import"}
                  </button>
                </form>
                {importResult && (
                  <div style={{ marginTop: 12 }}>
                    <p style={{ fontSize: 14 }}>
                      <strong>{importResult.createdCount}</strong> question{importResult.createdCount === 1 ? "" : "s"} created
                      out of {importResult.total}.{importResult.errorCount > 0 && ` ${importResult.errorCount} failed.`}
                    </p>
                    {importResult.errors.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        {importResult.errors.map((e, i) => (
                          <div key={i} style={{ fontSize: 12, color: "var(--rust)" }} className="mono">Row {e.row}: {e.reason}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
              {loading && <p className="mono" style={{ color: "var(--ink-dim)" }}>Loading…</p>}
              {!loading && questions.map((question) => (
                <div key={question.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <span className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>Q{question.questionNumber}</span>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{question.title || "(untitled)"}</span>
                      <span className="badge">{TYPE_LABELS[question.questionType]}</span>
                      <span className={`badge badge-${question.difficulty.toLowerCase()}`}>{question.difficulty}</span>
                    </div>
                    <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {[question.subject, question.topic].filter(Boolean).join(" · ") || "—"} · {question.description}
                    </p>
                  </div>
                  <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", whiteSpace: "nowrap" }}>
                    {question.points} marks{question.questionType === "CODING" ? ` · ${question._count.testCases} cases` : ""}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <Link to={`/staff/questions/${question.id}/edit`} className="btn btn-ghost">Edit</Link>
                    <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => handleDelete(question)}>Delete</button>
                  </div>
                </div>
              ))}
              {!loading && questions.length === 0 && (
                <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
                  No questions match. Try clearing filters, or add your first question.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FolderCard({ folder, onClick }) {
  return (
    <div className="card" style={{ padding: 16, cursor: "pointer" }} onClick={onClick}>
      <div style={{ fontSize: 28 }}>{folder.name.split(" ")[0]}</div>
      <div style={{ fontWeight: 700, marginTop: 6 }}>{folder.name.split(" ").slice(1).join(" ")}</div>
    </div>
  );
}

const inputStyle = { padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };
const selectStyle = { ...inputStyle, minWidth: 140 };

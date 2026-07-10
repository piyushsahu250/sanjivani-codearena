import { useEffect, useState } from "react";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

const inputStyle = { width: "100%", padding: "9px 11px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13, marginTop: 6 };
const labelStyle = { fontSize: 12, fontWeight: 600, color: "var(--ink-dim)", marginTop: 10, display: "block" };

// Admin/Staff content management for the Learning Module: drill down Course -> Module -> Lesson
// -> Practice Questions, all in one page since each level is a thin CRUD list.
export default function LearningManagement() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState(null);
  const [moduleId, setModuleId] = useState(null);
  const [lessonId, setLessonId] = useState(null);

  const [courseDetail, setCourseDetail] = useState(null); // { course, modules: [{...lessons}] }

  function loadCourses() {
    api.get("/learning/courses").then((res) => setCourses(res.data));
  }
  useEffect(loadCourses, []);

  function loadCourseDetail(slug) {
    api.get(`/learning/courses/${slug}`).then((res) => setCourseDetail(res.data));
  }
  useEffect(() => {
    if (!courseId) return setCourseDetail(null);
    const c = courses.find((c) => c.id === courseId);
    if (c) loadCourseDetail(c.slug);
  }, [courseId, courses]);

  const selectedCourse = courses.find((c) => c.id === courseId);
  const selectedModule = courseDetail?.modules.find((m) => m.id === moduleId);
  const selectedLesson = selectedModule?.lessons.find((l) => l.id === lessonId);

  function refresh() {
    if (selectedCourse) loadCourseDetail(selectedCourse.slug);
    loadCourses();
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Learning Management</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
          Manage courses, modules, lessons, and practice questions for the Learning module.
        </p>

        <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 20 }}>
          <span style={{ cursor: "pointer", textDecoration: courseId ? "underline" : "none" }} onClick={() => { setCourseId(null); setModuleId(null); setLessonId(null); }}>Courses</span>
          {selectedCourse && <> / <span style={{ cursor: "pointer", textDecoration: moduleId ? "underline" : "none" }} onClick={() => { setModuleId(null); setLessonId(null); }}>{selectedCourse.name}</span></>}
          {selectedModule && <> / <span style={{ cursor: "pointer", textDecoration: lessonId ? "underline" : "none" }} onClick={() => setLessonId(null)}>{selectedModule.title}</span></>}
          {selectedLesson && <> / {selectedLesson.title}</>}
        </div>

        {!courseId && <CoursePanel courses={courses} onSelect={setCourseId} onRefresh={loadCourses} />}
        {courseId && !moduleId && courseDetail && (
          <ModulePanel course={selectedCourse} modules={courseDetail.modules} onSelect={setModuleId} onRefresh={refresh} />
        )}
        {moduleId && !lessonId && selectedModule && (
          <LessonPanel mod={selectedModule} onSelect={setLessonId} onRefresh={refresh} />
        )}
        {lessonId && selectedLesson && (
          <LessonDetailPanel lessonId={lessonId} lessonSummary={selectedLesson} onRefresh={refresh} />
        )}
      </div>
    </div>
  );
}

function CoursePanel({ courses, onSelect, onRefresh }) {
  const [form, setForm] = useState({ slug: "", name: "", description: "" });
  const [saving, setSaving] = useState(false);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/learning/courses", form);
      setForm({ slug: "", name: "", description: "" });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create course");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(c) {
    await api.patch(`/learning/courses/${c.id}`, { isActive: !c.isActive });
    onRefresh();
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 24, marginTop: 20, alignItems: "start" }}>
      <form onSubmit={create} className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15 }}>Add course</h3>
        <label style={labelStyle}>Slug (URL id, e.g. "python")</label>
        <input style={inputStyle} required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <label style={labelStyle}>Name</label>
        <input style={inputStyle} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <label style={labelStyle}>Description</label>
        <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={saving}>{saving ? "Creating…" : "Create course"}</button>
      </form>

      <div style={{ display: "grid", gap: 10 }}>
        {courses.map((c) => (
          <div key={c.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ cursor: "pointer" }} onClick={() => onSelect(c.id)}>
              <div style={{ fontWeight: 600 }}>{c.name} <span className="mono" style={{ fontWeight: 400, fontSize: 12, color: "var(--ink-dim)" }}>/{c.slug}</span></div>
              <div style={{ fontSize: 12, color: "var(--ink-dim)" }}>{c.description}</div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="badge" style={{ background: c.isActive ? "#E7F3EB" : "#F0EEE3", color: c.isActive ? "var(--mint)" : "var(--ink-dim)" }}>
                {c.isActive ? "Active" : "Coming soon"}
              </span>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => toggleActive(c)}>
                {c.isActive ? "Deactivate" : "Activate"}
              </button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onSelect(c.id)}>Manage →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ModulePanel({ course, modules, onSelect, onRefresh }) {
  const [form, setForm] = useState({ title: "", description: "", order: modules.length });
  const [saving, setSaving] = useState(false);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/learning/courses/${course.id}/modules`, form);
      setForm({ title: "", description: "", order: modules.length + 1 });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create module");
    } finally {
      setSaving(false);
    }
  }

  async function remove(m) {
    if (!confirm(`Delete module "${m.title}" and all its lessons?`)) return;
    await api.delete(`/learning/modules/${m.id}`);
    onRefresh();
  }

  async function reorder(m, delta) {
    await api.patch(`/learning/modules/${m.id}`, { order: m.order + delta });
    onRefresh();
  }

  return (
    <div style={{ marginTop: 20 }}>
      <form onSubmit={create} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label style={labelStyle}>New module title</label>
          <input style={inputStyle} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div style={{ flex: "3 1 260px" }}>
          <label style={labelStyle}>Description</label>
          <input style={inputStyle} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "Add module"}</button>
      </form>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {modules.sort((a, b) => a.order - b.order).map((m, i) => (
          <div key={m.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ cursor: "pointer" }} onClick={() => onSelect(m.id)}>
              <div style={{ fontWeight: 600 }}>Module {i + 1}: {m.title}</div>
              <div className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>{m.totalCount} lesson{m.totalCount === 1 ? "" : "s"}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => reorder(m, -1)}>↑</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => reorder(m, 1)}>↓</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onSelect(m.id)}>Manage →</button>
              <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }} onClick={() => remove(m)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LessonPanel({ mod, onSelect, onRefresh }) {
  const [form, setForm] = useState({ title: "", estimatedMinutes: 10, order: mod.lessons.length });
  const [saving, setSaving] = useState(false);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post(`/learning/modules/${mod.id}/lessons`, form);
      setForm({ title: "", estimatedMinutes: 10, order: mod.lessons.length + 1 });
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to create lesson");
    } finally {
      setSaving(false);
    }
  }

  async function remove(l) {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    await api.delete(`/learning/lessons/${l.id}`);
    onRefresh();
  }

  async function reorder(l, delta) {
    await api.patch(`/learning/lessons/${l.id}`, { order: l.order + delta });
    onRefresh();
  }

  return (
    <div style={{ marginTop: 20 }}>
      <form onSubmit={create} className="card" style={{ padding: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label style={labelStyle}>New lesson title</label>
          <input style={inputStyle} required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div style={{ flex: "1 1 120px" }}>
          <label style={labelStyle}>Est. minutes</label>
          <input style={inputStyle} type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} />
        </div>
        <button className="btn btn-primary" disabled={saving}>{saving ? "Adding…" : "Add lesson"}</button>
      </form>

      <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
        {mod.lessons.sort((a, b) => a.order - b.order).map((l) => (
          <div key={l.id} className="card" style={{ padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ cursor: "pointer" }} onClick={() => onSelect(l.id)}>{l.title}</div>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => reorder(l, -1)}>↑</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 8px" }} onClick={() => reorder(l, 1)}>↓</button>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => onSelect(l.id)}>Edit →</button>
              <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }} onClick={() => remove(l)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fetches its own full lesson detail (content, video/pdf links, un-sanitized practice
// questions) since the course-tree summary the parent holds only has title/order/estimate —
// the CMS needs the real content to edit, which /learning/courses/:slug intentionally omits.
function LessonDetailPanel({ lessonId, lessonSummary, onRefresh }) {
  const [full, setFull] = useState(null);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  function load() {
    api.get(`/learning/lessons/${lessonId}`).then((res) => {
      setFull(res.data);
      const l = res.data.lesson;
      setForm({ title: l.title, content: l.content || "", videoUrl: l.videoUrl || "", pdfUrl: l.pdfUrl || "", estimatedMinutes: l.estimatedMinutes });
    });
  }
  useEffect(load, [lessonId]);

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/learning/lessons/${lessonId}`, form);
      load();
      onRefresh();
      alert("Lesson saved.");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save lesson");
    } finally {
      setSaving(false);
    }
  }

  if (!full || !form) return <p className="mono" style={{ marginTop: 20 }}>Loading…</p>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24, marginTop: 20, alignItems: "start" }}>
      <form onSubmit={save} className="card" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15 }}>Edit lesson</h3>
        <label style={labelStyle}>Title</label>
        <input style={inputStyle} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        <label style={labelStyle}>Content (HTML — headings, &lt;p&gt;, &lt;pre&gt;&lt;code&gt;, &lt;ul&gt;)</label>
        <textarea style={{ ...inputStyle, minHeight: 260, fontFamily: "var(--font-mono)", fontSize: 12 }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <label style={labelStyle}>Video URL (optional)</label>
        <input style={inputStyle} value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
        <label style={labelStyle}>PDF URL (optional)</label>
        <input style={inputStyle} value={form.pdfUrl} onChange={(e) => setForm({ ...form, pdfUrl: e.target.value })} />
        <label style={labelStyle}>Estimated minutes</label>
        <input style={inputStyle} type="number" min="1" value={form.estimatedMinutes} onChange={(e) => setForm({ ...form, estimatedMinutes: e.target.value })} />
        <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={saving}>{saving ? "Saving…" : "Save lesson"}</button>
      </form>

      <PracticeQuestionsPanel lesson={{ id: lessonId, questions: full.questions }} onRefresh={load} />
    </div>
  );
}

const EMPTY_Q = { type: "MCQ", prompt: "", options: ["", "", "", ""], correctAnswer: 0, explanation: "", starterCode: "", testCases: [{ input: "", expected: "" }], language: "java" };

function PracticeQuestionsPanel({ lesson, onRefresh }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_Q);
  const [saving, setSaving] = useState(false);

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, order: lesson.questions?.length || 0 };
      if (form.type !== "CODING") { payload.starterCode = undefined; payload.testCases = undefined; payload.language = undefined; }
      if (form.type !== "MCQ" && form.type !== "DEBUG" && form.type !== "OUTPUT_PREDICTION") payload.options = undefined;
      if (form.type === "FILL_BLANK") payload.correctAnswer = form.correctAnswer;
      await api.post(`/learning/lessons/${lesson.id}/questions`, payload);
      setForm(EMPTY_Q);
      setAdding(false);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to add question");
    } finally {
      setSaving(false);
    }
  }

  async function remove(q) {
    if (!confirm("Delete this practice question?")) return;
    await api.delete(`/learning/practice/${q.id}`);
    onRefresh();
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ fontSize: 15 }}>Practice questions</h3>
        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add"}</button>
      </div>

      <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
        {(lesson.questions || []).map((q) => (
          <div key={q.id} className="card" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13 }}>
            <div>
              <span className="badge">{q.type}</span>
              <div style={{ marginTop: 4 }}>{q.prompt}</div>
            </div>
            <button style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 12 }} onClick={() => remove(q)}>Delete</button>
          </div>
        ))}
        {(!lesson.questions || lesson.questions.length === 0) && <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No practice questions yet.</p>}
      </div>

      {adding && (
        <form onSubmit={create} style={{ marginTop: 16, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
          <label style={labelStyle}>Type</label>
          <select style={inputStyle} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            <option value="MCQ">Multiple Choice</option>
            <option value="DEBUG">Debugging (multiple choice)</option>
            <option value="OUTPUT_PREDICTION">Output Prediction (multiple choice)</option>
            <option value="FILL_BLANK">Fill in the Blank</option>
            <option value="CODING">Coding</option>
          </select>

          <label style={labelStyle}>Prompt</label>
          <textarea style={{ ...inputStyle, minHeight: 60 }} required value={form.prompt} onChange={(e) => setForm({ ...form, prompt: e.target.value })} />

          {(form.type === "MCQ" || form.type === "DEBUG" || form.type === "OUTPUT_PREDICTION") && (
            <>
              <label style={labelStyle}>Options (select the correct one)</label>
              {form.options.map((opt, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                  <input type="radio" checked={form.correctAnswer === i} onChange={() => setForm({ ...form, correctAnswer: i })} />
                  <input
                    style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                    value={opt}
                    onChange={(e) => { const opts = [...form.options]; opts[i] = e.target.value; setForm({ ...form, options: opts }); }}
                  />
                </div>
              ))}
            </>
          )}

          {form.type === "FILL_BLANK" && (
            <>
              <label style={labelStyle}>Correct answer</label>
              <input style={inputStyle} value={form.correctAnswer} onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} />
            </>
          )}

          {form.type === "CODING" && (
            <>
              <label style={labelStyle}>Starter code</label>
              <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "var(--font-mono)", fontSize: 12 }} value={form.starterCode} onChange={(e) => setForm({ ...form, starterCode: e.target.value })} />
              <label style={labelStyle}>Default language</label>
              <select style={inputStyle} value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                <option value="java">Java</option>
                <option value="javascript">JavaScript</option>
                <option value="python">Python</option>
                <option value="c">C</option>
                <option value="cpp">C++</option>
              </select>
              <label style={labelStyle}>Test cases</label>
              {form.testCases.map((tc, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  <input style={{ ...inputStyle, marginTop: 0 }} placeholder="input" value={tc.input} onChange={(e) => { const t = [...form.testCases]; t[i] = { ...t[i], input: e.target.value }; setForm({ ...form, testCases: t }); }} />
                  <input style={{ ...inputStyle, marginTop: 0 }} placeholder="expected output" value={tc.expected} onChange={(e) => { const t = [...form.testCases]; t[i] = { ...t[i], expected: e.target.value }; setForm({ ...form, testCases: t }); }} />
                </div>
              ))}
              <button type="button" className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setForm({ ...form, testCases: [...form.testCases, { input: "", expected: "" }] })}>+ Add test case</button>
            </>
          )}

          <label style={labelStyle}>Explanation (shown after answering)</label>
          <textarea style={{ ...inputStyle, minHeight: 50 }} value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} />

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 14 }} disabled={saving}>{saving ? "Adding…" : "Add question"}</button>
        </form>
      )}
    </div>
  );
}

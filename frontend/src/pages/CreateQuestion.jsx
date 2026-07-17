import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import FolderPicker from "../components/FolderPicker";

const QUESTION_TYPES = [
  { value: "CODING", label: "Coding" },
  { value: "MCQ", label: "Multiple Choice" },
  { value: "TRUE_FALSE", label: "True/False" },
  { value: "MULTISELECT", label: "Multiple Select" },
];

const SIGNATURE_TYPES = ["int", "long", "double", "boolean", "string", "int[]", "long[]", "double[]", "string[]", "boolean[]"];
const PREVIEW_LANGUAGES = [
  { id: "java", label: "Java" }, { id: "python", label: "Python" },
  { id: "cpp", label: "C++" }, { id: "javascript", label: "JavaScript" }, { id: "c", label: "C" },
];

const emptyForm = {
  title: "", subject: "", topic: "", description: "", questionType: "CODING",
  difficulty: "EASY", points: 10, explanation: "",
  timeLimitMs: 2000, memoryLimitKb: "", starterCode: "", tags: "",
  evaluationType: "STDIO",
};

const emptySignature = { methodName: "", returnType: "int", params: [{ name: "", type: "int" }] };

export default function CreateQuestion() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [testCases, setTestCases] = useState([{ input: "", expected: "", isHidden: false, explanation: "" }]);
  const [options, setOptions] = useState(["", ""]);
  const [correctIndices, setCorrectIndices] = useState([]);
  const [folderId, setFolderId] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [signature, setSignature] = useState(emptySignature);
  const [preview, setPreview] = useState(null); // { starterCodeByLanguage, supportedLanguages }
  const [previewLang, setPreviewLang] = useState("java");
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    if (!isEdit) return;
    api.get(`/questions/${id}`).then((res) => {
      const q = res.data;
      setForm({
        title: q.title || "", subject: q.subject || "", topic: q.topic || "",
        description: q.description || "", questionType: q.questionType,
        difficulty: q.difficulty, points: q.points, explanation: q.explanation || "",
        timeLimitMs: q.timeLimitMs ?? 2000, memoryLimitKb: q.memoryLimitKb ? Math.round(q.memoryLimitKb / 1024) : "",
        starterCode: q.starterCode || "", tags: Array.isArray(q.tags) ? q.tags.join(", ") : "",
        evaluationType: q.evaluationType || "STDIO",
      });
      if (q.functionSignature) setSignature(q.functionSignature);
      if (q.questionType === "CODING") {
        setTestCases(q.testCases?.length ? q.testCases.map((tc) => ({ input: tc.input, expected: tc.expected, isHidden: tc.isHidden, explanation: tc.explanation || "" })) : [{ input: "", expected: "", isHidden: false, explanation: "" }]);
      } else {
        setOptions(q.options?.length ? q.options : ["", ""]);
        setCorrectIndices(q.correctAnswer || []);
      }
      setFolderId(q.folderId || "");
      setLoading(false);
    });
  }, [id, isEdit]);

  function updateField(field) {
    return (e) => setForm({ ...form, [field]: e.target.value });
  }

  function updateCase(idx, field, value) {
    const next = [...testCases];
    next[idx] = { ...next[idx], [field]: value };
    setTestCases(next);
  }

  function addCase() {
    setTestCases([...testCases, { input: "", expected: "", isHidden: true, explanation: "" }]);
  }

  function removeCase(idx) {
    setTestCases(testCases.filter((_, i) => i !== idx));
  }

  function updateSignatureParam(idx, field, value) {
    const next = [...signature.params];
    next[idx] = { ...next[idx], [field]: value };
    setSignature({ ...signature, params: next });
  }
  function addSignatureParam() {
    setSignature({ ...signature, params: [...signature.params, { name: "", type: "int" }] });
  }
  function removeSignatureParam(idx) {
    setSignature({ ...signature, params: signature.params.filter((_, i) => i !== idx) });
  }

  // Live starter-code preview, regenerated from the same generator the backend uses to save —
  // debounced slightly isn't necessary here since this only fires on FUNCTION mode with a filled
  // method name, not on every keystroke across the whole form.
  useEffect(() => {
    if (form.questionType !== "CODING" || form.evaluationType !== "FUNCTION" || !signature.methodName) {
      setPreview(null);
      return;
    }
    const t = setTimeout(() => {
      api.post("/questions/preview-starter-code", { functionSignature: signature })
        .then((res) => { setPreview(res.data); setPreviewError(""); })
        .catch((err) => { setPreview(null); setPreviewError(err.response?.data?.error || "Invalid signature"); });
    }, 400);
    return () => clearTimeout(t);
  }, [form.questionType, form.evaluationType, signature]);

  function updateOption(idx, value) {
    const next = [...options];
    next[idx] = value;
    setOptions(next);
  }

  function addOption() {
    setOptions([...options, ""]);
  }

  function removeOption(idx) {
    setOptions(options.filter((_, i) => i !== idx));
    setCorrectIndices(correctIndices.filter((i) => i !== idx).map((i) => (i > idx ? i - 1 : i)));
  }

  function toggleCorrect(idx) {
    const isMulti = form.questionType === "MULTISELECT";
    if (isMulti) {
      setCorrectIndices((prev) => (prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]));
    } else {
      setCorrectIndices([idx]);
    }
  }

  function changeType(newType) {
    setForm({ ...form, questionType: newType });
    setCorrectIndices([]);
    if (newType === "TRUE_FALSE") setOptions(["True", "False"]);
    else if (options.length < 2 || (form.questionType === "TRUE_FALSE" && newType !== "TRUE_FALSE")) setOptions(["", ""]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        points: Number(form.points),
        timeLimitMs: Number(form.timeLimitMs),
        memoryLimitKb: form.memoryLimitKb ? Math.round(Number(form.memoryLimitKb) * 1024) : null,
        tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean),
        folderId: folderId || null,
      };
      if (form.questionType === "CODING") {
        payload.testCases = testCases;
        if (form.evaluationType === "FUNCTION") payload.functionSignature = signature;
      } else {
        payload.options = options.map((o) => o.trim()).filter(Boolean);
        payload.correctAnswer = correctIndices;
      }

      if (isEdit) {
        await api.patch(`/questions/${id}`, payload);
      } else {
        await api.post("/questions", payload);
      }
      navigate("/staff/questions");
    } catch (err) {
      alert(err.response?.data?.error || "Failed to save question");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div style={{ padding: 48 }} className="mono">Loading…</div>;

  const isQuiz = form.questionType !== "CODING";
  const isMulti = form.questionType === "MULTISELECT";
  const isTrueFalse = form.questionType === "TRUE_FALSE";

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "48px 24px" }}>
        <h1>{isEdit ? "Edit question" : "New question"}</h1>
        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Question Type</label>
          <select style={inputStyle} value={form.questionType} onChange={(e) => changeType(e.target.value)}>
            {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>

          <label style={labelStyle}>Question Name (optional)</label>
          <input style={inputStyle} value={form.title} onChange={updateField("title")} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Subject</label>
              <input style={inputStyle} value={form.subject} onChange={updateField("subject")} />
            </div>
            <div>
              <label style={labelStyle}>Topic</label>
              <input style={inputStyle} value={form.topic} onChange={updateField("topic")} />
            </div>
          </div>

          <label style={labelStyle}>Question Text</label>
          <textarea style={{ ...inputStyle, minHeight: 140 }} required value={form.description} onChange={updateField("description")} placeholder="Problem statement / question text…" />

          <div style={{ display: "grid", gridTemplateColumns: isQuiz ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>Difficulty Level</label>
              <select style={inputStyle} value={form.difficulty} onChange={updateField("difficulty")}>
                <option value="EASY">Easy</option>
                <option value="MEDIUM">Medium</option>
                <option value="HARD">Hard</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Marks</label>
              <input style={inputStyle} type="number" value={form.points} onChange={updateField("points")} />
            </div>
            {!isQuiz && (
              <div>
                <label style={labelStyle}>Time limit (ms)</label>
                <input style={inputStyle} type="number" value={form.timeLimitMs} onChange={updateField("timeLimitMs")} />
              </div>
            )}
          </div>

          {!isQuiz && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Memory limit (MB, optional)</label>
                  <input style={inputStyle} type="number" value={form.memoryLimitKb} onChange={updateField("memoryLimitKb")} placeholder="Platform default" />
                </div>
                <div>
                  <label style={labelStyle}>Tags (comma-separated, optional)</label>
                  <input style={inputStyle} value={form.tags} onChange={updateField("tags")} placeholder="Arrays, Dynamic Programming" />
                </div>
              </div>

              <div style={{ marginTop: 20, fontWeight: 700, fontSize: 14 }}>Evaluation Type</div>
              <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
                Function-based: the student writes only a method body matching a signature you define here (like
                LeetCode) — the platform generates the starter code and the stdin-parsing/method-invocation driver
                automatically. Full Program: the student's submitted code is the whole program, reading stdin and
                writing stdout themselves (the platform's original mode).
              </p>
              <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="radio" name="evalType" checked={form.evaluationType === "STDIO"} onChange={() => setForm({ ...form, evaluationType: "STDIO" })} /> Full Program
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input type="radio" name="evalType" checked={form.evaluationType === "FUNCTION"} onChange={() => setForm({ ...form, evaluationType: "FUNCTION" })} /> Function-based
                </label>
              </div>

              {form.evaluationType === "FUNCTION" ? (
                <div className="card" style={{ padding: 16, marginTop: 12 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>Method name</label>
                      <input style={inputStyle} value={signature.methodName} onChange={(e) => setSignature({ ...signature, methodName: e.target.value })} placeholder="twoSum" />
                    </div>
                    <div>
                      <label style={labelStyle}>Return type</label>
                      <select style={inputStyle} value={signature.returnType} onChange={(e) => setSignature({ ...signature, returnType: e.target.value })}>
                        {SIGNATURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>Parameters</div>
                    <button type="button" className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addSignatureParam}>+ Add parameter</button>
                  </div>
                  {signature.params.map((p, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
                      <input style={{ ...inputStyle, marginTop: 0 }} value={p.name} onChange={(e) => updateSignatureParam(idx, "name", e.target.value)} placeholder="nums" />
                      <select style={{ ...inputStyle, marginTop: 0 }} value={p.type} onChange={(e) => updateSignatureParam(idx, "type", e.target.value)}>
                        {SIGNATURE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                      {signature.params.length > 0 && (
                        <button type="button" onClick={() => removeSignatureParam(idx)} style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}>Remove</button>
                      )}
                    </div>
                  ))}

                  {previewError && <p style={{ fontSize: 12, color: "var(--rust)", marginTop: 10 }}>{previewError}</p>}
                  {preview && (
                    <>
                      <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {preview.supportedLanguages.map((l) => (
                          <button
                            type="button"
                            key={l}
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: "3px 8px", fontWeight: previewLang === l ? 700 : 400 }}
                            onClick={() => setPreviewLang(l)}
                          >
                            {PREVIEW_LANGUAGES.find((pl) => pl.id === l)?.label || l}
                          </button>
                        ))}
                      </div>
                      <pre className="mono" style={{ fontSize: 12, background: "var(--card-bg, #F7F7F5)", border: "1px solid var(--line)", borderRadius: 8, padding: 12, marginTop: 8, overflowX: "auto", whiteSpace: "pre-wrap" }}>
                        {preview.starterCodeByLanguage[previewLang] || "(not available in this language)"}
                      </pre>
                      <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 6 }}>
                        This is exactly what the student sees as starter code — generated automatically, saved when
                        you save this question. C isn't offered for signatures using array types.
                      </p>
                    </>
                  )}

                  <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 12 }}>
                    Test case format below: one line per parameter in order (arrays as space-separated values on
                    their own line), and the expected output on one line the same way. Example for
                    twoSum(int[] nums, int target) → 2 sample lines: <span className="mono">"2 7 11 15\n9"</span> with
                    expected <span className="mono">"0 1"</span>.
                  </p>
                </div>
              ) : (
                <>
                  <label style={labelStyle}>Starter code (optional)</label>
                  <textarea style={{ ...inputStyle, minHeight: 80, fontFamily: "var(--font-mono)" }} value={form.starterCode} onChange={updateField("starterCode")} />
                </>
              )}

              <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Test cases</div>
                <button type="button" className="btn btn-ghost" onClick={addCase}>+ Add test case</button>
              </div>

              {testCases.map((tc, idx) => (
                <div key={idx} className="card" style={{ padding: 16, marginTop: 10 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div>
                      <label style={labelStyle}>{form.evaluationType === "FUNCTION" ? "Input (one line per parameter)" : "Input (stdin)"}</label>
                      <textarea style={{ ...inputStyle, fontFamily: "var(--font-mono)", minHeight: 60 }} value={tc.input} onChange={(e) => updateCase(idx, "input", e.target.value)} />
                    </div>
                    <div>
                      <label style={labelStyle}>Expected {form.evaluationType === "FUNCTION" ? "return value" : "stdout"}</label>
                      <textarea style={{ ...inputStyle, fontFamily: "var(--font-mono)", minHeight: 60 }} value={tc.expected} onChange={(e) => updateCase(idx, "expected", e.target.value)} />
                    </div>
                  </div>
                  {!tc.isHidden && (
                    <>
                      <label style={{ ...labelStyle, marginTop: 8 }}>Explanation (optional, shown to students alongside this sample)</label>
                      <input style={inputStyle} value={tc.explanation || ""} onChange={(e) => updateCase(idx, "explanation", e.target.value)} />
                    </>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
                      <input type="checkbox" checked={tc.isHidden} onChange={(e) => updateCase(idx, "isHidden", e.target.checked)} />
                      Hidden (not shown to students as a sample)
                    </label>
                    {testCases.length > 1 && (
                      <button type="button" onClick={() => removeCase(idx)} style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}>Remove</button>
                    )}
                  </div>
                </div>
              ))}
            </>
          )}

          {isQuiz && (
            <>
              <div style={{ marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>
                  Options — {isMulti ? "check all correct answers" : "select the correct answer"}
                </div>
                {!isTrueFalse && <button type="button" className="btn btn-ghost" onClick={addOption}>+ Add option</button>}
              </div>

              {options.map((opt, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
                  <input
                    type={isMulti ? "checkbox" : "radio"}
                    name="correctOption"
                    checked={correctIndices.includes(idx)}
                    onChange={() => toggleCorrect(idx)}
                  />
                  <input
                    style={{ ...inputStyle, flex: 1 }}
                    value={opt}
                    disabled={isTrueFalse}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                  />
                  {!isTrueFalse && options.length > 2 && (
                    <button type="button" onClick={() => removeOption(idx)} style={{ background: "none", border: "none", color: "var(--rust)", fontSize: 13 }}>Remove</button>
                  )}
                </div>
              ))}

              <label style={labelStyle}>Explanation (optional)</label>
              <textarea style={{ ...inputStyle, minHeight: 60 }} value={form.explanation} onChange={updateField("explanation")} placeholder="Shown to staff for review; not shown to students during the test." />
            </>
          )}

          <div style={{ marginTop: 24, fontWeight: 700, fontSize: 14 }}>Question Bank</div>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 2 }}>
            File this question into a bank so it's easy to find and reuse later, or leave it uncategorized.
          </p>
          <div style={{ marginTop: 10 }}>
            <FolderPicker value={folderId} onChange={setFolderId} />
          </div>

          <button className="btn btn-primary" style={{ marginTop: 24 }} disabled={saving}>
            {saving ? "Saving…" : isEdit ? "Save changes" : "Save question"}
          </button>
        </form>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14, fontFamily: "var(--font-body)" };

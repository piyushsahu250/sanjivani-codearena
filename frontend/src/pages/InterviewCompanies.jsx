import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import {
  CATEGORIES, PACKAGE_BANDS, PACKAGE_BAND_LABEL, EXPERIENCE_LEVELS,
  FREQUENCY_TAGS, FREQUENCY_TAG_LABEL,
} from "../constants/interviewCategories";
import "./interviewPrep.css";

const selectStyle = { padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 13 };

// Student-facing company browse — the AI-Powered Auto-Updating Mock Interview System's Phase 4.
// The company grid always shows every company from the curated COMPANIES list (backend/src/utils/
// companies.js), even ones with zero questions seeded yet. Each company's "hiring pattern"
// checklist comes only from admin-approved CompanyPatternNote rows and is always rendered
// labeled as AI-estimated — never presented as verified company data.
export default function InterviewCompanies() {
  const navigate = useNavigate();
  const [companies, setCompanies] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [pattern, setPattern] = useState(null);
  const [filters, setFilters] = useState({ company: "", role: "", packageBand: "", experienceLevel: "", difficulty: "", topic: "", frequencyTag: "" });
  const [results, setResults] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    api.get("/interview/companies/browse").then((res) => setCompanies(res.data)).catch(() => setCompanies([]));
  }, []);

  function toggleCompany(company) {
    if (expanded === company) { setExpanded(null); setPattern(null); return; }
    setExpanded(company);
    setPattern(null);
    api.get(`/interview/companies/${encodeURIComponent(company)}/pattern`).then((res) => setPattern(res.data)).catch(() => setPattern([]));
  }

  function startCompanyRound(company) {
    navigate("/interview", { state: { prefillCompany: company } });
  }

  function runSearch() {
    const params = {};
    for (const [k, v] of Object.entries(filters)) if (v) params[k] = v;
    api.get("/interview/questions/browse", { params }).then((res) => setResults(res.data));
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Company Interview Prep</h1>
        <ChalkUnderline />
        <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>
          Browse hiring patterns by company and filter the question bank by role, package, experience level, and more.
        </p>

        <button className="btn btn-ghost" style={{ marginTop: 16 }} onClick={() => setShowFilters((s) => !s)}>
          {showFilters ? "Hide filters" : "🔍 Filter questions"}
        </button>

        {showFilters && (
          <div className="ip-glass" style={{ padding: 16, marginTop: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px,1fr))", gap: 10 }}>
              <select style={selectStyle} value={filters.company} onChange={(e) => setFilters({ ...filters, company: e.target.value })}>
                <option value="">Any company</option>
                {(companies || []).map((c) => <option key={c.company} value={c.company}>{c.company}</option>)}
              </select>
              <select style={selectStyle} value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value })}>
                <option value="">Any difficulty</option>
                <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
              </select>
              <input style={selectStyle} placeholder="Topic (e.g. Arrays, DBMS)" value={filters.topic} onChange={(e) => setFilters({ ...filters, topic: e.target.value })} />
              <select style={selectStyle} value={filters.packageBand} onChange={(e) => setFilters({ ...filters, packageBand: e.target.value })}>
                <option value="">Any package</option>
                {PACKAGE_BANDS.map((b) => <option key={b} value={b}>{PACKAGE_BAND_LABEL[b]}</option>)}
              </select>
              <select style={selectStyle} value={filters.experienceLevel} onChange={(e) => setFilters({ ...filters, experienceLevel: e.target.value })}>
                <option value="">Any experience level</option>
                {EXPERIENCE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <select style={selectStyle} value={filters.frequencyTag} onChange={(e) => setFilters({ ...filters, frequencyTag: e.target.value })}>
                <option value="">Any tag</option>
                {FREQUENCY_TAGS.map((t) => <option key={t} value={t}>{FREQUENCY_TAG_LABEL[t]}</option>)}
              </select>
            </div>
            <button className="btn btn-primary" style={{ marginTop: 10 }} onClick={runSearch}>Search</button>

            {results && (
              <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
                {results.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--ink-dim)" }}>No questions match these filters yet.</p>
                ) : (
                  results.map((q) => (
                    <div key={q.id} className="ip-glass" style={{ padding: 10, fontSize: 13, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
                      <span>{q.title || q.subject || q.category}{q.company ? ` · ${q.company}` : ""}</span>
                      <span>
                        <span className="badge" style={{ fontSize: 11 }}>{q.difficulty}</span>
                        {q.frequencyTag && <span className="badge" style={{ fontSize: 11, marginLeft: 4 }}>{FREQUENCY_TAG_LABEL[q.frequencyTag]}</span>}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12, marginTop: 24 }}>
          {companies === null ? (
            <p style={{ color: "var(--ink-dim)" }}>Loading…</p>
          ) : (
            companies.map((c) => (
              <div key={c.company} className="ip-glass" style={{ padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{c.company}</strong>
                  <span className="badge" style={{ fontSize: 11 }}>{c.questionCount} question{c.questionCount === 1 ? "" : "s"}</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => toggleCompany(c.company)} disabled={!c.hasApprovedPattern}>
                    {c.hasApprovedPattern ? (expanded === c.company ? "Hide pattern" : "View pattern") : "No pattern yet"}
                  </button>
                  <button className="btn btn-primary" style={{ fontSize: 12 }} onClick={() => startCompanyRound(c.company)}>Start Round</button>
                </div>
                {expanded === c.company && (
                  <div style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
                    <p style={{ fontSize: 11, color: "var(--ink-dim)" }}>AI-estimated hiring pattern — not verified company data.</p>
                    {pattern === null ? (
                      <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>Loading…</p>
                    ) : pattern.length === 0 ? (
                      <p style={{ fontSize: 12, color: "var(--ink-dim)" }}>No pattern notes yet.</p>
                    ) : (
                      pattern.map((p, i) => (
                        <div key={i} style={{ marginTop: 8, fontSize: 12 }}>
                          <strong>{CATEGORIES.includes(p.category) ? p.category : p.category}</strong>
                          <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                            {p.checklistItems.map((item, j) => <li key={j}>{item}</li>)}
                          </ul>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function StaffDashboard() {
  const { user } = useAuth();
  const [tests, setTests] = useState([]);

  useEffect(() => {
    refresh();
  }, []);

  function refresh() {
    api.get("/tests").then((res) => setTests(res.data));
  }

  async function togglePublish(test) {
    await api.patch(`/tests/${test.id}/publish`, { isPublished: !test.isPublished });
    refresh();
  }

  async function deleteTest(test) {
    await api.delete(`/tests/${test.id}`);
    refresh();
  }

  async function duplicateTest(test) {
    await api.post(`/tests/${test.id}/duplicate`);
    refresh();
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>Staff control room</h1>
            <ChalkUnderline />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link to="/staff/questions" className="btn btn-ghost">Question Bank</Link>
            <Link to="/staff/tests/new" className="btn btn-primary">+ New test</Link>
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, marginTop: 32 }}>
          {tests.map((test) => (
            <div key={test.id} className="card" style={{ padding: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ fontSize: 18 }}>{test.title}</h3>
                <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                  {test._count?.questions || 0} questions · {test._count?.attempts || 0} attempts ·{" "}
                  {test.isPublished ? "Published" : "Draft"}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Link to={`/staff/tests/${test.id}/preview`} className="btn btn-ghost">Preview</Link>
                <Link to={`/staff/tests/${test.id}/edit`} className="btn btn-ghost">Edit</Link>
                <button className="btn btn-ghost" onClick={() => duplicateTest(test)}>Duplicate</button>
                <Link to={`/staff/tests/${test.id}/results`} className="btn btn-ghost">Results</Link>
                <button className="btn btn-dark" onClick={() => togglePublish(test)}>
                  {test.isPublished ? "Unpublish" : "Publish"}
                </button>
                {user.role === "ADMIN" && (
                  <button className="btn btn-ghost" style={{ color: "var(--rust)", borderColor: "var(--rust)" }} onClick={() => deleteTest(test)}>
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
          {tests.length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: "center", color: "var(--ink-dim)" }}>
              No tests yet. Create a question bank first, then assemble a test.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

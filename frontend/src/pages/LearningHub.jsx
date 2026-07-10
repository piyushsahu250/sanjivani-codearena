import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function LearningHub() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    api.get("/learning/courses").then((res) => setCourses(res.data));
  }, []);

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Learning</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", marginTop: 12 }}>
          Structured, self-paced courses to build up your skills before attempting a coding test.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginTop: 24 }}>
          {courses.map((c) =>
            c.isActive ? (
              <Link key={c.id} to={`/learning/${c.slug}`} className="card" style={{ padding: 24, textDecoration: "none", color: "inherit" }}>
                <h3 style={{ fontSize: 18 }}>{c.name}</h3>
                <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>{c.description}</p>
                <span className="btn btn-primary" style={{ marginTop: 16, pointerEvents: "none" }}>Start learning →</span>
              </Link>
            ) : (
              <div key={c.id} className="card" style={{ padding: 24, opacity: 0.55 }}>
                <h3 style={{ fontSize: 18 }}>{c.name}</h3>
                <p style={{ fontSize: 13, color: "var(--ink-dim)", marginTop: 8 }}>{c.description}</p>
                <span className="badge" style={{ marginTop: 16, display: "inline-block" }}>Coming soon</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

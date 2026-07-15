import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";

export default function ClassStudents() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [resettingId, setResettingId] = useState(null);
  const confirmDialog = useConfirm();
  const toast = useToast();

  function load() {
    api.get(`/classes/${id}/students`)
      .then((res) => setData(res.data))
      .catch((err) => setError(err.response?.data?.error || "Failed to load class roster"));
  }

  useEffect(load, [id]);

  async function resetPassword(student) {
    const ok = await confirmDialog({
      title: "Reset Password",
      message: `Are you sure you want to reset ${student.name}'s password? A new, unique password will be generated. They will be required to set a new password during their next login.`,
      confirmLabel: "Reset Password",
      danger: true,
    });
    if (!ok) return;
    setResettingId(student.id);
    try {
      const { data: res } = await api.post(`/users/${student.id}/reset-password`);
      toast.success(`Password reset for ${student.name} to "${res.defaultPassword}". They'll be asked to set a new one on next login.`, 8000);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "48px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h1>{data ? `${data.class.name} (${data.class.batchYear || "—"})` : "Class roster"}</h1>
            <ChalkUnderline />
          </div>
          <Link to="/admin/classes" className="btn btn-ghost">← Back to Class Management</Link>
        </div>

        {error && <p style={{ color: "var(--rust)", marginTop: 24 }}>{error}</p>}

        {data && (
          <>
            <p style={{ color: "var(--ink-dim)", marginTop: 12, fontSize: 14 }}>
              {data.class.institute?.name} · <strong>{data.students.length}</strong> student{data.students.length === 1 ? "" : "s"}
            </p>

            <div style={{ marginTop: 20, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "2px solid var(--line)", fontSize: 12, color: "var(--ink-dim)" }}>
                    <th style={{ padding: "8px 6px" }}>Roll number</th>
                    <th style={{ padding: "8px 6px" }}>Name</th>
                    <th style={{ padding: "8px 6px" }}>Official email</th>
                    <th style={{ padding: "8px 6px" }}>Mobile</th>
                    <th style={{ padding: "8px 6px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {data.students.map((s) => (
                    <tr key={s.id} style={{ borderBottom: "1px solid var(--line)", fontSize: 14 }}>
                      <td className="mono" style={{ padding: "10px 6px" }}>{s.rollNumber || "—"}</td>
                      <td style={{ padding: "10px 6px" }}>
                        <Link to={`/admin/students/${s.id}`} style={{ color: "var(--ink)", fontWeight: 600 }}>{s.name}</Link>
                      </td>
                      <td className="mono" style={{ padding: "10px 6px" }}>{s.email}</td>
                      <td className="mono" style={{ padding: "10px 6px" }}>{s.mobile || "—"}</td>
                      <td style={{ padding: "10px 6px", textAlign: "right" }}>
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => resetPassword(s)} disabled={resettingId === s.id}>
                          {resettingId === s.id ? "Resetting…" : "Reset password"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {data.students.length === 0 && (
                <div className="card" style={{ padding: 32, marginTop: 16, textAlign: "center", color: "var(--ink-dim)" }}>
                  No students enrolled in this class yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

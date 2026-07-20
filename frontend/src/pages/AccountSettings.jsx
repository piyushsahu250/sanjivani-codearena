import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";
import { Laptop, Smartphone, Tablet, LogOut } from "lucide-react";

const DEVICE_ICON = { Mobile: Smartphone, Tablet: Tablet, Desktop: Laptop };

export default function AccountSettings() {
  const { user, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  const [sessions, setSessions] = useState(null);
  const [revokingId, setRevokingId] = useState(null);

  function loadSessions() {
    api.get("/users/me/sessions").then((res) => setSessions(res.data)).catch(() => setSessions([]));
  }
  useEffect(loadSessions, []);

  async function revokeSession(id) {
    setRevokingId(id);
    try {
      await api.delete(`/users/me/sessions/${id}`);
      loadSessions();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to sign out that session");
    } finally {
      setRevokingId(null);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword && newPassword !== confirmPassword) {
      return setError("New password and confirmation don't match");
    }

    const payload = { currentPassword };
    if (newEmail && newEmail !== user.email) payload.newEmail = newEmail;
    if (newPassword) payload.newPassword = newPassword;

    if (!payload.newEmail && !payload.newPassword) {
      return setError("Change the email and/or password before saving");
    }

    setSaving(true);
    try {
      const { data } = await api.patch("/users/me", payload);
      login(data.token, data.user);
      setSuccess("Account updated.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      loadSessions();
    } catch (err) {
      setError(err.response?.data?.error || "Update failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Navbar />
      <div style={{ maxWidth: 440, margin: "0 auto", padding: "48px 24px" }}>
        <h1>Account settings</h1>
        <ChalkUnderline />
        <p style={{ color: "var(--ink-dim)", fontSize: 14, marginTop: 16 }}>
          Change your sign-in email and/or password. Your current password is required to confirm the change.
        </p>

        <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
          <label style={labelStyle}>Email</label>
          <input style={inputStyle} type="email" required value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />

          <label style={labelStyle}>New password (optional)</label>
          <input style={inputStyle} type="password" minLength={8} placeholder="Leave blank to keep current password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          {newPassword && (
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginTop: 4 }}>
              At least 8 characters, with uppercase, lowercase, a number, and a special character.
            </p>
          )}

          {newPassword && (
            <>
              <label style={labelStyle}>Confirm new password</label>
              <input style={inputStyle} type="password" minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </>
          )}

          <label style={labelStyle}>Current password</label>
          <input style={inputStyle} type="password" required value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Required to confirm this change" />

          {error && <p style={{ color: "var(--rust)", fontSize: 13, marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: "var(--mint)", fontSize: 13, marginTop: 8 }}>{success}</p>}

          <button className="btn btn-primary" style={{ width: "100%", marginTop: 18, padding: "12px 0" }} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>

        <h2 style={{ fontSize: 18, marginTop: 40 }}>Active sessions</h2>
        <p style={{ color: "var(--ink-dim)", fontSize: 13, marginTop: 4 }}>
          Devices currently signed in to your account. If you don't recognize one, sign it out.
        </p>
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {sessions === null && <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>Loading…</p>}
          {sessions?.length === 0 && <p className="mono" style={{ fontSize: 12, color: "var(--ink-dim)" }}>No session history yet.</p>}
          {sessions?.map((s) => {
            const Icon = DEVICE_ICON[s.device] || Laptop;
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line)", borderRadius: 8, opacity: s.isActive ? 1 : 0.55 }}>
                <Icon size={18} style={{ flexShrink: 0, color: "var(--ink-dim)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {s.browser} on {s.os} {s.isCurrent && <span style={{ color: "var(--mint)", fontWeight: 700 }}>· This device</span>}
                  </div>
                  <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)" }}>
                    {s.ip || "unknown IP"} · {s.isActive ? "Active since" : "Signed out —"} {new Date(s.loginAt).toLocaleString()}
                  </div>
                </div>
                {s.isActive && !s.isCurrent && (
                  <button
                    className="btn btn-ghost"
                    style={{ padding: "6px 10px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                    onClick={() => revokeSession(s.id)}
                    disabled={revokingId === s.id}
                  >
                    <LogOut size={13} /> {revokingId === s.id ? "Signing out…" : "Sign out"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

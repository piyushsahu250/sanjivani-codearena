import { useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import ChalkUnderline from "../components/ChalkUnderline";

export default function AccountSettings() {
  const { user, login } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState(user.email);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

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
          <input style={inputStyle} type="password" minLength={6} placeholder="Leave blank to keep current password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />

          {newPassword && (
            <>
              <label style={labelStyle}>Confirm new password</label>
              <input style={inputStyle} type="password" minLength={6} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
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
      </div>
    </div>
  );
}

const labelStyle = { display: "block", fontSize: 13, fontWeight: 600, marginTop: 14, marginBottom: 6 };
const inputStyle = { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid var(--line)", fontSize: 14 };

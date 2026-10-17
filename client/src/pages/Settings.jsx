import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";
import { useToast } from "../components/Toast";

const CURRENCIES = ["NGN", "USD", "EUR", "GBP"];

function Settings() {
  const { user, updateUser, logout, deleteAccount } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [currency, setCurrency] = useState(user?.currency || "NGN");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      await updateUser({ name, currency });
      setSaved(true);
      notify("Settings saved");
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      setSaveError(err.response?.data?.error || "Could not save your changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAccount();
      navigate("/login");
    } catch (err) {
      setDeleteError(err.response?.data?.error || "Could not delete account");
      setDeleting(false);
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>

      <form className="panel settings-form" onSubmit={handleSubmit}>
        <h2 className="panel-title">Profile</h2>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label>
          Currency
          <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        {saveError && (
          <div className="banner banner-error" role="alert" style={{ marginBottom: 0 }}>
            {saveError}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
          {saved && <span className="save-confirm">Saved ✓</span>}
        </div>
      </form>

      <div className="panel settings-form" style={{ marginTop: 20 }}>
        <h2 className="panel-title">Appearance</h2>
        <ThemeToggle />
      </div>

      <div className="panel settings-form" style={{ marginTop: 20 }}>
        <h2 className="panel-title">Account</h2>
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>

      <div
        className="panel settings-form"
        style={{ marginTop: 20, borderColor: "var(--danger)" }}
      >
        <h2 className="panel-title" style={{ color: "var(--danger)" }}>
          Danger zone
        </h2>
        <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>
          Deleting your account permanently removes your transactions, budgets, and goals. This
          cannot be undone.
        </p>
        {deleteError && (
          <div className="banner banner-error" role="alert" style={{ marginBottom: 0 }}>
            {deleteError}
          </div>
        )}
        {!confirmingDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting…" : "Yes, permanently delete my account"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;

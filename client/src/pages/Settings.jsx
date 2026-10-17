import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

const CURRENCIES = ["NGN", "USD", "EUR", "GBP"];

function Settings() {
  const { user, updateUser, logout, deleteAccount } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || "");
  const [currency, setCurrency] = useState(user?.currency || "NGN");
  const [saved, setSaved] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    await updateUser({ name, currency });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

        <button className="btn btn-primary" type="submit">
          Save changes
        </button>
        {saved && <span className="save-confirm">Saved ✓</span>}
      </form>

      <div className="panel settings-form" style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 600 }}>Appearance</label>
        <ThemeToggle />
      </div>

      <div className="panel settings-form" style={{ marginTop: 20 }}>
        <label style={{ fontWeight: 600 }}>Account</label>
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Log out
        </button>
      </div>

      <div className="panel settings-form" style={{ marginTop: 20, borderColor: "var(--danger)" }}>
        <label style={{ fontWeight: 600, color: "var(--danger)" }}>Danger zone</label>
        <p style={{ fontSize: 13, color: "var(--text)", margin: 0 }}>
          Deleting your account permanently removes your transactions, budgets, and goals. This
          cannot be undone.
        </p>
        {deleteError && <div className="auth-error">{deleteError}</div>}
        {!confirmingDelete ? (
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => setConfirmingDelete(true)}
          >
            Delete account
          </button>
        ) : (
          <div style={{ display: "flex", gap: 10 }}>
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

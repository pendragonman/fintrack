import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../components/Toast";
import AuthMarketing from "../components/AuthMarketing";

function ResetPassword() {
  const { resetPassword } = useAuth();
  const { notify } = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Those passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      await resetPassword(token, password);
      notify("Password updated. You're signed in.");
      navigate("/", { replace: true });
    } catch (err) {
      setError(
        err.response?.data?.error || "We couldn't update your password. Try again."
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <main className="auth-page">
        <AuthMarketing />
        <div className="auth-card">
          <h1>Reset link missing</h1>
          <p className="auth-subtitle">
            This page needs a reset link from your email. Request a new one and open
            the link from that message.
          </p>
          <Link className="btn btn-primary" to="/forgot-password">
            Request a new link
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-page">
      <AuthMarketing />
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Set a new password</h1>
        <p className="auth-subtitle">
          Choose a password you haven&rsquo;t used before. At least 8 characters.
        </p>

        {error && <div className="auth-error">{error}</div>}

        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            autoFocus
          />
        </label>

        <label>
          Confirm new password
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            minLength={8}
            required
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>

        <p className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </form>
    </main>
  );
}

export default ResetPassword;

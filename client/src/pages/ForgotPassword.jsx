import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthMarketing from "../components/AuthMarketing";

function ForgotPassword() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <AuthMarketing />

      {sent ? (
        <div className="auth-card">
          <h1>Check your inbox</h1>
          <p className="auth-subtitle">
            If an account exists for <strong>{email}</strong>, we&rsquo;ve sent a link to
            reset your password. It expires in 30 minutes.
          </p>
          <p className="auth-subtitle">
            Nothing arrived? Check your spam folder, or try again in a few minutes.
          </p>
          <p className="auth-switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </div>
      ) : (
        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Forgot your password?</h1>
          <p className="auth-subtitle">
            Enter your email and we&rsquo;ll send you a link to set a new one.
          </p>

          {error && <div className="auth-error">{error}</div>}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>

          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send reset link"}
          </button>

          <p className="auth-switch">
            Remembered it? <Link to="/login">Log in</Link>
          </p>
        </form>
      )}
    </main>
  );
}

export default ForgotPassword;

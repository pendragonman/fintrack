import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function VerifyEmail() {
  const { verifyEmail, resendCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState(false);

  if (!email) {
    return <Navigate to="/signup" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await verifyEmail(email, code);
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    setError("");
    setResent(false);
    try {
      await resendCode(email);
      setResent(true);
    } catch {
      setError("Could not resend code, try again shortly");
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Check your email</h1>
        <p className="auth-subtitle">
          We sent a 6-digit code to <strong>{email}</strong>
        </p>

        {error && <div className="auth-error">{error}</div>}
        {resent && <div className="auth-success">A new code was sent.</div>}

        <label>
          Verification code
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            required
            autoFocus
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy || code.length !== 6}>
          {busy ? "Verifying…" : "Verify"}
        </button>

        <p className="auth-switch">
          Didn't get it?{" "}
          <button type="button" className="link-inline" onClick={handleResend}>
            Resend code
          </button>
        </p>
      </form>
    </div>
  );
}

export default VerifyEmail;

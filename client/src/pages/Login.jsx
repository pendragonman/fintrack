import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";
import AuthMarketing from "../components/AuthMarketing";

function Login() {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      if (err.response?.status === 403 && err.response.data?.needsVerification) {
        navigate("/verify-email", { state: { email: err.response.data.email } });
        return;
      }
      setError(err.response?.data?.error || "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const handleGoogle = useCallback(
    async (idToken) => {
      setError("");
      try {
        await loginWithGoogle(idToken);
        navigate("/");
      } catch (err) {
        setError(err.response?.data?.error || "Google sign-in failed");
      }
    },
    [loginWithGoogle, navigate]
  );

  return (
    <div className="auth-page">
      <AuthMarketing />
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1>Welcome back</h1>
        <p className="auth-subtitle">Log in to your finance tracker</p>

        {error && <div className="auth-error">{error}</div>}

        <GoogleButton onCredential={handleGoogle} />
        <div className="auth-divider">
          <span>or</span>
        </div>

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Logging in…" : "Log in"}
        </button>

        <p className="auth-switch">
          No account? <Link to="/signup">Sign up</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;

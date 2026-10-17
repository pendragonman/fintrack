import { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import GoogleButton from "../components/GoogleButton";
import AuthMarketing from "../components/AuthMarketing";

function Signup() {
  const { signup, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await signup(name, email, password);
      navigate("/verify-email", { state: { email: data.email } });
    } catch (err) {
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
        <h1>Create your account</h1>
        <p className="auth-subtitle">Start tracking your money in minutes</p>

        {error && <div className="auth-error">{error}</div>}

        <GoogleButton onCredential={handleGoogle} />
        <div className="auth-divider">
          <span>or</span>
        </div>

        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

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
            minLength={8}
            required
          />
        </label>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? "Creating account…" : "Sign up"}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

export default Signup;

import { createContext, useContext, useEffect, useState } from "react";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setLoading(false);
      return;
    }

    api
      .get("/auth/me")
      .then((res) => setUser(res.data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setLoading(false));
  }, []);

  // The axios interceptor fires this when a stored token is rejected (expired
  // or rotated) so the app can fall back to the login screen instead of
  // rendering empty-looking pages.
  useEffect(() => {
    function onUnauthorized() {
      setUser(null);
    }
    window.addEventListener("fintrack:unauthorized", onUnauthorized);
    return () => window.removeEventListener("fintrack:unauthorized", onUnauthorized);
  }, []);

  function applySession(data) {
    localStorage.setItem("token", data.token);
    setUser(data.user);
  }

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    applySession(res.data);
  }

  async function signup(name, email, password) {
    const res = await api.post("/auth/signup", { name, email, password });
    return res.data;
  }

  async function verifyEmail(email, code) {
    const res = await api.post("/auth/verify-email", { email, code });
    applySession(res.data);
  }

  async function resendCode(email) {
    await api.post("/auth/resend-code", { email });
  }

  async function loginWithGoogle(idToken) {
    const res = await api.post("/auth/google", { idToken });
    applySession(res.data);
  }

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  async function updateUser(fields) {
    const res = await api.patch("/auth/me", fields);
    setUser(res.data.user);
  }

  async function deleteAccount() {
    await api.delete("/auth/me");
    localStorage.removeItem("token");
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        verifyEmail,
        resendCode,
        loginWithGoogle,
        logout,
        updateUser,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

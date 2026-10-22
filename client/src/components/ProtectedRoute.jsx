import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, guestElement }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="page-loading">Loading…</div>;
  if (!user) return guestElement ?? <Navigate to="/login" replace />;

  return children;
}

export default ProtectedRoute;

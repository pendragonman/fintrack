import { Link } from "react-router-dom";

function NotFound() {
  return (
    <div className="auth-page">
      <main className="auth-card">
        <h1>Page not found</h1>
        <p className="auth-subtitle">
          That link doesn’t point anywhere. Check the address, or head back to your dashboard.
        </p>
        <Link className="btn btn-primary" to="/">
          Back to dashboard
        </Link>
      </main>
    </div>
  );
}

export default NotFound;

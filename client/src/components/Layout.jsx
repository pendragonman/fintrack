import { useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import {
  IconOverview,
  IconWallet,
  IconTransactions,
  IconImport,
  IconBudget,
  IconGoals,
  IconReports,
  IconSettings,
} from "./icons";

const links = [
  { to: "/", label: "Dashboard", end: true, Icon: IconOverview },
  { to: "/accounts", label: "Accounts", Icon: IconWallet },
  { to: "/transactions", label: "Transactions", Icon: IconTransactions },
  { to: "/import", label: "Import", Icon: IconImport },
  { to: "/budgets", label: "Budgets", Icon: IconBudget },
  { to: "/goals", label: "Goals", Icon: IconGoals },
  { to: "/reports", label: "Reports", Icon: IconReports },
  { to: "/settings", label: "Settings", Icon: IconSettings },
];

function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close the drawer with Escape, and stop the page scrolling behind it.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">KoboPath</span>
        <div className="topbar-actions">
          <ThemeToggle />
          <button
            className={`nav-toggle ${open ? "open" : ""}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="sidebar"
          >
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
          </button>
        </div>
      </header>

      <aside id="sidebar" className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <div className="sidebar-head">
          <span className="brand sidebar-brand">KoboPath</span>
          <ThemeToggle />
        </div>
        <nav className="sidebar-nav" aria-label="Main">
          {links.map(({ to, label, end, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? "active" : "")}
              onClick={() => setOpen(false)}
            >
              <Icon />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <span className="sidebar-user">{user?.name}</span>
          <button className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        ></button>
      )}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;

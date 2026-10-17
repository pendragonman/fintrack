import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "./ThemeToggle";
import {
  IconOverview,
  IconTransactions,
  IconBudget,
  IconGoals,
  IconReports,
  IconSettings,
} from "./icons";

const links = [
  { to: "/", label: "Dashboard", end: true, Icon: IconOverview },
  { to: "/transactions", label: "Transactions", Icon: IconTransactions },
  { to: "/budgets", label: "Budgets", Icon: IconBudget },
  { to: "/goals", label: "Goals", Icon: IconGoals },
  { to: "/reports", label: "Reports", Icon: IconReports },
  { to: "/settings", label: "Settings", Icon: IconSettings },
];

function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="app-shell">
      <header className="topbar">
        <span className="brand">💰 FinTrack</span>
        <button
          className={`nav-toggle ${open ? "open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </header>

      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        <span className="brand sidebar-brand">💰 FinTrack</span>
        <nav className="sidebar-nav">
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
          <ThemeToggle />
          <span className="sidebar-user">{user?.name}</span>
          <button className="btn btn-secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      {open && <div className="sidebar-backdrop" onClick={() => setOpen(false)}></div>}

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;

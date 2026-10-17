import { useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Label,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney, MONTH_NAMES } from "../format";
import { IconWallet, IconArrowUp, IconArrowDown, IconPiggyBank } from "../components/icons";

const COLORS = ["#7c3aed", "#0d9488", "#d97706", "#a78bfa", "#2dd4bf", "#fbbf24", "#4c1d95"];

function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [trend, setTrend] = useState([]);

  useEffect(() => {
    const now = new Date();
    api
      .get("/reports/summary", { params: { month: now.getMonth() + 1, year: now.getFullYear() } })
      .then((res) => setSummary(res.data));
    api
      .get("/reports/by-category", {
        params: { month: now.getMonth() + 1, year: now.getFullYear(), type: "EXPENSE" },
      })
      .then((res) => setByCategory(res.data.items));
    api.get("/reports/trend", { params: { year: now.getFullYear() } }).then((res) =>
      setTrend(
        res.data.items.map((m) => ({
          name: MONTH_NAMES[m.month - 1].slice(0, 3),
          Income: m.income,
          Expenses: m.expenses,
        }))
      )
    );
  }, []);

  const currency = user?.currency || "NGN";
  const totalSpent = byCategory.reduce((sum, c) => sum + c.total, 0);
  const topCategory = byCategory[0]?.category || "";

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <div className="stat-cards">
        <div className="stat-card-lg">
          <span className="stat-card-icon">
            <IconWallet />
          </span>
          <span className="stat-card-label">Total Balance</span>
          <span className="stat-card-value">
            {summary ? formatMoney(summary.totalBalance, currency) : "…"}
          </span>
        </div>
        <div className="stat-card-lg stat-positive">
          <span className="stat-card-icon">
            <IconArrowUp />
          </span>
          <span className="stat-card-label">Income (this month)</span>
          <span className="stat-card-value">
            {summary ? formatMoney(summary.income, currency) : "…"}
          </span>
        </div>
        <div className="stat-card-lg stat-negative">
          <span className="stat-card-icon">
            <IconArrowDown />
          </span>
          <span className="stat-card-label">Expenses (this month)</span>
          <span className="stat-card-value">
            {summary ? formatMoney(summary.expenses, currency) : "…"}
          </span>
        </div>
        <div className="stat-card-lg stat-savings">
          <span className="stat-card-icon">
            <IconPiggyBank />
          </span>
          <span className="stat-card-label">Total Savings</span>
          <span className="stat-card-value">
            {summary ? formatMoney(summary.savingsTotal, currency) : "…"}
          </span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h2>Spending by Category</h2>
          {byCategory.length === 0 ? (
            <p className="empty-state">No expenses recorded this month yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={byCategory}
                  dataKey="total"
                  nameKey="category"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                >
                  {byCategory.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const { cx, cy } = viewBox;
                      return (
                        <text x={cx} y={cy} textAnchor="middle">
                          <tspan
                            x={cx}
                            dy="-0.2em"
                            fontSize="20"
                            fontWeight="700"
                            fill="var(--text-h)"
                          >
                            {formatMoney(totalSpent, currency)}
                          </tspan>
                          <tspan x={cx} dy="1.5em" fontSize="12" fill="var(--text)">
                            {topCategory}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip formatter={(value) => formatMoney(value, currency)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="panel">
          <h2>Income vs Expenses ({new Date().getFullYear()})</h2>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trend}>
              <defs>
                <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
              <YAxis stroke="var(--text)" fontSize={12} />
              <Tooltip formatter={(value) => formatMoney(value, currency)} />
              <Legend />
              <Area
                type="monotone"
                dataKey="Income"
                stroke="#22c55e"
                strokeWidth={2.5}
                fill="url(#incomeGradient)"
              />
              <Area
                type="monotone"
                dataKey="Expenses"
                stroke="#ef4444"
                strokeWidth={2.5}
                fill="url(#expensesGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;

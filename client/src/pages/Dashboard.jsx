import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
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
import { formatMoney, formatCompact, MONTH_NAMES } from "../format";
import Banner from "../components/Banner";
import { IconWallet, IconArrowUp, IconArrowDown, IconPiggyBank } from "../components/icons";

const COLORS = ["#7c3aed", "#0d9488", "#d97706", "#a78bfa", "#2dd4bf", "#fbbf24", "#4c1d95"];

function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [byCategory, setByCategory] = useState([]);
  const [trend, setTrend] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    let cancelled = false;

    Promise.all([
      api.get("/reports/summary", { params: { month, year } }),
      api.get("/reports/by-category", { params: { month, year, type: "EXPENSE" } }),
      api.get("/reports/trend", { params: { year } }),
      api.get("/transactions", { params: { page: 1, pageSize: 5 } }),
    ])
      .then(([summaryRes, categoryRes, trendRes, recentRes]) => {
        if (cancelled) return;
        setSummary(summaryRes.data);
        setByCategory(categoryRes.data.items);
        setTrend(
          trendRes.data.items.map((m) => ({
            name: MONTH_NAMES[m.month - 1].slice(0, 3),
            Income: m.income,
            Expenses: m.expenses,
          }))
        );
        setRecent(recentRes.data.items);
      })
      .catch(() => {
        if (!cancelled) {
          setError("We couldn’t load your dashboard. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const currency = user?.currency || "NGN";
  const totalSpent = byCategory.reduce((sum, c) => sum + c.total, 0);
  const topCategory = byCategory[0]?.category || "";
  const year = new Date().getFullYear();

  // Shimmer only while the first load is in flight — a failed load shows a dash.
  const statsLoading = loading && !summary;
  const statClass = `stat-card-value${statsLoading ? " skeleton" : ""}`;
  const statValue = (amount) => {
    if (summary) return formatMoney(amount, currency);
    return statsLoading ? "₦0,000.00" : "—";
  };

  const pieLabel = byCategory.length
    ? `Spending by category: ${byCategory
        .map((c) => `${c.category} ${formatMoney(c.total, currency)}`)
        .join(", ")}`
    : "No expenses recorded this month";

  return (
    <div>
      <h1 className="page-title">Dashboard</h1>

      <Banner>{error}</Banner>

      <div className="stat-cards">
        <div className="stat-card-lg">
          <span className="stat-card-icon">
            <IconWallet />
          </span>
          <span className="stat-card-label">Total Balance</span>
          <span className={statClass}>{statValue(summary?.totalBalance)}</span>
        </div>
        <div className="stat-card-lg stat-positive">
          <span className="stat-card-icon">
            <IconArrowUp />
          </span>
          <span className="stat-card-label">Income (this month)</span>
          <span className={statClass}>{statValue(summary?.income)}</span>
        </div>
        <div className="stat-card-lg stat-negative">
          <span className="stat-card-icon">
            <IconArrowDown />
          </span>
          <span className="stat-card-label">Expenses (this month)</span>
          <span className={statClass}>{statValue(summary?.expenses)}</span>
        </div>
        <div className="stat-card-lg stat-savings">
          <span className="stat-card-icon">
            <IconPiggyBank />
          </span>
          <span className="stat-card-label">Total Savings</span>
          <span className={statClass}>{statValue(summary?.savingsTotal)}</span>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <h2>Spending by Category</h2>
          {byCategory.length === 0 ? (
            <p className="empty-state">
              No expenses recorded this month yet.
              <Link className="btn btn-primary" to="/transactions">
                + Add a transaction
              </Link>
            </p>
          ) : (
            /* Recharts stamps role="img" on every slice without a name, so the
               graphic is hidden and the labelled wrapper carries the summary. */
            <div role="img" aria-label={pieLabel}>
              <div aria-hidden="true">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="total"
                      nameKey="category"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      rootTabIndex={-1}
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
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Income vs Expenses ({year})</h2>
          <div role="img" aria-label={`Income and expenses by month for ${year}`}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22c55e" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expensesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
                <YAxis
                  stroke="var(--text)"
                  fontSize={12}
                  width={72}
                  tickFormatter={(value) => formatCompact(value, currency)}
                />
                <Tooltip formatter={(value) => formatMoney(value, currency)} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="Income"
                  stroke="#22c55e"
                  fill="url(#incomeGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="Expenses"
                  stroke="#ef4444"
                  fill="url(#expensesGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <h2>Recent activity</h2>
          <Link className="link-arrow" to="/transactions">
            View all →
          </Link>
        </div>

        {recent.length === 0 ? (
          <p className="empty-state">
            Nothing logged yet.
            <Link className="btn btn-primary" to="/transactions">
              + Add transaction
            </Link>
          </p>
        ) : (
          <ul className="activity-list">
            {recent.map((t) => (
              <li className="activity-item" key={t.id}>
                <span className={`activity-icon ${t.type === "INCOME" ? "income" : "expense"}`}>
                  {t.type === "INCOME" ? (
                    <IconArrowUp width={16} height={16} />
                  ) : (
                    <IconArrowDown width={16} height={16} />
                  )}
                </span>
                <div className="activity-desc">
                  <strong>{t.description || t.category}</strong>
                  <span>
                    {t.category} · {t.date.slice(0, 10)}
                  </span>
                </div>
                <span className={t.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                  {t.type === "INCOME" ? "+" : "-"}
                  {formatMoney(t.amount, currency)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default Dashboard;

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney, formatCompact, MONTH_NAMES } from "../format";
import Banner from "../components/Banner";

const COLORS = ["#7c3aed", "#0d9488", "#d97706", "#a78bfa", "#2dd4bf", "#fbbf24", "#4c1d95"];

function Reports() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [type, setType] = useState("EXPENSE");
  const [trend, setTrend] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    api
      .get("/reports/trend", { params: { year } })
      .then((res) => {
        if (cancelled) return;
        setTrend(
          res.data.items.map((m) => ({
            name: MONTH_NAMES[m.month - 1].slice(0, 3),
            Income: m.income,
            Expenses: m.expenses,
          }))
        );
      })
      .catch(() => {
        if (!cancelled) setError("We couldn’t load your reports. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/reports/by-category", { params: { month, year, type } })
      .then((res) => {
        if (!cancelled) setByCategory(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn’t load your reports. Check your connection and try again.");
      });
    return () => {
      cancelled = true;
    };
  }, [month, year, type]);

  const yearTotal = trend.reduce(
    (acc, m) => ({ income: acc.income + m.Income, expenses: acc.expenses + m.Expenses }),
    { income: 0, expenses: 0 }
  );

  const catTotal = byCategory.reduce((sum, c) => sum + c.total, 0);
  const isExpense = type === "EXPENSE";
  const catLabel = isExpense ? "Spending by category" : "Income by category";
  const chartLabel = byCategory.length
    ? `${catLabel} for ${MONTH_NAMES[month - 1]} ${year}: ${byCategory
        .map((c) => `${c.category} ${formatMoney(c.total, currency)}`)
        .join(", ")}`
    : `${catLabel}: no data`;

  return (
    <div>
      <h1 className="page-title">Reports</h1>

      <Banner>{error}</Banner>

      <div className="panel">
        <div className="page-header">
          <h2>Yearly trend</h2>
          <select
            aria-label="Year"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
          >
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        <p className="muted" style={{ marginBottom: 16 }}>
          {year} total — Income: {formatMoney(yearTotal.income, currency)} · Expenses:{" "}
          {formatMoney(yearTotal.expenses, currency)}
        </p>

        <div role="img" aria-label={`Income and expenses by month for ${year}`}>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
              <YAxis
                stroke="var(--text)"
                fontSize={12}
                width={72}
                tickFormatter={(v) => formatCompact(v, currency)}
              />
              <Tooltip formatter={(value) => formatMoney(value, currency)} />
              <Legend />
              <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="page-header">
          <h2>{catLabel}</h2>
          <div className="page-header-actions">
            <div className="theme-toggle" role="group" aria-label="Amount type">
              <button
                type="button"
                className={isExpense ? "active" : ""}
                aria-pressed={isExpense}
                onClick={() => setType("EXPENSE")}
              >
                Expenses
              </button>
              <button
                type="button"
                className={!isExpense ? "active" : ""}
                aria-pressed={!isExpense}
                onClick={() => setType("INCOME")}
              >
                Income
              </button>
            </div>
            <select
              aria-label="Month"
              value={month}
              onChange={(e) => setMonth(parseInt(e.target.value))}
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>

        {byCategory.length === 0 ? (
          <p className="empty-state">
            No {isExpense ? "expenses" : "income"} recorded for {MONTH_NAMES[month - 1]} {year}.
          </p>
        ) : (
          <div className="report-split">
            {/* Recharts stamps role="img" on every slice without a name, so the
                graphic is hidden and the labelled wrapper carries the summary. */}
            <div role="img" aria-label={chartLabel}>
              <div aria-hidden="true">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={byCategory}
                      dataKey="total"
                      nameKey="category"
                      outerRadius={110}
                      label
                    >
                      {byCategory.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(value, currency)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {byCategory.map((c) => (
                    <tr key={c.category}>
                      <td>{c.category}</td>
                      <td className={isExpense ? "amount-negative" : "amount-positive"}>
                        {formatMoney(c.total, currency)}
                      </td>
                      <td>{catTotal ? Math.round((c.total / catTotal) * 100) : 0}%</td>
                    </tr>
                  ))}
                  <tr>
                    <td>
                      <strong>Total</strong>
                    </td>
                    <td>
                      <strong>{formatMoney(catTotal, currency)}</strong>
                    </td>
                    <td>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Reports;

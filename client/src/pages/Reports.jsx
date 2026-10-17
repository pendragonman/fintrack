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
import { formatMoney, MONTH_NAMES } from "../format";

const COLORS = ["#7c3aed", "#0d9488", "#d97706", "#a78bfa", "#2dd4bf", "#fbbf24", "#4c1d95"];

function Reports() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [trend, setTrend] = useState([]);
  const [byCategory, setByCategory] = useState([]);

  useEffect(() => {
    api.get("/reports/trend", { params: { year } }).then((res) =>
      setTrend(
        res.data.items.map((m) => ({
          name: MONTH_NAMES[m.month - 1].slice(0, 3),
          Income: m.income,
          Expenses: m.expenses,
        }))
      )
    );
  }, [year]);

  useEffect(() => {
    api
      .get("/reports/by-category", { params: { month, year, type: "EXPENSE" } })
      .then((res) => setByCategory(res.data.items));
  }, [month, year]);

  const yearTotal = trend.reduce(
    (acc, m) => ({ income: acc.income + m.Income, expenses: acc.expenses + m.Expenses }),
    { income: 0, expenses: 0 }
  );

  return (
    <div>
      <h1 className="page-title">Reports</h1>

      <div className="panel">
        <div className="page-header">
          <h2>Yearly trend</h2>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
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

        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" stroke="var(--text)" fontSize={12} />
            <YAxis stroke="var(--text)" fontSize={12} />
            <Tooltip formatter={(value) => formatMoney(value, currency)} />
            <Legend />
            <Bar dataKey="Income" fill="#22c55e" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="page-header">
          <h2>Spending by category</h2>
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {byCategory.length === 0 ? (
          <p className="empty-state">No expenses recorded for this month.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={byCategory} dataKey="total" nameKey="category" outerRadius={110}>
                {byCategory.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatMoney(value, currency)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default Reports;

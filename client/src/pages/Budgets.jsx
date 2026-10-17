import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney, MONTH_NAMES } from "../format";
import { CATEGORIES } from "../categories";

function Budgets() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[3], limitAmount: "" });
  const [error, setError] = useState("");

  function load() {
    api.get("/budgets", { params: { month, year } }).then((res) => setItems(res.data.items));
  }

  useEffect(load, [month, year]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/budgets", {
        category: form.category,
        limitAmount: parseFloat(form.limitAmount),
        month,
        year,
      });
      setShowForm(false);
      setForm({ category: CATEGORIES[3], limitAmount: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this budget?")) return;
    await api.delete(`/budgets/${id}`);
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budgets</h1>
        <div className="page-header-actions">
          <select value={month} onChange={(e) => setMonth(parseInt(e.target.value))}>
            {MONTH_NAMES.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}>
            {[year - 1, year, year + 1].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Add budget
          </button>
        </div>
      </div>

      <div className="budgets-grid">
        {items.map((b) => {
          const pct = Math.min(100, (b.spent / Number(b.limitAmount)) * 100);
          return (
            <div className="panel budget-card" key={b.id}>
              <div className="budget-card-header">
                <h3>{b.category}</h3>
                <button className="link-btn" onClick={() => handleDelete(b.id)}>
                  Remove
                </button>
              </div>
              <p className="budget-amounts">
                {formatMoney(b.spent, currency)} of {formatMoney(b.limitAmount, currency)}
              </p>
              <div className="proficiency-track">
                <div
                  className={`budget-fill ${b.exceeded ? "budget-fill-over" : ""}`}
                  style={{ width: `${pct}%` }}
                ></div>
              </div>
              {b.exceeded && (
                <p className="budget-alert">
                  ⚠ Over budget by {formatMoney(b.spent - Number(b.limitAmount), currency)}
                </p>
              )}
            </div>
          );
        })}
        {items.length === 0 && <p className="empty-state">No budgets set for this month yet.</p>}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>
              Add budget — {MONTH_NAMES[month - 1]} {year}
            </h2>
            {error && <div className="auth-error">{error}</div>}

            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Monthly limit
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.limitAmount}
                onChange={(e) => setForm((f) => ({ ...f, limitAmount: e.target.value }))}
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Save budget
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Budgets;

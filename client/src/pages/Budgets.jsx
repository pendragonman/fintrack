import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney, MONTH_NAMES } from "../format";
import { CATEGORIES } from "../categories";
import Banner from "../components/Banner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

function Budgets() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency || "NGN";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: CATEGORIES[3], limitAmount: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get("/budgets", { params: { month, year } })
      .then((res) => {
        if (!cancelled) setItems(res.data.items);
      })
      .catch(() => {
        if (!cancelled) setError("We couldn’t load your budgets. Check your connection and try again.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, year, reloadKey]);

  const usedCategories = items.map((b) => b.category);
  const availableCategories = CATEGORIES.filter((c) => !usedCategories.includes(c));
  const totalBudgeted = items.reduce((sum, b) => sum + Number(b.limitAmount), 0);
  const totalSpent = items.reduce((sum, b) => sum + b.spent, 0);

  function openForm() {
    setForm({
      category: availableCategories[0] || CATEGORIES[0],
      limitAmount: "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api.post("/budgets", {
        category: form.category,
        limitAmount: parseFloat(form.limitAmount),
        month,
        year,
      });
      setShowForm(false);
      setForm({ category: CATEGORIES[3], limitAmount: "" });
      setReloadKey((k) => k + 1);
      notify("Budget saved");
    } catch (err) {
      setFormError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/budgets/${pendingDelete}`);
      notify("Budget removed");
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.error || "Could not remove that budget", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Budgets</h1>
        <div className="page-header-actions">
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
          <button
            className="btn btn-primary"
            onClick={openForm}
            disabled={loading || availableCategories.length === 0}
            title={
              availableCategories.length === 0
                ? "Every category already has a budget this month"
                : undefined
            }
          >
            + Add budget
          </button>
        </div>
      </div>

      <Banner>{error}</Banner>

      {items.length > 0 && (
        <p className="muted" style={{ marginBottom: 16 }}>
          {items.length} categor{items.length === 1 ? "y" : "ies"} this month — budgeted{" "}
          {formatMoney(totalBudgeted, currency)}, spent {formatMoney(totalSpent, currency)}.
        </p>
      )}

      <div className="budgets-grid">
        {items.map((b) => {
          const rawPct = (b.spent / Number(b.limitAmount)) * 100;
          const pct = Math.round(rawPct);
          const fillClass = b.exceeded
            ? "budget-fill-over"
            : rawPct >= 80
              ? "budget-fill-warn"
              : "";
          return (
            <div className="panel budget-card" key={b.id}>
              <div className="budget-card-header">
                <h3>{b.category}</h3>
                <button className="link-btn" onClick={() => setPendingDelete(b.id)}>
                  Remove
                </button>
              </div>
              <p className="budget-amounts">
                {formatMoney(b.spent, currency)} of {formatMoney(b.limitAmount, currency)}
              </p>
              <div className="proficiency-track">
                <div
                  className={`budget-fill ${fillClass}`}
                  style={{ width: `${Math.min(100, rawPct)}%` }}
                ></div>
              </div>
              <div className="progress-meta">
                <span>{pct}% used</span>
                <span>
                  {b.exceeded
                    ? `${formatMoney(b.spent - Number(b.limitAmount), currency)} over`
                    : `${formatMoney(Number(b.limitAmount) - b.spent, currency)} left`}
                </span>
              </div>
              {b.exceeded && (
                <p className="budget-alert">
                  ⚠ Over budget by {formatMoney(b.spent - Number(b.limitAmount), currency)}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          {loading
            ? "Loading your budgets…"
            : error
              ? "Budgets unavailable."
              : `No budgets set for ${MONTH_NAMES[month - 1]} ${year} yet.`}
          {!loading && !error && (
            <button className="btn btn-primary" onClick={openForm}>
              + Add your first budget
            </button>
          )}
        </div>
      )}

      {showForm && (
        <Modal
          title={`Add budget — ${MONTH_NAMES[month - 1]} ${year}`}
          onClose={() => {
            setShowForm(false);
            setFormError("");
          }}
        >
          <form className="modal-form" onSubmit={handleSubmit}>
            {formError && (
              <div className="banner banner-error" role="alert">
                {formError}
              </div>
            )}

            <label>
              Category
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {availableCategories.map((c) => (
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
                autoFocus
                value={form.limitAmount}
                onChange={(e) => setForm((f) => ({ ...f, limitAmount: e.target.value }))}
              />
            </label>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowForm(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save budget"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Remove budget"
          message="This budget will be removed for the selected month. Your transactions are not affected."
          confirmLabel="Remove"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default Budgets;

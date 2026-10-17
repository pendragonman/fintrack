import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../format";

const emptyForm = { name: "", targetAmount: "", targetDate: "" };

function Goals() {
  const { user } = useAuth();
  const currency = user?.currency || "NGN";

  const [items, setItems] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [contributeAmounts, setContributeAmounts] = useState({});

  function load() {
    api.get("/goals").then((res) => setItems(res.data.items));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post("/goals", {
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        targetDate: form.targetDate || null,
      });
      setShowForm(false);
      setForm(emptyForm);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Something went wrong");
    }
  }

  async function handleDelete(id) {
    if (!confirm("Delete this goal?")) return;
    await api.delete(`/goals/${id}`);
    load();
  }

  async function handleContribute(id) {
    const amount = parseFloat(contributeAmounts[id]);
    if (!amount) return;
    await api.post(`/goals/${id}/contribute`, { amount });
    setContributeAmounts((c) => ({ ...c, [id]: "" }));
    load();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Savings Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add goal
        </button>
      </div>

      <div className="goals-grid">
        {items.map((g) => {
          const pct = Math.min(100, (Number(g.currentAmount) / Number(g.targetAmount)) * 100);
          return (
            <div className="panel goal-card" key={g.id}>
              <div className="budget-card-header">
                <h3>{g.name}</h3>
                <button className="link-btn" onClick={() => handleDelete(g.id)}>
                  Remove
                </button>
              </div>
              <p className="budget-amounts">
                {formatMoney(g.currentAmount, currency)} of {formatMoney(g.targetAmount, currency)}
              </p>
              <div className="proficiency-track">
                <div className="goal-fill" style={{ width: `${pct}%` }}></div>
              </div>
              {g.targetDate && (
                <p className="muted">Target date: {g.targetDate.slice(0, 10)}</p>
              )}
              <div className="goal-contribute">
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={contributeAmounts[g.id] || ""}
                  onChange={(e) =>
                    setContributeAmounts((c) => ({ ...c, [g.id]: e.target.value }))
                  }
                />
                <button className="btn btn-secondary" onClick={() => handleContribute(g.id)}>
                  Add funds
                </button>
              </div>
            </div>
          );
        })}
        {items.length === 0 && <p className="empty-state">No savings goals yet.</p>}
      </div>

      {showForm && (
        <div className="modal-backdrop" onClick={() => setShowForm(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
            <h2>Add savings goal</h2>
            {error && <div className="auth-error">{error}</div>}

            <label>
              Name
              <input
                required
                placeholder='e.g. "Save for a laptop"'
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </label>

            <label>
              Target amount
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.targetAmount}
                onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
              />
            </label>

            <label>
              Target date (optional)
              <input
                type="date"
                value={form.targetDate}
                onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
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
                Save goal
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default Goals;

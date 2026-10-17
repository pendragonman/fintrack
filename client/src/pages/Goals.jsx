import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../format";
import Banner from "../components/Banner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

const emptyForm = { name: "", targetAmount: "", targetDate: "" };

function Goals() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency || "NGN";

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [contributeAmounts, setContributeAmounts] = useState({});
  const [contributingId, setContributingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    api
      .get("/goals")
      .then((res) => {
        if (!cancelled) setItems(res.data.items);
      })
      .catch(() => {
        if (!cancelled) {
          setError("We couldn’t load your goals. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    try {
      await api.post("/goals", {
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        targetDate: form.targetDate || null,
      });
      setShowForm(false);
      setForm(emptyForm);
      setReloadKey((k) => k + 1);
      notify("Goal created");
    } catch (err) {
      setFormError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/goals/${pendingDelete}`);
      notify("Goal removed");
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.error || "Could not remove that goal", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleContribute(e, id) {
    e.preventDefault();
    const amount = parseFloat(contributeAmounts[id]);
    if (!amount || amount <= 0) {
      notify("Enter an amount greater than zero", "error");
      return;
    }

    setContributingId(id);
    try {
      await api.post(`/goals/${id}/contribute`, { amount });
      setContributeAmounts((c) => ({ ...c, [id]: "" }));
      setReloadKey((k) => k + 1);
      notify("Funds added");
    } catch (err) {
      notify(err.response?.data?.error || "Could not add funds", "error");
    } finally {
      setContributingId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Savings Goals</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Add goal
        </button>
      </div>

      <Banner>{error}</Banner>

      <div className="goals-grid">
        {items.map((g) => {
          const target = Number(g.targetAmount);
          const current = Number(g.currentAmount);
          const rawPct = target > 0 ? (current / target) * 100 : 0;
          const pct = Math.round(rawPct);
          const complete = current >= target && target > 0;
          return (
            <div className="panel goal-card" key={g.id}>
              <div className="budget-card-header">
                <h3>{g.name}</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {complete && <span className="badge badge-success">Complete</span>}
                  <button className="link-btn" onClick={() => setPendingDelete(g.id)}>
                    Remove
                  </button>
                </div>
              </div>

              <p className="budget-amounts">
                {formatMoney(current, currency)} of {formatMoney(target, currency)}
              </p>

              <div className="proficiency-track">
                <div className="goal-fill" style={{ width: `${Math.min(100, rawPct)}%` }}></div>
              </div>
              <div className="progress-meta">
                <span>{pct}% saved</span>
                <span>
                  {complete
                    ? "Goal reached"
                    : `${formatMoney(target - current, currency)} to go`}
                </span>
              </div>

              {g.targetDate && (
                <p className="muted" style={{ marginTop: 8 }}>
                  Target date: {g.targetDate.slice(0, 10)}
                </p>
              )}

              <form className="goal-contribute" onSubmit={(e) => handleContribute(e, g.id)}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  aria-label={`Amount to add to ${g.name}`}
                  placeholder="Amount"
                  value={contributeAmounts[g.id] || ""}
                  onChange={(e) =>
                    setContributeAmounts((c) => ({ ...c, [g.id]: e.target.value }))
                  }
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={contributingId === g.id}
                >
                  {contributingId === g.id ? "Adding…" : "Add funds"}
                </button>
              </form>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="empty-state">
          {loading
            ? "Loading your goals…"
            : error
              ? "Goals unavailable."
              : "No savings goals yet — start with something small."}
          {!loading && !error && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Add your first goal
            </button>
          )}
        </div>
      )}

      {showForm && (
        <Modal
          title="Add savings goal"
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
              Name
              <input
                required
                autoFocus
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
                disabled={saving}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? "Saving…" : "Save goal"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Remove goal"
          message="This savings goal will be permanently removed. That can’t be undone."
          confirmLabel="Remove"
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default Goals;

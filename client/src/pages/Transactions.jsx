import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../format";
import { CATEGORIES } from "../categories";
import Banner from "../components/Banner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

function emptyForm() {
  return {
    type: "EXPENSE",
    amount: "",
    category: CATEGORIES[3],
    description: "",
    date: new Date().toISOString().slice(0, 10),
    accountId: "",
  };
}

function Transactions() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency || "NGN";

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const [filters, setFilters] = useState({
    type: "",
    category: "",
    search: "",
    from: "",
    to: "",
    accountId: "",
  });
  const [accounts, setAccounts] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  function updateFilter(key, value) {
    setFilters((f) => ({ ...f, [key]: value }));
    setPage(1);
  }

  // Debounced so typing in the search box doesn't fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((f) => (f.search === search ? f : { ...f, search }));
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError("");

    const params = { page, pageSize };
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });

    api
      .get("/transactions", { params })
      .then((res) => {
        if (cancelled) return;
        setItems(res.data.items);
        setTotal(res.data.total);
      })
      .catch(() => {
        if (!cancelled) {
          setListError("We couldn’t load your transactions. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, filters, reloadKey]);

  const filtersActive = Object.values(filters).some(Boolean);

  // The account picker is a convenience; the list still works without it.
  useEffect(() => {
    let cancelled = false;
    api
      .get("/accounts")
      .then((res) => {
        if (!cancelled) setAccounts(res.data.items.filter((a) => !a.archived));
      })
      .catch(() => {
        if (!cancelled) setAccounts([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function clearFilters() {
    setSearch("");
    setFilters({ type: "", category: "", search: "", from: "", to: "", accountId: "" });
    setPage(1);
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm(), accountId: accounts[0]?.id || "" });
    setFormError("");
    setShowForm(true);
  }

  function openEdit(t) {
    setEditingId(t.id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category,
      description: t.description || "",
      date: t.date.slice(0, 10),
      accountId: t.accountId || "",
    });
    setFormError("");
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);
    const payload = {
      ...form,
      amount: parseFloat(form.amount),
      accountId: form.accountId || null,
    };

    try {
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        notify("Transaction updated");
      } else {
        await api.post("/transactions", payload);
        notify("Transaction added");
      }
      setShowForm(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/transactions/${pendingDelete.id}`);
      notify(pendingDelete.transferGroupId ? "Transfer deleted" : "Transaction deleted");
      setPendingDelete(null);
      if (items.length === 1 && page > 1) setPage((p) => p - 1);
      else setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.error || "Could not delete that transaction", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    const params = {};
    Object.entries(filters).forEach(([k, v]) => {
      if (v) params[k] = v;
    });
    try {
      const res = await api.get("/transactions/export", { params, responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      notify("CSV downloaded");
    } catch {
      notify("Export failed — try again", "error");
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const money = (t) => `${t.type === "INCOME" ? "+" : "-"}${formatMoney(t.amount, currency)}`;
  const accountLabel = (t) => t.account?.name || (accounts.length ? "Unassigned" : "");

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Transactions</h1>
        <div className="page-header-actions">
          <button className="btn btn-secondary" onClick={handleExport}>
            Export CSV
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add transaction
          </button>
        </div>
      </div>

      <Banner>{listError}</Banner>

      <div className="filters">
        <select
          aria-label="Filter by type"
          value={filters.type}
          onChange={(e) => updateFilter("type", e.target.value)}
        >
          <option value="">All types</option>
          <option value="INCOME">Income</option>
          <option value="EXPENSE">Expense</option>
        </select>

        <select
          aria-label="Filter by category"
          value={filters.category}
          onChange={(e) => updateFilter("category", e.target.value)}
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {accounts.length > 0 && (
          <select
            aria-label="Filter by account"
            value={filters.accountId}
            onChange={(e) => updateFilter("accountId", e.target.value)}
          >
            <option value="">All accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
            <option value="unassigned">Unassigned</option>
          </select>
        )}

        <input
          type="date"
          aria-label="From date"
          value={filters.from}
          onChange={(e) => updateFilter("from", e.target.value)}
        />
        <input
          type="date"
          aria-label="To date"
          value={filters.to}
          onChange={(e) => updateFilter("to", e.target.value)}
        />

        <input
          type="text"
          aria-label="Search descriptions"
          placeholder="Search description…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {filtersActive && (
          <button type="button" className="btn btn-secondary" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {items.length > 0 && (
        <p className="muted" style={{ marginBottom: 12 }}>
          Showing {from}–{to} of {total}
        </p>
      )}

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Category</th>
              <th scope="col">Description</th>
              {accounts.length > 0 && <th scope="col">Account</th>}
              <th scope="col">Amount</th>
              <th scope="col">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t.id}>
                <td>{t.date.slice(0, 10)}</td>
                <td>
                  {t.category}
                  {t.transferGroupId && <span className="badge badge-transfer">Transfer</span>}
                </td>
                <td>{t.description || "—"}</td>
                {accounts.length > 0 && <td>{accountLabel(t)}</td>}
                <td className={t.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                  {money(t)}
                </td>
                <td>
                  <div className="row-actions">
                    {t.transferGroupId ? (
                      <span className="muted">Transfer</span>
                    ) : (
                      <button onClick={() => openEdit(t)}>Edit</button>
                    )}
                    <button onClick={() => setPendingDelete(t)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={accounts.length > 0 ? 6 : 5}>
                  <div className="empty-state">
                    {loading ? (
                      "Loading…"
                    ) : listError ? (
                      "Transactions unavailable."
                    ) : filtersActive ? (
                      <>
                        No transactions match your filters.
                        <button className="btn btn-secondary" onClick={clearFilters}>
                          Clear filters
                        </button>
                      </>
                    ) : (
                      <>
                        No transactions yet.
                        <button className="btn btn-primary" onClick={openCreate}>
                          + Add your first transaction
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length > 0 && (
        <div className="tx-cards">
          {items.map((t) => (
            <div className="tx-card" key={t.id}>
              <div className="tx-card-top">
                <div>
                  <div className="tx-card-desc">{t.description || t.category}</div>
                  <div className="tx-card-meta">
                    {t.category}
                    {t.transferGroupId && <span className="badge badge-transfer">Transfer</span>} ·{" "}
                    {t.date.slice(0, 10)}
                    {accountLabel(t) ? ` · ${accountLabel(t)}` : ""}
                  </div>
                </div>
                <span className={t.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                  {money(t)}
                </span>
              </div>
              <div className="tx-card-actions">
                {!t.transferGroupId && (
                  <button className="btn btn-secondary" onClick={() => openEdit(t)}>
                    Edit
                  </button>
                )}
                <button className="btn btn-secondary" onClick={() => setPendingDelete(t)}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Prev
          </button>
          <span>
            Page {page} of {totalPages}
          </span>
          <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </button>
        </div>
      )}

      {showForm && (
        <Modal
          title={editingId ? "Edit transaction" : "Add transaction"}
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
              Type
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="EXPENSE">Expense</option>
                <option value="INCOME">Income</option>
              </select>
            </label>

            <label>
              Amount
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </label>

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

            {accounts.length > 0 && (
              <label>
                Account
                <select
                  value={form.accountId}
                  onChange={(e) => setForm((f) => ({ ...f, accountId: e.target.value }))}
                >
                  <option value="">No account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Date
              <input
                type="date"
                required
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </label>

            <label>
              Description (optional)
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
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
                {saving ? "Saving…" : editingId ? "Save changes" : "Add transaction"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title={pendingDelete.transferGroupId ? "Delete transfer" : "Delete transaction"}
          message={
            pendingDelete.transferGroupId
              ? "Both legs of this transfer will be removed and the affected account balances will go back to what they were."
              : "This transaction will be permanently removed. That can’t be undone."
          }
          confirmLabel={pendingDelete.transferGroupId ? "Delete transfer" : "Delete"}
          busy={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

export default Transactions;

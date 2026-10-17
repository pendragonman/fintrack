import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../format";
import Banner from "../components/Banner";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

const ACCOUNT_TYPES = [
  { value: "BANK", label: "Bank account" },
  { value: "CASH", label: "Cash" },
  { value: "CARD", label: "Card" },
  { value: "WALLET", label: "Mobile wallet" },
  { value: "SAVINGS", label: "Savings" },
  { value: "INVESTMENT", label: "Investment" },
];

const TYPE_LABELS = Object.fromEntries(ACCOUNT_TYPES.map((t) => [t.value, t.label]));

function emptyAccount() {
  return { name: "", type: "BANK", openingBalance: "", claimUnassigned: false };
}

function emptyTransfer(accounts = []) {
  return {
    fromAccountId: accounts[0]?.id || "",
    toAccountId: accounts[1]?.id || "",
    amount: "",
    date: new Date().toISOString().slice(0, 10),
    description: "",
  };
}

function Accounts() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency || "NGN";

  const [data, setData] = useState({ items: [], totalBalance: 0, unassignedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyAccount);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [transferOpen, setTransferOpen] = useState(false);
  const [transfer, setTransfer] = useState(() => emptyTransfer());
  const [transferError, setTransferError] = useState("");
  const [transferring, setTransferring] = useState(false);

  const [pendingDelete, setPendingDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setListError("");

    api
      .get("/accounts")
      .then((res) => {
        if (!cancelled) setData(res.data);
      })
      .catch(() => {
        if (!cancelled) {
          setListError("We couldn’t load your accounts. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const accounts = data.items;
  const activeAccounts = accounts.filter((a) => !a.archived);

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyAccount(), claimUnassigned: accounts.length === 0 });
    setFormError("");
    setFormOpen(true);
  }

  function openEdit(account) {
    setEditingId(account.id);
    setForm({
      name: account.name,
      type: account.type,
      openingBalance: String(account.openingBalance),
      claimUnassigned: false,
    });
    setFormError("");
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    const payload = {
      name: form.name.trim(),
      type: form.type,
      openingBalance: form.openingBalance === "" ? 0 : parseFloat(form.openingBalance),
    };

    try {
      if (editingId) {
        await api.put(`/accounts/${editingId}`, payload);
        notify("Account updated");
      } else {
        const res = await api.post("/accounts", {
          ...payload,
          claimUnassigned: form.claimUnassigned,
        });
        const claimed = res.data.claimed || 0;
        notify(
          claimed > 0
            ? `Account added — ${claimed} transaction${claimed === 1 ? "" : "s"} linked to it`
            : "Account added"
        );
      }
      setFormOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setFormError(err.response?.data?.error || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchived(account) {
    try {
      await api.put(`/accounts/${account.id}`, { archived: !account.archived });
      notify(account.archived ? "Account restored" : "Account archived");
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.error || "Could not update that account", "error");
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.delete(`/accounts/${pendingDelete}`);
      notify("Account deleted — its transactions are now unassigned");
      setPendingDelete(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      notify(err.response?.data?.error || "Could not delete that account", "error");
    } finally {
      setDeleting(false);
    }
  }

  function openTransfer() {
    setTransfer(emptyTransfer(activeAccounts));
    setTransferError("");
    setTransferOpen(true);
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setTransferError("");
    setTransferring(true);
    try {
      await api.post("/accounts/transfer", {
        ...transfer,
        amount: parseFloat(transfer.amount),
      });
      notify("Transfer recorded");
      setTransferOpen(false);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setTransferError(err.response?.data?.error || "Something went wrong");
    } finally {
      setTransferring(false);
    }
  }

  const fromAccount = accounts.find((a) => a.id === transfer.fromAccountId);
  const toAccount = accounts.find((a) => a.id === transfer.toAccountId);
  const deleteTarget = accounts.find((a) => a.id === pendingDelete);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={openTransfer}
            disabled={activeAccounts.length < 2}
            title={activeAccounts.length < 2 ? "Add two accounts to transfer between them" : undefined}
          >
            Transfer
          </button>
          <button className="btn btn-primary" onClick={openCreate}>
            + Add account
          </button>
        </div>
      </div>

      <Banner>{listError}</Banner>

      {accounts.length > 0 && (
        <p className="account-summary">
          <span className="muted">Net across {activeAccounts.length} active account
            {activeAccounts.length === 1 ? "" : "s"}</span>
          <strong>{formatMoney(data.totalBalance, currency)}</strong>
        </p>
      )}

      {data.unassignedCount > 0 && (
        <p className="account-hint">
          {data.unassignedCount} transaction{data.unassignedCount === 1 ? "" : "s"} not linked to
          an account yet.{" "}
          <button type="button" className="link-inline" onClick={openCreate}>
            Link them to a new account
          </button>
        </p>
      )}

      {loading && accounts.length === 0 ? (
        <p className="empty-state">Loading…</p>
      ) : accounts.length === 0 ? (
        <p className="empty-state">
          No accounts yet. Add your bank, cash or wallet accounts to see balances and move money
          between them.
          <button className="btn btn-primary" onClick={openCreate}>
            + Add your first account
          </button>
        </p>
      ) : (
        <div className="accounts-grid">
          {accounts.map((account) => (
            <div className={`account-card${account.archived ? " account-archived" : ""}`} key={account.id}>
              <div className="account-card-head">
                <div>
                  <span className="account-card-name">{account.name}</span>
                  <span className="account-card-meta">{TYPE_LABELS[account.type] || account.type}</span>
                </div>
                {account.archived && <span className="badge">Archived</span>}
              </div>

              <span
                className={`account-card-balance${
                  account.balance < 0 ? " amount-negative" : " amount-positive"
                }`}
              >
                {formatMoney(account.balance, currency)}
              </span>

              <span className="account-card-meta">
                Opening {formatMoney(account.openingBalance, currency)} · movement{" "}
                {account.movement >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(account.movement), currency)}
              </span>

              <div className="row-actions">
                <button onClick={() => openEdit(account)}>Edit</button>
                <button onClick={() => toggleArchived(account)}>
                  {account.archived ? "Restore" : "Archive"}
                </button>
                <button onClick={() => setPendingDelete(account.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <Modal
          title={editingId ? "Edit account" : "Add account"}
          onClose={() => {
            setFormOpen(false);
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
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. GTBank current"
                required
                autoFocus
              />
            </label>

            <label>
              Type
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Opening balance
              <input
                type="number"
                step="0.01"
                value={form.openingBalance}
                onChange={(e) => setForm((f) => ({ ...f, openingBalance: e.target.value }))}
                placeholder="0.00"
              />
            </label>

            {!editingId && data.unassignedCount > 0 && (
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={form.claimUnassigned}
                  onChange={(e) => setForm((f) => ({ ...f, claimUnassigned: e.target.checked }))}
                />
                Move my {data.unassignedCount} unassigned transaction
                {data.unassignedCount === 1 ? "" : "s"} into this account
              </label>
            )}

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setFormOpen(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Save changes" : "Add account"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {transferOpen && (
        <Modal
          title="Transfer between accounts"
          onClose={() => {
            setTransferOpen(false);
            setTransferError("");
          }}
        >
          <form className="modal-form" onSubmit={handleTransfer}>
            {transferError && (
              <div className="banner banner-error" role="alert">
                {transferError}
              </div>
            )}

            <label>
              From
              <select
                value={transfer.fromAccountId}
                onChange={(e) => setTransfer((t) => ({ ...t, fromAccountId: e.target.value }))}
                required
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To
              <select
                value={transfer.toAccountId}
                onChange={(e) => setTransfer((t) => ({ ...t, toAccountId: e.target.value }))}
                required
              >
                {activeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>

            {transfer.fromAccountId === transfer.toAccountId && (
              <p className="muted">Choose two different accounts.</p>
            )}

            <label>
              Amount
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={transfer.amount}
                onChange={(e) => setTransfer((t) => ({ ...t, amount: e.target.value }))}
                required
              />
            </label>

            <label>
              Date
              <input
                type="date"
                value={transfer.date}
                onChange={(e) => setTransfer((t) => ({ ...t, date: e.target.value }))}
                required
              />
            </label>

            <label>
              Note <span className="muted">(optional)</span>
              <input
                type="text"
                value={transfer.description}
                onChange={(e) => setTransfer((t) => ({ ...t, description: e.target.value }))}
                placeholder="e.g. Monthly savings"
              />
            </label>

            {fromAccount && toAccount && transfer.fromAccountId !== transfer.toAccountId && (
              <p className="muted">
                Moves money from {fromAccount.name} to {toAccount.name}. Transfers don’t count as
                income or spending.
              </p>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setTransferOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={transferring || transfer.fromAccountId === transfer.toAccountId}
              >
                {transferring ? "Transferring…" : "Transfer"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete account"
          confirmLabel="Delete account"
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
          busy={deleting}
        >
          <p>
            <strong>{deleteTarget?.name}</strong> will be removed. Its transactions are kept and
            become unassigned — no spending history is deleted.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default Accounts;

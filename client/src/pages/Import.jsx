import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import { useAuth } from "../context/AuthContext";
import { formatMoney } from "../format";
import { CATEGORIES } from "../categories";
import { detectDelimiter, parseCsv, guessMapping, buildRows, suggestUnsigned } from "../csv";
import Banner from "../components/Banner";
import ConfirmDialog from "../components/ConfirmDialog";
import { useToast } from "../components/Toast";

const CHUNK = 500;
const PREVIEW_LIMIT = 2000;
const PREVIEW_ROWS = 12;

function ColumnSelect({ label, value, onChange, headers }) {
  return (
    <label className="import-field">
      <span>{label}</span>
      <select
        value={value === null || value === undefined ? "" : String(value)}
        onChange={(event) => onChange(event.target.value === "" ? null : Number(event.target.value))}
      >
        <option value="">Not used</option>
        {headers.map((heading, index) => (
          <option key={`${heading}-${index}`} value={index}>
            {heading}
          </option>
        ))}
      </select>
    </label>
  );
}

function Import() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency || "NGN";

  const [rules, setRules] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [ruleForm, setRuleForm] = useState({ match: "", category: "Other", type: "ANY" });
  const [ruleError, setRuleError] = useState("");
  const [addingRule, setAddingRule] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  const [upload, setUpload] = useState(null);
  const [fileError, setFileError] = useState("");
  const [accountId, setAccountId] = useState("");
  const [fallbackCategory, setFallbackCategory] = useState("Other");
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [importError, setImportError] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([api.get("/rules"), api.get("/accounts")])
      .then(([rulesRes, accountsRes]) => {
        if (cancelled) return;
        setRules(rulesRes.data.items);
        setAccounts(accountsRes.data.items.filter((account) => !account.archived));
      })
      .catch(() => {
        if (!cancelled) setLoadError("We couldn’t load your rules. Refresh to try again.");
      });

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const parsed = useMemo(
    () => (upload ? buildRows(upload.records, upload.mapping) : { rows: [], badDates: [], skipped: 0 }),
    [upload]
  );

  const mapping = upload?.mapping || {};
  const splitColumns = mapping.debit !== null && mapping.debit !== undefined;
  const amountStyle = splitColumns ? "split" : "single";
  const unsigned = upload?.mapping.unsigned || "EXPENSE";
  const hasAmountSource = [mapping.amount, mapping.debit, mapping.credit].some(
    (index) => index !== null && index !== undefined
  );
  const mappingReady = Boolean(upload) && mapping.date !== null && mapping.date !== undefined && hasAmountSource;

  function resetOutputs() {
    setPreview(null);
    setResult(null);
    setImportError("");
  }

  function updateMapping(patch) {
    setUpload((current) => ({ ...current, mapping: { ...current.mapping, ...patch } }));
    resetOutputs();
  }

  function setAmountStyle(style) {
    if (style === "split") {
      updateMapping({
        amount: null,
        debit: mapping.debit ?? null,
        credit: mapping.credit ?? null,
      });
    } else {
      const unsignedDefault = upload
        ? suggestUnsigned(upload.records, mapping.amount ?? guessMapping(upload.headers).amount)
        : "EXPENSE";
      updateMapping({ debit: null, credit: null, amount: mapping.amount ?? null, unsigned: unsignedDefault });
    }
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    setFileError("");
    resetOutputs();
    if (!file) return;

    try {
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const table = parseCsv(text, delimiter);

      if (table.length < 2) {
        setUpload(null);
        setFileError("That file needs a header row and at least one transaction.");
        return;
      }

      const headers = table[0].map((heading, index) => String(heading).trim() || `Column ${index + 1}`);
      const unsignedDefault = upload
        ? suggestUnsigned(upload.records, guessMapping(upload.headers).amount)
        : "EXPENSE";
      setUpload({ name: file.name, headers, records: table.slice(1), mapping: { ...guessMapping(headers), unsigned: unsignedDefault } });
    } catch {
      setUpload(null);
      setFileError("We couldn’t read that file. Save it as CSV and try again.");
    } finally {
      event.target.value = "";
    }
  }

  function updateAmountColumn(index) {
    const unsignedDefault = upload
      ? suggestUnsigned(upload.records, index)
      : "EXPENSE";
    updateMapping({ amount: index, unsigned: unsignedDefault });
  }

  async function addRule(event) {
    event.preventDefault();
    setRuleError("");
    setAddingRule(true);

    try {
      await api.post("/rules", {
        match: ruleForm.match.trim(),
        category: ruleForm.category,
        type: ruleForm.type === "ANY" ? null : ruleForm.type,
      });
      setRuleForm((current) => ({ ...current, match: "" }));
      setReloadKey((key) => key + 1);
      notify("Rule added");
    } catch (err) {
      setRuleError(err.response?.data?.error || "Could not add that rule");
    } finally {
      setAddingRule(false);
    }
  }

  async function removeRule(rule) {
    try {
      await api.delete(`/rules/${rule.id}`);
      setRules((list) => list.filter((item) => item.id !== rule.id));
      notify("Rule removed");
    } catch {
      notify("Could not remove that rule");
    }
  }

  async function applyRules() {
    setApplying(true);
    try {
      const res = await api.post("/rules/apply", {});
      const updated = res.data.updated;
      notify(
        updated === 0 ? "Nothing left to recategorise" : `${updated} transaction${updated === 1 ? "" : "s"} recategorised`
      );
      setApplyOpen(false);
    } catch {
      notify("Could not apply the rules");
    } finally {
      setApplying(false);
    }
  }

  async function runPreview() {
    setImportError("");
    setPreviewing(true);
    try {
      const res = await api.post("/import", {
        rows: parsed.rows.slice(0, PREVIEW_LIMIT),
        accountId: accountId || null,
        fallbackCategory,
        dryRun: true,
      });
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      setImportError(err.response?.data?.error || "Could not preview that file");
    } finally {
      setPreviewing(false);
    }
  }

  async function runImport() {
    setImportError("");
    setImporting(true);

    const batches = [];
    for (let i = 0; i < parsed.rows.length; i += CHUNK) {
      batches.push(parsed.rows.slice(i, i + CHUNK));
    }

    try {
      let imported = 0;
      let duplicates = 0;
      const totals = new Map();

      for (const rows of batches) {
        const res = await api.post("/import", {
          rows,
          accountId: accountId || null,
          fallbackCategory,
        });
        imported += res.data.imported;
        duplicates += res.data.duplicates;
        for (const entry of res.data.byCategory) {
          totals.set(entry.category, (totals.get(entry.category) || 0) + entry.count);
        }
      }

      setResult({
        imported,
        duplicates,
        total: parsed.rows.length,
        byCategory: [...totals.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count),
      });
      setUpload(null);
      setPreview(null);
      notify(
        imported === 0
          ? "Nothing new to import"
          : `${imported} transaction${imported === 1 ? "" : "s"} imported`
      );
    } catch (err) {
      setImportError(err.response?.data?.error || "The import stopped part way through");
    } finally {
      setImporting(false);
    }
  }

  const previewRows = preview?.preview?.slice(0, PREVIEW_ROWS) || [];

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Import &amp; rules</h1>
        <div className="page-header-actions">
          <Link className="btn btn-secondary" to="/transactions">
            View transactions
          </Link>
        </div>
      </div>

      <Banner>{loadError}</Banner>

      <div className="panel">
        <div className="panel-head">
          <h2>Auto-categorise rules</h2>
        </div>
        <p className="muted">
          When a description contains one of your keywords, the transaction gets that category — on
          import and when you apply the rules to history.
        </p>

        <form className="rule-form" onSubmit={addRule}>
          <label className="import-field">
            <span>Keyword</span>
            <input
              type="text"
              value={ruleForm.match}
              onChange={(event) => setRuleForm((form) => ({ ...form, match: event.target.value }))}
              placeholder="e.g. Bolt"
              required
            />
          </label>

          <label className="import-field">
            <span>Only for</span>
            <select
              value={ruleForm.type}
              onChange={(event) => setRuleForm((f) => ({ ...f, type: event.target.value }))}
            >
              <option value="ANY">Income and expenses</option>
              <option value="EXPENSE">Expenses only</option>
              <option value="INCOME">Income only</option>
            </select>
          </label>

          <label className="import-field">
            <span>Category</span>
            <select
              value={ruleForm.category}
              onChange={(event) => setRuleForm((f) => ({ ...f, category: event.target.value }))}
            >
              {CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <button className="btn btn-primary" type="submit" disabled={addingRule}>
            {addingRule ? "Adding…" : "Add rule"}
          </button>
        </form>

        {ruleError && (
          <div className="banner banner-error" role="alert">
            {ruleError}
          </div>
        )}

        {rules.length === 0 ? (
          <p className="muted">
            No rules yet. Add one like <strong>Bolt → Transport</strong> and every future import is
            sorted for you.
          </p>
        ) : (
          <ul className="rule-list">
            {rules.map((rule) => (
              <li className="rule-item" key={rule.id}>
                <code className="rule-keyword">{rule.match}</code>
                <span aria-hidden="true" className="rule-arrow">
                  →
                </span>
                <span className="rule-target">{rule.category}</span>
                {rule.type && <span className="badge">{rule.type === "INCOME" ? "Income" : "Expenses"} only</span>}
                <button className="link-btn" onClick={() => removeRule(rule)}>
                  Remove<span className="sr-only"> rule for {rule.match}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <p className="import-hint">
          <button
            className="btn btn-secondary"
            type="button"
            disabled={rules.length === 0}
            onClick={() => setApplyOpen(true)}
          >
            Clean up my “{fallbackCategory}” transactions
          </button>
          <span className="muted">
            Rewrites transactions that are still in <strong>{fallbackCategory}</strong> and leaves
            everything you categorised yourself untouched.
          </span>
        </p>
      </div>

      <div className="panel" style={{ marginTop: 24 }}>
        <div className="panel-head">
          <h2>Import a CSV</h2>
          {accounts.length > 0 && (
            <Link className="link-arrow" to="/accounts">
              Accounts →
            </Link>
          )}
        </div>

        <p className="muted">
          Export a statement from your bank or wallet app, then choose the file. Nothing is saved
          until you look the preview over and press import.
        </p>

        <label className="import-field">
          <span>CSV file</span>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        </label>

        <Banner>{fileError}</Banner>

        {upload && (
          <>
            <p className="import-file">
              <strong>{upload.name}</strong> · {upload.records.length} row
              {upload.records.length === 1 ? "" : "s"} read
              {parsed.badDates.length > 0 && ` · ${parsed.badDates.length} with an unreadable date`}
              {parsed.skipped > 0 && ` · ${parsed.skipped} without an amount`}
            </p>

            <div className="import-map">
              <ColumnSelect
                label="Date column"
                value={mapping.date}
                onChange={(value) => updateMapping({ date: value })}
                headers={upload.headers}
              />
              <ColumnSelect
                label="Description column"
                value={mapping.description}
                onChange={(value) => updateMapping({ description: value })}
                headers={upload.headers}
              />

              <label className="import-field">
                <span>Amount columns</span>
                <select value={splitColumns ? "split" : "single"} onChange={(event) => setAmountStyle(event.target.value)}>
                  <option value="single">One amount column</option>
                  <option value="split">Separate debit and credit</option>
                </select>
              </label>

              {splitColumns ? (
                <>
                  <ColumnSelect
                    label="Debit column"
                    value={mapping.debit}
                    onChange={(value) => updateMapping({ debit: value })}
                    headers={upload.headers}
                  />
                  <ColumnSelect
                    label="Credit column"
                    value={mapping.credit}
                    onChange={(value) => updateMapping({ credit: value })}
                    headers={upload.headers}
                  />
                </>
              ) : (
                <ColumnSelect
                  label="Amount column"
                  value={mapping.amount}
                  onChange={(value) => updateAmountColumn(value)}
                  headers={upload.headers}
                />
              )}

              {!splitColumns && hasAmountSource && mapping.amount !== null && (
                <label className="import-field">
                  <span>Treat unsigned amounts as</span>
                  <select
                    value={unsigned}
                    onChange={(event) => updateMapping({ unsigned: event.target.value })}
                  >
                    <option value="EXPENSE">Expenses</option>
                    <option value="INCOME">Income</option>
                  </select>
                </label>
              )}

              <ColumnSelect
                label="Type column"
                value={mapping.type}
                onChange={(value) => updateMapping({ type: value })}
                headers={upload.headers}
              />

              <label className="import-field">
                <span>Account</span>
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
                  <option value="">No account</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="import-field">
                <span>Category when no rule matches</span>
                <select value={fallbackCategory} onChange={(event) => setFallbackCategory(event.target.value)}>
                  {CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="import-actions">
              <button
                className="btn btn-secondary"
                onClick={runPreview}
                disabled={!mappingReady || previewing || parsed.rows.length === 0}
              >
                {previewing ? "Checking…" : "Preview"}
              </button>
              <span className="muted">
                {parsed.rows.length} transaction{parsed.rows.length === 1 ? "" : "s"} ready
              </span>
            </div>

            <Banner>{importError}</Banner>

            {preview && (
              <>
                <p className="import-summary">
                  <strong>{preview.ready}</strong> will be imported
                  {preview.duplicates > 0 && ` · ${preview.duplicates} already recorded`}
                  {preview.total > PREVIEW_LIMIT && ` · showing the first ${PREVIEW_LIMIT} of ${preview.total}`}
                </p>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Date</th>
                        <th scope="col">Description</th>
                        <th scope="col">Amount</th>
                        <th scope="col">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, index) => (
                        <tr key={`${row.date}-${index}`} className={row.duplicate ? "row-skipped" : undefined}>
                          <td>{row.date}</td>
                          <td>{row.description || "—"}</td>
                          <td className={row.type === "INCOME" ? "amount-positive" : "amount-negative"}>
                            {row.type === "INCOME" ? "+" : "−"}
                            {formatMoney(row.amount, currency)}
                          </td>
                          <td>
                            {row.category}
                            {row.matchedBy && <span className="badge">“{row.matchedBy}”</span>}
                            {row.duplicate && <span className="badge">Already recorded</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="banner-note">
                  The preview shows the first {Math.min(PREVIEW_ROWS, preview.preview.length)} rows of{" "}
                  {preview.total}.
                </p>

                <div className="import-actions">
                  <button
                    className="btn btn-primary"
                    onClick={runImport}
                    disabled={importing || preview.ready === 0}
                  >
                    {importing ? "Importing…" : `Import ${preview.ready} transaction${preview.ready === 1 ? "" : "s"}`}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {result && (
          <div className="import-result">
            <p>
              <strong>{result.imported}</strong> imported
              {result.duplicates > 0 && ` · ${result.duplicates} skipped as already recorded`}
            </p>
            {result.byCategory.length > 0 && (
              <ul className="import-chips">
                {result.byCategory.map((entry) => (
                  <li key={entry.category} className="badge">
                    {entry.category} · {entry.count}
                  </li>
                ))}
              </ul>
            )}
            <Link className="link-arrow" to="/transactions">
              See them in Transactions →
            </Link>
          </div>
        )}
      </div>

      {applyOpen && (
        <ConfirmDialog
          title="Apply your rules"
          confirmLabel="Apply rules"
          busy={applying}
          onConfirm={applyRules}
          onCancel={() => setApplyOpen(false)}
        >
          <p>
            Transactions still sitting in <strong>{fallbackCategory}</strong> will be recategorised
            using your {rules.length} rule{rules.length === 1 ? "" : "s"}. Anything you categorised
            yourself is left alone, and transfers are never touched.
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
}

export default Import;

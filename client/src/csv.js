// Small, dependency-free CSV reader used by the import screen.
// Bank and wallet exports vary a lot, so the goal is to guess well and let the
// user correct the guess with the column pickers.

const MONTHS = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const DATE_HINTS = ["date", "transaction date", "posted", "value date"];
const DESC_HINTS = [
  "description",
  "narration",
  "particulars",
  "particular",
  "details",
  "memo",
  "payee",
  "remark",
  "narrative",
  "reference",
];
const AMOUNT_HINTS = ["amount", "value", "total"];
const DEBIT_HINTS = ["debit", "withdrawal", "money out", "paid out"];
const CREDIT_HINTS = ["credit", "deposit", "money in", "paid in"];
const TYPE_HINTS = ["type", "dr/cr", "direction", "transaction type"];

const pad = (n) => String(n).padStart(2, "0");

function validDate(year, month, day) {
  if (!year || !month || !day) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

// Returns YYYY-MM-DD or null. Day-first is assumed (NG/UK convention) and only
// swapped when the second number cannot be a month.
export function parseDate(raw) {
  const value = String(raw ?? "").trim();
  if (!value) return null;

  let parts = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(value);
  if (parts) return validDate(+parts[1], +parts[2], +parts[3]);

  parts = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{2,4})$/.exec(value);
  if (parts) {
    let day = +parts[1];
    let month = +parts[2];
    if (month > 12 && day <= 12) {
      month = +parts[1];
      day = +parts[2];
    }
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    return validDate(+year, month, day);
  }

  parts = /^(\d{1,2})[ -]([A-Za-z]{3,})[ -](\d{2,4})$/.exec(value);
  if (parts) {
    const month = MONTHS[parts[2].slice(0, 3).toLowerCase()];
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    if (month) return validDate(+year, month, +parts[1]);
  }

  parts = /^([A-Za-z]{3,})[ -](\d{1,2}),?[ -](\d{2,4})$/.exec(value);
  if (parts) {
    const month = MONTHS[parts[1].slice(0, 3).toLowerCase()];
    const year = parts[3].length === 2 ? `20${parts[3]}` : parts[3];
    if (month) return validDate(+year, month, +parts[2]);
  }

  // Anything with a trailing time is read by the platform parser, using local
  // parts so a timezone offset cannot push the date onto the wrong day.
  const fallback = new Date(value);
  if (Number.isNaN(fallback.getTime())) return null;
  return `${fallback.getFullYear()}-${pad(fallback.getMonth() + 1)}-${pad(fallback.getDate())}`;
}

// Handles "1,500.00", "₦1,500", "(25.00)" and "25.00-".
export function parseAmount(raw) {
  let value = String(raw ?? "").trim();
  if (!value) return null;

  let negative = false;
  if (/^\(.*\)$/.test(value)) {
    negative = true;
    value = value.slice(1, -1);
  }
  if (/-$/.test(value)) {
    negative = true;
    value = value.replace(/-$/, "");
  }

  value = value.replace(/[^0-9.]/g, "");
  if (!value || value === ".") return null;

  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;

  return { amount: Math.abs(amount), negative: negative || amount < 0 };
}

export function detectDelimiter(text) {
  const header = String(text ?? "").split(/\r?\n/)[0] || "";
  const candidates = [",", ";", "\t"];
  const counts = candidates.map((delimiter) => [delimiter, header.split(delimiter).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ",";
}

export function parseCsv(text, delimiter = ",") {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  row.push(field);
  rows.push(row);

  return rows.filter((cells) => cells.some((cell) => String(cell).trim() !== ""));
}

function findColumnIndex(headers, hints) {
  const lower = headers.map((header) => String(header).trim().toLowerCase());
  const exact = lower.findIndex((header) => hints.includes(header));
  if (exact !== -1) return exact;
  const loose = lower.findIndex((header) => hints.some((hint) => header.includes(hint)));
  return loose === -1 ? null : loose;
}

export function guessMapping(headers) {
  const debit = findColumnIndex(headers, DEBIT_HINTS);
  const credit = findColumnIndex(headers, CREDIT_HINTS);
  const hasSplit = debit !== null || credit !== null;

  return {
    date: findColumnIndex(headers, DATE_HINTS),
    description: findColumnIndex(headers, DESC_HINTS),
    amount: hasSplit ? null : findColumnIndex(headers, AMOUNT_HINTS),
    debit,
    credit,
    type: findColumnIndex(headers, TYPE_HINTS),
    unsigned: "EXPENSE",
  };
}

// A single amount column with no sign at all cannot say which way the money
// went. When the column mixes negative and positive values the sign is
// meaningful, so a bare positive is income; when every value is positive it is
// almost always a spending statement, so it defaults to an expense.
export function suggestUnsigned(records, amountIndex) {
  if (amountIndex === null || amountIndex === undefined) return "EXPENSE";

  let sawNegative = false;
  let sawPositive = false;

  for (const record of records) {
    const parsed = parseAmount(record[amountIndex]);
    if (!parsed || parsed.amount === 0) continue;
    if (parsed.negative) sawNegative = true;
    else sawPositive = true;
    if (sawNegative && sawPositive) return "INCOME";
  }

  return "EXPENSE";
}

// Turns raw CSV cells into transaction rows, reporting what could not be read.
export function buildRows(records, mapping) {
  const rows = [];
  const badDates = [];
  let skipped = 0;

  const explicitType = (record) => {
    if (mapping.type === null || mapping.type === undefined) return null;
    const value = String(record[mapping.type] ?? "").toLowerCase();
    if (/(debit|withdraw|expense|\bout\b|^dr\b)/.test(value)) return "EXPENSE";
    if (/(credit|deposit|income|\bin\b|^cr\b)/.test(value)) return "INCOME";
    return null;
  };

  const cell = (record, index) => (index === null || index === undefined ? "" : record[index]);

  for (const [index, record] of records.entries()) {
    const date = parseDate(cell(record, mapping.date));
    if (!date) {
      badDates.push(index + 2);
      continue;
    }

    const description = String(cell(record, mapping.description) ?? "").trim().slice(0, 200);
    let amount = null;
    let type = null;

    if (mapping.debit !== null || mapping.credit !== null) {
      const debit = parseAmount(cell(record, mapping.debit));
      const credit = parseAmount(cell(record, mapping.credit));
      if (debit && debit.amount > 0) {
        amount = debit.amount;
        type = "EXPENSE";
      } else if (credit && credit.amount > 0) {
        amount = credit.amount;
        type = "INCOME";
      }
    } else if (mapping.amount !== null) {
      const parsed = parseAmount(cell(record, mapping.amount));
      if (parsed && parsed.amount > 0) {
        amount = parsed.amount;
        type = parsed.negative ? "EXPENSE" : mapping.unsigned === "INCOME" ? "INCOME" : "EXPENSE";
      }
    }

    if (amount === null) {
      skipped += 1;
      continue;
    }

    // An explicit Debit/Credit-style column beats the sign of the amount.
    rows.push({ date, description, amount, type: explicitType(record) || type });
  }

  return { rows, badDates, skipped };
}

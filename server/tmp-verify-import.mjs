// TEMP: end-to-end verification of category rules and CSV import. Deleted after.
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = "http://localhost:4000/api";
const PASSWORD = "Verify!2345";
const stamp = Date.now();
const EMAIL = `imp-verify-${stamp}@example.com`;
const OTHER_EMAIL = `imp-verify-other-${stamp}@example.com`;

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function req(method, path, { token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* 204 has no body */
  }
  return { status: res.status, json };
}

const passwordHash = await bcrypt.hash(PASSWORD, 10);
const me = await prisma.user.create({
  data: { email: EMAIL, name: "Import Verify", passwordHash, emailVerified: true },
});
const stranger = await prisma.user.create({
  data: { email: OTHER_EMAIL, name: "Stranger", passwordHash, emailVerified: true },
});
const login = async (email) =>
  (await req("POST", "/auth/login", { body: { email, password: PASSWORD } })).json.token;
const token = await login(EMAIL);
const otherToken = await login(OTHER_EMAIL);
check("setup: two users signed in", Boolean(token) && Boolean(otherToken));

// --- 1. rules CRUD ---------------------------------------------------------
const bolt = await req("POST", "/rules", { token, body: { match: "Bolt", category: "Transport" } });
check(
  "rules: create returns 201",
  bolt.status === 201 && bolt.json.rule.category === "Transport",
  `status=${bolt.status}`
);

const boltFood = await req("POST", "/rules", { token, body: { match: "Bolt food", category: "Food" } });
check("rules: a second, more specific rule is accepted", boltFood.status === 201);

const dupe = await req("POST", "/rules", { token, body: { match: "bolt", category: "Shopping" } });
check("rules: duplicate keyword (any case) rejected", dupe.status === 409);

const tooShort = await req("POST", "/rules", { token, body: { match: "x", category: "Food" } });
check("rules: one-character keyword rejected", tooShort.status === 400);

const blankCategory = await req("POST", "/rules", { token, body: { match: "Uber", category: "  " } });
check("rules: blank category rejected", blankCategory.status === 400);

const incomeRule = await req("POST", "/rules", {
  token,
  body: { match: "topup", category: "Savings", type: "INCOME" },
});
check("rules: income-only rule accepted", incomeRule.status === 201 && incomeRule.json.rule.type === "INCOME");

const listed = await req("GET", "/rules", { token });
check(
  "rules: list is ordered longest keyword first",
  listed.status === 200 && listed.json.items[0].match === "Bolt food",
  listed.json?.items?.map((r) => r.match).join(" > ")
);

const renamed = await req("PUT", `/rules/${bolt.json.rule.id}`, { token, body: { category: "Bills" } });
check("rules: update changes the category", renamed.status === 200 && renamed.json.rule.category === "Bills");

const renameClash = await req("PUT", `/rules/${bolt.json.rule.id}`, { token, body: { match: "TOPUP" } });
check("rules: renaming onto an existing keyword rejected", renameClash.status === 409);

const strangerRules = await req("GET", "/rules", { token: otherToken });
check("rules: another user sees none of mine", strangerRules.json.items.length === 0);

const foreignEdit = await req("PUT", `/rules/${bolt.json.rule.id}`, {
  token: otherToken,
  body: { category: "Food" },
});
check("rules: another user cannot edit mine", foreignEdit.status === 404);

// --- 2. import preview -----------------------------------------------------
const rows = [
  { date: "2026-10-05", description: "Bolt ride to the office", amount: 1500, type: "EXPENSE" },
  { date: "2026-10-06", description: "Bolt food order", amount: 4200, type: "EXPENSE" },
  { date: "2026-10-07", description: "Shoprite Lekki", amount: 18500, type: "EXPENSE" },
  { date: "2026-10-08", description: "TOPUP from card", amount: 10000, type: "EXPENSE" },
  { date: "2026-10-09", description: "TOPUP to savings", amount: 20000, type: "INCOME" },
  { date: "2026-10-10", description: "Salary for October", amount: 450000, type: "INCOME" },
];

const preview = await req("POST", "/import", {
  token,
  body: { rows, fallbackCategory: "Other", dryRun: true },
});
check(
  "import: dry run previews every row",
  preview.status === 200 && preview.json.preview.length === 6 && preview.json.ready === 6,
  `status=${preview.status}`
);
check(
  "import: keyword rules assign categories",
  preview.json.preview[0].category === "Bills" && preview.json.preview[1].category === "Food",
  `${preview.json?.preview?.[0]?.category} / ${preview.json?.preview?.[1]?.category}`
);
check(
  "import: the more specific keyword wins",
  preview.json.preview[1].category === "Food" && preview.json.preview[1].matchedBy === "Bolt food"
);
check(
  "import: unmatched rows fall back to the default",
  preview.json.preview[2].category === "Other" && preview.json.preview[2].matchedBy === null
);
check(
  "import: a type-restricted rule ignores the other direction",
  preview.json.preview[3].category === "Other" && preview.json.preview[4].category === "Savings",
  `${preview.json?.preview?.[3]?.category} / ${preview.json?.preview?.[4]?.category}`
);
check("import: dry run writes nothing", (await prisma.transaction.count({ where: { userId: me.id } })) === 0);

// --- 3. accounts in the import --------------------------------------------
const account = await req("POST", "/accounts", {
  token,
  body: { name: "GTBank", type: "BANK", openingBalance: 0 },
});
check("import: test account created", account.status === 201);

const strangerAccount = await prisma.account.create({
  data: { userId: stranger.id, name: "Their account", type: "BANK", openingBalance: 0 },
});
const foreignAccount = await req("POST", "/import", {
  token,
  body: { rows, accountId: strangerAccount.id },
});
check("import: another user's account rejected", foreignAccount.status === 404);

// --- 4. commit -------------------------------------------------------------
const committed = await req("POST", "/import", {
  token,
  body: { rows, accountId: account.json.account.id, fallbackCategory: "Other" },
});
check(
  "import: commit imports every row",
  committed.status === 201 && committed.json.imported === 6,
  `imported=${committed.json?.imported}`
);
check("import: nothing is a duplicate on the first pass", committed.json.duplicates === 0);
check(
  "import: the summary counts categories",
  committed.json.byCategory.find((c) => c.category === "Other")?.count === 3 &&
    committed.json.byCategory.find((c) => c.category === "Bills")?.count === 1,
  JSON.stringify(committed.json?.byCategory)
);
check(
  "import: rows land on the chosen account",
  (await prisma.transaction.count({ where: { userId: me.id, accountId: account.json.account.id } })) === 6
);

const again = await req("POST", "/import", {
  token,
  body: { rows, accountId: account.json.account.id, fallbackCategory: "Other" },
});
check(
  "import: re-importing the same file changes nothing",
  again.status === 201 && again.json.imported === 0 && again.json.duplicates === 6,
  `imported=${again.json?.imported} dupes=${again.json?.duplicates}`
);
check("import: no extra rows were written", (await prisma.transaction.count({ where: { userId: me.id } })) === 6);

const overlapping = await req("POST", "/import", {
  token,
  body: {
    rows: [rows[0], { date: "2026-10-11", description: "New purchase", amount: 500, type: "EXPENSE" }],
    accountId: account.json.account.id,
    fallbackCategory: "Other",
  },
});
check(
  "import: a partly-overlapping file imports only the new row",
  overlapping.json.imported === 1 && overlapping.json.duplicates === 1,
  `imported=${overlapping.json?.imported} dupes=${overlapping.json?.duplicates}`
);

// --- 5. validation ---------------------------------------------------------
const badDate = await req("POST", "/import", {
  token,
  body: { rows: [{ date: "not-a-date", description: "x", amount: 5, type: "EXPENSE" }] },
});
check("import: an unrecognised date is rejected", badDate.status === 400);

const badRowInBatch = await req("POST", "/import", {
  token,
  body: {
    rows: [
      { date: "2026-10-12", description: "fine", amount: 5, type: "EXPENSE" },
      { date: "someday", description: "bad", amount: 5, type: "EXPENSE" },
    ],
  },
});
check("import: one bad row rejects the whole batch", badRowInBatch.status === 400);

const emptyRows = await req("POST", "/import", { token, body: { rows: [] } });
check("import: an empty row list is rejected", emptyRows.status === 400);

const negative = await req("POST", "/import", {
  token,
  body: { rows: [{ date: "2026-10-12", amount: -5, type: "EXPENSE" }] },
});
check("import: a negative amount is rejected", negative.status === 400);

const badType = await req("POST", "/import", {
  token,
  body: { rows: [{ date: "2026-10-12", amount: 5, type: "TRANSFER" }] },
});
check("import: an unknown type is rejected", badType.status === 400);

const tooMany = await req("POST", "/import", {
  token,
  body: {
    rows: Array.from({ length: 2001 }, (_, i) => ({
      date: "2026-10-12",
      description: `row ${i}`,
      amount: 5,
      type: "EXPENSE",
    })),
  },
});
check("import: more than 2000 rows in one go is rejected", tooMany.status === 400);

const unauth = await req("POST", "/import", { body: { rows } });
check("import: requires a token", unauth.status === 401);

// --- 6. applying rules to history -----------------------------------------
// Re-categorise two existing rows back to the catch-all first.
await prisma.transaction.updateMany({
  where: { userId: me.id, description: "Shoprite Lekki" },
  data: { category: "Other" },
});
await prisma.transaction.updateMany({
  where: { userId: me.id, description: "Salary for October" },
  data: { category: "Other" },
});
await req("POST", "/rules", { token, body: { match: "Shoprite", category: "Food" } });
await req("POST", "/rules", { token, body: { match: "Salary", category: "Salary", type: "INCOME" } });

const applied = await req("POST", "/rules/apply", { token, body: {} });
check("apply: rewrites the catch-all rows", applied.status === 200 && applied.json.updated === 2, `updated=${applied.json?.updated}`);
check(
  "apply: the keywords actually landed",
  (await prisma.transaction.count({ where: { userId: me.id, description: "Shoprite Lekki", category: "Food" } })) === 1 &&
    (await prisma.transaction.count({ where: { userId: me.id, description: "Salary for October", category: "Salary" } })) === 1
);

const appliedAgain = await req("POST", "/rules/apply", { token, body: {} });
check("apply: is idempotent", appliedAgain.json.updated === 0, `updated=${appliedAgain.json?.updated}`);

// A hand-categorised row is left alone unless explicitly included.
await prisma.transaction.updateMany({
  where: { userId: me.id, description: "Bolt ride to the office" },
  data: { category: "Other" },
});
await prisma.transaction.create({
  data: {
    userId: me.id,
    type: "EXPENSE",
    amount: 999,
    category: "Shopping",
    description: "Bolt ride to the office",
    date: new Date("2026-10-13"),
  },
});
const safeApply = await req("POST", "/rules/apply", { token, body: {} });
check("apply: only touches the catch-all by default", safeApply.json.updated === 1, `updated=${safeApply.json?.updated}`);
check(
  "apply: a hand-picked category survives",
  (await prisma.transaction.count({
    where: { userId: me.id, category: "Shopping", description: "Bolt ride to the office" },
  })) === 1
);

const fullApply = await req("POST", "/rules/apply", { token, body: { includeCategorised: true } });
check("apply: includeCategorised rewrites everything matching", fullApply.json.updated === 1, `updated=${fullApply.json?.updated}`);

// --- 7. transfers are never recategorised ---------------------------------
const second = await req("POST", "/accounts", { token, body: { name: "Cash", type: "CASH", openingBalance: 0 } });
const transfer = await req("POST", "/accounts/transfer", {
  token,
  body: {
    fromAccountId: account.json.account.id,
    toAccountId: second.json.account.id,
    amount: 1000,
    date: "2026-10-14",
    description: "Bolt of a transfer",
  },
});
check("apply: a transfer can be recorded for the test", transfer.status === 201);
const transferApply = await req("POST", "/rules/apply", { token, body: { includeCategorised: true } });
check(
  "apply: leaves transfer legs alone even when the note matches a rule",
  transferApply.json.updated === 0,
  `updated=${transferApply.json?.updated}`
);
check(
  "apply: transfer legs keep the Transfer category",
  (await prisma.transaction.count({ where: { userId: me.id, transferGroupId: { not: null }, category: { not: "Transfer" } } })) === 0
);
const reimportWithTransferText = await req("POST", "/import", {
  token,
  body: { rows: [{ date: "2026-10-15", description: "Bolt of a transfer", amount: 700, type: "EXPENSE" }] },
});
check(
  "import: still categorises a row whose text matches a transfer note",
  reimportWithTransferText.json.imported === 1
);

// --- 8. delete -------------------------------------------------------------
const deleted = await req("DELETE", `/rules/${incomeRule.json.rule.id}`, { token });
check("rules: delete returns 204", deleted.status === 204);
check(
  "rules: deleted rule is gone",
  (await req("GET", "/rules", { token })).json.items.every((r) => r.id !== incomeRule.json.rule.id)
);
const deleteForeign = await req("DELETE", `/rules/${bolt.json.rule.id}`, { token: otherToken });
check("rules: another user cannot delete mine", deleteForeign.status === 404);

// --- cleanup ---------------------------------------------------------------
await prisma.user.delete({ where: { id: me.id } });
await prisma.user.delete({ where: { id: stranger.id } });
check(
  "cleanup: cascade removed the test data",
  (await prisma.transaction.count({ where: { userId: me.id } })) === 0 &&
    (await prisma.categoryRule.count({ where: { userId: me.id } })) === 0 &&
    (await prisma.account.count({ where: { userId: me.id } })) === 0
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
await prisma.$disconnect();
process.exit(failed.length ? 1 : 0);

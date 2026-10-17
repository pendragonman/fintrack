import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const ACCOUNT_TYPES = ["CASH", "BANK", "CARD", "WALLET", "SAVINGS", "INVESTMENT"];

// Transfers are stored as a pair of transactions that share a transferGroupId.
// They move money between the user's own accounts, so they count towards each
// account's balance but are excluded from income/expense reporting.
export const TRANSFER_CATEGORY = "Transfer";

const accountSchema = z.object({
  name: z.string().trim().min(1, "Give the account a name").max(60),
  type: z.enum(ACCOUNT_TYPES).default("BANK"),
  openingBalance: z.number().finite().min(-1e12).max(1e12).default(0),
  archived: z.boolean().optional(),
});

const transferSchema = z.object({
  fromAccountId: z.string().min(1),
  toAccountId: z.string().min(1),
  amount: z.number().positive(),
  date: z.string().min(1),
  description: z.string().max(120).optional(),
});

// Net movement per account from its transactions (transfers included).
async function movementsFor(userId) {
  const rows = await prisma.transaction.groupBy({
    by: ["accountId", "type"],
    where: { userId, accountId: { not: null } },
    _sum: { amount: true },
  });

  const movements = new Map();
  for (const row of rows) {
    const current = movements.get(row.accountId) || 0;
    const value = Number(row._sum.amount || 0);
    movements.set(row.accountId, row.type === "INCOME" ? current + value : current - value);
  }
  return movements;
}

function present(account, movements) {
  const movement = movements.get(account.id) || 0;
  return {
    ...account,
    openingBalance: Number(account.openingBalance),
    movement,
    balance: Number(account.openingBalance) + movement,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const [accounts, movements, unassignedCount] = await Promise.all([
      prisma.account.findMany({
        where: { userId: req.userId },
        orderBy: [{ archived: "asc" }, { createdAt: "asc" }],
      }),
      movementsFor(req.userId),
      prisma.transaction.count({ where: { userId: req.userId, accountId: null } }),
    ]);

    const items = accounts.map((account) => present(account, movements));

    res.json({
      items,
      totalBalance: items
        .filter((account) => !account.archived)
        .reduce((sum, account) => sum + account.balance, 0),
      unassignedCount,
    });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = accountSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { name, type, openingBalance } = parsed.data;
    const claimUnassigned = req.body?.claimUnassigned === true;

    const clash = await prisma.account.findFirst({ where: { userId: req.userId, name } });
    if (clash) {
      return res.status(409).json({ error: "You already have an account with that name" });
    }

    const account = await prisma.account.create({
      data: { userId: req.userId, name, type, openingBalance },
    });

    // Useful when someone is adopting accounts for the first time: link all the
    // transactions that were recorded before accounts existed.
    let claimed = 0;
    if (claimUnassigned) {
      const result = await prisma.transaction.updateMany({
        where: { userId: req.userId, accountId: null },
        data: { accountId: account.id },
      });
      claimed = result.count;
    }

    res.status(201).json({ account: present(account, new Map()), claimed });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = accountSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existing = await prisma.account.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Account not found" });
    }

    const { name, type, openingBalance, archived } = parsed.data;

    if (name && name !== existing.name) {
      const clash = await prisma.account.findFirst({
        where: { userId: req.userId, name, id: { not: existing.id } },
      });
      if (clash) {
        return res.status(409).json({ error: "You already have an account with that name" });
      }
    }

    const account = await prisma.account.update({
      where: { id: existing.id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(openingBalance !== undefined ? { openingBalance } : {}),
        ...(archived !== undefined ? { archived } : {}),
      },
    });

    const movements = await movementsFor(req.userId);
    res.json({ account: present(account, movements) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.account.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Account not found" });
    }

    // Transactions are kept; they simply become unassigned.
    await prisma.account.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

router.post(
  "/transfer",
  asyncHandler(async (req, res) => {
    const parsed = transferSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { fromAccountId, toAccountId, amount, date, description } = parsed.data;

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ error: "Choose two different accounts" });
    }

    const accounts = await prisma.account.findMany({
      where: { id: { in: [fromAccountId, toAccountId] }, userId: req.userId },
      select: { id: true, name: true },
    });
    if (accounts.length !== 2) {
      return res.status(404).json({ error: "Account not found" });
    }

    const transferGroupId = crypto.randomUUID();
    const when = new Date(date);
    const note = description?.trim() ? description.trim() : null;

    const [outgoing, incoming] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId: req.userId,
          type: "EXPENSE",
          amount,
          category: TRANSFER_CATEGORY,
          description: note,
          date: when,
          accountId: fromAccountId,
          transferGroupId,
        },
      }),
      prisma.transaction.create({
        data: {
          userId: req.userId,
          type: "INCOME",
          amount,
          category: TRANSFER_CATEGORY,
          description: note,
          date: when,
          accountId: toAccountId,
          transferGroupId,
        },
      }),
    ]);

    const names = new Map(accounts.map((account) => [account.id, account.name]));
    const withNames = (transaction) => ({
      ...transaction,
      account: { id: transaction.accountId, name: names.get(transaction.accountId) },
    });

    res.status(201).json({
      transferGroupId,
      transactions: [withNames(outgoing), withNames(incoming)],
    });
  })
);

export default router;

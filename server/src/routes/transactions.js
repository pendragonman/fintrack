import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const transactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"]),
  amount: z.number().positive(),
  category: z.string().min(1).max(40),
  description: z.string().max(200).optional(),
  date: z.string().min(1),
  accountId: z.string().min(1).nullish(),
});

const accountSelect = { select: { id: true, name: true } };

function buildFilters(userId, query) {
  const where = { userId };

  if (query.type === "INCOME" || query.type === "EXPENSE") {
    where.type = query.type;
  }
  if (query.category) {
    where.category = query.category;
  }
  if (query.accountId) {
    // "unassigned" surfaces the transactions that predate accounts.
    where.accountId = query.accountId === "unassigned" ? null : query.accountId;
  }
  if (query.transfers === "only") {
    where.transferGroupId = { not: null };
  } else if (query.transfers === "exclude") {
    where.transferGroupId = null;
  }
  if (query.from || query.to) {
    where.date = {};
    if (query.from) where.date.gte = new Date(query.from);
    if (query.to) where.date.lte = new Date(query.to);
  }
  if (query.search) {
    where.description = { contains: query.search, mode: "insensitive" };
  }

  return where;
}

// A transaction may only reference an account the caller owns.
async function accountFor(userId, accountId) {
  if (!accountId) return null;
  return prisma.account.findFirst({
    where: { id: accountId, userId },
    select: { id: true },
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const where = buildFilters(req.userId, req.query);
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize) || 20));

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy: { date: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { account: { select: { id: true, name: true } } },
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ items, total, page, pageSize });
  })
);

router.get(
  "/export",
  asyncHandler(async (req, res) => {
    const where = buildFilters(req.userId, req.query);
    const items = await prisma.transaction.findMany({
      where,
      orderBy: { date: "desc" },
      include: { account: { select: { name: true } } },
    });

    const cell = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;

    const header = "Date,Type,Category,Description,Account,Amount\n";
    const rows = items
      .map((t) =>
        [
          t.date.toISOString().slice(0, 10),
          t.type,
          cell(t.category),
          cell(t.description),
          cell(t.account?.name || ""),
          t.amount,
        ].join(",")
      )
      .join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=transactions.csv");
    res.send(header + rows);
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { type, amount, category, description, date, accountId } = parsed.data;

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: req.userId },
        select: { id: true },
      });
      if (!account) return res.status(404).json({ error: "Account not found" });
    }

    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId,
        type,
        amount,
        category,
        description: description || null,
        date: new Date(date),
        accountId: accountId || null,
      },
      include: { account: { select: { id: true, name: true } } },
    });

    res.status(201).json({ transaction });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = transactionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    if (existing.transferGroupId) {
      return res.status(400).json({
        error: "This is one leg of a transfer. Delete the transfer and record a new one.",
      });
    }

    const { type, amount, category, description, date, accountId } = parsed.data;

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: req.userId },
        select: { id: true },
      });
      if (!account) return res.status(404).json({ error: "Account not found" });
    }

    const transaction = await prisma.transaction.update({
      where: { id: existing.id },
      data: {
        type,
        amount,
        category,
        description: description || null,
        date: new Date(date),
        accountId: accountId || null,
      },
      include: { account: { select: { id: true, name: true } } },
    });

    res.json({ transaction });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    // Deleting either leg of a transfer removes both, so balances stay correct.
    if (existing.transferGroupId) {
      await prisma.transaction.deleteMany({
        where: { userId: req.userId, transferGroupId: existing.transferGroupId },
      });
      return res.status(204).end();
    }

    await prisma.transaction.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

export default router;

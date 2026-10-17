import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const budgetSchema = z.object({
  category: z.string().min(1).max(40),
  limitAmount: z.number().positive(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
});

async function withSpent(userId, budget) {
  const start = new Date(budget.year, budget.month - 1, 1);
  const end = new Date(budget.year, budget.month, 1);

  const agg = await prisma.transaction.aggregate({
    where: {
      userId,
      type: "EXPENSE",
      category: budget.category,
      date: { gte: start, lt: end },
      transferGroupId: null,
    },
    _sum: { amount: true },
  });

  const spent = Number(agg._sum.amount || 0);
  const limitAmount = Number(budget.limitAmount);

  return {
    ...budget,
    spent,
    remaining: limitAmount - spent,
    exceeded: spent > limitAmount,
  };
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const budgets = await prisma.budget.findMany({
      where: { userId: req.userId, month, year },
      orderBy: { category: "asc" },
    });

    const withStatus = await Promise.all(budgets.map((b) => withSpent(req.userId, b)));
    res.json({ items: withStatus });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = budgetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { category, limitAmount, month, year } = parsed.data;

    const budget = await prisma.budget.upsert({
      where: {
        userId_category_month_year: { userId: req.userId, category, month, year },
      },
      update: { limitAmount },
      create: { userId: req.userId, category, limitAmount, month, year },
    });

    res.status(201).json({ budget: await withSpent(req.userId, budget) });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.budget.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Budget not found" });
    }

    await prisma.budget.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;

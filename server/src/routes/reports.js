import { Router } from "express";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
router.use(requireAuth);

router.get(
  "/summary",
  asyncHandler(async (req, res) => {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [incomeAgg, expenseAgg, allTimeIncome, allTimeExpense, goals] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          userId: req.userId,
          type: "INCOME",
          date: { gte: start, lt: end },
          transferGroupId: null,
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "EXPENSE", date: { gte: start, lt: end }, transferGroupId: null },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "INCOME", transferGroupId: null },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: { userId: req.userId, type: "EXPENSE", transferGroupId: null },
        _sum: { amount: true },
      }),
      prisma.savingsGoal.aggregate({
        where: { userId: req.userId },
        _sum: { currentAmount: true },
      }),
    ]);

    const income = Number(incomeAgg._sum.amount || 0);
    const expenses = Number(expenseAgg._sum.amount || 0);
    const totalBalance =
      Number(allTimeIncome._sum.amount || 0) - Number(allTimeExpense._sum.amount || 0);

    res.json({
      month,
      year,
      income,
      expenses,
      net: income - expenses,
      totalBalance,
      savingsTotal: Number(goals._sum.currentAmount || 0),
    });
  })
);

router.get(
  "/by-category",
  asyncHandler(async (req, res) => {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const type = req.query.type === "INCOME" ? "INCOME" : "EXPENSE";
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const rows = await prisma.transaction.groupBy({
      by: ["category"],
      where: { userId: req.userId, type, date: { gte: start, lt: end }, transferGroupId: null },
      _sum: { amount: true },
      orderBy: { _sum: { amount: "desc" } },
    });

    res.json({
      items: rows.map((r) => ({ category: r.category, total: Number(r._sum.amount || 0) })),
    });
  })
);

router.get(
  "/trend",
  asyncHandler(async (req, res) => {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    const transactions = await prisma.transaction.findMany({
      where: { userId: req.userId, date: { gte: start, lt: end }, transferGroupId: null },
      select: { type: true, amount: true, date: true },
    });

    const months = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      income: 0,
      expenses: 0,
    }));

    for (const t of transactions) {
      const m = t.date.getMonth();
      if (t.type === "INCOME") months[m].income += Number(t.amount);
      else months[m].expenses += Number(t.amount);
    }

    res.json({ year, items: months });
  })
);

export default router;

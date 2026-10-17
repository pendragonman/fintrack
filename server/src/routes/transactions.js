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
  description: z.string().max(200).optional().nullable(),
  date: z.string().min(1),
});

function buildFilters(userId, query) {
  const where = { userId };

  if (query.type === "INCOME" || query.type === "EXPENSE") {
    where.type = query.type;
  }
  if (query.category) {
    where.category = query.category;
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
    const items = await prisma.transaction.findMany({ where, orderBy: { date: "desc" } });

    const header = "Date,Type,Category,Description,Amount\n";
    const rows = items
      .map((t) => {
        const date = t.date.toISOString().slice(0, 10);
        const description = (t.description || "").replace(/"/g, '""');
        return `${date},${t.type},${t.category},"${description}",${t.amount}`;
      })
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

    const { type, amount, category, description, date } = parsed.data;
    const transaction = await prisma.transaction.create({
      data: {
        userId: req.userId,
        type,
        amount,
        category,
        description: description || null,
        date: new Date(date),
      },
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

    const { type, amount, category, description, date } = parsed.data;
    const transaction = await prisma.transaction.update({
      where: { id: req.params.id },
      data: {
        type,
        amount,
        category,
        description: description || null,
        date: new Date(date),
      },
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

    await prisma.transaction.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;

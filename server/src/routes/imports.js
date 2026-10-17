import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";
import { orderRules, categorize } from "../lib/categorize.js";

const router = Router();
router.use(requireAuth);

const rowSchema = z.object({
  date: z.string().min(1),
  description: z.string().max(200).optional().nullable(),
  amount: z.number().finite().positive().max(1e12),
  type: z.enum(["INCOME", "EXPENSE"]),
});

const importSchema = z.object({
  rows: z.array(rowSchema).min(1, "Nothing to import").max(2000, "Send at most 2000 rows at a time"),
  accountId: z.string().min(1).nullish(),
  fallbackCategory: z.string().trim().min(1).max(40).default("Other"),
  dryRun: z.boolean().optional(),
});

const day = (date) => date.toISOString().slice(0, 10);

// What counts as "the same transaction" when re-importing an overlapping file.
const fingerprint = (type, amount, description, dateKey) =>
  `${dateKey}|${type}|${Number(amount).toFixed(2)}|${String(description || "").trim().toLowerCase()}`;

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = importSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { rows, accountId, fallbackCategory, dryRun } = parsed.data;

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: req.userId },
        select: { id: true },
      });
      if (!account) return res.status(404).json({ error: "Account not found" });
    }

    const normalised = [];
    for (const [index, row] of rows.entries()) {
      const date = new Date(row.date);
      if (Number.isNaN(date.getTime())) {
        return res.status(400).json({ error: `Row ${index + 1} has an unrecognised date` });
      }
      normalised.push({
        date,
        description: row.description?.trim() || null,
        amount: row.amount,
        type: row.type,
      });
    }

    const rules = orderRules(await prisma.categoryRule.findMany({ where: { userId: req.userId } }));

    // Anything already recorded with the same type, amount, description and day
    // is a repeat of the same money movement, so it is skipped.
    const dates = normalised.map((row) => row.date.getTime());
    const existing = await prisma.transaction.findMany({
      where: {
        userId: req.userId,
        date: { gte: new Date(Math.min(...dates)), lte: new Date(Math.max(...dates)) },
      },
      select: { type: true, amount: true, description: true, date: true },
    });

    const seen = new Set(
      existing.map((t) => fingerprint(t.type, t.amount, t.description, day(t.date)))
    );

    const accepted = [];
    const preview = [];
    let duplicates = 0;

    for (const row of normalised) {
      const key = fingerprint(row.type, row.amount, row.description, day(row.date));
      const rule = categorize(rules, row);
      const category = rule?.category || fallbackCategory;

      if (seen.has(key)) {
        duplicates += 1;
        preview.push({ ...row, date: day(row.date), category, duplicate: true, matchedBy: rule?.match || null });
        continue;
      }

      seen.add(key);
      accepted.push({ ...row, category });
      preview.push({ ...row, date: day(row.date), category, duplicate: false, matchedBy: rule?.match || null });
    }

    if (dryRun) {
      return res.json({
        preview,
        total: normalised.length,
        ready: accepted.length,
        duplicates,
      });
    }

    if (accepted.length > 0) {
      await prisma.transaction.createMany({
        data: accepted.map((row) => ({
          userId: req.userId,
          type: row.type,
          amount: row.amount,
          category: row.category,
          description: row.description,
          date: row.date,
          accountId: accountId || null,
        })),
      });
    }

    const byCategory = new Map();
    for (const row of accepted) {
      byCategory.set(row.category, (byCategory.get(row.category) || 0) + 1);
    }

    res.status(201).json({
      imported: accepted.length,
      duplicates,
      total: normalised.length,
      byCategory: [...byCategory.entries()]
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count),
    });
  })
);

export default router;

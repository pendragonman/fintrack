import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";
import { orderRules, categorize } from "../lib/categorize.js";

const router = Router();
router.use(requireAuth);

const ruleSchema = z.object({
  match: z.string().trim().min(2, "Use at least two characters").max(60),
  category: z.string().trim().min(1).max(40),
  type: z.enum(["INCOME", "EXPENSE"]).nullish(),
  priority: z.number().int().min(-99).max(99).optional(),
});

async function listRules(userId) {
  const rules = await prisma.categoryRule.findMany({ where: { userId } });
  return orderRules(rules);
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ items: await listRules(req.userId) });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = ruleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const { match, category, type, priority } = parsed.data;

    // Same keyword + category is a no-op, but the same keyword pointing at a
    // different category is almost always a mistake.
    const clash = await prisma.categoryRule.findFirst({
      where: { userId: req.userId, match: { equals: match, mode: "insensitive" } },
    });
    if (clash) {
      return res.status(409).json({
        error: `You already have a rule for “${match}” → ${clash.category}`,
      });
    }

    const rule = await prisma.categoryRule.create({
      data: {
        userId: req.userId,
        match,
        category,
        type: type || null,
        priority: priority ?? 0,
      },
    });

    res.status(201).json({ rule });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = ruleSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existing = await prisma.categoryRule.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Rule not found" });
    }

    const { match, category, type, priority } = parsed.data;

    if (match && match.toLowerCase() !== existing.match.toLowerCase()) {
      const clash = await prisma.categoryRule.findFirst({
        where: {
          userId: req.userId,
          id: { not: existing.id },
          match: { equals: match, mode: "insensitive" },
        },
      });
      if (clash) return res.status(409).json({ error: `You already have a rule for “${match}”` });
    }

    const rule = await prisma.categoryRule.update({
      where: { id: existing.id },
      data: {
        ...(match !== undefined ? { match } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(type !== undefined ? { type: type || null } : {}),
        ...(priority !== undefined ? { priority } : {}),
      },
    });

    res.json({ rule });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.categoryRule.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Rule not found" });
    }

    await prisma.categoryRule.delete({ where: { id: existing.id } });
    res.status(204).end();
  })
);

// Re-run the rules over history. Transfers are never touched, and by default
// only transactions still sitting in the catch-all category are rewritten.
router.post(
  "/apply",
  asyncHandler(async (req, res) => {
    const includeCategorised = req.body?.includeCategorised === true;
    const fallback =
      typeof req.body?.fallbackCategory === "string" && req.body.fallbackCategory.trim()
        ? req.body.fallbackCategory.trim()
        : "Other";

    const rules = await listRules(req.userId);
    if (rules.length === 0) {
      return res.json({ updated: 0, rules: 0 });
    }

    const transactions = await prisma.transaction.findMany({
      where: {
        userId: req.userId,
        transferGroupId: null,
        ...(includeCategorised ? {} : { category: fallback }),
      },
      select: { id: true, description: true, type: true, category: true },
    });

    // Group by outcome so the whole pass is a handful of statements, and use
    // the same matcher the importer uses so the best rule always wins.
    const byCategory = new Map();
    for (const transaction of transactions) {
      const rule = categorize(rules, transaction);
      if (!rule || rule.category === transaction.category) continue;
      if (!byCategory.has(rule.category)) byCategory.set(rule.category, []);
      byCategory.get(rule.category).push(transaction.id);
    }

    let updated = 0;
    for (const [category, ids] of byCategory) {
      for (let i = 0; i < ids.length; i += 500) {
        const result = await prisma.transaction.updateMany({
          where: { userId: req.userId, id: { in: ids.slice(i, i + 500) } },
          data: { category },
        });
        updated += result.count;
      }
    }

    res.json({ updated, rules: rules.length });
  })
);

export default router;

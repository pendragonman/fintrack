import { Router } from "express";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
router.use(requireAuth);

const goalSchema = z.object({
  name: z.string().min(1).max(80),
  targetAmount: z.number().positive(),
  targetDate: z.string().optional().nullable(),
});

const contributeSchema = z.object({
  amount: z.number(),
});

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const goals = await prisma.savingsGoal.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ items: goals });
  })
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, targetAmount, targetDate } = parsed.data;

    const goal = await prisma.savingsGoal.create({
      data: {
        userId: req.userId,
        name,
        targetAmount,
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });

    res.status(201).json({ goal });
  })
);

router.put(
  "/:id",
  asyncHandler(async (req, res) => {
    const parsed = goalSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existing = await prisma.savingsGoal.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const { name, targetAmount, targetDate } = parsed.data;
    const goal = await prisma.savingsGoal.update({
      where: { id: req.params.id },
      data: { name, targetAmount, targetDate: targetDate ? new Date(targetDate) : null },
    });

    res.json({ goal });
  })
);

router.post(
  "/:id/contribute",
  asyncHandler(async (req, res) => {
    const parsed = contributeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const existing = await prisma.savingsGoal.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Goal not found" });
    }

    const newAmount = Math.max(0, Number(existing.currentAmount) + parsed.data.amount);
    const goal = await prisma.savingsGoal.update({
      where: { id: req.params.id },
      data: { currentAmount: newAmount },
    });

    res.json({ goal });
  })
);

router.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const existing = await prisma.savingsGoal.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== req.userId) {
      return res.status(404).json({ error: "Goal not found" });
    }

    await prisma.savingsGoal.delete({ where: { id: req.params.id } });
    res.status(204).end();
  })
);

export default router;

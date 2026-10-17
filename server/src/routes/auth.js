import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import { generateCode, sendVerificationEmail } from "../lib/mailer.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signupSchema = z.object({
  name: z.string().min(1).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const verifySchema = z.object({
  email: z.string().email(),
  code: z.string().min(6).max(6),
});

const resendSchema = z.object({
  email: z.string().email(),
});

const googleSchema = z.object({
  idToken: z.string().min(1),
});

function issueToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function toPublicUser(user) {
  return { id: user.id, name: user.name, email: user.email, currency: user.currency };
}

async function issueAndSendCode(user) {
  const code = generateCode();
  const expiry = new Date(Date.now() + 15 * 60 * 1000);
  await prisma.user.update({
    where: { id: user.id },
    data: { verificationCode: code, verificationCodeExpiry: expiry },
  });
  sendVerificationEmail(user.email, user.name, code).catch((err) => {
    console.error(`Failed to send verification email to ${user.email}:`, err);
  });
}

router.post(
  "/signup",
  asyncHandler(async (req, res) => {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { name, email, password } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const error = existing.googleId
        ? "This email is registered via Google. Use \"Continue with Google\" to log in."
        : "An account with this email already exists";
      return res.status(409).json({ error });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { name, email, passwordHash, emailVerified: false },
    });

    await issueAndSendCode(user);
    res.status(201).json({ needsVerification: true, email: user.email });
  })
);

router.post(
  "/login",
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (!user.emailVerified) {
      await issueAndSendCode(user);
      return res.status(403).json({ needsVerification: true, email: user.email });
    }

    const token = issueToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  })
);

router.post(
  "/verify-email",
  asyncHandler(async (req, res) => {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.verificationCode || !user.verificationCodeExpiry) {
      return res.status(400).json({ error: "Invalid or expired code" });
    }
    if (user.verificationCodeExpiry < new Date()) {
      return res.status(400).json({ error: "This code has expired. Request a new one." });
    }
    if (user.verificationCode !== code) {
      return res.status(400).json({ error: "Incorrect code" });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationCode: null, verificationCodeExpiry: null },
    });

    const token = issueToken(updated.id);
    res.json({ token, user: toPublicUser(updated) });
  })
);

router.post(
  "/resend-code",
  asyncHandler(async (req, res) => {
    const parsed = resendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (!user || user.emailVerified) {
      return res.json({ ok: true });
    }

    await issueAndSendCode(user);
    res.json({ ok: true });
  })
);

router.post(
  "/google",
  asyncHandler(async (req, res) => {
    const parsed = googleSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: parsed.data.idToken,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Invalid Google credential" });
    }

    const { sub: googleId, email, name } = payload;
    if (!email) {
      return res.status(400).json({ error: "Google account has no email" });
    }

    let user = await prisma.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    });

    if (user) {
      if (!user.googleId) {
        return res.status(409).json({
          error: "This email already has a password-based account. Log in with your password instead.",
        });
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          name: name || email.split("@")[0],
          googleId,
          emailVerified: true,
        },
      });
    }

    const token = issueToken(user.id);
    res.json({ token, user: toPublicUser(user) });
  })
);

router.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: toPublicUser(user) });
  })
);

const updateMeSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  currency: z.string().min(1).max(10).optional(),
});

router.patch(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = updateMeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: parsed.data,
    });
    res.json({ user: toPublicUser(user) });
  })
);

router.delete(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    await prisma.user.delete({ where: { id: req.userId } });
    res.status(204).end();
  })
);

export default router;

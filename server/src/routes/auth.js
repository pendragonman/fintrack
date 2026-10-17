import { Router } from "express";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod";
import prisma from "../lib/prisma.js";
import requireAuth from "../middleware/auth.js";
import { generateCode, sendVerificationEmail, sendPasswordResetEmail } from "../lib/mailer.js";
import { rateLimit } from "../lib/rateLimit.js";
import asyncHandler from "../lib/asyncHandler.js";

const router = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const RESET_TTL_MINUTES = 30;
const MAX_FAILED_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

const loginLimiter = rateLimit({
  keyPrefix: "login",
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: "Too many login attempts from this device. Try again in a few minutes.",
});
const signupLimiter = rateLimit({
  keyPrefix: "signup",
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: "Too many sign-up attempts from this device. Try again later.",
});
const resendLimiter = rateLimit({
  keyPrefix: "resend",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many code requests. Wait a few minutes before trying again.",
});
const forgotLimiter = rateLimit({
  keyPrefix: "forgot",
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: "Too many reset requests. Wait a few minutes before trying again.",
});
const resetLimiter = rateLimit({
  keyPrefix: "reset",
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: "Too many attempts. Try again in a few minutes.",
});

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

const forgotSchema = z.object({
  email: z.string().email(),
  // The browser sends its own origin so reset links come back to the right host
  // (production vs. localhost). Anything not on the allow-list is ignored.
  origin: z.string().url().optional(),
});

const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: z.string().min(8).max(100),
});

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function allowedOrigins() {
  return (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

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
  signupLimiter,
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
  loginLimiter,
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

    // Durable lockout, so a targeted attack cannot just rotate IPs.
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.max(
        1,
        Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
      );
      return res.status(429).json({
        error: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      const attempts = user.failedLoginAttempts + 1;
      const shouldLock = attempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          // Once the threshold is hit the lock is what protects the account, so
          // the counter restarts from zero for the next window.
          failedLoginAttempts: shouldLock ? 0 : attempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000)
            : null,
        },
      });

      if (shouldLock) {
        return res.status(429).json({
          error: `Too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
        });
      }
      return res.status(401).json({ error: "Invalid email or password" });
    }

    if (user.failedLoginAttempts > 0 || user.lockedUntil) {
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: 0, lockedUntil: null },
      });
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
  resendLimiter,
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
  "/forgot-password",
  forgotLimiter,
  asyncHandler(async (req, res) => {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { email, origin } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always answer identically so this endpoint cannot be used to discover
    // which email addresses have accounts.
    if (!user || !user.passwordHash) {
      return res.json({ ok: true });
    }

    const token = crypto.randomBytes(32).toString("base64url");
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: hashToken(token),
        resetTokenExpiry: new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000),
      },
    });

    const origins = allowedOrigins();
    const base = origin && origins.includes(origin) ? origin : origins[0];
    const link = `${base}/reset-password?token=${encodeURIComponent(token)}`;

    sendPasswordResetEmail(user.email, user.name, link).catch((err) => {
      console.error(`Failed to send password reset email to ${user.email}:`, err);
    });

    res.json({ ok: true });
  })
);

router.post(
  "/reset-password",
  resetLimiter,
  asyncHandler(async (req, res) => {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message });
    }
    const { token, password } = parsed.data;

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: hashToken(token) },
    });
    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      return res.status(400).json({
        error: "This reset link is invalid or has expired. Request a new one.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiry: null,
        // Following the emailed link proves control of the address.
        emailVerified: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    res.json({ token: issueToken(updated.id), user: toPublicUser(updated) });
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

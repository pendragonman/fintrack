import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import transactionRoutes from "./routes/transactions.js";
import budgetRoutes from "./routes/budgets.js";
import goalRoutes from "./routes/goals.js";
import reportRoutes from "./routes/reports.js";
import { CATEGORIES } from "./lib/categories.js";

process.on("unhandledRejection", (err) => {
  console.error("Unhandled rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err);
});

const app = express();
app.disable("x-powered-by");

// Behind Vercel's proxy, so req.ip must come from X-Forwarded-For; the auth
// rate limiters key off it.
app.set("trust proxy", 1);

// CLIENT_ORIGIN may be a comma-separated list, e.g.
// "https://my-app.vercel.app,http://localhost:5173"
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(cors({ origin: allowedOrigins }));

// The API only returns per-user data, so responses must never be cached or
// revalidated. Vercel's default `Cache-Control: public, max-age=0,
// must-revalidate` plus an ETag makes browsers revalidate, and the resulting
// 304 comes back without CORS headers, which browsers reject as a CORS error.
app.set("etag", false);
app.use((req, res, next) => {
  res.set("Cache-Control", "no-store");
  // Baseline hardening. Deliberately no Cross-Origin-Opener-Policy: it breaks
  // the Google Sign-In popup flow.
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "no-referrer");
  res.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.get("/api/categories", (req, res) => res.json({ items: CATEGORIES }));

app.use("/api/auth", authRoutes);
app.use("/api/transactions", transactionRoutes);
app.use("/api/budgets", budgetRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/reports", reportRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong" });
});

const port = process.env.PORT || 4000;

// Vercel (serverless) imports this module and uses the exported app.
// Locally, we start a normal listening server.
if (process.env.VERCEL !== "1") {
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;

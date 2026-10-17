// Best-effort in-memory rate limiting.
//
// Serverless instances are ephemeral and horizontally scaled, so this only
// throttles repeat traffic that lands on the same instance. It is defence in
// depth on top of the durable per-account lockout in the auth routes, which is
// what actually stops a targeted password-guessing attack.
const buckets = new Map();
const MAX_TRACKED_KEYS = 5000;

function prune(now) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export function rateLimit({ keyPrefix, windowMs, max, message }) {
  return function rateLimiter(req, res, next) {
    const now = Date.now();
    if (buckets.size > MAX_TRACKED_KEYS) prune(now);

    const key = `${keyPrefix}:${req.ip}`;
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.set("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: message || `Too many requests. Try again in ${retryAfter} seconds.`,
      });
    }

    next();
  };
}

export default rateLimit;

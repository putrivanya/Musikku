const buckets = new Map();

// Pembersihan berkala agar memori tidak tumbuh tanpa batas.
const cleanup = setInterval(() => {
  const now = Date.now();

  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}, 60_000);

if (typeof cleanup.unref === "function") cleanup.unref();

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || "unknown";
}

/**
 * Rate limiter sederhana berbasis memori.
 * Cocok untuk satu instance backend; gunakan Redis bila backend diskalakan.
 */
function rateLimit({
  windowMs = 15 * 60 * 1000,
  max = 20,
  keyGenerator = clientIp,
  skipSuccessfulRequests = false,
  message = "Terlalu banyak percobaan. Coba lagi nanti.",
} = {}) {
  return function limiter(req, res, next) {
    const key = String(keyGenerator(req) || "unknown");
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((bucket.resetAt - now) / 1000)
      );

      res.setHeader("Retry-After", String(retryAfter));

      return res.status(429).json({
        success: false,
        message,
      });
    }

    if (skipSuccessfulRequests) {
      res.on("finish", () => {
        if (res.statusCode < 400) {
          const current = buckets.get(key);

          if (current && current.count > 0) {
            current.count -= 1;
          }
        }
      });
    }

    return next();
  };
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skipSuccessfulRequests: true,
  message:
    "Terlalu banyak percobaan login. Tunggu 15 menit sebelum mencoba lagi.",
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message:
    "Terlalu banyak pendaftaran dari jaringan ini. Coba lagi nanti.",
});

module.exports = {
  rateLimit,
  loginLimiter,
  registerLimiter,
};

import { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  windowMs: number;
  max: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
  skip?: (req: Request) => boolean;
}

interface ClientRecord {
  count: number;
  resetAt: number;
}

/**
 * High-performance, zero-dependency in-memory sliding window rate limiter.
 * Protects endpoints from brute-force, DoS flooding, and rapid scraping.
 */
export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, ClientRecord>();
  const { windowMs, max, message = "Too many requests. Please slow down." } = options;

  // Cleanup expired entries periodically to prevent memory leaks
  const interval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetAt) {
        hits.delete(key);
      }
    }
  }, 30000);

  if (interval.unref) interval.unref();

  return (req: Request, res: Response, next: NextFunction) => {
    // Always skip CORS preflight requests
    if (req.method === "OPTIONS") {
      return next();
    }

    if (options.skip && options.skip(req)) {
      return next();
    }

    const clientIp = options.keyGenerator 
      ? options.keyGenerator(req) 
      : ((req.headers["x-forwarded-for"] as string) || req.ip || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();

    const now = Date.now();
    let record = hits.get(clientIp);

    if (!record || now > record.resetAt) {
      record = { count: 1, resetAt: now + windowMs };
      hits.set(clientIp, record);
    } else {
      record.count++;
    }

    const remaining = Math.max(0, max - record.count);
    const retryAfterSec = Math.max(1, Math.ceil((record.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", Math.ceil(record.resetAt / 1000));

    if (record.count > max) {
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({
        error: "Too Many Requests",
        message,
        retryAfterSeconds: retryAfterSec,
      });
    }

    next();
  };
}

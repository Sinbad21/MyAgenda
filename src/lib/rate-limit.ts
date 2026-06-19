/**
 * Simple in-memory rate limiter (per IP or user token).
 * Resets every `windowMs` milliseconds.
 * Safe for single-process deployments; for multi-process use Redis.
 */

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

interface RateLimitOptions {
  /** How many requests to allow per window. */
  limit: number;
  /** Window size in milliseconds. Default: 60_000 (1 minute). */
  windowMs?: number;
}

export function checkRateLimit(key: string, opts: RateLimitOptions): { ok: boolean; remaining: number } {
  const now = Date.now();
  const windowMs = opts.windowMs ?? 60_000;
  let win = store.get(key);
  if (!win || now >= win.resetAt) {
    win = { count: 0, resetAt: now + windowMs };
    store.set(key, win);
  }
  win.count++;
  const remaining = Math.max(0, opts.limit - win.count);
  return { ok: win.count <= opts.limit, remaining };
}

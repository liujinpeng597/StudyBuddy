type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// ponytail: process-local fixed-window limiter; replace with Redis only if multi-instance limits matter.
export function enforceRateLimit(key: string, limit: number, windowMs: number): void {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) {
    throw new Error("请求过于频繁，请稍后再试");
  }
  current.count += 1;
}

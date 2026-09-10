// In-memory per-process limiter — fine for the single dev/prod instance this
// app runs as. ponytail: swap for a shared store (Redis/Supabase) if this
// ever runs as more than one instance.
type Entry = { count: number; resetAt: number };
const requests = new Map<string, Entry>();
const WINDOW_MS = 60_000;
const MAX_REQUESTS = 20;

export function enforceRateLimit(key: string) {
  const now = Date.now();
  const current = requests.get(key);
  if (!current || current.resetAt <= now) {
    requests.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  if (current.count >= MAX_REQUESTS) throw new Error("Too many requests");
  current.count += 1;
}

export function requestKey(request: Request, userId?: string) {
  if (userId) return `user:${userId}`;
  return `ip:${request.headers.get("x-forwarded-for") ?? "unknown"}`;
}

export type D1Result<T = Record<string, unknown>> = { results?: T[]; meta?: Record<string, any> };
export type D1StatementLike = { bind: (...values: any[]) => D1StatementLike; run: () => Promise<{ meta?: Record<string, any> }>; first: <T = Record<string, any>>() => Promise<T | null>; all: <T = Record<string, any>>() => Promise<D1Result<T>> };
export type D1DatabaseLike = { prepare: (query: string) => D1StatementLike; batch: (statements: D1StatementLike[]) => Promise<unknown> };

const workerEnv: Record<string, any> = await import("cloudflare:workers")
  .then((module) => (module as any).env || {})
  .catch(() => ({}));

export function getDatabase(): D1DatabaseLike | null {
  return (workerEnv.DB as D1DatabaseLike) || null;
}

export function getMediaBucket(): any | null {
  return workerEnv.MEDIA || null;
}

export function getSecret(name: string): string {
  const fromWorker = workerEnv[name];
  if (typeof fromWorker === "string" && fromWorker.trim()) return fromWorker.trim();
  try {
    const fromProcess = process.env[name];
    return typeof fromProcess === "string" ? fromProcess.trim() : "";
  } catch {
    return "";
  }
}

export function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function jsonError(message: string, status = 400, details?: Record<string, unknown>) {
  return Response.json({ error: message, ...details }, { status });
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(buffer, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function clientFingerprint(request: Request): string {
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
}

export async function consumeRateLimit(db: D1DatabaseLike, key: string, limit: number, windowSeconds: number) {
  const bucket = Math.floor(Date.now() / 1000 / windowSeconds);
  const id = `${key}:${bucket}`;
  await db.prepare(
    "INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, datetime('now', ?)) ON CONFLICT(key) DO UPDATE SET count = count + 1",
  ).bind(id, `+${windowSeconds} seconds`).run();
  const row = await db.prepare("SELECT count FROM rate_limits WHERE key = ? LIMIT 1").bind(id).first<{ count: number }>();
  return Number(row?.count || 0) <= limit;
}

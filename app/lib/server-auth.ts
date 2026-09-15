import { getDatabase, getSecret, isLocalRequest, randomToken, sha256, type D1DatabaseLike } from "./server-platform";

export type AuthUser = {
  id: string;
  email: string;
  nickname: string;
  role: "member" | "admin";
  status: "active" | "suspended";
  emailVerified: boolean;
};

const SESSION_COOKIE = "prompthub_session";
// Cloudflare Workers currently caps WebCrypto PBKDF2 at 100,000 iterations.
// Keep this value portable so production registration and login use the same hash.
const PASSWORD_ITERATIONS = 100_000;
let localSchemaReady = false;
let bootstrappedAdminKey = "";

const localSchema = [
  `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, password_salt TEXT NOT NULL, nickname TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_login_at TEXT, email_verified INTEGER NOT NULL DEFAULT 0, email_verified_at TEXT)`,
  `CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, user_agent TEXT)`,
  `CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL DEFAULT 1, expires_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, detail TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS auth_tokens (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, purpose TEXT NOT NULL, token_hash TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`,
];

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function parseCookies(request: Request) {
  const cookies = new Map<string, string>();
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0) cookies.set(part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim()));
  }
  return cookies;
}

async function derivePassword(password: string, saltHex: string) {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)?.map((value) => parseInt(value, 16)) || []);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PASSWORD_ITERATIONS }, key, 256);
  return Array.from(new Uint8Array(bits), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string) {
  const salt = randomToken(16);
  return { salt, hash: await derivePassword(password, salt) };
}

export async function verifyPassword(password: string, salt: string, expected: string) {
  const actual = await derivePassword(password, salt);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function prepareAuth(request: Request) {
  const db = getDatabase();
  if (!db) return null;
  if (isLocalRequest(request) && !localSchemaReady) {
    await db.batch(localSchema.map((statement) => db.prepare(statement)));
    localSchemaReady = true;
  }
  await bootstrapAdmin(db, isLocalRequest(request));
  return db;
}

async function bootstrapAdmin(db: D1DatabaseLike, localRequest: boolean) {
  const configuredEmail = getSecret("PROMPTHUB_ADMIN_EMAIL");
  const configuredPassword = getSecret("PROMPTHUB_ADMIN_PASSWORD");
  if (!localRequest && (!configuredEmail || !configuredPassword)) return;
  const email = normalizeEmail(configuredEmail || "admin@prompthub.local");
  const password = configuredPassword || "PromptHub.Admin#2026";
  if (!email || password.length < 12) return;
  const cacheKey = `${email}:${password}`;
  if (bootstrappedAdminKey === cacheKey) return;
  const existing = await db.prepare("SELECT id,role,password_hash,password_salt FROM users WHERE email = ? LIMIT 1").bind(email).first<Record<string, any>>();
  if (existing) {
    if (existing.role === "admin") {
      bootstrappedAdminKey = cacheKey;
      return;
    }
    const { hash, salt } = await hashPassword(password);
    await db.prepare("UPDATE users SET role='admin',status='active',password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash, salt, existing.id).run();
    await db.prepare("DELETE FROM sessions WHERE user_id=?").bind(existing.id).run();
    bootstrappedAdminKey = cacheKey;
    return;
  }
  const nickname = getSecret("PROMPTHUB_ADMIN_NICKNAME") || "PromptHub 管理员";
  const { hash, salt } = await hashPassword(password);
  await db.prepare("INSERT INTO users (id,email,password_hash,password_salt,nickname,role,status) VALUES (?,?,?,?,?,'admin','active')")
    .bind(crypto.randomUUID(), email, hash, salt, nickname).run();
  bootstrappedAdminKey = cacheKey;
}

export async function getCurrentUser(request: Request): Promise<AuthUser | null> {
  const db = await prepareAuth(request);
  if (!db) return null;
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token) return null;
  const id = await sha256(token);
  const row = await db.prepare(
    `SELECT u.id,u.email,u.nickname,u.role,u.status,u.email_verified FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.id=? AND s.expires_at>CURRENT_TIMESTAMP LIMIT 1`,
  ).bind(id).first<Record<string, any>>();
  if (!row || row.status !== "active") return null;
  await db.prepare("UPDATE sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE id=? AND last_seen_at < datetime('now','-15 minutes')").bind(id).run();
  return { id: row.id, email: row.email, nickname: row.nickname, role: row.role, status: row.status, emailVerified: Boolean(row.email_verified) } as AuthUser;
}

export async function requireUser(request: Request) {
  const user = await getCurrentUser(request);
  return user || null;
}

export async function requireAdmin(request: Request) {
  const user = await getCurrentUser(request);
  return user?.role === "admin" ? user : null;
}

export async function createSession(request: Request, userId: string, remember: boolean) {
  const db = getDatabase();
  if (!db) throw new Error("数据库暂不可用");
  const token = randomToken(32);
  const id = await sha256(token);
  const days = remember ? 30 : 1;
  await db.prepare("DELETE FROM sessions WHERE expires_at <= CURRENT_TIMESTAMP").run();
  await db.prepare("INSERT INTO sessions (id,user_id,expires_at,user_agent) VALUES (?,?,datetime('now',?),?)")
    .bind(id, userId, `+${days} days`, (request.headers.get("user-agent") || "").slice(0, 240)).run();
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${days * 86400}${isLocalRequest(request) ? "" : "; Secure"}`;
}

export async function destroySession(request: Request) {
  const db = getDatabase();
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (db && token) await db.prepare("DELETE FROM sessions WHERE id=?").bind(await sha256(token)).run();
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isLocalRequest(request) ? "" : "; Secure"}`;
}

export function publicUser(user: AuthUser | null) {
  return user ? { id: user.id, email: user.email, nickname: user.nickname, role: user.role, emailVerified: user.emailVerified } : null;
}

export async function issueAuthToken(db: D1DatabaseLike, userId: string, purpose: string, ttlMinutes = 60): Promise<string> {
  const raw = randomToken(24);
  const tokenHash = await sha256(raw);
  const id = crypto.randomUUID();
  await db.prepare("INSERT INTO auth_tokens (id,user_id,purpose,token_hash,expires_at) VALUES (?,?,?,?,datetime('now', ?))")
    .bind(id, userId, purpose, tokenHash, `+${ttlMinutes} minutes`).run();
  return raw;
}

export async function consumeAuthToken(db: D1DatabaseLike, raw: string, purpose: string) {
  const tokenHash = await sha256(raw);
  const row = await db.prepare("SELECT * FROM auth_tokens WHERE token_hash=? AND purpose=? AND used_at IS NULL AND expires_at>CURRENT_TIMESTAMP LIMIT 1")
    .bind(tokenHash, purpose).first<Record<string, any>>();
  if (!row) return null;
  await db.prepare("UPDATE auth_tokens SET used_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
  return row;
}

export async function isUserEmailVerified(db: D1DatabaseLike, userId: string): Promise<boolean> {
  const row = await db.prepare("SELECT email_verified FROM users WHERE id=?").bind(userId).first<{ email_verified: number }>();
  return Boolean(row?.email_verified);
}

export { normalizeEmail };

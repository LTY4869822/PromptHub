import { assertSameOrigin, clientFingerprint, consumeRateLimit, jsonError } from "../../../lib/server-platform";
import { createSession, normalizeEmail, prepareAuth, publicUser, verifyPassword } from "../../../lib/server-auth";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const db = await prepareAuth(request);
  if (!db) return jsonError("账号服务暂不可用", 503);
  if (!await consumeRateLimit(db, `login:${clientFingerprint(request)}`, 12, 900)) return jsonError("登录尝试过于频繁，请 15 分钟后再试", 429);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = normalizeEmail(String(body?.email || ""));
  const password = String(body?.password || "");
  const row = await db.prepare("SELECT * FROM users WHERE email=? LIMIT 1").bind(email).first<Record<string, any>>();
  if (!row || !await verifyPassword(password, row.password_salt, row.password_hash)) return jsonError("邮箱或密码不正确", 401);
  if (row.status !== "active") return jsonError("该账号已被暂停使用，请联系管理员", 403);
  await db.prepare("UPDATE users SET last_login_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.id).run();
  const cookie = await createSession(request, row.id, Boolean(body?.remember));
  return Response.json({ user: publicUser({ id: row.id, email: row.email, nickname: row.nickname, role: row.role, status: row.status, emailVerified: Boolean(row.email_verified) }) }, { headers: { "Set-Cookie": cookie } });
}

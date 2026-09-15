import { consumeAuthToken, hashPassword, issueAuthToken, normalizeEmail } from "../../../lib/server-auth";
import { prepareData } from "../../../lib/server-schema";
import { assertSameOrigin, clientFingerprint, consumeRateLimit, jsonError } from "../../../lib/server-platform";
import { sendEmail } from "../../../lib/email";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const db = await prepareData(request);
  if (!db) return jsonError("服务暂不可用", 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  if (action === "request") {
    if (!await consumeRateLimit(db, `pwreset:${clientFingerprint(request)}`, 8, 3600)) return jsonError("操作过于频繁，请稍后再试", 429);
    const email = normalizeEmail(String(body?.email || ""));
    const row = await db.prepare("SELECT id,email FROM users WHERE email=? AND status='active' LIMIT 1").bind(email).first<Record<string, any>>();
    if (row) {
      const token = await issueAuthToken(db, row.id, "reset_password", 30);
      const origin = new URL(request.url).origin;
      const link = `${origin}/reset-password?token=${encodeURIComponent(token)}`;
      await sendEmail(row.email, "重置你的 PromptHub 密码", `<p>点击下方链接设置新密码：</p><p><a href="${link}">${link}</a></p><p>链接 30 分钟内有效。若未发起此操作，请忽略本邮件。</p>`);
    }
    return Response.json({ ok: true });
  }
  if (action === "confirm") {
    const token = String(body?.token || "");
    const password = String(body?.password || "");
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return jsonError("密码至少 10 位，且同时包含字母和数字");
    const row = await consumeAuthToken(db, token, "reset_password");
    if (!row) return jsonError("重置链接无效或已过期", 400);
    const { hash, salt } = await hashPassword(password);
    await db.batch([
      db.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash, salt, row.user_id),
      db.prepare("DELETE FROM sessions WHERE user_id=?").bind(row.user_id),
      db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'account.password.reset','user',?)").bind(row.user_id, row.user_id),
    ]);
    return Response.json({ ok: true });
  }
  return jsonError("不支持的请求");
}

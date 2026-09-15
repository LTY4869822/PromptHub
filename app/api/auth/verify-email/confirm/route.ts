import { consumeAuthToken } from "../../../../lib/server-auth";
import { prepareData } from "../../../../lib/server-schema";
import { jsonError } from "../../../../lib/server-platform";

export async function POST(request: Request) {
  const db = await prepareData(request);
  if (!db) return jsonError("验证服务不可用", 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const token = String(body?.token || "");
  if (!token) return jsonError("缺少验证令牌");
  const row = await consumeAuthToken(db, token, "verify_email");
  if (!row) return jsonError("验证链接无效或已过期", 400);
  await db.prepare("UPDATE users SET email_verified=1,email_verified_at=CURRENT_TIMESTAMP WHERE id=?").bind(row.user_id).run();
  return Response.json({ ok: true });
}

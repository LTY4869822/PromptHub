import { issueAuthToken, requireUser } from "../../../lib/server-auth";
import { prepareData } from "../../../lib/server-schema";
import { jsonError } from "../../../lib/server-platform";
import { sendEmail } from "../../../lib/email";

export async function POST(request: Request) {
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request);
  if (!db) return jsonError("验证服务不可用", 503);
  const row = await db.prepare("SELECT email,email_verified FROM users WHERE id=?").bind(user.id).first<Record<string, any>>();
  if (!row) return jsonError("账号不存在", 404);
  if (row.email_verified) return Response.json({ verified: true });
  const token = await issueAuthToken(db, user.id, "verify_email", 60);
  const origin = new URL(request.url).origin;
  const link = `${origin}/verify?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail(row.email, "验证你的 PromptHub 邮箱", `<p>点击下方链接完成邮箱验证：</p><p><a href="${link}">${link}</a></p><p>链接 60 分钟内有效。</p>`);
  return Response.json({ verified: false, sent });
}

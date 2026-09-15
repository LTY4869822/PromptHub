import { destroySession, hashPassword, requireUser, verifyPassword } from "../../lib/server-auth";
import { prepareData } from "../../lib/server-schema";
import { assertSameOrigin, getMediaBucket, jsonError } from "../../lib/server-platform";

export async function GET(request: Request) {
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("账号服务暂不可用", 503);
  const [profile, prompts, reactions, follows, comments] = await Promise.all([
    db.prepare("SELECT nickname,gender,city,birthday,bio,promptory_id promptoryId,updated_at updatedAt FROM creator_profiles WHERE user_id=? OR actor_key=? LIMIT 1").bind(user.id, user.id).first(),
    db.prepare("SELECT id,title,prompt,summary,source,tool,prompt_type promptType,created_at createdAt,content_status contentStatus FROM prompts WHERE owner_key=? ORDER BY id DESC").bind(user.id).all(),
    db.prepare("SELECT prompt_id promptId,reaction_type reactionType,created_at createdAt FROM prompt_reactions WHERE actor_key=? ORDER BY id DESC").bind(user.id).all(),
    db.prepare("SELECT creator_name creatorName,created_at createdAt FROM creator_follows WHERE actor_key=? ORDER BY id DESC").bind(user.id).all(),
    db.prepare("SELECT prompt_id promptId,body,created_at createdAt FROM prompt_comments WHERE author_key=? ORDER BY id DESC").bind(user.id).all(),
  ]);
  const payload = { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email, nickname: user.nickname, role: user.role }, profile, prompts: prompts.results || [], reactions: reactions.results || [], follows: follows.results || [], comments: comments.results || [] };
  return new Response(JSON.stringify(payload, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="prompthub-data-${new Date().toISOString().slice(0, 10)}.json"`, "Cache-Control": "no-store" } });
}

export async function PATCH(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("账号服务暂不可用", 503);
  const body = await request.json() as Record<string, unknown>; const currentPassword = String(body.currentPassword || ""); const newPassword = String(body.newPassword || "");
  const row = await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=? LIMIT 1").bind(user.id).first<Record<string, any>>();
  if (!row || !await verifyPassword(currentPassword, row.password_salt, row.password_hash)) return jsonError("当前密码不正确", 401);
  if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) return jsonError("新密码至少 10 位，并同时包含字母和数字");
  const { hash, salt } = await hashPassword(newPassword);
  await db.batch([db.prepare("UPDATE users SET password_hash=?,password_salt=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(hash, salt, user.id), db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'account.password','user',?)").bind(user.id, user.id)]);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await destroySession(request) } });
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  if (user.role === "admin") return jsonError("管理员账号不能通过前台注销", 403);
  const db = await prepareData(request); if (!db) return jsonError("账号服务暂不可用", 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; const password = String(body?.password || "");
  const row = await db.prepare("SELECT password_hash,password_salt FROM users WHERE id=? LIMIT 1").bind(user.id).first<Record<string, any>>();
  if (!row || !await verifyPassword(password, row.password_salt, row.password_hash)) return jsonError("密码不正确，无法注销", 401);
  const [profile, mediaRows] = await Promise.all([
    db.prepare("SELECT avatar_key,cover_key FROM creator_profiles WHERE user_id=? OR actor_key=? LIMIT 1").bind(user.id, user.id).first<Record<string, any>>(),
    db.prepare("SELECT media_key,poster_key FROM prompts WHERE owner_key=?").bind(user.id).all<Record<string, any>>(),
  ]);
  await db.batch([
    db.prepare("UPDATE users SET status='deleted',email='deleted+'||id||'@invalid.local',nickname='已注销用户',updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(user.id),
    db.prepare("UPDATE creator_profiles SET nickname='已注销用户',gender='保密',city='未填写',birthday='未填写',bio='',avatar_key=NULL,cover_key=NULL,updated_at=CURRENT_TIMESTAMP WHERE user_id=? OR actor_key=?").bind(user.id, user.id),
    db.prepare("UPDATE prompts SET content_status='deleted',deleted_at=CURRENT_TIMESTAMP,author_name='已注销用户',author_initials='注销',author_bio='',media_key=NULL,poster_key=NULL,media_size=0 WHERE owner_key=?").bind(user.id),
    db.prepare("UPDATE prompt_comments SET author_name='已注销用户',author_initials='注销' WHERE author_key=?").bind(user.id),
    db.prepare("DELETE FROM prompt_reactions WHERE actor_key=?").bind(user.id),
    db.prepare("DELETE FROM creator_follows WHERE actor_key=? OR creator_key=?").bind(user.id, user.id),
    db.prepare("DELETE FROM sessions WHERE user_id=?").bind(user.id),
    db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'account.delete','user',?)").bind(user.id, user.id),
  ]);
  const keys = [profile?.avatar_key, profile?.cover_key, ...(mediaRows.results || []).flatMap((item) => [item.media_key, item.poster_key])].filter(Boolean) as string[];
  if (keys.length) await getMediaBucket()?.delete(keys).catch(() => undefined);
  return Response.json({ ok: true }, { headers: { "Set-Cookie": await destroySession(request) } });
}

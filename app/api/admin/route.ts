import { requireAdmin } from "../../lib/server-auth";
import { prepareData } from "../../lib/server-schema";
import { assertSameOrigin, jsonError } from "../../lib/server-platform";

export async function GET(request: Request) {
  const admin = await requireAdmin(request); if (!admin) return jsonError("需要管理员权限", 403);
  const db = await prepareData(request); if (!db) return jsonError("管理服务暂不可用", 503);
  const url = new URL(request.url); const view = url.searchParams.get("view") || "overview";
  if (view === "users") {
    const result = await db.prepare("SELECT id,email,nickname,role,status,created_at createdAt,last_login_at lastLoginAt FROM users ORDER BY created_at DESC LIMIT 100").all();
    return Response.json({ users: result.results || [] });
  }
  if (view === "content") {
    const result = await db.prepare("SELECT p.id,p.title,p.author_name authorName,p.content_status contentStatus,p.review_status reviewStatus,p.moderation_note moderationNote,p.created_at createdAt,u.status ownerStatus FROM prompts p LEFT JOIN users u ON u.id=p.owner_key ORDER BY p.id DESC LIMIT 100").all();
    return Response.json({ prompts: result.results || [] });
  }
  if (view === "reports") {
    const result = await db.prepare("SELECT r.id,r.prompt_id promptId,r.reason,r.detail,r.status,r.resolution,r.created_at createdAt,p.title,p.author_name authorName FROM prompt_reports r LEFT JOIN prompts p ON p.id=r.prompt_id ORDER BY CASE r.status WHEN 'open' THEN 0 ELSE 1 END,r.id DESC LIMIT 100").all();
    return Response.json({ reports: result.results || [] });
  }
  if (view === "audit") {
    const result = await db.prepare("SELECT a.id,a.action,a.target_type targetType,a.target_id targetId,a.detail,a.created_at createdAt,u.nickname actorName FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100").all();
    return Response.json({ logs: result.results || [] });
  }
  const [registered, users, prompts, reports, pending, hidden] = await Promise.all([
    db.prepare("SELECT COUNT(*) total FROM users").first<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) total FROM users WHERE status='active'").first<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) total FROM prompts WHERE content_status='published'").first<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) total FROM prompt_reports WHERE status='open'").first<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) total FROM prompts WHERE content_status='pending'").first<Record<string, any>>(),
    db.prepare("SELECT COUNT(*) total FROM prompts WHERE content_status='hidden'").first<Record<string, any>>(),
  ]);
  return Response.json({ overview: { registered: Number(registered?.total || 0), users: Number(users?.total || 0), prompts: Number(prompts?.total || 0), reports: Number(reports?.total || 0), pending: Number(pending?.total || 0), hidden: Number(hidden?.total || 0) } });
}

export async function PATCH(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const admin = await requireAdmin(request); if (!admin) return jsonError("需要管理员权限", 403);
  const db = await prepareData(request); if (!db) return jsonError("管理服务暂不可用", 503);
  const data = await request.json() as Record<string, any>; const action = String(data.action || ""); const targetId = String(data.targetId || "");
  if (action === "user.status") {
    if (!targetId || targetId === admin.id || !["active", "suspended"].includes(data.status)) return jsonError("用户操作参数不正确");
    await db.batch([db.prepare("UPDATE users SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND role!='admin'").bind(data.status, targetId), db.prepare("DELETE FROM sessions WHERE user_id=? AND ?='suspended'").bind(targetId, data.status), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id,detail) VALUES (?,'user.status','user',?,?)").bind(admin.id, targetId, JSON.stringify({ status: data.status }))]);
  } else if (action === "prompt.status") {
    if (!targetId || !["published", "hidden"].includes(data.status)) return jsonError("内容操作参数不正确");
    if (data.status === "published") {
      const owner = await db.prepare("SELECT u.status FROM prompts p JOIN users u ON u.id=p.owner_key WHERE p.id=? LIMIT 1").bind(targetId).first<Record<string, any>>();
      if (!owner || owner.status !== "active") return jsonError("账号已注销或不可用，不能恢复该作品", 409);
    }
    await db.batch([db.prepare("UPDATE prompts SET content_status=?,deleted_at=CASE WHEN ?='published' THEN NULL ELSE deleted_at END,moderation_note=?,moderated_by=? WHERE id=?").bind(data.status, data.status, String(data.note || "").slice(0, 500) || null, admin.id, targetId), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id,detail) VALUES (?,'prompt.status','prompt',?,?)").bind(admin.id, targetId, JSON.stringify({ status: data.status, note: String(data.note || "").slice(0, 500) }))]);
  } else if (action === "report.resolve") {
    if (!targetId || !["resolved", "dismissed"].includes(data.status)) return jsonError("举报处理参数不正确");
    await db.batch([db.prepare("UPDATE prompt_reports SET status=?,assigned_to=?,resolution=?,resolved_at=CURRENT_TIMESTAMP WHERE id=?").bind(data.status, admin.id, String(data.resolution || "").slice(0, 500), targetId), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id,detail) VALUES (?,'report.resolve','report',?,?)").bind(admin.id, targetId, JSON.stringify({ status: data.status, resolution: String(data.resolution || "").slice(0, 500) }))]);
  } else return jsonError("不支持的管理员操作");
  return Response.json({ ok: true });
}

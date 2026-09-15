import { getCurrentUser, requireUser } from "../../lib/server-auth";
import { prepareData } from "../../lib/server-schema";
import { assertSameOrigin, clientFingerprint, consumeRateLimit, getMediaBucket, jsonError, sha256, type D1DatabaseLike } from "../../lib/server-platform";
import { isLocalPreview, reviewPromptSubmission, type PromptReview } from "../../lib/server-review";
import { moderateImage } from "../../lib/server-media-review";

type PromptRow = Record<string, any>;
const parseJson = (value: unknown, fallback: any[] = []) => { try { return JSON.parse(String(value || "[]")); } catch { return fallback; } };
const initials = (name: string) => Array.from(name.trim()).slice(0, 2).join("") || "匿";
const safeList = (value: unknown) => (Array.isArray(value) ? value : String(value || "").split(/[，,\n]+/)).map((item) => String(item).trim()).filter(Boolean).slice(0, 4);
const safeUrl = (value: unknown) => { let text = String(value || "").trim(); if (!text) return null; if (!/^https?:\/\//i.test(text) && /^[a-z0-9-]+(\.[a-z0-9-]+)+([/?#]\S*)?$/i.test(text)) text = `https://${text}`; try { const url = new URL(text); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; } };
const extractUrl = (value: unknown) => { const match = String(value || "").match(/https?:\/\/[^\s"'<>]+/i); return match ? match[0] : null; };
const reviewPayload = (value: Record<string, any>) => ({ title: String(value.title || ""), summary: String(value.summary || ""), prompt: String(value.prompt || ""), negativePrompt: String(value.negativePrompt || ""), tags: Array.isArray(value.tags) ? value.tags.join("，") : String(value.tags || ""), tool: String(value.tool || ""), promptType: String(value.promptType || "") });

function toPrompt(row: PromptRow, viewer?: { id: string; role: string } | null) {
  return { id: row.id, title: row.title, prompt: row.prompt, summary: row.summary, negativePrompt: row.negative_prompt, aspectRatio: row.aspect_ratio, modelVersion: row.model_version, parameters: row.parameters, useCases: parseJson(row.use_cases), source: row.source, sourceUrl: row.source_url, originalWorkUrl: row.original_work_url, tool: row.tool, promptType: row.prompt_type || "待确认类型", mediaRole: row.media_role || "生成效果", mediaType: row.media_type, mediaUrl: row.media_key ? `/api/media/${encodeURIComponent(row.media_key)}` : null, posterUrl: row.poster_key ? `/api/media/${encodeURIComponent(row.poster_key)}` : null, mediaName: row.media_name, mediaSize: row.media_size, tags: parseJson(row.tags), rightsType: row.rights_type, reviewStatus: row.review_status || "legacy", reviewMode: row.review_mode || "legacy", reviewConfidence: Number(row.review_confidence || 0) / 100, reviewReason: row.review_reason, safetyLabels: parseJson(row.safety_labels), reviewedAt: row.reviewed_at, contentStatus: row.content_status || "published", authorId: row.owner_key || undefined, authorName: row.author_name, authorInitials: row.author_initials, authorBio: row.author_bio, likes: row.likes, saves: row.saves, views: row.views, commentsCount: row.comments_count, createdAt: row.created_at, tone: row.media_type === "video" ? "tone-night" : "tone-sand", duration: row.duration, owned: Boolean(viewer && row.owner_key === viewer.id), liked: Boolean(row.viewer_liked), saved: Boolean(row.viewer_saved), hotScore: Number(row.computed_hot_score ?? row.hot_score ?? 0) };
}

async function consumeReviewReceipt(db: D1DatabaseLike, userId: string, receipt: string, payload: Record<string, any>): Promise<PromptReview | null> {
  if (!receipt) return null;
  const hash = await sha256(JSON.stringify(reviewPayload(payload)));
  const row = await db.prepare("SELECT result FROM review_receipts WHERE id=? AND user_id=? AND payload_hash=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(receipt, userId, hash).first<Record<string, any>>();
  if (!row) return null;
  await db.prepare("DELETE FROM review_receipts WHERE id=?").bind(receipt).run();
  try { return JSON.parse(row.result) as PromptReview; } catch { return null; }
}

export async function GET(request: Request) {
  const db = await prepareData(request); if (!db) return Response.json({ prompts: [], nextCursor: null });
  const viewer = await getCurrentUser(request); if (!viewer) return jsonError("请先登录", 401); const url = new URL(request.url); const id = url.searchParams.get("id");
  if (id) {
    const row = await db.prepare(`SELECT p.*,(SELECT 1 FROM prompt_reactions r WHERE r.prompt_id=p.id AND r.actor_key=? AND r.reaction_type='like' LIMIT 1) viewer_liked,(SELECT 1 FROM prompt_reactions r WHERE r.prompt_id=p.id AND r.actor_key=? AND r.reaction_type='save' LIMIT 1) viewer_saved FROM prompts p WHERE p.id=? AND (p.content_status='published' OR p.owner_key=? OR ?='admin') AND p.deleted_at IS NULL LIMIT 1`).bind(viewer?.id || "", viewer?.id || "", id, viewer?.id || "", viewer?.role || "").first<PromptRow>();
    if (!row) return jsonError("未找到该作品", 404);
    const comments = await db.prepare("SELECT id,author_name authorName,author_initials authorInitials,body,created_at createdAt FROM prompt_comments WHERE prompt_id=? AND status='published' ORDER BY id DESC LIMIT 50").bind(id).all();
    const following = viewer ? Boolean(await db.prepare("SELECT id FROM creator_follows WHERE actor_key=? AND (creator_key=? OR creator_name=?) LIMIT 1").bind(viewer.id, row.owner_key || "", row.author_name).first()) : false;
    return Response.json({ prompt: toPrompt(row, viewer), comments: comments.results || [], following });
  }
  const mine = url.searchParams.get("mine") === "1"; if (mine && !viewer) return jsonError("请先登录", 401);
  const mode = url.searchParams.get("mode") || "gallery"; const creator = url.searchParams.get("creator"); const creatorKey = url.searchParams.get("creatorKey"); const query = (url.searchParams.get("q") || "").trim().slice(0, 80); const cursorToken = url.searchParams.get("cursor") || ""; const cursor = Math.max(0, Number(cursorToken || 0)); const limit = Math.min(48, Math.max(1, Number(url.searchParams.get("limit") || 24))); const hotExpression = "((p.saves*6+p.likes*3+p.comments_count*4+p.views*0.12)/pow(MAX(2,julianday('now')-julianday(p.created_at)+2),1.35))";
  if (["following", "saved"].includes(mode) && !viewer) return jsonError("请先登录", 401);
  const conditions: string[] = [mine ? "p.deleted_at IS NULL" : "p.content_status='published'", mine ? "p.owner_key=?" : "1=1"]; const bindings: any[] = mine ? [viewer!.id] : [];
  if (creator) { conditions.push("p.author_name=?"); bindings.push(creator); }
  if (creatorKey) { conditions.push("p.owner_key=?"); bindings.push(creatorKey); }
  if (mode === "hot" && cursorToken.includes(":")) { const [scoreText, idText] = cursorToken.split(":"); const score = Number(scoreText); const hotId = Number(idText); if (Number.isFinite(score) && hotId > 0) { conditions.push(`(${hotExpression}<? OR (${hotExpression}=? AND p.id<?))`); bindings.push(score, score, hotId); } }
  else if (cursor) { conditions.push("p.id<?"); bindings.push(cursor); }
  if (query) { conditions.push("(p.title LIKE ? OR p.summary LIKE ? OR p.tags LIKE ? OR p.author_name LIKE ? OR p.tool LIKE ?)"); const pattern = `%${query.replace(/[%_]/g, "")}%`; bindings.push(pattern, pattern, pattern, pattern, pattern); }
  if (mode === "following" && viewer) { conditions.push("EXISTS(SELECT 1 FROM creator_follows f WHERE f.actor_key=? AND (f.creator_key=p.owner_key OR f.creator_name=p.author_name))"); bindings.push(viewer.id); }
  if (mode === "saved" && viewer) { conditions.push("EXISTS(SELECT 1 FROM prompt_reactions r WHERE r.actor_key=? AND r.reaction_type='save' AND r.prompt_id=p.id)"); bindings.push(viewer.id); }
  if (mode === "hot") conditions.push("p.review_status='approved' AND (p.saves>=2 OR p.likes>=5 OR p.views>=30) AND p.created_at>=datetime('now','-30 days')");
  const order = mode === "hot" ? `${hotExpression} DESC,p.id DESC` : "p.id DESC";
  const result = await db.prepare(`SELECT p.*,(SELECT 1 FROM prompt_reactions r WHERE r.prompt_id=p.id AND r.actor_key=? AND r.reaction_type='like' LIMIT 1) viewer_liked,(SELECT 1 FROM prompt_reactions r WHERE r.prompt_id=p.id AND r.actor_key=? AND r.reaction_type='save' LIMIT 1) viewer_saved${mode === "hot" ? `,${hotExpression} computed_hot_score` : ""} FROM prompts p WHERE ${conditions.join(" AND ")} ORDER BY ${order} LIMIT ?`).bind(viewer?.id || "", viewer?.id || "", ...bindings, limit + 1).all<PromptRow>();
  const rows = result.results || []; const hasMore = rows.length > limit; const page = rows.slice(0, limit);
  const last = page[page.length - 1]; const following = viewer && last && (creator || creatorKey) ? Boolean(await db.prepare("SELECT id FROM creator_follows WHERE actor_key=? AND (creator_key=? OR creator_name=?) LIMIT 1").bind(viewer.id, last.owner_key || "", last.author_name).first()) : false;
  return Response.json({ prompts: page.map((row) => toPrompt(row, viewer)), nextCursor: hasMore && last ? mode === "hot" ? `${Number(last.computed_hot_score || 0)}:${last.id}` : last.id : null, following });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("发布服务暂不可用", 503);
  if (!await consumeRateLimit(db, `publish:${user.id}`, 20, 86400)) return jsonError("今日发布次数已达上限", 429);
  const body = await request.json().catch(() => null) as Record<string, any> | null; if (!body) return jsonError("发布数据格式不正确");
  const title = String(body.title || "").trim().slice(0, 80); const prompt = String(body.prompt || "").trim().slice(0, 50_000); const summary = String(body.summary || "").trim().slice(0, 120); const source = String(body.source || "").trim().slice(0, 120); const tool = String(body.tool || "").trim().slice(0, 60);
  if (!title || !summary || !prompt || !source || !tool || tool === "其他") return jsonError("标题、摘要、提示词、来源和实际生成工具均为必填");
  const upload = await db.prepare("SELECT * FROM upload_sessions WHERE id=? AND owner_key=? AND status='completed' LIMIT 1").bind(String(body.mediaUploadId || ""), user.id).first<Record<string, any>>();
  if (!upload) return jsonError("展示素材尚未上传完成");
  const poster = body.posterUploadId ? await db.prepare("SELECT * FROM upload_sessions WHERE id=? AND owner_key=? AND status='completed' LIMIT 1").bind(String(body.posterUploadId), user.id).first<Record<string, any>>() : null;
  if (body.posterUploadId && !poster) return jsonError("视频封面尚未上传完成");
  if (poster && (!poster.mime.startsWith("image/") || poster.kind !== "poster")) return jsonError("视频封面文件格式或用途不正确", 415);
  const visualTarget = poster || (upload.mime.startsWith("image/") ? upload : null);
  let moderationNote = "";
  if (visualTarget) {
    const visualLabels = await moderateImage(await getMediaBucket()?.get(visualTarget.object_key), visualTarget.mime, isLocalPreview(request));
    if (visualLabels === null) moderationNote = "视觉审核服务暂不可用，作品已直接发布";
    else if (visualLabels.length) return jsonError(`展示素材未通过安全审核：${visualLabels.join("、")}`, 422);
  }
  if (upload.mime.startsWith("video/") && !isLocalPreview(request) && !moderationNote) moderationNote = "视频作品已通过文本与封面审核，直接发布";
  const payload = { ...body, title, summary, prompt, source, tool };
  let review = await consumeReviewReceipt(db, user.id, String(body.reviewReceipt || ""), payload);
  if (!review) review = await reviewPromptSubmission({ title, summary, prompt, negativePrompt: String(body.negativePrompt || ""), tags: String(body.tags || ""), tool, claimedType: String(body.promptType || "") }, { localPreview: isLocalPreview(request) });
  if (review.status !== "approved") return Response.json({ error: review.safetyReason, review }, { status: review.status === "blocked" ? 422 : 503 });
  const profile = await db.prepare("SELECT nickname,bio FROM creator_profiles WHERE user_id=? OR actor_key=? LIMIT 1").bind(user.id, user.id).first<Record<string, any>>(); const userName = profile?.nickname || user.nickname;
  const contentStatus = "published";
  const row = await db.prepare(`INSERT INTO prompts (owner_key,title,prompt,summary,negative_prompt,aspect_ratio,model_version,parameters,use_cases,source,source_url,original_work_url,tool,prompt_type,media_role,media_type,media_key,media_name,media_mime,media_size,poster_key,duration,tags,rights_type,review_status,review_mode,review_confidence,review_reason,safety_labels,review_model,reviewed_at,moderation_note,content_status,author_name,author_initials,author_bio) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING *`)
    .bind(user.id, title, prompt, summary, String(body.negativePrompt || "").trim().slice(0, 10_000), String(body.aspectRatio || "").slice(0, 12), String(body.modelVersion || "").trim().slice(0, 80), String(body.parameters || "").trim().slice(0, 160), JSON.stringify(safeList(body.useCases)), source, safeUrl(body.sourceUrl) || extractUrl(body.source), safeUrl(body.originalWorkUrl), tool, review.detectedType, String(body.mediaRole || "生成效果").slice(0, 24), upload.mime.startsWith("video/") ? "video" : "image", upload.object_key, upload.file_name, upload.mime, upload.size, poster?.object_key || null, String(body.duration || "").slice(0, 16) || null, JSON.stringify(safeList(body.tags)), String(body.rightsType || "原创分享").slice(0, 24), review.status, review.mode, Math.round(review.confidence * 100), `${review.typeReason}${review.typeChanged ? `；作者自选“${review.claimedType}”，AI 已更正` : ""}`, JSON.stringify(review.safetyLabels), review.model, review.reviewedAt, moderationNote || null, contentStatus, userName, initials(userName), String(body.authorBio || profile?.bio || "").trim().slice(0, 160)).first<PromptRow>();
  await db.batch([db.prepare("UPDATE upload_sessions SET status='attached' WHERE id=? OR id=?").bind(upload.id, poster?.id || ""), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'prompt.publish','prompt',?)").bind(user.id, String(row?.id || ""))]);
  return Response.json({ prompt: row ? toPrompt(row, user) : null, moderationNote }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("服务暂不可用", 503);
  const data = await request.json() as Record<string, any>; const id = Number(data.promptId || 0);
  if (data.action === "edit" && id && data.prompt) {
    const own = await db.prepare("SELECT id FROM prompts WHERE id=? AND owner_key=? AND deleted_at IS NULL LIMIT 1").bind(id, user.id).first(); if (!own) return jsonError("无权编辑这条作品", 403);
    const next = data.prompt as Record<string, any>; const title = String(next.title || "").trim().slice(0, 80); const prompt = String(next.prompt || "").trim().slice(0, 50_000); const tool = String(next.tool || "").trim().slice(0, 60);
    if (!title || !prompt || !tool || tool === "其他") return jsonError("标题、提示词和实际生成工具不能留空");
    const review = await reviewPromptSubmission({ title, summary: String(next.summary || ""), prompt, negativePrompt: String(next.negativePrompt || ""), tags: safeList(next.tags).join("，"), tool, claimedType: String(next.promptType || "") }, { localPreview: isLocalPreview(request) });
    if (review.status !== "approved") return Response.json({ error: review.safetyReason, review }, { status: review.status === "blocked" ? 422 : 503 });
    const row = await db.prepare(`UPDATE prompts SET title=?,prompt=?,summary=?,negative_prompt=?,aspect_ratio=?,model_version=?,parameters=?,use_cases=?,source=?,source_url=?,original_work_url=?,tool=?,prompt_type=?,media_role=?,tags=?,rights_type=?,review_status=?,review_mode=?,review_confidence=?,review_reason=?,safety_labels=?,review_model=?,reviewed_at=? WHERE id=? AND owner_key=? RETURNING *`).bind(title, prompt, String(next.summary || "").trim().slice(0, 120), String(next.negativePrompt || "").trim().slice(0, 10_000), String(next.aspectRatio || "").slice(0, 12), String(next.modelVersion || "").trim().slice(0, 80), String(next.parameters || "").trim().slice(0, 160), JSON.stringify(safeList(next.useCases)), String(next.source || "").trim().slice(0, 120), safeUrl(next.sourceUrl), safeUrl(next.originalWorkUrl), tool, review.detectedType, String(next.mediaRole || "生成效果").slice(0, 24), JSON.stringify(safeList(next.tags)), String(next.rightsType || "原创分享").slice(0, 24), review.status, review.mode, Math.round(review.confidence * 100), review.typeReason, JSON.stringify(review.safetyLabels), review.model, review.reviewedAt, id, user.id).first<PromptRow>();
    await db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'prompt.edit','prompt',?)").bind(user.id, String(id)).run(); return Response.json({ ok: true, prompt: row ? toPrompt(row, user) : null });
  }
  if (!id && data.action !== "follow") return jsonError("缺少作品 ID");
  if (id && ["comment", "like", "save", "report", "view"].includes(String(data.action || ""))) {
    const target = await db.prepare("SELECT id FROM prompts WHERE id=? AND content_status='published' AND deleted_at IS NULL LIMIT 1").bind(id).first();
    if (!target) return jsonError("该作品不存在或已下架", 404);
  }
  if (data.action === "comment") {
    if (!await consumeRateLimit(db, `comment:${user.id}`, 30, 3600)) return jsonError("评论过于频繁，请稍后再试", 429);
    const body = String(data.body || "").trim().slice(0, 300); if (!body) return jsonError("评论不能为空");
    const review = await reviewPromptSubmission({ prompt: body }, { localPreview: isLocalPreview(request) }); if (review.status !== "approved") return jsonError("评论未通过安全检查", 422);
    await db.batch([db.prepare("INSERT INTO prompt_comments (prompt_id,author_key,author_name,author_initials,body) VALUES (?,?,?,?,?)").bind(id, user.id, user.nickname, initials(user.nickname), body), db.prepare("UPDATE prompts SET comments_count=comments_count+1 WHERE id=? AND content_status='published'").bind(id)]);
  } else if (data.action === "like" || data.action === "save") {
    if (!await consumeRateLimit(db, `reaction:${user.id}`, 300, 3600)) return jsonError("操作过于频繁，请稍后再试", 429);
    const type = data.action; const existing = await db.prepare("SELECT id FROM prompt_reactions WHERE prompt_id=? AND reaction_type=? AND actor_key=? LIMIT 1").bind(id, type, user.id).first<Record<string, any>>();
    if (existing) await db.batch([db.prepare("DELETE FROM prompt_reactions WHERE id=?").bind(existing.id), db.prepare(`UPDATE prompts SET ${type === "like" ? "likes" : "saves"}=MAX(0,${type === "like" ? "likes" : "saves"}-1) WHERE id=?`).bind(id)]); else await db.batch([db.prepare("INSERT INTO prompt_reactions (prompt_id,reaction_type,actor_key) VALUES (?,?,?)").bind(id, type, user.id), db.prepare(`UPDATE prompts SET ${type === "like" ? "likes" : "saves"}=${type === "like" ? "likes" : "saves"}+1 WHERE id=?`).bind(id)]);
  } else if (data.action === "follow" && (data.creatorName || data.creatorKey)) {
    const requestedName = String(data.creatorName || "").trim().slice(0, 80); const requestedKey = String(data.creatorKey || "").trim().slice(0, 80);
    const creator = requestedKey ? await db.prepare("SELECT owner_key,author_name FROM prompts WHERE owner_key=? AND content_status='published' ORDER BY id DESC LIMIT 1").bind(requestedKey).first<Record<string, any>>() : await db.prepare("SELECT owner_key,author_name FROM prompts WHERE author_name=? AND content_status='published' ORDER BY id DESC LIMIT 1").bind(requestedName).first<Record<string, any>>();
    if (!creator) return jsonError("创作者不存在或暂无公开作品", 404);
    if (creator.owner_key === user.id) return jsonError("不能关注自己", 409);
    const existing = await db.prepare("SELECT id FROM creator_follows WHERE actor_key=? AND (creator_key=? OR creator_name=?) LIMIT 1").bind(user.id, creator.owner_key || "", creator.author_name).first<Record<string, any>>();
    if (existing) await db.prepare("DELETE FROM creator_follows WHERE id=?").bind(existing.id).run(); else await db.prepare("INSERT INTO creator_follows (creator_name,creator_key,actor_key) VALUES (?,?,?)").bind(creator.author_name, creator.owner_key || null, user.id).run();
  } else if (data.action === "report" && data.reason) {
    if (!await consumeRateLimit(db, `report:${user.id}`, 20, 86400)) return jsonError("今日举报次数已达上限", 429);
    const duplicate = await db.prepare("SELECT id FROM prompt_reports WHERE prompt_id=? AND actor_key=? AND status='open' LIMIT 1").bind(id, user.id).first(); if (duplicate) return jsonError("你已举报过该作品，管理员正在处理", 409);
    await db.prepare("INSERT INTO prompt_reports (prompt_id,reason,detail,actor_key) VALUES (?,?,?,?)").bind(id, String(data.reason).slice(0, 80), String(data.detail || "").slice(0, 500) || null, user.id).run();
  } else if (data.action === "view") {
    const day = new Date().toISOString().slice(0, 10); const actor = user.id || await sha256(clientFingerprint(request));
    const result = await db.prepare("INSERT OR IGNORE INTO prompt_views (prompt_id,actor_key,day_key) VALUES (?,?,?)").bind(id, actor, day).run(); if (result.meta?.changes) await db.prepare("UPDATE prompts SET views=views+1 WHERE id=?").bind(id).run();
  } else return jsonError("不支持的操作");
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("服务暂不可用", 503);
  const id = Number(new URL(request.url).searchParams.get("id") || 0); if (!id) return jsonError("缺少作品 ID");
  const row = await db.prepare("SELECT id FROM prompts WHERE id=? AND owner_key=? AND deleted_at IS NULL LIMIT 1").bind(id, user.id).first(); if (!row) return jsonError("无权删除这条作品", 403);
  await db.batch([db.prepare("UPDATE prompts SET content_status='deleted',deleted_at=CURRENT_TIMESTAMP WHERE id=? AND owner_key=?").bind(id, user.id), db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'prompt.delete','prompt',?)").bind(user.id, String(id))]);
  return Response.json({ ok: true, recoverable: true });
}

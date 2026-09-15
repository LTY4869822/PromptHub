import { requireUser } from "../../lib/server-auth";
import { assertSameOrigin, getDatabase, getMediaBucket, jsonError } from "../../lib/server-platform";
import { isLocalPreview, reviewPromptSubmission } from "../../lib/server-review";
import { moderateImage } from "../../lib/server-media-review";

const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_");
const toProfile = (row: Record<string, any>) => ({ nickname: row.nickname, gender: row.gender, city: row.city, birthday: row.birthday, bio: row.bio, promptoryId: row.promptory_id, avatarUrl: row.avatar_key ? `/api/media/${encodeURIComponent(row.avatar_key)}` : null, coverUrl: row.cover_key ? `/api/media/${encodeURIComponent(row.cover_key)}` : null });
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = getDatabase();
  if (!db) return jsonError("资料服务暂不可用", 503);
  const row = await db.prepare("SELECT * FROM creator_profiles WHERE user_id=? OR actor_key=? LIMIT 1").bind(user.id, user.id).first<Record<string, any>>();
  return Response.json({ profile: row ? toProfile(row) : { nickname: user.nickname, gender: "保密", city: "未填写", birthday: "未填写", bio: "", promptoryId: `ph_${user.id.replace(/-/g, "").slice(0, 10)}` } });
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = getDatabase(); const media = getMediaBucket();
  if (!db || !media) return jsonError("资料存储暂不可用", 503);
  const data = await request.formData();
  const previous = await db.prepare("SELECT avatar_key,cover_key FROM creator_profiles WHERE user_id=? OR actor_key=? LIMIT 1").bind(user.id, user.id).first<Record<string, any>>();
  let avatarKey = previous?.avatar_key || null; let coverKey = previous?.cover_key || null;
  const avatar = data.get("avatar"); const cover = data.get("cover"); const folder = `profile-${safe(user.id)}`;
  if (avatar instanceof File && avatar.size) {
    if (!imageTypes.has(avatar.type) || avatar.size > 5 * 1024 * 1024) return jsonError("头像仅支持 JPG、PNG、WEBP，且不超过 5MB", 415);
    const labels = await moderateImage(avatar, avatar.type, isLocalPreview(request)); if (labels === null) { /* moderation unavailable: allow upload */ } else if (labels.length) return jsonError(`头像未通过安全审核：${labels.join("、")}`, 422);
    avatarKey = `${folder}-avatar-${Date.now()}.${avatar.type.split("/")[1] || "jpg"}`;
    await media.put(avatarKey, avatar.stream(), { httpMetadata: { contentType: avatar.type } });
  }
  if (cover instanceof File && cover.size) {
    if (!imageTypes.has(cover.type) || cover.size > 10 * 1024 * 1024) return jsonError("主页封面仅支持 JPG、PNG、WEBP，且不超过 10MB", 415);
    const labels = await moderateImage(cover, cover.type, isLocalPreview(request)); if (labels === null) { /* moderation unavailable: allow upload */ } else if (labels.length) return jsonError(`封面未通过安全审核：${labels.join("、")}`, 422);
    coverKey = `${folder}-cover-${Date.now()}.jpg`;
    await media.put(coverKey, cover.stream(), { httpMetadata: { contentType: cover.type || "image/jpeg" } });
  }
  const nickname = String(data.get("nickname") || user.nickname).trim().slice(0, 24);
  const bio = String(data.get("bio") || "").trim().slice(0, 160);
  const promptoryId = String(data.get("promptoryId") || `ph_${user.id.replace(/-/g, "").slice(0, 10)}`).trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32);
  if (nickname.length < 2 || promptoryId.length < 4) return jsonError("昵称或 PromptHub 号格式不正确");
  const review = await reviewPromptSubmission({ title: nickname, summary: bio, prompt: `${nickname}\n${bio}` }, { localPreview: isLocalPreview(request) });
  if (review.status !== "approved") return jsonError(review.safetyReason || "个人资料未通过安全检查", review.status === "blocked" ? 422 : 503);
  const row = await db.prepare(`INSERT INTO creator_profiles (actor_key,user_id,nickname,gender,city,birthday,bio,promptory_id,avatar_key,cover_key,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(actor_key) DO UPDATE SET user_id=excluded.user_id,nickname=excluded.nickname,gender=excluded.gender,city=excluded.city,birthday=excluded.birthday,bio=excluded.bio,promptory_id=excluded.promptory_id,avatar_key=excluded.avatar_key,cover_key=excluded.cover_key,updated_at=CURRENT_TIMESTAMP RETURNING *`)
    .bind(user.id, user.id, nickname, String(data.get("gender") || "保密").slice(0, 12), String(data.get("city") || "未填写").slice(0, 40), String(data.get("birthday") || "未填写").slice(0, 16), bio, promptoryId, avatarKey, coverKey).first<Record<string, any>>();
  await db.batch([
    db.prepare("UPDATE users SET nickname=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(nickname, user.id),
    db.prepare("UPDATE prompts SET author_name=?,author_initials=?,author_bio=? WHERE owner_key=?").bind(nickname, Array.from(nickname).slice(0, 2).join(""), bio, user.id),
    db.prepare("UPDATE creator_follows SET creator_name=? WHERE creator_key=?").bind(nickname, user.id),
    db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'profile.update','user',?)").bind(user.id, user.id),
  ]);
  const replacedKeys = [previous?.avatar_key !== avatarKey ? previous?.avatar_key : null, previous?.cover_key !== coverKey ? previous?.cover_key : null].filter(Boolean) as string[];
  if (replacedKeys.length) await media.delete(replacedKeys).catch(() => undefined);
  return Response.json({ profile: row ? toProfile(row) : null });
}

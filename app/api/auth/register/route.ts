import { assertSameOrigin, clientFingerprint, consumeRateLimit, jsonError } from "../../../lib/server-platform";
import { createSession, hashPassword, issueAuthToken, normalizeEmail } from "../../../lib/server-auth";
import { prepareData } from "../../../lib/server-schema";
import { reviewAccountNickname } from "../../../lib/server-review";
import { emailConfigured, sendEmail } from "../../../lib/email";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const db = await prepareData(request);
  if (!db) return jsonError("账号服务暂不可用", 503);
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const email = normalizeEmail(String(body?.email || ""));
  const nickname = String(body?.nickname || "").trim();
  const password = String(body?.password || "");
  if (!/^\S+@\S+\.\S+$/.test(email)) return jsonError("请输入有效的邮箱地址");
  if (nickname.length < 2 || nickname.length > 24) return jsonError("昵称需要 2–24 个字符");
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) return jsonError("密码至少 10 位，并同时包含字母和数字");
  const nicknameReview = reviewAccountNickname(nickname);
  if (nicknameReview.status !== "approved") return jsonError("昵称包含不适合公开展示的内容，请更换后重试", 422);
  const exists = await db.prepare("SELECT id FROM users WHERE email=? LIMIT 1").bind(email).first();
  if (exists) return jsonError("该邮箱已注册，请直接登录", 409);
  if (!await consumeRateLimit(db, `register:v2:${clientFingerprint(request)}`, 8, 3600)) return jsonError("注册尝试过于频繁，请稍后再试", 429);
  const id = crypto.randomUUID();
  const { hash, salt } = await hashPassword(password);
  await db.batch([
    db.prepare("INSERT INTO users (id,email,password_hash,password_salt,nickname) VALUES (?,?,?,?,?)").bind(id, email, hash, salt, nickname),
    db.prepare("INSERT INTO creator_profiles (actor_key,user_id,nickname,gender,city,birthday,bio,promptory_id) VALUES (?,?,?,'保密','未填写','未填写','',?)").bind(id, id, nickname, `ph_${id.replace(/-/g, "").slice(0, 10)}`),
    db.prepare("INSERT INTO audit_logs (actor_id,action,target_type,target_id) VALUES (?,'account.register','user',?)").bind(id, id),
  ]);
  let verificationSent = false;
  if (emailConfigured()) {
    const verifyToken = await issueAuthToken(db, id, "verify_email", 60);
    const origin = new URL(request.url).origin;
    const verifyLink = `${origin}/verify?token=${encodeURIComponent(verifyToken)}`;
    verificationSent = await sendEmail(email, "验证你的 PromptHub 邮箱", `<p>欢迎加入 PromptHub！点击下方链接完成邮箱验证：</p><p><a href="${verifyLink}">${verifyLink}</a></p><p>链接 60 分钟内有效。</p>`);
  }
  const cookie = await createSession(request, id, Boolean(body?.remember));
  return Response.json({ user: { id, email, nickname, role: "member", emailVerified: false }, verificationSent }, { status: 201, headers: { "Set-Cookie": cookie } });
}

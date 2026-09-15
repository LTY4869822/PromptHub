import { requireUser } from "../../lib/server-auth";
import { assertSameOrigin, clientFingerprint, consumeRateLimit, jsonError } from "../../lib/server-platform";
import { prepareData } from "../../lib/server-schema";
import { isLocalPreview, reviewPromptSubmission } from "../../lib/server-review";

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request);
  if (!db) return jsonError("审核服务暂不可用", 503);
  if (!await consumeRateLimit(db, `review:${user.id}:${clientFingerprint(request)}`, 30, 3600)) return jsonError("审核次数过多，请稍后再试", 429);
  try {
    const body = await request.json() as Record<string, string>;
    const result = await reviewPromptSubmission({ title: body.title, summary: body.summary, prompt: body.prompt, negativePrompt: body.negativePrompt, tags: body.tags, tool: body.tool, claimedType: body.promptType }, { localPreview: isLocalPreview(request) });
    if (result.status !== "approved") return Response.json({ review: result }, { status: result.status === "blocked" ? 422 : 503 });
    const token = crypto.randomUUID();
    await db.prepare("DELETE FROM review_receipts WHERE expires_at<CURRENT_TIMESTAMP").run();
    await db.prepare("INSERT INTO review_receipts (id,user_id,payload_hash,result,expires_at) VALUES (?,?,?,?,datetime('now','+15 minutes'))")
      .bind(token, user.id, await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ title: body.title || "", summary: body.summary || "", prompt: body.prompt || "", negativePrompt: body.negativePrompt || "", tags: body.tags || "", tool: body.tool || "", promptType: body.promptType || "" }))).then((buffer) => Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("")), JSON.stringify(result)).run();
    return Response.json({ review: result, receipt: token });
  } catch {
    return jsonError("审核请求格式不正确");
  }
}

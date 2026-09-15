import { getCurrentUser } from "../../../lib/server-auth";
import { prepareData } from "../../../lib/server-schema";
import { getMediaBucket } from "../../../lib/server-platform";

export async function GET(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params; const decoded = decodeURIComponent(key); const media = getMediaBucket(); const db = await prepareData(request);
  if (!media) return new Response("Media storage unavailable", { status: 503 });
  if (!db) return new Response("Media authorization unavailable", { status: 503 });
  const viewer = await getCurrentUser(request); if (!viewer) return new Response("Unauthorized", { status: 401 });
  const prompt = await db.prepare("SELECT owner_key,content_status FROM prompts WHERE (media_key=? OR poster_key=?) AND deleted_at IS NULL LIMIT 1").bind(decoded, decoded).first<Record<string, any>>();
  const profile = prompt ? null : await db.prepare("SELECT user_id FROM creator_profiles WHERE avatar_key=? OR cover_key=? LIMIT 1").bind(decoded, decoded).first<Record<string, any>>();
  if (prompt && prompt.content_status !== "published" && viewer.id !== prompt.owner_key && viewer.role !== "admin") return new Response("Not found", { status: 404 });
  if (!prompt && !profile) return new Response("Not found", { status: 404 });
  const restricted = Boolean(prompt && prompt.content_status !== "published");
  const object = await media.get(decoded); if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers(); object.writeHttpMetadata(headers); headers.set("etag", object.httpEtag); headers.set("accept-ranges", "bytes"); headers.set("cache-control", restricted ? "private, no-store" : "private, max-age=3600"); headers.set("vary", "Cookie"); headers.set("x-content-type-options", "nosniff");
  const range = request.headers.get("range");
  if (range && object.size) { const match = /^bytes=(\d*)-(\d*)$/.exec(range); if (match) { const suffix = !match[1] && Boolean(match[2]); const start = suffix ? Math.max(0, object.size - Number(match[2])) : Number(match[1] || 0); const end = suffix ? object.size - 1 : match[2] ? Math.min(object.size - 1, Number(match[2])) : object.size - 1; if (start <= end && start < object.size) { const ranged = await media.get(decoded, { range: { offset: start, length: end - start + 1 } }); if (ranged) { const partial = new Headers(headers); partial.set("content-range", `bytes ${start}-${end}/${object.size}`); partial.set("content-length", String(end - start + 1)); return new Response(ranged.body, { status: 206, headers: partial }); } } return new Response(null, { status: 416, headers: { "content-range": `bytes */${object.size}` } }); } }
  return new Response(object.body, { headers });
}

import { requireAdmin } from "../../../lib/server-auth";
import { getDatabase, getMediaBucket, jsonError } from "../../../lib/server-platform";

const TABLES = [
  "users",
  "sessions",
  "prompts",
  "prompt_comments",
  "prompt_reactions",
  "creator_follows",
  "prompt_reports",
  "creator_profiles",
  "upload_sessions",
  "prompt_views",
  "review_receipts",
  "rate_limits",
  "audit_logs",
] as const;

const PREFIX = "backups/";
const KEEP = 30;

function safeBackupKey(value: string) {
  const key = decodeURIComponent(value);
  if (!key.startsWith(PREFIX) || key.includes("..") || key.includes("/", PREFIX.length)) return null;
  return key;
}

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("需要管理员权限", 403);
  const media = getMediaBucket();
  if (!media) return jsonError("备份存储不可用", 503);
  const download = new URL(request.url).searchParams.get("download");
  if (download) {
    const key = safeBackupKey(download);
    if (!key) return jsonError("非法的备份标识", 400);
    const object = await media.get(key);
    if (!object) return jsonError("备份不存在", 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Content-Disposition", `attachment; filename="${key.slice(PREFIX.length)}"`);
    headers.set("Cache-Control", "private, no-store");
    return new Response(object.body, { headers });
  }
  const listing = await media.list({ prefix: PREFIX });
  const backups = (listing.objects || [])
    .map((object) => ({ key: object.key, size: object.size, uploadedAt: object.uploaded }))
    .sort((a, b) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
  return Response.json({ backups });
}

export async function POST(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("需要管理员权限", 403);
  const db = getDatabase();
  const media = getMediaBucket();
  if (!db || !media) return jsonError("备份服务不可用", 503);
  const snapshot: Record<string, unknown> = { exportedAt: new Date().toISOString(), tables: {} };
  const tables = snapshot.tables as Record<string, unknown[]>;
  for (const table of TABLES) {
    const result = await db.prepare(`SELECT * FROM ${table}`).all<Record<string, unknown>>();
    tables[table] = result.results || [];
  }
  const body = JSON.stringify(snapshot);
  const key = `${PREFIX}prompthub-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await media.put(key, body, { httpMetadata: { contentType: "application/json" } });
  const listing = await media.list({ prefix: PREFIX });
  const objects = [...(listing.objects || [])].sort((a, b) => String(a.uploaded || "").localeCompare(String(b.uploaded || "")));
  if (objects.length > KEEP) {
    const expired = objects.slice(0, objects.length - KEEP).map((object) => object.key);
    await media.delete(expired).catch(() => undefined);
  }
  return Response.json({ backup: { key, size: body.length, uploadedAt: new Date().toISOString() } });
}

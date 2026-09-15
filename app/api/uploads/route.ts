import { requireUser } from "../../lib/server-auth";
import { prepareData } from "../../lib/server-schema";
import { assertSameOrigin, getMediaBucket, jsonError } from "../../lib/server-platform";

const IMAGE_LIMIT = 20 * 1024 * 1024;
const VIDEO_LIMIT = 500 * 1024 * 1024;
const PART_LIMIT = 10 * 1024 * 1024;
const CHUNK_SIZE = 8 * 1024 * 1024;
const imageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const videoTypes = new Set(["video/mp4", "video/webm", "video/quicktime"]);
const safeName = (value: string) => value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "asset";
function sniff(bytes: Uint8Array, mime: string) {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value);
  if (mime === "image/jpeg") return starts(0xff, 0xd8, 0xff);
  if (mime === "image/png") return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  if (mime === "image/webp") return new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (mime === "video/mp4" || mime === "video/quicktime") return new TextDecoder().decode(bytes.slice(4, 8)) === "ftyp";
  if (mime === "video/webm") return starts(0x1a, 0x45, 0xdf, 0xa3);
  return false;
}

export async function GET(request: Request) {
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); if (!db) return jsonError("上传服务暂不可用", 503);
  const id = new URL(request.url).searchParams.get("id");
  const row = id ? await db.prepare("SELECT id,file_name,mime,size,status,parts,expires_at FROM upload_sessions WHERE id=? AND owner_key=? LIMIT 1").bind(id, user.id).first<Record<string, any>>() : null;
  return row ? Response.json({ upload: { id: row.id, file_name: row.file_name, mime: row.mime, size: row.size, status: row.status, parts: JSON.parse(row.parts || "[]"), expires_at: row.expires_at } }) : jsonError("上传任务不存在", 404);
}

export async function POST(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request);
  if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); const media = getMediaBucket();
  if (!db || !media) return jsonError("上传服务暂不可用", 503);
  const body = await request.json().catch(() => null) as Record<string, any> | null;
  if (body?.action === "complete") {
    const row = await db.prepare("SELECT * FROM upload_sessions WHERE id=? AND owner_key=? LIMIT 1").bind(String(body.id || ""), user.id).first<Record<string, any>>();
    if (!row || !row.multipart_id) return jsonError("上传任务不存在", 404);
    const parts = JSON.parse(row.parts || "[]") as Array<{ partNumber: number; etag: string }>;
    if (!parts.length) return jsonError("尚未收到文件分片");
    await media.resumeMultipartUpload(row.object_key, row.multipart_id).complete(parts.sort((a, b) => a.partNumber - b.partNumber));
    const object = await media.head(row.object_key);
    if (!object || Number(object.size || 0) !== Number(row.size)) {
      await media.delete(row.object_key).catch(() => undefined);
      await db.prepare("UPDATE upload_sessions SET status='invalid' WHERE id=?").bind(row.id).run();
      return jsonError("上传文件不完整，请重新上传", 422);
    }
    await db.prepare("UPDATE upload_sessions SET status='completed' WHERE id=?").bind(row.id).run();
    return Response.json({ upload: { id: row.id, objectKey: row.object_key, mime: row.mime, size: row.size, status: "completed" } });
  }
  const fileName = String(body?.fileName || ""); const mime = String(body?.mime || "").toLowerCase(); const size = Number(body?.size || 0); const kind = String(body?.kind || "media");
  const isImage = imageTypes.has(mime); const isVideo = videoTypes.has(mime);
  if (!fileName || !size || (!isImage && !isVideo)) return jsonError("仅支持 JPG、PNG、WEBP、MP4、WebM 或 MOV", 415);
  if (!Number.isSafeInteger(size) || size < 1) return jsonError("文件大小不正确");
  if (!new Set(["media", "poster"]).has(kind)) return jsonError("上传用途不正确");
  if (kind === "poster" && !isImage) return jsonError("视频封面必须是 JPG、PNG 或 WEBP 图片", 415);
  if ((isImage && size > IMAGE_LIMIT) || (isVideo && size > VIDEO_LIMIT)) return jsonError(isImage ? "图片不能超过 20MB" : "视频不能超过 500MB", 413);
  const active = await db.prepare("SELECT COUNT(*) total,COALESCE(SUM(size),0) bytes FROM upload_sessions WHERE owner_key=? AND created_at>datetime('now','-1 day')").bind(user.id).first<Record<string, any>>();
  if (Number(active?.total || 0) >= 40 || Number(active?.bytes || 0) + size > 2 * 1024 * 1024 * 1024) return jsonError("今日上传额度已用完，请明天再试", 429);
  await db.prepare("DELETE FROM upload_sessions WHERE expires_at<CURRENT_TIMESTAMP OR (status IN ('completed','aborted') AND created_at<datetime('now','-7 days'))").run();
  const id = crypto.randomUUID(); const objectKey = `users/${user.id}/${new Date().toISOString().slice(0, 10)}/${id}-${safeName(fileName)}`;
  const upload = await media.createMultipartUpload(objectKey, { httpMetadata: { contentType: mime } });
  await db.prepare("INSERT INTO upload_sessions (id,owner_key,object_key,multipart_id,kind,file_name,mime,size,status,expires_at) VALUES (?,?,?,?,?,?,?,?, 'created',datetime('now','+24 hours'))")
    .bind(id, user.id, objectKey, upload.uploadId, kind.slice(0, 24), fileName.slice(0, 180), mime, size).run();
  return Response.json({ upload: { id, chunkSize: CHUNK_SIZE, mime, size } }, { status: 201 });
}

export async function PUT(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); const media = getMediaBucket(); if (!db || !media) return jsonError("上传服务暂不可用", 503);
  const url = new URL(request.url); const id = url.searchParams.get("id"); const partNumber = Number(url.searchParams.get("part")); const length = Number(request.headers.get("content-length") || 0);
  if (!id || !Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10000 || !request.body) return jsonError("分片参数不正确");
  if (length > PART_LIMIT) return jsonError("单个上传分片不能超过 10MB", 413);
  const row = await db.prepare("SELECT * FROM upload_sessions WHERE id=? AND owner_key=? AND expires_at>CURRENT_TIMESTAMP LIMIT 1").bind(id, user.id).first<Record<string, any>>();
  if (!row || !row.multipart_id || row.status === "completed") return jsonError("上传任务已失效", 410);
  const payload = await request.arrayBuffer();
  if (!payload.byteLength || payload.byteLength > PART_LIMIT) return jsonError("上传分片大小不正确", payload.byteLength > PART_LIMIT ? 413 : 400);
  if (length && length !== payload.byteLength) return jsonError("上传分片长度不一致", 422);
  const expectedParts = Math.ceil(Number(row.size) / CHUNK_SIZE);
  if (partNumber > expectedParts) return jsonError("上传分片超出文件范围", 422);
  const expectedLength = partNumber === expectedParts ? Number(row.size) - CHUNK_SIZE * (expectedParts - 1) : CHUNK_SIZE;
  if (payload.byteLength !== expectedLength) return jsonError("上传分片不完整，请重试", 422);
  if (partNumber === 1 && !sniff(new Uint8Array(payload.slice(0, 16)), row.mime)) return jsonError("文件内容与扩展名或 MIME 类型不一致", 415);
  const part = await media.resumeMultipartUpload(row.object_key, row.multipart_id).uploadPart(partNumber, payload);
  const parts = (JSON.parse(row.parts || "[]") as Array<{ partNumber: number; etag: string }>).filter((item) => item.partNumber !== partNumber);
  parts.push({ partNumber, etag: part.etag });
  await db.prepare("UPDATE upload_sessions SET status='uploading',parts=? WHERE id=?").bind(JSON.stringify(parts), id).run();
  return Response.json({ part: { partNumber, etag: part.etag } });
}

export async function DELETE(request: Request) {
  if (!assertSameOrigin(request)) return jsonError("请求来源无效", 403);
  const user = await requireUser(request); if (!user) return jsonError("请先登录", 401);
  const db = await prepareData(request); const media = getMediaBucket(); if (!db || !media) return jsonError("上传服务暂不可用", 503);
  const id = new URL(request.url).searchParams.get("id");
  const row = id ? await db.prepare("SELECT * FROM upload_sessions WHERE id=? AND owner_key=? LIMIT 1").bind(id, user.id).first<Record<string, any>>() : null;
  if (!row) return jsonError("上传任务不存在", 404);
  if (row.multipart_id && row.status !== "completed") await media.resumeMultipartUpload(row.object_key, row.multipart_id).abort().catch(() => undefined);
  await db.prepare("UPDATE upload_sessions SET status='aborted' WHERE id=?").bind(row.id).run();
  return Response.json({ ok: true });
}

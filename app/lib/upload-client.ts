export type CompletedUpload = { id: string; objectKey: string; mime: string; size: number; status: "completed" };

async function responseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => ({})) as { error?: string };
  return new Error(data.error || fallback);
}

async function retry<T>(operation: () => Promise<T>, attempts = 3): Promise<T> {
  let error: unknown;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { return await operation(); }
    catch (next) { error = next; if (attempt < attempts - 1) await new Promise((resolve) => window.setTimeout(resolve, 400 * (attempt + 1))); }
  }
  throw error;
}

export async function uploadAsset(file: File, kind: "media" | "poster", onProgress?: (value: number) => void): Promise<CompletedUpload> {
  const create = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mime: file.type, size: file.size, kind }) });
  if (!create.ok) throw await responseError(create, "无法创建上传任务");
  const created = await create.json() as { upload: { id: string; chunkSize: number } };
  const { id, chunkSize } = created.upload;
  try {
    const totalParts = Math.ceil(file.size / chunkSize);
    for (let index = 0; index < totalParts; index += 1) {
      const partNumber = index + 1;
      const chunk = file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize));
      await retry(async () => {
        const response = await fetch(`/api/uploads?id=${encodeURIComponent(id)}&part=${partNumber}`, { method: "PUT", headers: { "Content-Type": "application/octet-stream" }, body: chunk });
        if (!response.ok) throw await responseError(response, `第 ${partNumber} 个分片上传失败`);
      });
      onProgress?.(Math.round(partNumber / totalParts * 92));
    }
    const complete = await fetch("/api/uploads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "complete", id }) });
    if (!complete.ok) throw await responseError(complete, "无法完成上传");
    onProgress?.(100);
    return (await complete.json() as { upload: CompletedUpload }).upload;
  } catch (error) {
    await fetch(`/api/uploads?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => undefined);
    throw error;
  }
}


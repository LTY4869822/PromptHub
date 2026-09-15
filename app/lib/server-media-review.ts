import { getSecret } from "./server-platform";

const categoryNames: Record<string, string> = { sexual: "色情或性内容", "sexual/minors": "未成年人性内容", violence: "暴力内容", "violence/graphic": "血腥或重度暴力", illicit: "违法犯罪指导", "illicit/violent": "暴力犯罪指导", hate: "仇恨内容", "hate/threatening": "威胁性仇恨内容", "harassment/threatening": "威胁或骚扰", "self-harm/instructions": "自伤指导", "self-harm/intent": "自伤意图" };
const blocking = new Set(Object.keys(categoryNames));

export async function moderateImage(object: any, mime: string, localPreview: boolean) {
  const apiKey = getSecret("OPENAI_API_KEY");
  if (!apiKey) return localPreview ? [] : null;
  if (!object || !mime.startsWith("image/")) return [];
  const bytes = new Uint8Array(await object.arrayBuffer());
  if (bytes.byteLength > 12 * 1024 * 1024) return ["图片审核文件过大"];
  let binary = ""; const size = 0x8000;
  for (let index = 0; index < bytes.length; index += size) binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + size, bytes.length)));
  const response = await fetch("https://api.openai.com/v1/moderations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "omni-moderation-latest", input: [{ type: "image_url", image_url: { url: `data:${mime};base64,${btoa(binary)}` } }] }) });
  if (!response.ok) return null;
  const data = await response.json() as any; const categories = data.results?.[0]?.categories || {};
  return Object.entries(categories).filter(([category, flagged]) => flagged && blocking.has(category)).map(([category]) => categoryNames[category] || category);
}


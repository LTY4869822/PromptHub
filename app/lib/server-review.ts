export type ReviewPromptType = "视频提示词" | "图片提示词" | "图生视频" | "通用提示词";
const runtimeEnv: any = await import("cloudflare:workers").then((module) => module.env).catch(() => ({}));
export type ReviewStatus = "approved" | "blocked" | "unavailable";
export type PromptReview = {
  status: ReviewStatus;
  detectedType: ReviewPromptType;
  confidence: number;
  typeReason: string;
  safetyLabels: string[];
  safetyReason: string;
  mode: "openai" | "rules-local" | "unavailable";
  model: string;
  reviewedAt: string;
  claimedType?: string;
  typeChanged: boolean;
};

type ReviewInput = { title?: string; summary?: string; prompt?: string; negativePrompt?: string; tags?: string; tool?: string; claimedType?: string };

const riskGroups = [
  { label: "色情或露骨性内容", terms: ["色情", "情色", "性交", "性行为", "强奸", "露点", "全裸", "成人视频", "卖淫", "嫖娼"] },
  { label: "未成年人性内容", terms: ["儿童色情", "幼女色情", "未成年性行为", "炼铜", "恋童"] },
  { label: "血腥或重度暴力", terms: ["肢解", "碎尸", "开膛", "内脏外露", "断头", "血肉横飞", "虐杀", "血腥特写"] },
  { label: "违法犯罪指导", terms: ["制作炸弹", "制毒教程", "盗刷银行卡", "入侵账户", "绕过安检", "购买枪支", "洗钱教程", "诈骗话术"] },
  { label: "仇恨或极端主义", terms: ["种族灭绝", "恐怖袭击教程", "招募恐怖分子", "仇恨犯罪"] },
  { label: "自伤指导", terms: ["自杀教程", "如何自杀", "割腕教程", "自残方法"] },
] as const;

const isNegated = (text: string, index: number) => /禁止|不要|避免|排除|不得|不出现|无|没有|拒绝|反对|not|no|without|avoid|exclude/i.test(text.slice(Math.max(0, index - 14), index));

function ruleSafety(input: ReviewInput) {
  const text = [input.title, input.summary, input.prompt, input.tags].filter(Boolean).join("\n").toLowerCase();
  const labels = new Set<string>();
  for (const group of riskGroups) for (const term of group.terms) {
    let index = text.indexOf(term.toLowerCase());
    while (index >= 0) {
      if (!isNegated(text, index)) labels.add(group.label);
      index = text.indexOf(term.toLowerCase(), index + term.length);
    }
  }
  return [...labels];
}

export function reviewAccountNickname(nickname: string) {
  const safetyLabels = ruleSafety({ title: nickname });
  return {
    status: safetyLabels.length ? "blocked" as const : "approved" as const,
    safetyLabels,
  };
}

function ruleType(input: ReviewInput): { type: ReviewPromptType; confidence: number; reason: string } {
  const text = [input.title, input.summary, input.prompt, input.negativePrompt, input.tags, input.tool].filter(Boolean).join(" ").toLowerCase();
  const imageToVideo = ["图生视频", "image to video", "image-to-video", "i2v", "首帧", "尾帧", "参考图保持", "让这张图", "基于输入图片"];
  const video = ["视频", "镜头", "运镜", "分镜", "秒", "fps", "转场", "推镜", "拉镜", "摇镜", "跟拍", "一镜到底", "camera movement", "shot", "motion", "pan ", "dolly", "zoom", "duration"];
  const image = ["图片", "生图", "摄影", "照片", "海报", "插画", "静物", "肖像", "构图", "光圈", "快门", "photo", "photograph", "illustration", "poster", "still image", "--ar"];
  const count = (terms: string[]) => terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
  const i2v = count(imageToVideo); const videoScore = count(video); const imageScore = count(image);
  if (i2v > 0) return { type: "图生视频", confidence: Math.min(.97, .78 + i2v * .06), reason: "检测到首帧、参考图或图生视频工作流描述" };
  if (videoScore >= imageScore + 1 && videoScore >= 2) return { type: "视频提示词", confidence: Math.min(.95, .68 + videoScore * .045), reason: "检测到镜头运动、时长、帧率或分镜等视频生成指令" };
  if (imageScore >= videoScore + 1 && imageScore >= 2) return { type: "图片提示词", confidence: Math.min(.95, .68 + imageScore * .045), reason: "检测到摄影、构图、插画或静态画面等图片生成指令" };
  return { type: "通用提示词", confidence: .62, reason: "未发现足够明确的图片或视频专用指令，归为通用提示词" };
}

function secret(name: string) {
  try {
    const processValue = typeof process !== "undefined" ? process.env?.[name] : undefined;
    return runtimeEnv?.[name] || processValue || "";
  } catch { return ""; }
}

function outputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  for (const item of data?.output || []) for (const content of item?.content || []) if (typeof content?.text === "string") return content.text;
  return "";
}

async function openAiModeration(apiKey: string, text: string) {
  const response = await fetch("https://api.openai.com/v1/moderations", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model: "omni-moderation-latest", input: text }) });
  if (!response.ok) throw new Error(`moderation_${response.status}`);
  const data = await response.json() as any; const result = data.results?.[0] || {};
  const categoryNames: Record<string, string> = { sexual: "色情或性内容", "sexual/minors": "未成年人性内容", violence: "暴力内容", "violence/graphic": "血腥或重度暴力", illicit: "违法犯罪指导", "illicit/violent": "暴力犯罪指导", hate: "仇恨内容", "hate/threatening": "威胁性仇恨内容", "harassment/threatening": "威胁或骚扰", "self-harm/instructions": "自伤指导", "self-harm/intent": "自伤意图" };
  const blockingCategories = new Set(["sexual", "sexual/minors", "violence", "violence/graphic", "illicit", "illicit/violent", "hate/threatening", "harassment/threatening", "self-harm/instructions", "self-harm/intent"]);
  return Object.entries(result.categories || {}).filter(([category, flagged]) => flagged && blockingCategories.has(category)).map(([category]) => categoryNames[category] || category);
}

async function openAiType(apiKey: string, input: ReviewInput) {
  const model = secret("OPENAI_REVIEW_MODEL") || "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({
    model,
    instructions: "你是提示词分享网站的审核分类器。根据提示词实际用途独立判断类型，不要盲从作者自选类型。图生视频必须明确依赖输入图片、首帧或参考图；视频提示词应包含时序、动作、镜头、时长等线索；图片提示词面向静态图；都不明确时选通用提示词。只输出符合架构的结果。",
    input: JSON.stringify({ 作者自选类型: input.claimedType || "未选择", 标题: input.title || "", 摘要: input.summary || "", 提示词: input.prompt || "", 负向提示词: input.negativePrompt || "", 标签: input.tags || "", 工具: input.tool || "" }),
    text: { format: { type: "json_schema", name: "prompt_type_review", strict: true, schema: { type: "object", additionalProperties: false, properties: { promptType: { type: "string", enum: ["视频提示词", "图片提示词", "图生视频", "通用提示词"] }, confidence: { type: "number", minimum: 0, maximum: 1 }, reason: { type: "string" } }, required: ["promptType", "confidence", "reason"] } } }
  }) });
  if (!response.ok) throw new Error(`classification_${response.status}`);
  const data = await response.json() as any; const parsed = JSON.parse(outputText(data));
  return { type: parsed.promptType as ReviewPromptType, confidence: Number(parsed.confidence), reason: String(parsed.reason), model };
}

async function deepSeekReview(apiKey: string, input: ReviewInput) {
  const model = secret("DEEPSEEK_REVIEW_MODEL") || "deepseek-chat";
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "你是 PromptHub 的内容安全审核与提示词分类器。输出严格 JSON。分类只能是：视频提示词、图片提示词、图生视频、通用提示词。阻止违法犯罪指导、色情或未成年人性内容、仇恨威胁、自残指导、血腥重度暴力；普通艺术、教育、新闻语境不要误判。JSON 格式：{\"promptType\":\"通用提示词\",\"confidence\":0.9,\"blocked\":false,\"safetyLabels\":[],\"reason\":\"简短理由\"}" },
        { role: "user", content: JSON.stringify(input) },
      ],
    }),
  });
  if (!response.ok) throw new Error(`deepseek_${response.status}`);
  const data = await response.json() as any;
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("deepseek_empty");
  const parsed = JSON.parse(content);
  const allowedTypes = new Set(["视频提示词", "图片提示词", "图生视频", "通用提示词"]);
  if (!allowedTypes.has(parsed.promptType) || typeof parsed.blocked !== "boolean") throw new Error("deepseek_schema");
  return { type: parsed.promptType as ReviewPromptType, confidence: Number(parsed.confidence) || .7, blocked: parsed.blocked, labels: Array.isArray(parsed.safetyLabels) ? parsed.safetyLabels.map(String).slice(0, 8) : [], reason: String(parsed.reason || "DeepSeek 审核完成"), model };
}

export async function reviewPromptSubmission(input: ReviewInput, options: { localPreview?: boolean; apiKey?: string } = {}): Promise<PromptReview> {
  const reviewedAt = new Date().toISOString(); const localLabels = ruleSafety(input); const fallbackType = ruleType(input);
  const deepSeekKey = secret("DEEPSEEK_API_KEY");
  if (deepSeekKey) {
    try {
      const result = await deepSeekReview(deepSeekKey, input);
      const labels = [...new Set([...localLabels, ...result.labels])];
      const blocked = result.blocked || labels.length > 0;
      return { status: blocked ? "blocked" : "approved", detectedType: result.type, confidence: Math.max(0, Math.min(1, result.confidence)), typeReason: result.reason, safetyLabels: labels, safetyReason: blocked ? `安全审核未通过：${labels.join("、") || result.reason}` : "DeepSeek AI 与内置安全规则审核通过", mode: "openai", model: result.model, reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== result.type) };
    } catch {
      return { status: "unavailable", detectedType: fallbackType.type, confidence: fallbackType.confidence, typeReason: fallbackType.reason, safetyLabels: localLabels, safetyReason: "DeepSeek 审核服务暂时不可用，请稍后重试", mode: "unavailable", model: "deepseek-unavailable", reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== fallbackType.type) };
    }
  }
  const apiKey = options.apiKey || secret("OPENAI_API_KEY");
  if (!apiKey) {
    if (!options.localPreview) return { status: "unavailable", detectedType: fallbackType.type, confidence: fallbackType.confidence, typeReason: fallbackType.reason, safetyLabels: localLabels, safetyReason: "AI 审核服务尚未配置，为避免绕过审核，当前禁止发布", mode: "unavailable", model: "none", reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== fallbackType.type) };
    return { status: localLabels.length ? "blocked" : "approved", detectedType: fallbackType.type, confidence: fallbackType.confidence, typeReason: fallbackType.reason, safetyLabels: localLabels, safetyReason: localLabels.length ? `命中风险类别：${localLabels.join("、")}` : "本地规则检查未发现违法、色情、血腥等高风险内容", mode: "rules-local", model: "local-rules-v1", reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== fallbackType.type) };
  }
  try {
    const moderationText = `标题：${input.title || ""}\n摘要：${input.summary || ""}\n提示词：${input.prompt || ""}\n标签：${input.tags || ""}`;
    const [moderationLabels, classification] = await Promise.all([openAiModeration(apiKey, moderationText), openAiType(apiKey, input)]);
    const labels = [...new Set([...localLabels, ...moderationLabels])];
    return { status: labels.length ? "blocked" : "approved", detectedType: classification.type, confidence: Math.max(0, Math.min(1, classification.confidence)), typeReason: classification.reason, safetyLabels: labels, safetyReason: labels.length ? `AI 安全审核识别到：${labels.join("、")}` : "AI 安全审核通过，未发现违法、色情、血腥或其他高风险内容", mode: "openai", model: `${classification.model} + omni-moderation-latest`, reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== classification.type) };
  } catch {
    return { status: "unavailable", detectedType: fallbackType.type, confidence: fallbackType.confidence, typeReason: fallbackType.reason, safetyLabels: localLabels, safetyReason: "AI 审核服务暂时不可用，为避免漏审，本次发布已暂停", mode: "unavailable", model: "unavailable", reviewedAt, claimedType: input.claimedType, typeChanged: Boolean(input.claimedType && input.claimedType !== fallbackType.type) };
  }
}

export function isLocalPreview(request: Request) {
  const host = new URL(request.url).hostname;
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

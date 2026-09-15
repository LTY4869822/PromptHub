export type PromptType = "视频提示词" | "图片提示词" | "图生视频" | "通用提示词" | "待确认类型";
export type MediaRole = "生成效果" | "效果截图" | "原作品截图" | "参考素材";

export type PromptItem = {
  id: number | string;
  title: string;
  prompt: string;
  summary?: string;
  negativePrompt?: string | null;
  aspectRatio?: string;
  modelVersion?: string;
  parameters?: string;
  useCases?: string[];
  source: string;
  sourceUrl?: string | null;
  originalWorkUrl?: string | null;
  tool: string;
  promptType?: PromptType;
  mediaRole?: MediaRole;
  /** The detected format of the uploaded display asset, independent of promptType. */
  mediaType: "image" | "video";
  mediaUrl?: string | null;
  posterUrl?: string | null;
  mediaName?: string | null;
  mediaSize?: number;
  tags: string[];
  authorName: string;
  authorId?: string;
  authorInitials: string;
  authorBio?: string;
  likes: number;
  views: number;
  saves?: number;
  commentsCount?: number;
  createdAt: string;
  tone: string;
  duration?: string;
  rightsType?: string;
  reviewStatus?: "approved" | "blocked" | "unavailable" | "legacy";
  reviewMode?: "openai" | "rules-local" | "unavailable" | "legacy";
  reviewConfidence?: number;
  reviewReason?: string;
  safetyLabels?: string[];
  reviewedAt?: string | null;
  hotScore?: number;
  hotEligible?: boolean;
  contentStatus?: "published" | "hidden" | "deleted" | "pending";
  owned?: boolean;
  liked?: boolean;
  saved?: boolean;
};

export const seedPrompts: PromptItem[] = [
  { id: "seed-1", title: "把普通街景拍成胶片感的电影开场", summary: "雨后城市街景，一镜推入，克制但有故事感。", prompt: "一段电影感的城市街景，雨后路面反射暖黄色霓虹，35mm 胶片颗粒，镜头从橱窗内缓慢推向街道，路人自然经过，克制的蓝绿色阴影与琥珀色高光，真实光影，4K，情绪安静但有故事感。", negativePrompt: "过度锐化，塑料质感，人物变形，字幕，水印，品牌 Logo", aspectRatio: "16:9", modelVersion: "Veo 3 / Quality", parameters: "8 秒 · 24fps · 电影镜头", useCases: ["城市影像", "短片开场"], source: "小红书 · 影像研究所", tool: "Veo 3", mediaType: "video", tags: ["电影感", "街景", "胶片"], authorName: "Mori Studio", authorInitials: "MS", authorBio: "用提示词记录真实质感。", likes: 328, saves: 184, commentsCount: 12, views: 1840, createdAt: "今天 12:41", tone: "tone-night", duration: "00:08", rightsType: "原创分享" },
  { id: "seed-2", title: "一镜到底：城市夜行的霓虹呼吸", summary: "雨夜霓虹市场的一镜到底，氛围感优先。", prompt: "Cinematic one-take walk through a rainy neon market at midnight, subtle handheld camera, reflections on wet asphalt, cyan and coral palette, natural crowd motion, atmospheric haze, no text, no logos, premium short film stillness.", negativePrompt: "静止人群，跳切，文字，Logo，过饱和，卡通感", aspectRatio: "9:16", modelVersion: "即梦 AI · 高清", parameters: "12 秒 · 手持感 · 慢推", useCases: ["短视频", "氛围片段"], source: "即梦 AI · @一颗胶片", tool: "即梦 AI", mediaType: "video", tags: ["一镜到底", "夜景", "氛围"], authorName: "一颗胶片", authorInitials: "一", authorBio: "把城市的呼吸留在镜头里。", likes: 246, saves: 126, commentsCount: 8, views: 1260, createdAt: "今天 10:26", tone: "tone-coral", duration: "00:12", rightsType: "整理分享" },
  { id: "seed-3", title: "让产品像博物馆藏品一样被看见", summary: "极简产品静物摄影，适合商业广告与电商主视觉。", prompt: "极简产品静物摄影，乳白色石材底座，一束下午斜射的自然光，细腻阴影与柔和尘埃，镜头轻微环绕，留白充足，像设计博物馆的展柜摄影，材质真实，克制高级，商业广告质感。", negativePrompt: "杂乱背景，低清晰度，过曝，变形，额外物体，文字", aspectRatio: "4:5", modelVersion: "Midjourney v7", parameters: "--stylize 180 · raw", useCases: ["产品视觉", "商业广告"], source: "公众号 · 视觉实验室", tool: "Midjourney", mediaType: "image", tags: ["产品", "商业", "极简"], authorName: "Yuki Lin", authorInitials: "YL", authorBio: "研究材质、光线与留白。", likes: 189, saves: 92, commentsCount: 5, views: 903, createdAt: "昨天 18:02", tone: "tone-sand", rightsType: "已获授权" },
  { id: "seed-4", title: "纸张、风与光：手作质感实验", summary: "保留纸张纤维和手作瑕疵的二维定格动画。", prompt: "俯拍的手工纸拼贴动画，米白纸张、砖红色剪纸和墨绿色线条在桌面上轻轻移动，纸张边缘带有真实纤维，风吹动一角，顶光温暖，节奏舒缓，保留手作瑕疵与微小阴影。", negativePrompt: "3D 塑料感，过度平滑，复杂背景，快速闪烁", aspectRatio: "16:9", modelVersion: "可灵 2.1", parameters: "6 秒 · 定格动画 · 轻微俯拍", useCases: ["品牌片", "知识动画"], source: "B站 · 纸片公园", tool: "可灵 AI", mediaType: "video", tags: ["纸艺", "手作", "定格动画"], authorName: "纸片公园", authorInitials: "纸", authorBio: "纸张是我的第一种动画语言。", likes: 412, saves: 231, commentsCount: 21, views: 2214, createdAt: "昨天 15:31", tone: "tone-paper", duration: "00:06", rightsType: "原创分享" },
  { id: "seed-5", title: "人物情绪从平静到失控的 8 秒分镜", summary: "用光线、停顿和镜头推进表达压抑情绪。", prompt: "固定中近景，人物坐在清晨的厨房餐桌前，先是安静地搅拌咖啡，窗外光线逐渐变冷，手指停下，呼吸变重，镜头缓慢推进眼睛，情绪不过度夸张表达，真实、压抑、留白。", negativePrompt: "夸张表情，快速摇镜，恐怖血腥，台词字幕", aspectRatio: "16:9", modelVersion: "Runway Gen-4", parameters: "8 秒 · 中近景 · 慢推", useCases: ["叙事短片", "人物练习"], source: "抖音 · 导演的练习册", tool: "Runway", mediaType: "video", tags: ["叙事", "人物", "情绪"], authorName: "Nana Film", authorInitials: "NF", authorBio: "每天练习一个情绪转折。", likes: 156, saves: 64, commentsCount: 3, views: 744, createdAt: "08 月 12 日", tone: "tone-blue", duration: "00:08", rightsType: "整理分享" },
  { id: "seed-6", title: "把一段知识做成可循环的动态图解", summary: "用一颗种子长成树，解释复利和长期积累。", prompt: "Editorial motion graphic explaining compound interest: a single small seed becomes a branching tree through repeating cycles, flat geometric shapes, dark navy background, warm lime highlights, clean Chinese labels, precise easing, seamless loop, no visual clutter.", negativePrompt: "视觉噪点，复杂纹理，随机文字，跳帧", aspectRatio: "1:1", modelVersion: "Sora", parameters: "无缝循环 · 扁平图形 · 精确缓动", useCases: ["知识内容", "动态图解"], source: "YouTube · Motion Notes", tool: "ChatGPT + Sora", mediaType: "image", tags: ["动态图解", "知识", "循环"], authorName: "Motion Notes", authorInitials: "MN", authorBio: "让抽象概念变得可视化。", likes: 98, saves: 41, commentsCount: 4, views: 531, createdAt: "08 月 11 日", tone: "tone-lime", rightsType: "原创分享" },
];

seedPrompts.forEach((item) => {
  item.promptType ||= item.mediaType === "video" ? "视频提示词" : "图片提示词";
  item.mediaRole ||= "生成效果";
  item.reviewStatus ||= "approved";
  item.reviewMode ||= "rules-local";
  item.reviewConfidence ||= .9;
  item.reviewReason ||= "站内示例内容已通过规则审核";
  item.safetyLabels ||= [];
});

export const showDemoContent = () => typeof window !== "undefined" && window.location.hostname === "localhost";

export const toolOptions = ["Veo 3", "即梦 AI", "Midjourney", "可灵 AI", "Runway", "Sora", "ChatGPT + Sora", "其他"];
export const promptTypeOptions: PromptType[] = ["视频提示词", "图片提示词", "图生视频", "通用提示词"];
export const mediaRoleOptions: MediaRole[] = ["生成效果", "效果截图", "原作品截图", "参考素材"];
export const promptTypeOf = (item: PromptItem): PromptType => item.promptType || "待确认类型";
export const mediaRoleOf = (item: PromptItem): MediaRole => item.mediaRole || "生成效果";
export const displayAssetLabel = (item: PromptItem) => `${mediaRoleOf(item)} · ${item.mediaType === "video" ? "视频" : "图片"}`;
export const ageInDays = (item: PromptItem, now = Date.now()) => {
  const parsed = Date.parse(item.createdAt);
  if (!Number.isFinite(parsed)) return item.createdAt.includes("刚刚") || item.createdAt.includes("今天") ? 0 : item.createdAt.includes("昨天") ? 1 : 7;
  return Math.max(0, (now - parsed) / 86400000);
};
export const hotScoreOf = (item: PromptItem, now = Date.now()) => {
  const raw = (item.saves || 0) * 6 + item.likes * 3 + (item.commentsCount || 0) * 4 + item.views * .12;
  return raw / Math.pow(ageInDays(item, now) + 2, 1.35);
};
export const hotEligibilityOf = (item: PromptItem) => {
  const reviewed = item.reviewStatus === "approved";
  const engagement = (item.saves || 0) >= 8 || item.likes >= 20 || item.views >= 200;
  return reviewed && engagement && ageInDays(item) <= 30;
};
export const ratioOptions = ["全部画幅", "16:9", "9:16", "4:5", "1:1", "3:4"];
export const rightsOptions = ["原创分享", "已获授权", "整理分享", "AI 生成"];
export const formatCount = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toString();

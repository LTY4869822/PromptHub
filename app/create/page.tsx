"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark, BrandName, MediaArt } from "../components/PromptoryShell";
import ThemeButton from "../components/ThemeButton";
import { mediaRoleOptions, promptTypeOptions, ratioOptions, rightsOptions, toolOptions, type MediaRole, type PromptItem, type PromptType } from "../lib/prompt-data";
import { uploadAsset } from "../lib/upload-client";

type ReviewResult = { status: "approved" | "blocked" | "unavailable"; detectedType: PromptType; confidence: number; typeReason: string; safetyReason: string; typeChanged: boolean; mode: string; reviewedAt: string; safetyLabels: string[] };

const DRAFT_KEY = "promptory-publish-draft";
const IMAGE_LIMIT = 20 * 1024 * 1024;
const VIDEO_LIMIT = 500 * 1024 * 1024;
const initialForm = { title: "", summary: "", prompt: "", negativePrompt: "", source: "", sourceUrl: "", originalWorkUrl: "", tool: "", customTool: "", promptType: "", mediaRole: "生成效果", modelVersion: "", aspectRatio: "16:9", parameters: "", useCases: "", tags: "", rightsType: "原创分享", authorBio: "", mediaType: "video" };
const splitList = (value: string) => value.split(/[，,\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 4);
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
const durationText = (seconds: number) => { const total = Math.round(seconds); return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`; };

function compressImage(file: File) {
  return new Promise<File>((resolve) => {
    const src = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const maxEdge = 2400;
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      if (scale === 1 && file.size < 1.5 * 1024 * 1024) { URL.revokeObjectURL(src); resolve(file); return; }
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(src);
        if (!blob || blob.size >= file.size) { resolve(file); return; }
        resolve(new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" }));
      }, "image/webp", .86);
    };
    image.onerror = () => { URL.revokeObjectURL(src); resolve(file); };
    image.src = src;
  });
}

function makeVideoPoster(file: File) {
  return new Promise<{ file: File | null; preview: string; duration: string }>((resolve) => {
    const src = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true; video.preload = "metadata"; video.playsInline = true;
    const finish = (poster: File | null, preview = "") => { URL.revokeObjectURL(src); resolve({ file: poster, preview, duration: Number.isFinite(video.duration) ? durationText(video.duration) : "" }); };
    video.onloadedmetadata = () => { video.currentTime = Math.min(.2, Math.max(0, video.duration / 10)); };
    video.onseeked = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale)); canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => blob ? finish(new File([blob], "video-cover.jpg", { type: "image/jpeg" }), URL.createObjectURL(blob)) : finish(null), "image/jpeg", .86);
    };
    video.onerror = () => { URL.revokeObjectURL(src); resolve({ file: null, preview: "", duration: "INVALID" }); };
    video.src = src;
  });
}

export default function CreatePromptPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const posterInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState("");
  const [duration, setDuration] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(initialForm);
  const [ready, setReady] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [published, setPublished] = useState<PromptItem | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [step, setStep] = useState(1);
  const resolvedTool = form.tool === "其他" ? form.customTool.trim() : form.tool.trim();

  useEffect(() => {
    try {
      const draft = window.localStorage.getItem(DRAFT_KEY);
      if (draft) { setForm({ ...initialForm, ...JSON.parse(draft) }); setNotice("已恢复上次保存的文字草稿"); }
    } catch { /* ignore an invalid draft */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || published) return;
    const timer = window.setTimeout(() => { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); }, 700);
    return () => window.clearTimeout(timer);
  }, [form, ready, published]);
  const update = (key: keyof typeof initialForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const saveDraft = () => { window.localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); setNotice("文字草稿已保存，媒体文件需发布前重新选择"); };
  const validate = (nextFile: File) => {
    const image = nextFile.type.startsWith("image/"); const video = nextFile.type.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(nextFile.name);
    if (!image && !video) return "仅支持 JPG、PNG、WEBP、MP4、WebM 或 MOV";
    if (image && nextFile.size > IMAGE_LIMIT) return "图片不能超过 20 MB";
    if (video && nextFile.size > VIDEO_LIMIT) return "视频不能超过 200 MB";
    return "";
  };
  const handleFile = async (nextFile?: File) => {
    if (!nextFile) return;
    const error = validate(nextFile); if (error) { setNotice(error); return; }
    const image = nextFile.type.startsWith("image/"); setNotice(image ? "正在优化图片…" : "正在读取视频信息…");
    const prepared = image ? await compressImage(nextFile) : nextFile;
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(prepared); setPreview(URL.createObjectURL(prepared));
    setForm((current) => ({ ...current, mediaType: image ? "image" : "video", mediaRole: image && (current.promptType === "视频提示词" || current.promptType === "图生视频") && current.mediaRole === "生成效果" ? "效果截图" : current.mediaRole }));
    setPosterFile(null); if (posterPreview.startsWith("blob:")) URL.revokeObjectURL(posterPreview); setPosterPreview(""); setDuration("");
    if (!image) { const poster = await makeVideoPoster(prepared); if (poster.duration === "INVALID") { setFile(null); setPreview(""); setNotice("当前浏览器无法解码该视频，请转为 H.264 编码的 MP4 或 WebM 后上传"); return; } setPosterFile(poster.file); setPosterPreview(poster.preview); setDuration(poster.duration); }
    setNotice(image && prepared.size < nextFile.size ? `图片已优化：${fileSize(nextFile.size)} → ${fileSize(prepared.size)}` : `已选择 ${nextFile.name} · ${fileSize(prepared.size)}`);
  };
  const handlePoster = (nextFile?: File) => {
    if (!nextFile || !nextFile.type.startsWith("image/")) { setNotice("视频封面需要使用图片文件"); return; }
    if (posterPreview.startsWith("blob:")) URL.revokeObjectURL(posterPreview);
    setPosterFile(nextFile); setPosterPreview(URL.createObjectURL(nextFile)); setNotice("已使用自定义视频封面");
  };

  const canEnterStep = (target: number) => {
    if (target <= 1) { setStep(1); return; }
    if (!form.title.trim() || !form.summary.trim() || !form.prompt.trim() || !form.promptType) {
      setStep(1); setNotice("请先完成标题、摘要、提示词文本和提示词类型"); return;
    }
    if (target <= 2) { setNotice(""); setStep(2); return; }
    if (!resolvedTool || !form.source.trim()) {
      setStep(2); setNotice(!form.tool ? "请选择生成工具" : form.tool === "其他" && !form.customTool.trim() ? "选择“其他”后，请填写实际使用的 AI 工具名称" : "请填写提示词来源平台或博主"); return;
    }
    setNotice(""); setStep(3);
  };

  const runReview = async () => {
    setReviewing(true); setReview(null); setNotice("AI 正在检查提示词类型与内容安全…");
    try {
      const response = await fetch("/api/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tool: resolvedTool }) });
      const data = await response.json() as { review?: ReviewResult; receipt?: string; error?: string };
      if (!data.review) throw new Error(data.error || "审核服务无响应");
      setReview(data.review);
      if (data.review.status !== "approved") { setNotice(data.review.safetyReason); return null; }
      setNotice(`${data.review.typeChanged ? `AI 已将类型更正为“${data.review.detectedType}”` : `AI 确认类型为“${data.review.detectedType}”`}；内容安全检查通过`);
      return { review: data.review, receipt: data.receipt || "" };
    } catch (error) { setNotice(error instanceof Error ? error.message : "AI 审核失败，请稍后重试"); return null; }
    finally { setReviewing(false); }
  };
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.summary.trim() || !form.prompt.trim() || !form.source.trim() || !form.promptType || !resolvedTool || !file) { setNotice(!file ? "请先上传图片或视频" : !form.promptType ? "请选择提示词类型；附件格式不会替你判断用途" : !form.tool ? "请选择生成工具" : form.tool === "其他" && !form.customTool.trim() ? "选择“其他”后，请填写实际使用的 AI 工具名称" : "标题、摘要、提示词和来源均为必填"); return; }
    const approved = await runReview(); if (!approved) return;
    setPublishing(true); setProgress(2); setNotice("AI 审核通过，正在上传展示素材…");
    try {
      const mediaUpload = await uploadAsset(file, "media", (value) => setProgress(Math.round(value * (posterFile ? .82 : .94))));
      const posterUpload = posterFile ? await uploadAsset(posterFile, "poster", (value) => setProgress(82 + Math.round(value * .12))) : null;
      const response = await fetch("/api/prompts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, tool: resolvedTool, duration, mediaUploadId: mediaUpload.id, posterUploadId: posterUpload?.id || null, reviewReceipt: approved.receipt }) });
      const data = await response.json().catch(() => ({})) as { prompt?: PromptItem; error?: string };
      if (!response.ok || !data.prompt) throw new Error(data.error || "发布失败");
      setPublished(data.prompt); setProgress(100); setNotice(data.prompt.contentStatus === "pending" ? "提交成功，视频正在等待管理员复核；通过后会进入灵感广场" : "发布成功，作品已经进入灵感广场"); window.localStorage.removeItem(DRAFT_KEY);
    }
    catch (error) {
      const message = error instanceof Error ? error.message : "发布失败";
      setProgress(0); setNotice(message);
    }
    finally { setPublishing(false); }
  };

  const previewItem: PromptItem = { id: "preview", title: form.title || "你的提示词标题", summary: form.summary, prompt: form.prompt, source: form.source || "来源平台 · 博主", sourceUrl: form.sourceUrl || null, originalWorkUrl: form.originalWorkUrl || null, tool: resolvedTool || "待选择生成工具", promptType: form.promptType as PromptType, mediaRole: form.mediaRole as MediaRole, mediaType: form.mediaType as "image" | "video", mediaUrl: preview || null, posterUrl: posterPreview || null, aspectRatio: form.aspectRatio, rightsType: form.rightsType, tags: splitList(form.tags), authorName: "你", authorInitials: "你", likes: 0, saves: 0, views: 0, createdAt: "现在", tone: form.mediaType === "video" ? "tone-night" : "tone-sand", duration };
  const uploadedPreview = preview ? (form.mediaType === "video" ? <video src={preview} poster={posterPreview || undefined} controls playsInline preload="metadata" aria-label="视频上传预览" /> : <img src={preview} alt="图片上传预览" />) : null;

  return <div className="fullscreen-page create-page">
    <header className="fullscreen-topbar"><a className="back-link" href="/">← 返回灵感广场</a><div className="fullscreen-brand"><BrandMark /><BrandName /></div><div className="fullscreen-actions"><ThemeButton /><span className="topbar-status">CREATE / NEW</span></div></header>
    <main className="create-layout">
      <section className="create-intro"><p className="eyebrow">SHARE YOUR PROCESS</p><h1>发布一条<br /><em>值得复用的灵感</em><span className="heading-dot">.</span></h1><p>先展示结果，再完整交代工具、参数、来源和授权状态。让别人看见效果，也看见方法。</p><div className="create-tips"><span>01</span><div><strong>封面优先</strong><small>广场只展示效果封面，点击后才会看到提示词。</small></div></div><div className="create-tips"><span>02</span><div><strong>来源透明</strong><small>明确原作者和授权状态，尊重每一份灵感。</small></div></div></section>
      <form className="creator-form" onSubmit={handleSubmit} noValidate>
        {published ? <div className="publish-success"><span>✓</span><p className="eyebrow">PUBLISHED</p><h2>这条灵感已经准备好被看见</h2><p>{notice}</p><div><button type="button" className="button button--dark" onClick={() => window.location.assign(`/prompt/${published.id}`)}>查看作品 ↗</button><button type="button" className="button button--light" onClick={() => { setPublished(null); setForm(initialForm); setFile(null); setPreview(""); setPosterFile(null); setPosterPreview(""); setDuration(""); setNotice(""); setProgress(0); }}>继续发布</button></div></div> : <>
          <div className="create-steps" aria-label="发布步骤"><button type="button" className={step === 1 ? "active" : ""} onClick={() => canEnterStep(1)}><b>01</b><span>提示词与用途</span></button><button type="button" className={step === 2 ? "active" : ""} onClick={() => canEnterStep(2)}><b>02</b><span>工具、来源与版权</span></button><button type="button" className={step === 3 ? "active" : ""} onClick={() => canEnterStep(3)}><b>03</b><span>素材、封面与审核</span></button></div>
          <div className="form-section-head"><div><span className="section-kicker">STEP {String(step).padStart(2, "0")} / 03</span><h2>{step === 1 ? "把灵感说明白" : step === 2 ? "交代工具与来源" : "上传效果并发布"}</h2></div><button type="button" className="draft-button" onClick={saveDraft}>保存草稿</button></div>
          <div className={`form-grid create-step-panel step-${step}`}>
            <div className="create-step-group" data-step="1"><label className="field field--full"><span>标题 <b>*</b></span><input value={form.title} maxLength={80} onChange={(event) => update("title", event.target.value)} placeholder="例如：把普通街景变成电影开场" /></label>
            <label className="field field--full"><span>一句话摘要 <b>*</b> <small>{form.summary.length}/120</small></span><textarea value={form.summary} maxLength={120} rows={2} onChange={(event) => update("summary", event.target.value)} placeholder="先告诉浏览者这条提示词能做出什么" /></label>
            <label className="field field--full"><span>提示词文本 <b>*</b></span><textarea value={form.prompt} onChange={(event) => update("prompt", event.target.value)} placeholder="粘贴或输入完整提示词……" rows={8} /></label>
            <label className="field field--full"><span>负向提示词 <small>可选</small></span><textarea value={form.negativePrompt} onChange={(event) => update("negativePrompt", event.target.value)} placeholder="例如：低清晰度、变形、文字、水印" rows={3} /></label>
            <label className="field"><span>提示词类型 <b>*</b></span><select value={form.promptType} onChange={(event) => setForm((current) => ({ ...current, promptType: event.target.value, mediaRole: current.mediaType === "image" && (event.target.value === "视频提示词" || event.target.value === "图生视频") && current.mediaRole === "生成效果" ? "效果截图" : current.mediaRole }))}><option value="" disabled>请选择提示词用途</option>{promptTypeOptions.map((type) => <option key={type}>{type}</option>)}</select><small className="field-help">按提示词用途选择，不取决于上传的是截图还是视频。</small></label></div>
            <div className="create-step-group" data-step="2"><label className="field"><span>生成工具 <b>*</b></span><select required value={form.tool} onChange={(event) => update("tool", event.target.value)}><option value="" disabled>请选择生成工具</option>{toolOptions.map((tool) => <option key={tool}>{tool}</option>)}</select><small className="field-help">必须选择实际生成这项效果时使用的 AI。</small></label>
            {form.tool === "其他" && <label className="field"><span>所用 AI 名称 <b>*</b></span><input required autoFocus value={form.customTool} maxLength={60} onChange={(event) => update("customTool", event.target.value)} placeholder="例如：海螺 AI、FLUX、Adobe Firefly" /><small className="field-help">填写后将以这个名称展示在作品与工具榜。</small></label>}
            <label className="field"><span>模型版本</span><input value={form.modelVersion} onChange={(event) => update("modelVersion", event.target.value)} placeholder="例如：Veo 3 / Quality" /></label>
            <label className="field"><span>画幅比例</span><select value={form.aspectRatio} onChange={(event) => update("aspectRatio", event.target.value)}>{ratioOptions.filter((ratio) => ratio !== "全部画幅").map((ratio) => <option key={ratio}>{ratio}</option>)}</select></label>
            <label className="field"><span>关键参数</span><input value={form.parameters} onChange={(event) => update("parameters", event.target.value)} placeholder="8 秒 · 24fps · 慢推镜头" /></label>
            <label className="field field--full"><span>适用场景 <small>用逗号分开，最多 4 个</small></span><input value={form.useCases} onChange={(event) => update("useCases", event.target.value)} placeholder="短片开场，产品广告，情绪片段" /></label>
            <label className="field"><span>来源平台 / 博主 <b>*</b></span><input value={form.source} onChange={(event) => update("source", event.target.value)} placeholder="小红书 · @博主" /></label>
            <label className="field"><span>授权状态</span><select value={form.rightsType} onChange={(event) => update("rightsType", event.target.value)}>{rightsOptions.map((right) => <option key={right}>{right}</option>)}</select></label>
            <label className="field field--full"><span>提示词来源 / 原作者主页链接 <small>推荐填写</small></span><input type="url" value={form.sourceUrl} onChange={(event) => update("sourceUrl", event.target.value)} placeholder="https://… 原作者主页或提示词原帖" /></label>
            <label className="field field--full"><span>原作品 / 完整视频链接 <small>上传截图时尤其建议填写</small></span><input type="url" value={form.originalWorkUrl} onChange={(event) => update("originalWorkUrl", event.target.value)} placeholder="https://… 原视频、原图片或作品详情页" /></label>
            <label className="field field--full"><span>标签 <small>用逗号分开，最多 4 个</small></span><input value={form.tags} onChange={(event) => update("tags", event.target.value)} placeholder="电影感，夜景，胶片" /></label>
            <label className="field field--full"><span>作者简介 <small>会展示在你的主页</small></span><input value={form.authorBio} maxLength={100} onChange={(event) => update("authorBio", event.target.value)} placeholder="一句话介绍你的创作方向" /></label></div>
            <div className="create-step-group" data-step="3"><label className="field field--full"><span>展示素材说明 <b>*</b></span><select value={form.mediaRole} onChange={(event) => update("mediaRole", event.target.value)}>{mediaRoleOptions.map((role) => <option key={role}>{role}</option>)}</select><small className="field-help">例如：视频提示词没有视频时，可上传画面截图并选择“效果截图”。</small></label>
            <div className="field field--full"><span>上传展示素材 <b>*</b> <small>可以是效果视频、效果图或截图 · 图片 ≤20MB · 视频 ≤500MB</small></span><div className={`upload-zone ${preview ? "has-preview" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); handleFile(event.dataTransfer.files?.[0]); }}>{uploadedPreview || <button type="button" className="upload-empty" onClick={() => fileInputRef.current?.click()}><span className="upload-plus">＋</span><strong>拖拽展示素材到这里，或点击上传</strong><small>系统只识别附件格式，不会用它判断提示词类型</small></button>}{preview && <button type="button" className="upload-replace" onClick={() => fileInputRef.current?.click()}>更换文件</button>}</div><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" onChange={(event) => handleFile(event.target.files?.[0])} />{file && <div className="media-file-meta"><span>{file.name}</span><span>{form.mediaType === "video" ? "视频附件" : "图片附件"} · {fileSize(file.size)}{duration ? ` · ${duration}` : ""}</span></div>}</div>
            {form.mediaType === "video" && file && <div className="field field--full"><span>视频封面 <small>已自动截取，也可上传自定义封面</small></span><div className="poster-picker">{posterPreview ? <img src={posterPreview} alt="视频封面" /> : <span>当前视频无法自动截帧</span>}<button type="button" className="button button--light" onClick={() => posterInputRef.current?.click()}>更换封面</button></div><input ref={posterInputRef} className="visually-hidden" type="file" accept="image/*" onChange={(event) => handlePoster(event.target.files?.[0])} /></div>}</div>
          </div>
          {review && <div className={`review-result review-result--${review.status}`}><span>{review.status === "approved" ? "✓" : "!"}</span><div><strong>{review.status === "approved" ? `AI 判定：${review.detectedType}` : "审核未通过"}</strong><p>{review.status === "approved" ? `${review.typeReason} · 置信度 ${Math.round(review.confidence * 100)}%` : review.safetyReason}</p><small>{review.mode === "rules-local" ? "本地预览规则审核" : "AI 服务端审核"}</small></div></div>}
          {(publishing || reviewing) && <div className="upload-progress" aria-live="polite"><span style={{ width: `${reviewing ? 35 : progress}%` }} /><small>{reviewing ? "AI 审核中" : `上传中 ${progress}%`}</small></div>}
          <div className="form-submit create-step-actions"><span className={notice ? "form-notice is-visible" : "form-notice"}>{notice || "发布前将进行 AI 类型识别与内容安全审核"}</span><div>{step > 1 && <button className="button button--light" type="button" onClick={() => setStep(step - 1)}>上一步</button>}{step < 3 ? <button className="button button--dark" type="button" onClick={() => canEnterStep(step + 1)}>下一步</button> : <button className="button button--dark" type="submit" disabled={publishing || reviewing}>{reviewing ? "AI 审核中…" : publishing ? "发布中…" : "AI 检查并发布"} <span>↗</span></button>}</div></div>
        </>}
      </form>
      <aside className="create-preview"><div className="preview-head"><span className="section-kicker">LIVE PREVIEW</span><span>封面优先</span></div><div className="preview-card"><div className="preview-media"><MediaArt item={previewItem} /><div className="preview-type-row"><span>{previewItem.promptType}</span><span>{previewItem.mediaRole}</span></div></div><div className="preview-card-body"><span>{previewItem.tool} · {previewItem.aspectRatio}</span><h3>{previewItem.title}</h3><div className="tag-row">{previewItem.tags.length ? previewItem.tags.map((tag) => <span key={tag}>#{tag}</span>) : <span>#你的标签</span>}</div></div></div><p>广场会分别标明“提示词类型”和“展示素材”。视频提示词上传截图，也不会被归类为图片提示词。</p></aside>
    </main>
  </div>;
}

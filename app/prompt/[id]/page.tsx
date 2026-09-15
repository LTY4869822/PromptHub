"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BrandMark, BrandName, MediaArt } from "../../components/PromptoryShell";
import ThemeButton from "../../components/ThemeButton";
import type { LocalComment } from "../../lib/local-state";
import { displayAssetLabel, formatCount, promptTypeOf, type PromptItem } from "../../lib/prompt-data";

type ApiComment = { id: number | string; author_name?: string; authorName?: string; author_initials?: string; authorInitials?: string; body: string; created_at?: string; createdAt?: string };
const toComment = (comment: ApiComment): LocalComment => ({ id: String(comment.id), promptId: "", authorName: comment.author_name || comment.authorName || "访客", authorInitials: comment.author_initials || comment.authorInitials || "访", body: comment.body, createdAt: comment.created_at || comment.createdAt || "刚刚" });
const patchAction = async (data: Record<string, unknown>) => { const response = await fetch("/api/prompts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); if (response.status === 401) { window.location.assign(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return {}; } const body = await response.json().catch(() => ({})) as { error?: string }; if (!response.ok) throw new Error(body.error || "操作失败"); return body; };

export default function PromptDetailPage({ params }: { params: { id: string } }) {
  const viewed = useRef(false);
  const [item, setItem] = useState<PromptItem | null>(null);
  const [promptId, setPromptId] = useState("");
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [following, setFollowing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [comments, setComments] = useState<LocalComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [lightbox, setLightbox] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("来源或版权问题");
  const [reportDetail, setReportDetail] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    const routeParams = params as unknown as { id?: string } | Promise<{ id: string }>;
    if (typeof (routeParams as Promise<{ id: string }>).then === "function") (routeParams as Promise<{ id: string }>).then(({ id }) => setPromptId(id));
    else setPromptId((routeParams as { id?: string }).id || "");
  }, [params]);

  useEffect(() => {
    if (!promptId) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    fetch(`/api/prompts?id=${encodeURIComponent(promptId)}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("offline")))
      .then((data: { prompt?: PromptItem; comments?: ApiComment[]; following?: boolean }) => {
        if (data.prompt) { setItem(data.prompt); setSaved(Boolean(data.prompt.saved)); setLiked(Boolean(data.prompt.liked)); setFollowing(Boolean(data.following)); }
        setComments((data.comments || []).map(toComment));
      }).catch(() => undefined);
    if (!viewed.current) { viewed.current = true; fetch("/api/prompts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "view", promptId }) }).catch(() => undefined); }
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [promptId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") { setLightbox(false); setReportOpen(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, []);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 2200); };
  const copyPrompt = async () => { await navigator.clipboard?.writeText(item?.prompt || ""); setCopied(true); notify("提示词已复制"); window.setTimeout(() => setCopied(false), 2200); };
  const toggleSaved = async () => { if (!item) return; const next = !saved; setSaved(next); setItem({ ...item, saves: Math.max(0, (item.saves || 0) + (next ? 1 : -1)) }); try { await patchAction({ action: "save", promptId: item.id }); notify(next ? "已收藏" : "已取消收藏"); } catch (error) { setSaved(!next); notify(error instanceof Error ? error.message : "操作失败"); } };
  const toggleLiked = async () => { if (!item) return; const next = !liked; setLiked(next); setItem({ ...item, likes: Math.max(0, item.likes + (next ? 1 : -1)) }); try { await patchAction({ action: "like", promptId: item.id }); } catch (error) { setLiked(!next); notify(error instanceof Error ? error.message : "操作失败"); } };
  const toggleFollow = async () => { if (!item) return; const next = !following; setFollowing(next); try { await patchAction({ action: "follow", creatorName: item.authorName, creatorKey: item.authorId }); notify(next ? `已关注 ${item.authorName}` : `已取消关注 ${item.authorName}`); } catch (error) { setFollowing(!next); notify(error instanceof Error ? error.message : "操作失败"); } };
  const submitComment = async (event: FormEvent) => { event.preventDefault(); if (!item || !commentText.trim()) return; try { await patchAction({ action: "comment", promptId: item.id, body: commentText.trim() }); const comment = { id: `new-${Date.now()}`, promptId: String(item.id), authorName: "你", authorInitials: "你", body: commentText.trim(), createdAt: "刚刚" }; setComments((current) => [comment, ...current]); setItem({ ...item, commentsCount: (item.commentsCount || 0) + 1 }); setCommentText(""); notify("评论已发布"); } catch (error) { notify(error instanceof Error ? error.message : "评论发布失败"); } };
  const submitReport = async (event: FormEvent) => { event.preventDefault(); if (!item) return; try { await patchAction({ action: "report", promptId: item.id, reason: reportReason, detail: reportDetail }); setReportOpen(false); setReportDetail(""); notify("举报已提交，管理员会尽快审核"); } catch (error) { notify(error instanceof Error ? error.message : "举报提交失败"); } };

  if (!item) return <div className="fullscreen-page not-found"><a className="back-link" href="/">← 返回灵感广场</a><div><h1>这条灵感暂时找不到</h1><p>它可能还没有同步完成，或者已经被作者撤下。</p></div></div>;
  const isLong = item.prompt.length > 320;
  const canZoom = item.mediaType === "image" && Boolean(item.mediaUrl);

  return <div className="fullscreen-page detail-page">
    <header className="fullscreen-topbar"><button className="back-link back-button" onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.assign("/"); }}>← 返回上一页</button><div className="fullscreen-brand"><BrandMark /><BrandName /></div><div className="fullscreen-actions"><ThemeButton /><a className="button button--dark button--compact" href="/create"><span>＋</span> 发布提示词</a></div></header>
    <main className="detail-layout detail-layout--rich">
      <section className="detail-stage"><div className="detail-stage-label"><span>{promptTypeOf(item)}</span><span>{item.tool}</span></div><div className={`detail-stage-media ${canZoom ? "is-zoomable" : ""}`} onClick={() => canZoom && setLightbox(true)} onKeyDown={(event) => canZoom && (event.key === "Enter" || event.key === " ") && setLightbox(true)} role={canZoom ? "button" : undefined} tabIndex={canZoom ? 0 : undefined} aria-label={canZoom ? "放大查看图片" : "展示素材预览"}><MediaArt item={item} large />{canZoom && <span className="zoom-hint">⌕ 点击放大</span>}</div><div className="detail-stage-foot"><span>{item.mediaRole === "生成效果" ? "先看效果，再看提示词" : "展示素材仅供理解提示词效果"}</span><span>{displayAssetLabel(item)}{item.duration ? ` · ${item.duration}` : ""}</span></div></section>
      <section className="detail-info detail-info--rich">
        <div className="detail-info-top"><div><p className="eyebrow">PROMPTHUB / DETAIL</p><h1>{item.title}<span className="heading-dot">.</span></h1>{item.summary && <p className="detail-summary">{item.summary}</p>}</div><button className={`icon-action ${saved ? "is-saved" : ""}`} aria-label={saved ? "取消收藏" : "收藏提示词"} onClick={toggleSaved}>{saved ? "♥" : "♡"}</button></div>
        <div className="detail-author"><a className="avatar avatar--large" href={`/author/${encodeURIComponent(item.authorId || item.authorName)}`}>{item.authorInitials}</a><div><a href={`/author/${encodeURIComponent(item.authorId || item.authorName)}`}><strong>{item.authorName}</strong></a><small>{item.createdAt} 发布 · {formatCount(item.views + 1)} 次查看</small></div><button className={`follow-button ${following ? "is-following" : ""}`} onClick={toggleFollow}>{following ? "已关注" : "＋ 关注"}</button></div>
        <div className="detail-actionbar"><button className={liked ? "is-active" : ""} onClick={toggleLiked}>{liked ? "♥" : "♡"} {formatCount(item.likes)}</button><button className={saved ? "is-active" : ""} onClick={toggleSaved}>⌑ {formatCount(item.saves || 0)}</button><button onClick={copyPrompt}>▣ {copied ? "已复制" : "复制"}</button><button onClick={() => setReportOpen(true)}>… 举报</button></div>
        <div className="content-identity"><span>{promptTypeOf(item)}</span><span>{displayAssetLabel(item)}</span>{item.mediaType === "image" && promptTypeOf(item) !== "图片提示词" && <small>附件是截图/图片，不代表提示词类型</small>}</div>
        {item.reviewStatus === "approved" && <div className="ai-review-card"><span>✓</span><div><strong>AI 类型与安全审核已通过</strong><p>{item.reviewReason || `判定为 ${promptTypeOf(item)}`}{typeof item.reviewConfidence === "number" && item.reviewConfidence > 0 ? ` · 置信度 ${Math.round(item.reviewConfidence * 100)}%` : ""}</p><small>{item.reviewMode === "rules-local" ? "本地预览规则审核" : "服务端 AI 审核"}</small></div></div>}
        <div className="metadata-grid"><div><small>提示词类型</small><strong>{promptTypeOf(item)}</strong></div><div><small>生成工具</small><strong>{item.tool}</strong></div><div><small>模型版本</small><strong>{item.modelVersion || "未注明"}</strong></div><div><small>画幅比例</small><strong>{item.aspectRatio || "未注明"}</strong></div><div><small>展示素材</small><strong>{displayAssetLabel(item)}</strong></div><div><small>关键参数</small><strong>{item.parameters || item.duration || "未注明"}</strong></div></div>
        <div className="detail-prompt-head"><span>提示词文本</span><button className="button button--light" onClick={copyPrompt}>{copied ? "已复制" : "复制提示词"}</button></div><div className={`prompt-block prompt-block--full ${isLong && !expanded ? "is-collapsed" : ""}`}><div className="prompt-lang">PROMPT / {item.tool.toUpperCase()}</div><p>{item.prompt}</p>{isLong && <button className="prompt-expand-button" onClick={() => setExpanded((current) => !current)}>{expanded ? "收起提示词 ↑" : "展开全部提示词 ↓"}</button>}</div>
        {item.negativePrompt && <details className="negative-prompt"><summary>负向提示词 <span>展开查看</span></summary><p>{item.negativePrompt}</p></details>}
        {(item.useCases?.length || item.tags.length) && <div className="detail-taxonomy">{item.useCases?.length ? <div><small>适用场景</small><div>{item.useCases.map((useCase) => <span key={useCase}>{useCase}</span>)}</div></div> : null}<div><small>内容标签</small><div>{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div></div></div>}
        <div className="rights-card"><span className="source-icon">↗</span><div><small>来源与版权</small>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.source} · 查看提示词来源</a> : <strong>{item.source}</strong>}<p>{item.rightsType || "来源待核验"} · 请遵循原作者及生成工具的使用条款</p>{item.originalWorkUrl && <a className="original-work-link" href={item.originalWorkUrl} target="_blank" rel="noreferrer">查看原作品 / 完整视频 ↗</a>}</div></div>
        <section className="comments-section"><div className="comments-head"><div><span className="section-kicker">COMMUNITY</span><h2>评论与使用心得</h2></div><span>{comments.length} 条</span></div><form className="comment-form" onSubmit={submitComment}><span className="avatar">你</span><input value={commentText} maxLength={300} onChange={(event) => setCommentText(event.target.value)} placeholder="说说你会怎样使用这条提示词…" /><button disabled={!commentText.trim()}>发布</button></form><div className="comment-list">{comments.length ? comments.map((comment) => <article key={comment.id}><span className="avatar">{comment.authorInitials}</span><div><strong>{comment.authorName}<small>{comment.createdAt}</small></strong><p>{comment.body}</p></div></article>) : <p className="comments-empty">还没有评论，来分享第一个使用心得。</p>}</div></section>
      </section>
    </main>
    {lightbox && item.mediaUrl && <div className="lightbox" role="dialog" aria-modal="true" onClick={() => setLightbox(false)}><button aria-label="关闭大图">×</button><img src={item.mediaUrl} alt={item.title} onClick={(event) => event.stopPropagation()} /></div>}
    {reportOpen && <div className="modal-layer" role="dialog" aria-modal="true" onMouseDown={(event) => event.target === event.currentTarget && setReportOpen(false)}><form className="report-modal" onSubmit={submitReport}><div><span className="section-kicker">REPORT</span><button type="button" onClick={() => setReportOpen(false)}>×</button></div><h2>举报这条内容</h2><p>请选择最贴近的问题，审核结果会用于维护广场内容质量。</p><label className="field"><span>问题类型</span><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}><option>来源或版权问题</option><option>提示词与效果不符</option><option>垃圾或重复内容</option><option>不安全或不适宜内容</option></select></label><label className="field"><span>补充说明 <small>可选</small></span><textarea rows={4} value={reportDetail} onChange={(event) => setReportDetail(event.target.value)} placeholder="请提供有助于审核的信息" /></label><button className="button button--dark" type="submit">提交举报</button></form></div>}
    {toast && <div className="toast"><span>✓</span>{toast}</div>}
  </div>;
}

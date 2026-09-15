"use client";

import { useEffect, useMemo, useState } from "react";
import { displayAssetLabel, formatCount, hotScoreOf, promptTypeOf, promptTypeOptions, ratioOptions, seedPrompts, showDemoContent, toolOptions, type PromptItem } from "../lib/prompt-data";
import ThemeButton from "./ThemeButton";
import AuthStatus from "./AuthStatus";

export type GalleryMode = "gallery" | "latest" | "hot" | "following" | "saved" | "published" | "tools";
const navItems = [
  { label: "灵感广场", href: "/", mode: "gallery" as GalleryMode, icon: "✦" },
  { label: "最新发布", href: "/latest", mode: "latest" as GalleryMode, icon: "↗" },
  { label: "热门收藏", href: "/hot", mode: "hot" as GalleryMode, icon: "♨" },
  { label: "关注动态", href: "/following", mode: "following" as GalleryMode, icon: "◎" },
  { label: "我的收藏", href: "/saved", mode: "saved" as GalleryMode, icon: "♡" },
  { label: "我的发布", href: "/published", mode: "published" as GalleryMode, icon: "◌" },
  { label: "本周工具榜", href: "/tools", mode: "tools" as GalleryMode, icon: "▥" },
];

export function getPromptsWithLocal() { return showDemoContent() ? seedPrompts : []; }

export function MediaArt({ item, large = false }: { item: PromptItem; large?: boolean }) {
  if (item.mediaUrl && item.mediaType === "image") return <div className={`media-display ${large ? "media-display--large" : ""}`}><img className={`uploaded-media ${large ? "uploaded-media--large" : ""}`} src={item.mediaUrl} alt={item.title} loading="lazy" /></div>;
  if (item.mediaUrl && item.mediaType === "video") return <div className={`media-display ${large ? "media-display--large" : ""}`}><video className={`uploaded-media ${large ? "uploaded-media--large" : ""}`} src={item.mediaUrl} poster={item.posterUrl || undefined} controls={large} muted={!large} preload={large ? "metadata" : "none"} playsInline /></div>;
  return <div className={`media-art ${item.tone} ${large ? "media-art--large" : ""}`} aria-label={`${item.title} 的封面`}><div className="art-grid" /><div className="art-orb art-orb--one" /><div className="art-orb art-orb--two" /><span className="art-kicker">{item.mediaType === "video" ? "MOTION STUDY" : "VISUAL STUDY"}</span><strong>{item.title.slice(0, 14)}</strong><span className="art-footer">PROMPTHUB / {item.tool}</span></div>;
}

export function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><img src="/prompthub-prism.png" alt="" /></span>;
}

export function BrandName() {
  return <strong className="brand-name">Prompt<span>Hub</span></strong>;
}

export function Sidebar({ active }: { active: GalleryMode | "account" }) {
  return <aside className="sidebar"><a className="brand" href="/" aria-label="返回 PromptHub 灵感广场"><BrandMark /><span className="brand-copy"><BrandName /><small>提示词灵感库</small></span></a><div className="sidebar-divider" /><nav className="side-nav" aria-label="主导航"><p className="nav-label">发现</p>{navItems.slice(0, 4).map((item) => <a key={item.href} className={active === item.mode ? "active" : ""} href={item.href}><span className="nav-icon">{item.icon}</span>{item.label}</a>)}<p className="nav-label nav-label--spaced">我的工作台</p>{navItems.slice(4, 6).map((item) => <a key={item.href} className={active === item.mode ? "active" : ""} href={item.href}><span className="nav-icon">{item.icon}</span>{item.label}</a>)}<p className="nav-label nav-label--spaced">更多</p><a className={active === "tools" ? "active" : ""} href="/tools"><span className="nav-icon">▥</span>本周工具榜</a><a href="/account"><span className="nav-icon">⚙</span>账号与数据</a></nav><div className="sidebar-bottom"><div className="side-note"><span>✺</span><div><strong>灵感不该被藏起来</strong><small>分享你的下一次尝试</small></div></div><a className="profile-mini profile-link" href="/published"><span className="avatar avatar--large">你</span><div><strong>我的主页</strong><small>资料与作品</small></div><span className="profile-more">···</span></a><div className="sidebar-legal"><a href="/legal/terms">协议</a><a href="/legal/privacy">隐私</a><a href="/legal/community">规范</a></div></div></aside>;
}

export function AppTopbar() {
  const [open, setOpen] = useState(false);
  return <header className="topbar"><div className="breadcrumb"><span>灵感库</span><i>/</i><strong>视觉提示词</strong></div><div className="top-actions"><AuthStatus /><ThemeButton /><div className="notification-wrap"><button className="icon-button" aria-label="通知" onClick={() => setOpen((value) => !value)}>♢<span className="notification-dot" /></button>{open && <div className="notification-popover"><strong>最近动态</strong><p>你的收藏和评论会显示在这里。</p><small>社区功能已开启</small></div>}</div><a className="button button--dark button--compact" href="/create"><span>＋</span> 发布提示词</a></div></header>;
}

export function PromptCard({ item, saved, onToggleSave, showHotScore = false }: { item: PromptItem; saved: boolean; onToggleSave: (id: PromptItem["id"]) => void; showHotScore?: boolean }) {
  const authorPath = `/author/${encodeURIComponent(item.authorId || item.authorName)}`;
  return <article className="prompt-card"><div className="card-cover"><a className="cover-link" href={`/prompt/${item.id}`} aria-label={`查看 ${item.title}`}><MediaArt item={item} /><div className="cover-topline"><div className="cover-badge-stack" title="提示词类型由 AI 根据内容复核；附件格式由上传文件自动识别"><span className="prompt-type-badge">{promptTypeOf(item)}</span><span className="material-badge">{displayAssetLabel(item)}</span></div>{item.duration && <span className="duration-badge">{item.duration}</span>}</div><div className="cover-hint">查看提示词 <span>↗</span></div></a><button className={`cover-save ${saved ? "is-saved" : ""}`} aria-label={saved ? "取消收藏" : "收藏提示词"} onClick={() => onToggleSave(item.id)}>{saved ? "♥" : "♡"}</button></div><div className="card-content"><div className="card-meta"><span>{item.tool}</span><span className="meta-dot">·</span><span>{item.aspectRatio || item.createdAt}</span><span className="rights-mini">{showHotScore ? `热门 ${hotScoreOf(item).toFixed(1)}` : item.reviewStatus === "approved" ? "AI 已审核" : item.rightsType || "原创分享"}</span></div><h3><a href={`/prompt/${item.id}`}>{item.title}</a></h3><div className="tag-row">{item.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div><div className="card-footer"><a className="author" href={authorPath}><span className="avatar">{item.authorInitials}</span>{item.authorName}</a><span className="engagement">♡ {formatCount(item.saves || 0)} <span>◉ {formatCount(item.views)}</span></span></div></div></article>;
}

function EmptyState({ mode }: { mode: GalleryMode }) { const copy = mode === "saved" ? ["收藏夹还是空的", "看到喜欢的封面，点一下心形就能收进来。"] : mode === "following" ? ["还没有关注动态", "进入作者主页并关注创作者，这里就会出现更新。"] : ["还没有匹配的灵感", "调整筛选条件，或者发布你的第一条提示词。"] ; return <div className="empty-state"><div className="empty-icon">✦</div><h3>{copy[0]}</h3><p>{copy[1]}</p><a href="/create" className="button button--dark">发布第一条</a></div>; }

const modeCopy: Record<GalleryMode, { eyebrow: string; title: string; subtitle: string }> = {
  gallery: { eyebrow: "PROMPTHUB / DISCOVER", title: "灵感广场", subtitle: "先看效果，再看方法。找到值得收藏和尝试的 AI 创作灵感。" }, latest: { eyebrow: "LATEST DROPS", title: "最新发布", subtitle: "刚刚被创作者分享的视觉尝试。" }, hot: { eyebrow: "TRENDING NOW", title: "热门收藏", subtitle: "根据近期收藏、浏览、点赞和评论综合排序。" }, following: { eyebrow: "FOLLOWING FEED", title: "关注动态", subtitle: "只看你关注的创作者最近发布的内容。" }, saved: { eyebrow: "YOUR COLLECTION", title: "我的收藏", subtitle: "把那些想马上试试的灵感放在这里。" }, published: { eyebrow: "YOUR DROPS", title: "我的发布", subtitle: "管理你分享过的提示词与生成效果。" }, tools: { eyebrow: "WEEKLY TOOL INDEX", title: "本周工具榜", subtitle: "根据本站实际作品数量与互动热度生成。" },
};

export function PromptoryShell({ active, children }: { active: GalleryMode | "account"; children: React.ReactNode }) { return <div className="app-shell"><Sidebar active={active} /><main className="main-area"><AppTopbar />{children}</main></div>; }
function HeroBanner() { return <section className="hero-banner"><div className="hero-copy"><span className="hero-tag">本周精选 · EDITOR'S PICKS</span><h2>先被画面吸引<br /><em>再发现生成方法</em></h2><p>封面保持纯粹，提示词、参数、来源和讨论都留在详情页。</p><a className="hero-link" href="/hot">浏览本周热门 <span>↗</span></a></div><div className="hero-visual"><div className="hero-circle hero-circle--back" /><div className="hero-circle hero-circle--front" /><div className="hero-card-float"><span>01</span><strong>视觉叙事</strong><small>从结果反推方法</small></div><div className="hero-line" /></div></section>; }

export default function GalleryPage({ mode }: { mode: GalleryMode }) {
  const [prompts, setPrompts] = useState<PromptItem[]>([]); const [savedIds, setSavedIds] = useState<(number | string)[]>([]); const [search, setSearch] = useState(""); const [category, setCategory] = useState("全部"); const [assetType, setAssetType] = useState("全部展示素材"); const [tool, setTool] = useState("全部工具"); const [ratio, setRatio] = useState("全部画幅"); const [loading, setLoading] = useState(true); const [nextCursor, setNextCursor] = useState<string | number | null>(null); const [loadError, setLoadError] = useState(false); const [reloadKey, setReloadKey] = useState(0); const copy = modeCopy[mode];
  useEffect(() => {
    setLoading(true); setLoadError(false);
    const parameters = new URLSearchParams({ mode, limit: "24" });
    if (search.trim()) parameters.set("q", search.trim());
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 10000);
    let cancelled = false;
    fetch(`/api/prompts?${parameters}`, { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error("http"))))
      .then((data: { prompts?: PromptItem[]; nextCursor?: string | number | null }) => {
        if (cancelled) return;
        const remote = data.prompts || [];
        const demos = mode === "gallery" && showDemoContent() && !search ? seedPrompts : [];
        const merged = [...remote, ...demos].filter((item, index, all) => all.findIndex((other) => String(other.id) === String(item.id)) === index);
        setPrompts(merged); setSavedIds(remote.filter((item) => item.saved).map((item) => item.id)); setNextCursor(data.nextCursor || null); setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        if (controller.signal.aborted) { setLoadError(true); setLoading(false); }
        else { setPrompts(mode === "gallery" && showDemoContent() ? seedPrompts : []); setLoading(false); }
      });
    return () => { cancelled = true; window.clearTimeout(timer); controller.abort(); };
  }, [mode, search, reloadKey]);
  // Re-fetch the list when the tab becomes visible again after being hidden,
  // in case a backgrounded request never completed (page would otherwise keep
  // showing stale loading state).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && loading) setReloadKey((key) => key + 1);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [loading]);
  const availableTools = useMemo(() => Array.from(new Set([...toolOptions.filter((item) => item !== "其他"), ...prompts.map((item) => item.tool).filter(Boolean)])), [prompts]);
  const filtered = useMemo(() => { let result = prompts.filter((item) => { const matchesType = category === "全部" || promptTypeOf(item) === category; const matchesAsset = assetType === "全部展示素材" || (assetType === "视频附件" && item.mediaType === "video") || (assetType === "图片 / 截图" && item.mediaType === "image"); const matchesTool = tool === "全部工具" || item.tool === tool; const matchesRatio = ratio === "全部画幅" || item.aspectRatio === ratio; return matchesType && matchesAsset && matchesTool && matchesRatio; }); if (mode === "hot") result = result.sort((a, b) => hotScoreOf(b) - hotScoreOf(a)); return result; }, [assetType, category, mode, prompts, ratio, tool]);
  const toggleSave = async (id: PromptItem["id"]) => { const wasSaved = savedIds.map(String).includes(String(id)); setSavedIds((current) => wasSaved ? current.filter((item) => String(item) !== String(id)) : [...current, id]); setPrompts((current) => current.map((item) => String(item.id) === String(id) ? { ...item, saves: Math.max(0, (item.saves || 0) + (wasSaved ? -1 : 1)) } : item)); const response = await fetch("/api/prompts", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "save", promptId: id }) }); if (response.status === 401) { window.location.assign(`/auth?returnTo=${encodeURIComponent(window.location.pathname + window.location.search)}`); return; } if (!response.ok) window.location.reload(); };
  const authorCount = new Set(prompts.map((item) => item.authorName)).size;
  if (mode === "tools") { const rows = availableTools.map((name) => { const items = prompts.filter((item) => item.tool === name); return { name, count: items.length, score: items.reduce((sum, item) => sum + (item.saves || 0) * 3 + item.likes + item.views / 100, 0) }; }).sort((a, b) => b.score - a.score); const max = Math.max(...rows.map((row) => row.score), 1); return <PromptoryShell active={mode}><div className="content-wrap"><PageHeading copy={copy} stats={`${prompts.length} 条真实作品`} /><div className="tool-ranking">{rows.map((row, index) => <div className="tool-row" key={row.name}><span className="tool-index">{String(index + 1).padStart(2, "0")}</span><div className="tool-name"><strong>{row.name}</strong><small>{row.count} 条作品</small></div><div className="tool-bar"><span style={{ width: `${Math.max(4, row.score / max * 100)}%` }} /></div><span className="tool-count">{Math.round(row.score)} 热度</span></div>)}</div></div></PromptoryShell>; }
  const loadMore = async () => { if (!nextCursor) return; const response = await fetch(`/api/prompts?mode=${mode}&limit=24&cursor=${encodeURIComponent(String(nextCursor))}`); if (!response.ok) return; const data = await response.json() as { prompts?: PromptItem[]; nextCursor?: string | number | null }; setPrompts((current) => [...current, ...(data.prompts || [])]); setNextCursor(data.nextCursor || null); };
  return <PromptoryShell active={mode}><div className="content-wrap"><PageHeading copy={copy} stats={`${prompts.length} 条灵感 · ${authorCount} 位创作者`} />{mode === "gallery" && <HeroBanner />}<div className="toolbar toolbar--advanced"><div className="category-tabs">{["全部", ...promptTypeOptions].map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div><div className="filter-actions"><select aria-label="按展示素材筛选" value={assetType} onChange={(event) => setAssetType(event.target.value)}><option>全部展示素材</option><option>视频附件</option><option>图片 / 截图</option></select><select aria-label="按工具筛选" value={tool} onChange={(event) => setTool(event.target.value)}><option>全部工具</option>{availableTools.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="按画幅筛选" value={ratio} onChange={(event) => setRatio(event.target.value)}>{ratioOptions.map((item) => <option key={item}>{item}</option>)}</select><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索标题、作者或标签" aria-label="搜索提示词" />{search && <button onClick={() => setSearch("")} aria-label="清除搜索">×</button>}</label></div></div><div className="section-head"><div><span className="section-kicker">{copy.eyebrow}</span><h2>{mode === "gallery" ? "值得一看的新作品" : copy.title}</h2></div><span className="result-count">{loading ? "正在同步..." : `${filtered.length} 条结果`}</span></div>{loadError ? <div className="empty-state"><div className="empty-icon">!</div><h3>加载失败</h3><p>网络连接可能已中断，请重试。</p><button className="button button--dark" onClick={() => setReloadKey((key) => key + 1)}>重新加载</button></div> : filtered.length ? <><div className="prompt-grid">{filtered.map((item) => <PromptCard key={String(item.id)} item={item} saved={savedIds.map(String).includes(String(item.id))} onToggleSave={toggleSave} />)}</div>{nextCursor && <button className="button button--light load-more" onClick={loadMore}>加载更多</button>}</> : <EmptyState mode={mode} />}</div></PromptoryShell>;
}
function PageHeading({ copy, stats }: { copy: { eyebrow: string; title: string; subtitle: string }; stats: string }) { return <><div className="page-heading"><div><p className="eyebrow">{copy.eyebrow}</p><h1>{copy.title}<span className="heading-dot">.</span></h1><p className="heading-sub">{copy.subtitle}</p></div><div className="heading-stats"><span><strong>{stats}</strong></span></div></div>{copy.title === "热门收藏" && <div className="hot-rule-card"><div><span>热门收藏规则</span><strong>热门分 =（收藏×6＋点赞×3＋评论×4＋浏览×0.12）÷（发布天数＋2）<sup>1.35</sup></strong></div><p>只统计近 30 天内且达到收藏 ≥8、点赞 ≥20 或浏览 ≥200 的审核通过作品；排序分会随发布时间自然衰减。</p></div>}</>; }

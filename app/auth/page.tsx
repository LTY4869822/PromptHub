"use client";

import { useEffect, useState, type FormEvent } from "react";
import { BrandMark, BrandName } from "../components/PromptoryShell";

const scenes = [
  { label: "灵感流光", caption: "GOLDEN HOUR", url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4" },
  { label: "静谧之海", caption: "STILL WATER", url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4" },
  { label: "深林构想", caption: "DEEP WOODS", url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4" },
  { label: "破晓画布", caption: "QUIET DAWN", url: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4" },
];

type Mode = "login" | "register";
type Feedback = { type: "error" | "success"; text: string } | null;

export default function AuthPage() {
  const [activeVideo, setActiveVideo] = useState(0);
  const [transitioning, setTransitioning] = useState(false);
  const [mode, setMode] = useState<Mode>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [complete, setComplete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [returnTo, setReturnTo] = useState("/");
  const [form, setForm] = useState({ nickname: "", email: "", password: "", confirm: "", remember: true });

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("returnTo");
    if (requested?.startsWith("/") && !requested.startsWith("//") && !requested.startsWith("/auth")) setReturnTo(requested);
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => { if (response.ok) window.location.replace(requested || "/"); }).catch(() => undefined);
  }, []);

  const changeScene = (index: number) => { if (index === activeVideo || transitioning) return; setTransitioning(true); setActiveVideo(index); window.setTimeout(() => setTransitioning(false), 1000); };
  const switchMode = (next: Mode) => { setMode(next); setComplete(false); setFeedback(null); setForm((current) => ({ ...current, password: "", confirm: "" })); };
  const update = (key: keyof typeof form, value: string | boolean) => setForm((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setFeedback(null);
    const email = form.email.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) { setFeedback({ type: "error", text: "请输入有效的邮箱地址" }); return; }
    if (mode === "register" && (form.nickname.trim().length < 2 || form.nickname.trim().length > 24)) { setFeedback({ type: "error", text: "昵称需要 2–24 个字符" }); return; }
    if (mode === "register" && (form.password.length < 10 || !/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) { setFeedback({ type: "error", text: "密码至少 10 位，并同时包含字母和数字" }); return; }
    if (mode === "register" && form.password !== form.confirm) { setFeedback({ type: "error", text: "两次输入的密码不一致" }); return; }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nickname: form.nickname.trim(), email, password: form.password, remember: form.remember }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "账号操作失败，请稍后再试");
      window.sessionStorage.setItem("prompthub-session-verified-at", String(Date.now()));
      setComplete(true);
      setFeedback({ type: "success", text: mode === "login" ? "身份验证通过，你的灵感库已准备好" : "账号创建成功，欢迎加入 PromptHub" });
    } catch (error) { setFeedback({ type: "error", text: error instanceof Error ? error.message : "账号操作失败，请稍后再试" }); }
    finally { setSubmitting(false); }
  };

  return <section className={`auth-page ${activeVideo === 2 ? "auth-page--ink" : ""}`}>
    <div className="auth-video-stack" aria-hidden="true">{scenes.map((scene, index) => <video key={scene.url} className={index === activeVideo ? "is-active" : ""} src={scene.url} autoPlay muted loop playsInline preload={index === activeVideo ? "auto" : "metadata"} />)}</div>
    <div className="auth-cinematic-shade" /><img className="auth-atmosphere" src="https://soft-zoom-63098134.figma.site/_assets/v11/0b4a435b2df2747593c43d7a1c9b4578f7d8d90c.png" alt="" aria-hidden="true" />
    <header className="auth-nav"><span className="auth-brand" aria-label="PromptHub"><BrandMark /><BrandName /></span></header>
    <main className="auth-content">
      <section className="auth-story"><span className="auth-badge liquid-glass"><i /> 为提示词创作者而建</span><h1>让每一次灵感<br /><em>都有迹可循</em></h1><p>从令人停留的画面出发，发现它背后的提示词、工具与创作方法。保存你的尝试，也让好灵感被更多人看见。</p><div className="auth-scene-switcher" aria-label="切换背景场景">{scenes.map((scene, index) => <button key={scene.label} className={index === activeVideo ? "is-active" : ""} disabled={transitioning} onClick={() => changeScene(index)}><small>{scene.caption}</small><span>{scene.label}</span></button>)}</div></section>
      <section id="account" className="auth-card liquid-glass" aria-label="PromptHub 账号"><div className="auth-card-glow" />{complete ? <div className="auth-complete"><span>✓</span><p>WELCOME TO PROMPTHUB</p><h2>{mode === "login" ? "欢迎回来" : "欢迎加入"}</h2><div>{feedback?.text}</div><a href={returnTo}>{returnTo === "/" ? "进入灵感广场" : "继续刚才的访问"} <b>↗</b></a>{mode === "register" && <a className="auth-complete-secondary" href="/published">完善我的主页</a>}</div> : <>
        <div className="auth-card-head"><p>{mode === "login" ? "WELCOME BACK" : "JOIN THE COMMUNITY"}</p><h2>{mode === "login" ? "登录 PromptHub" : "创建你的账号"}</h2><span>{mode === "login" ? "继续收藏、发布和管理你的创作灵感。" : "每个账号都有独立资料、收藏和作品空间。"}</span></div>
        <div className="auth-tabs"><button className={mode === "login" ? "is-active" : ""} type="button" onClick={() => switchMode("login")}>登录</button><button className={mode === "register" ? "is-active" : ""} type="button" onClick={() => switchMode("register")}>注册</button><i className={mode === "register" ? "is-register" : ""} /></div>
        <form className="auth-form" onSubmit={submit} noValidate>{mode === "register" && <label><span>昵称</span><div className="auth-input"><i>◌</i><input value={form.nickname} onChange={(event) => update("nickname", event.target.value)} autoComplete="nickname" maxLength={24} placeholder="你希望大家如何称呼你" /></div></label>}<label><span>邮箱</span><div className="auth-input"><i>＠</i><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} autoComplete="email" placeholder="name@example.com" /></div></label><label><span>密码</span><div className="auth-input"><i>●</i><input type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => update("password", event.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "register" ? "至少 10 位，包含字母与数字" : "输入你的密码"} /><button type="button" aria-label={showPassword ? "隐藏密码" : "显示密码"} onClick={() => setShowPassword((value) => !value)}>{showPassword ? "隐藏" : "显示"}</button></div></label>{mode === "register" && <label><span>确认密码</span><div className="auth-input"><i>●</i><input type={showPassword ? "text" : "password"} value={form.confirm} onChange={(event) => update("confirm", event.target.value)} autoComplete="new-password" placeholder="再次输入密码" /></div></label>}<div className="auth-form-options"><label><input type="checkbox" checked={form.remember} onChange={(event) => update("remember", event.target.checked)} /><span>记住我</span></label>{mode === "login" && <a href="mailto:support@prompthub.example?subject=PromptHub%20密码重置">无法登录？</a>}</div>{feedback && <div className={`auth-feedback is-${feedback.type}`} aria-live="polite"><b>{feedback.type === "success" ? "✓" : "!"}</b>{feedback.text}</div>}<button className="auth-submit" type="submit" disabled={submitting}>{submitting ? "正在安全验证…" : mode === "login" ? "登录并进入 PromptHub" : "创建账号"}<span>↗</span></button></form>
        <p className="auth-terms">继续即表示你同意 <a href="/legal/terms">用户协议</a>、<a href="/legal/privacy">隐私政策</a>与<a href="/legal/community">社区规范</a>。</p>
      </>}</section>
    </main>
    <footer className="auth-stats"><span><b>先看效果</b> 再看方法</span><i>|</i><span><b>AI 复核</b> 类型与安全</span><i>|</i><span><b>账号隔离</b> 私人收藏与作品</span><i>|</i><span><b>来源透明</b> 尊重原创</span></footer>
  </section>;
}

"use client";

import { useState, type FormEvent } from "react";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setNotice("请输入有效的邮箱地址"); return; }
    setLoading(true); setNotice("");
    try {
      const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "request", email: email.trim() }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "发送失败");
      setNotice("如果该邮箱已注册，我们已发送一封重置邮件，请在 30 分钟内查收。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "发送失败，请稍后再试");
    } finally { setLoading(false); }
  };
  return (
    <main className="fullscreen-page">
      <div style={{ maxWidth: 420, margin: "8vh auto 0", padding: 28, border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}>
        <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>找回密码</h1>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 20px" }}>输入注册邮箱，我们会发送一封重置链接。</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" style={{ padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13 }} />
          <button className="button button--dark" type="submit" disabled={loading}>{loading ? "发送中…" : "发送重置邮件"}</button>
        </form>
        {notice && <p style={{ marginTop: 16, fontSize: 12, color: "var(--teal)" }}>{notice}</p>}
        <p style={{ marginTop: 18, fontSize: 12 }}><a href="/auth">← 返回登录</a></p>
      </div>
    </main>
  );
}

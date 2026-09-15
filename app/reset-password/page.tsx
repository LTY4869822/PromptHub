"use client";

import { useEffect, useState, type FormEvent } from "react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("token") || ""); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) { setNotice("密码至少 10 位，且同时包含字母和数字"); return; }
    if (password !== confirm) { setNotice("两次输入的密码不一致"); return; }
    setLoading(true); setNotice("");
    try {
      const response = await fetch("/api/auth/password-reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "confirm", token, password }) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error || "重置失败");
      setDone(true);
    } catch (error) { setNotice(error instanceof Error ? error.message : "重置失败，请重试"); }
    finally { setLoading(false); }
  };
  if (done) return <main className="fullscreen-page"><div style={{ maxWidth: 420, margin: "8vh auto 0", padding: 28, textAlign: "center" }}><h1 style={{ fontSize: 24 }}>密码已更新</h1><p style={{ color: "var(--muted)", fontSize: 12 }}>现在可以用新密码登录了。</p><a className="button button--dark" href="/auth" style={{ display: "inline-block", marginTop: 16 }}>去登录</a></div></main>;
  return (
    <main className="fullscreen-page">
      <div style={{ maxWidth: 420, margin: "8vh auto 0", padding: 28, border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)" }}>
        <h1 style={{ fontSize: 26, margin: "0 0 8px" }}>设置新密码</h1>
        <p style={{ color: "var(--muted)", fontSize: 12, margin: "0 0 20px" }}>输入新密码完成重置。</p>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="新密码（至少 10 位，含字母和数字）" autoComplete="new-password" style={{ padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13 }} />
          <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} placeholder="再次输入新密码" autoComplete="new-password" style={{ padding: "11px 12px", border: "1px solid var(--line)", borderRadius: 9, fontSize: 13 }} />
          <button className="button button--dark" type="submit" disabled={loading || !token}>{loading ? "提交中…" : "确认重置"}</button>
        </form>
        {notice && <p style={{ marginTop: 16, fontSize: 12, color: "#a95046" }}>{notice}</p>}
      </div>
    </main>
  );
}

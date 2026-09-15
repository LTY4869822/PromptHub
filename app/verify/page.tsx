"use client";

import { useEffect, useState } from "react";

export default function VerifyPage() {
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token") || "";
    if (!token) { setState("error"); setMessage("缺少验证令牌"); return; }
    fetch("/api/auth/verify-email/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) })
      .then((response) => response.json().catch(() => ({})))
      .then((data: { ok?: boolean; error?: string }) => { if (data.ok) { setState("success"); setMessage("邮箱验证成功"); } else { setState("error"); setMessage(data.error || "验证失败"); } })
      .catch(() => { setState("error"); setMessage("验证失败，请重试"); });
  }, []);
  return (
    <main className="fullscreen-page">
      <div style={{ maxWidth: 420, margin: "8vh auto 0", padding: 28, textAlign: "center" }}>
        <h1 style={{ fontSize: 24, margin: "0 0 12px" }}>{state === "loading" ? "正在验证…" : state === "success" ? "验证成功" : "验证失败"}</h1>
        <p style={{ color: "var(--muted)", fontSize: 13 }}>{message}</p>
        <a className="button button--dark" href="/" style={{ display: "inline-block", marginTop: 18 }}>返回灵感广场</a>
      </div>
    </main>
  );
}

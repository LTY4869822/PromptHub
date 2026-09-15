"use client";

import { useEffect, useState } from "react";

type SessionUser = { id: string; email: string; nickname: string; role: "member" | "admin" };

export default function AuthStatus() {
  const [user, setUser] = useState<SessionUser | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 6000);
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((data) => setUser(data?.user || null)).catch(() => setUser(null));
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, []);
  if (!user) return <a className="auth-entry" href="/auth">登录 / 注册</a>;
  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.sessionStorage.removeItem("prompthub-session-verified-at");
    window.location.assign("/auth");
  };
  return <div className="auth-status-wrap">{user.role === "admin" && <a className="admin-entry" href="/admin">管理后台</a>}<button className="auth-entry auth-entry--signed" type="button" title={user.email} onClick={logout}><span>{user.nickname}</span><b>退出</b></button></div>;
}

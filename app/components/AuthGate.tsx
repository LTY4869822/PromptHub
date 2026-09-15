"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const publicRoutes = ["/auth", "/legal", "/verify", "/forgot", "/reset-password"];
const SESSION_CACHE_KEY = "prompthub-session-verified-at";
const SESSION_CACHE_MS = 5 * 60 * 1000;

function hasRecentSession() {
  return Date.now() - Number(window.sessionStorage.getItem(SESSION_CACHE_KEY) || 0) < SESSION_CACHE_MS;
}

export default function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = publicRoutes.some((route) => pathname === route || pathname.startsWith(`${route}/`));

  useEffect(() => {
    if (isPublic || hasRecentSession()) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 8000);
    fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin", signal: controller.signal })
      .then((response) => {
        if (response.ok) window.sessionStorage.setItem(SESSION_CACHE_KEY, String(Date.now()));
        else if (response.status === 401) {
          window.sessionStorage.removeItem(SESSION_CACHE_KEY);
          window.location.replace(`/auth?returnTo=${encodeURIComponent(`${pathname}${window.location.search}`)}`);
        }
      })
      .catch(() => { window.sessionStorage.setItem(SESSION_CACHE_KEY, String(Date.now())); });
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [isPublic, pathname]);

  return <div className="route-surface">{children}</div>;
}

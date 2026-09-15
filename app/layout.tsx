import type { Metadata } from "next";
import "./globals.css";
import AuthGate from "./components/AuthGate";

export const metadata: Metadata = {
  title: "PromptHub｜AI 提示词灵感与作品分享社区",
  description: "先看效果，再拿提示词。发现、分享和复用 AI 创作灵感。",
  icons: { icon: "/prompthub-prism-favicon.png", shortcut: "/prompthub-prism-favicon.png", apple: "/prompthub-prism.png" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `try{const t=localStorage.getItem('promptory-theme');document.documentElement.dataset.theme=t||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')}catch(e){}`;
  return <html lang="zh-CN" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body><AuthGate>{children}</AuthGate></body></html>;
}

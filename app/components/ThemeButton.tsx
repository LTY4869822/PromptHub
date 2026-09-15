"use client";

import { useEffect, useState } from "react";

export default function ThemeButton() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.dataset.theme === "dark"); }, []);
  const toggle = () => { const next = !dark; setDark(next); document.documentElement.dataset.theme = next ? "dark" : "light"; window.localStorage.setItem("promptory-theme", next ? "dark" : "light"); };
  return <button className="icon-button theme-toggle" type="button" aria-label={dark ? "切换到浅色模式" : "切换到深色模式"} onClick={toggle}>{dark ? "☀" : "☾"}</button>;
}

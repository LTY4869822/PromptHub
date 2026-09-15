"use client";

import { useEffect, useMemo, useState } from "react";
import { PromptoryShell } from "../components/PromptoryShell";

type SessionUser = { id: string; email: string; nickname: string; role: "member" | "admin" };

export default function AccountPage() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((data) => setUser(data?.user || null)).catch(() => undefined);
  }, []);

  const passwordChecks = useMemo(() => [
    { label: "至少 10 位", passed: newPassword.length >= 10 },
    { label: "包含字母", passed: /[A-Za-z]/.test(newPassword) },
    { label: "包含数字", passed: /\d/.test(newPassword) },
  ], [newPassword]);
  const passwordReady = passwordChecks.every((item) => item.passed) && newPassword === confirmPassword && Boolean(currentPassword);

  const changePassword = async () => {
    if (!passwordReady) { setNotice({ type: "error", text: newPassword !== confirmPassword ? "两次输入的新密码不一致" : "请完成所有密码要求" }); return; }
    setSaving(true); setNotice(null);
    const response = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setSaving(false); setNotice({ type: "error", text: data.error || "密码修改失败" }); return; }
    window.location.assign("/auth?passwordChanged=1");
  };

  const deleteAccount = async () => {
    if (!deletePassword) { setNotice({ type: "error", text: "请输入当前密码确认注销" }); return; }
    setSaving(true); setNotice(null);
    const response = await fetch("/api/account", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
    const data = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) { setSaving(false); setNotice({ type: "error", text: data.error || "账号注销失败" }); return; }
    window.location.assign("/auth?accountDeleted=1");
  };

  return <PromptoryShell active="account">
    <div className="content-wrap account-page account-center">
      <header className="account-heading">
        <div><p className="eyebrow">ACCOUNT CENTER</p><h1>账号与安全<span className="heading-dot">.</span></h1><p>查看登录身份，管理密码与个人数据。</p></div>
        <div className="account-trust"><span>✓</span><div><strong>账号保护已开启</strong><small>服务端会话 · 数据隔离 · 操作留痕</small></div></div>
      </header>

      <section className="account-overview" aria-label="当前账号">
        <div className="account-avatar">{Array.from(user?.nickname || "你").slice(0, 2).join("")}</div>
        <div className="account-identity"><span>CURRENT ACCOUNT</span><h2>{user?.nickname || "正在读取账号…"}</h2><p>{user?.email || "身份信息加载中"}</p></div>
        <div className="account-badges"><span>{user?.role === "admin" ? "管理员" : "普通成员"}</span><span className="is-safe"><i /> 状态正常</span></div>
        <a className="account-profile-link" href="/published">编辑公开资料 <b>↗</b></a>
      </section>

      <div className="account-layout">
        <main className="account-primary">
          <section className="account-panel security-panel">
            <div className="account-panel-head"><div className="account-panel-icon">01</div><div><span>LOGIN SECURITY</span><h2>修改登录密码</h2><p>修改后会退出包括当前设备在内的全部登录会话。</p></div></div>
            <div className="account-password-form">
              <label className="account-field"><span>当前密码</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="输入当前登录密码" /></label>
              <div className="account-field-row"><label className="account-field"><span>新密码</span><input type="password" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="设置新的登录密码" /></label><label className="account-field"><span>确认新密码</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="再次输入新密码" /></label></div>
              <div className="password-requirements" aria-live="polite">{passwordChecks.map((item) => <span className={item.passed ? "passed" : ""} key={item.label}><i>{item.passed ? "✓" : "·"}</i>{item.label}</span>)}<span className={confirmPassword && newPassword === confirmPassword ? "passed" : ""}><i>{confirmPassword && newPassword === confirmPassword ? "✓" : "·"}</i>两次输入一致</span></div>
              <div className="account-form-actions"><small>为了安全，PromptHub 不会通过邮件展示或发送你的原密码。</small><button type="button" className="button button--dark" disabled={!passwordReady || saving} onClick={changePassword}>{saving ? "正在保存…" : "更新密码"}</button></div>
            </div>
          </section>
        </main>

        <aside className="account-secondary">
          <section className="account-panel data-panel">
            <div className="account-panel-icon">02</div><span>YOUR DATA</span><h2>下载数据副本</h2><p>导出账号资料、发布作品、收藏、关注和评论记录。文件为可读的 JSON 格式。</p>
            <ul><li><i>✓</i>仅当前登录账号可下载</li><li><i>✓</i>实时生成，不创建公开链接</li></ul>
            <a className="account-download" href="/api/account"><span>↓</span><div><strong>导出我的数据</strong><small>JSON · 立即生成</small></div><b>↗</b></a>
          </section>
          <nav className="account-help" aria-label="隐私帮助"><a href="/legal/privacy"><span>隐私政策</span><b>↗</b></a><a href="/legal/account"><span>数据与注销说明</span><b>↗</b></a></nav>
        </aside>
      </div>

      <section className="account-danger-zone">
        <div><span>DANGER ZONE</span><h2>永久注销账号</h2><p>仅当你确定不再使用 PromptHub 时操作。作品会下架，个人资料会匿名化。</p></div>
        <button type="button" onClick={() => setDeleteOpen(true)}>申请注销账号</button>
      </section>

      {deleteOpen && <div className="modal-layer account-delete-layer" role="dialog" aria-modal="true" aria-labelledby="delete-account-title" onMouseDown={(event) => event.target === event.currentTarget && setDeleteOpen(false)}><div className="account-delete-modal"><button className="account-modal-close" aria-label="关闭" onClick={() => setDeleteOpen(false)}>×</button><div className="delete-symbol">!</div><span>IRREVERSIBLE ACTION</span><h2 id="delete-account-title">确认永久注销账号？</h2><p>注销后无法恢复。你的公开作品将被下架，头像、主页背景和上传媒体会被清理，账号资料会被匿名化。</p><div className="delete-checklist"><span>账号将立即退出所有设备</span><span>管理员账号不能在此注销</span></div><label className="account-field"><span>输入当前密码以确认</span><input autoFocus type="password" autoComplete="current-password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} placeholder="当前登录密码" /></label><div className="account-modal-actions"><button className="button button--light" onClick={() => { setDeleteOpen(false); setDeletePassword(""); }}>取消</button><button className="button button--danger" disabled={!deletePassword || saving} onClick={deleteAccount}>{saving ? "正在处理…" : "确认永久注销"}</button></div></div></div>}
      {notice && <div className={`toast account-toast is-${notice.type}`} role="status"><span>{notice.type === "success" ? "✓" : "!"}</span>{notice.text}</div>}
    </div>
  </PromptoryShell>;
}

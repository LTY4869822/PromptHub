# PromptHub

PromptHub 是一个以“先看效果，再看提示词”为核心的提示词分享社区。用户可以发布提示词、生成工具、来源和图片/视频展示素材；其他用户通过封面进入详情页后查看完整方法。

## 技术结构

- vinext + React 19
- Cloudflare D1：用户、会话、作品、互动、举报与审计记录
- Cloudflare R2：图片、视频、头像和主页封面
- HttpOnly Cookie 会话、PBKDF2-SHA256 密码派生、服务端 RBAC
- OpenAI 文本分类与内容审核；图片封面使用多模态审核

## 本地运行

```bash
npm install
npm run dev
```

本地地址默认为 `http://localhost:5190`。localhost 会自动初始化一个仅供本机预览的管理员：

- 邮箱：`admin@prompthub.local`
- 密码：`PromptHub.Admin#2026`

该默认账号只会在请求域名是 localhost/127.0.0.1 时创建，不能用于线上域名。

## 生产环境必填配置

复制 `.env.example` 中的变量到部署平台的加密 Secret：

```text
OPENAI_API_KEY=正式审核密钥
OPENAI_REVIEW_MODEL=gpt-4o-mini
PROMPTHUB_ADMIN_EMAIL=真实管理员邮箱
PROMPTHUB_ADMIN_PASSWORD=至少 12 位的随机强密码
PROMPTHUB_ADMIN_NICKNAME=PromptHub 管理员
```

不要提交 `.env` 或 `.dev.vars`。生产环境未配置 OpenAI 审核时会安全失败并暂停注册、发布和资料修改；未配置管理员凭据时不会生成默认管理员。

## 数据库与构建

```bash
npm run db:generate
npx tsc --noEmit
npm test
```

正式迁移位于 `drizzle/`。本地预览包含兼容建表逻辑，生产数据库应以迁移为准。

## 内容治理

- 图片作品：文本和封面审核通过后公开。
- 视频作品：文本和封面先自动审核，线上提交后进入 `pending`，由管理员完整查看视频后通过或拒绝。
- 管理员可处理举报、隐藏/恢复内容、封禁/解禁普通用户，并查看审计日志。
- 热门榜只统计近 30 天内、AI 审核通过且达到最低互动门槛的作品，并按时间衰减。

## 发布前仍需外部配置

- 将法律页面中的 `.example` 联系邮箱替换为真实客服、隐私和版权邮箱。
- 接入邮件服务后实现邮箱验证与忘记密码邮件；当前用户可在登录后修改密码。
- 如需自动审核完整视频，接入视频转码/帧抽取服务；当前采用管理员人工复核，避免未经检查的视频直接公开。
- 配置错误监控、产品分析、备份、域名和生产密钥轮换策略。

import { BrandMark, BrandName } from "../../components/PromptoryShell";

const pages: Record<string, { title: string; updated: string; sections: Array<[string, string]> }> = {
  terms: { title: "PromptHub 用户协议", updated: "2026 年 8 月 14 日", sections: [["服务说明", "PromptHub 提供提示词、展示素材、来源信息与创作经验的发布和交流服务。用户应对自己提交内容的真实性、授权状态和合法性负责。"], ["账号与安全", "请使用真实可联系的邮箱注册并妥善保管密码。不得出借账号、批量注册、绕过限流或干扰平台服务。"], ["内容授权", "你保留原创内容的权利，同时授予平台为提供展示、分发、审核、备份和技术处理所必需的非独占许可。转载或整理内容必须标明来源并取得所需授权。"], ["内容处置", "平台可依据社区规范对涉嫌侵权、违法或不安全内容进行限制展示、隐藏、删除或保全证据，并提供申诉渠道。"], ["终止与申诉", "你可申请注销账号。被限制使用时可通过版权与申诉页面提交证据，平台会结合内容和操作日志复核。"]] },
  privacy: { title: "PromptHub 隐私政策", updated: "2026 年 8 月 14 日", sections: [["我们收集的信息", "为提供账号和社区服务，我们处理邮箱、昵称、个人资料、发布内容、上传媒体、互动记录、设备与安全日志。生日和城市为可选资料。"], ["使用目的", "信息用于登录验证、作品展示、收藏关注、内容审核、安全风控、举报处理、数据备份和服务改进。"], ["存储与保护", "密码经加盐密钥派生后保存；登录使用 HttpOnly 会话 Cookie。媒体与业务数据分开存储，并通过权限校验、限流和审计日志降低滥用风险。"], ["你的权利", "你可编辑资料和作品、删除作品、导出个人数据或申请注销账号。部分安全与合规日志可能在法定或必要期限内保留。"], ["第三方服务", "AI 审核和基础设施提供商可能按服务所需处理提交内容。平台仅发送完成审核和托管所需的数据，并要求相应的安全措施。"]] },
  community: { title: "PromptHub 社区规范", updated: "2026 年 8 月 14 日", sections: [["尊重原创", "转载提示词、截图或视频时必须说明平台、原作者与原作链接；不得冒充原创、移除水印或伪造授权。"], ["安全底线", "禁止色情及未成年人性内容、血腥暴力、仇恨威胁、自残指导、违法犯罪教程、欺诈、恶意软件和绕过安全机制的内容。"], ["真实描述", "提示词类型由 AI 根据实际文本复核；展示素材类型由文件自动识别。不得用无关封面、虚假参数或误导性标题骗取互动。"], ["友善互动", "禁止骚扰、人肉搜索、歧视、刷赞刷收藏、垃圾评论和恶意举报。"], ["处理与申诉", "违规内容可能被隐藏或删除，账号可能被暂停。管理员操作会记录审计日志，用户可提交补充证据申请复核。"]] },
  copyright: { title: "版权投诉与申诉", updated: "2026 年 8 月 14 日", sections: [["提交材料", "请提供权利人姓名与联系方式、原作品证明、涉嫌侵权链接、具体权利主张以及诚信声明。"], ["处理流程", "平台收到完整材料后会登记举报，必要时先限制内容展示，再联系上传者补充授权证明。"], ["反通知", "上传者可提交原创过程、授权文件、发布日期或其他能够证明合法使用的材料。"], ["联系入口", "公测期间请发送至 copyright@prompthub.example。正式部署前需替换为可用的运营邮箱和主体信息。"]] },
  account: { title: "账号数据与注销", updated: "2026 年 8 月 14 日", sections: [["数据导出", "你可以申请导出账号资料、已发布作品、收藏与互动记录。公测阶段由支持团队在验证身份后提供。"], ["账号注销", "注销会停止账号登录并下架个人公开内容。出于纠纷处理、安全与法定义务，部分记录可能在必要期限内保留。"], ["申请方式", "请使用注册邮箱发送至 privacy@prompthub.example，并注明“数据导出”或“账号注销”。正式上线前需配置工单系统或自助流程。"]] },
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> | { slug: string } }) {
  const resolved = await params; const page = pages[resolved.slug] || pages.terms;
  return <div className="legal-page"><header><a href="/" className="legal-brand"><BrandMark /><BrandName /></a><a href="/">返回 PromptHub</a></header><main><p className="eyebrow">PROMPTHUB / TRUST CENTER</p><h1>{page.title}</h1><span>更新日期：{page.updated}</span>{page.sections.map(([title, body]) => <section key={title}><h2>{title}</h2><p>{body}</p></section>)}<nav><a href="/legal/terms">用户协议</a><a href="/legal/privacy">隐私政策</a><a href="/legal/community">社区规范</a><a href="/legal/copyright">版权投诉</a><a href="/legal/account">数据与注销</a></nav></main></div>;
}


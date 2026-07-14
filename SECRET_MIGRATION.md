# 密钥迁移指南

> **重要安全提醒**：本次提交之前 `wrangler.toml` 中明文存储了 6 个生产密钥。
> 这些密钥已经被 git 历史记录，即使现在从 `wrangler.toml` 删除也无法撤销。
> **请立即到对应平台轮换这些密钥**。

## 🔴 已被泄露的密钥清单

| 密钥 | 位置 | 影响范围 | 轮换地址 |
|---|---|---|---|
| `JWT_SECRET` | `wrangler.toml:35` | 所有用户 token 失效（强制重新登录） | Cloudflare Pages → 设置 → 变量与机密 → 重新生成 |
| `RESEND_API_KEY` | `wrangler.toml:36` | 邮件验证码功能 | https://resend.com/api-keys → Revoke + 新建 |
| `LINUXDO_CLIENT_SECRET` | `wrangler.toml:39` | Linux.do OAuth 登录 | Linux.do OAuth 控制台 → 重置 |
| `GITEE_CLIENT_SECRET` | `wrangler.toml:46` | Gitee OAuth 登录 | https://gitee.com/oauth/applications → 重置 |
| `GITHUB_CLIENT_SECRET` | `wrangler.toml:50` | GitHub OAuth 登录 | https://github.com/settings/developers → Regenerate |
| `QQ_CLIENT_SECRET` | 之前泄露过 | QQ OAuth 登录 | QQ 互联控制台 → 重置 |
| Pollinations Bearer | `vite.config.ts:274` (已修) | 文生图配额被盗用 | https://auth.pollinations.ai → 重新生成 |

## ✅ 当前正确做法

### 1. 本地开发（已自动 .gitignore）

复制 `.dev.vars.example` 为 `.dev.vars`，填入真实密钥：

```bash
cp .dev.vars.example .dev.vars
# 编辑 .dev.vars，填入真实密钥
```

`.dev.vars` 已经 gitignore，不会被提交。

### 2. Cloudflare Pages 生产环境

1. 打开 Cloudflare Dashboard → Pages → 你的项目 → 设置 → 变量和机密
2. 在"机密"区域（不是"变量"！）添加以下键：

```
JWT_SECRET                = <生产值>
RESEND_API_KEY            = <生产值>
LINUXDO_CLIENT_SECRET     = <生产值>
GITEE_CLIENT_SECRET       = <生产值>
GITHUB_CLIENT_SECRET      = <生产值>
QQ_CLIENT_SECRET          = <生产值>
```

3. 可公开的 OAuth `*_CLIENT_ID` / `*_REDIRECT_URI` / `RESEND_FROM_EMAIL` 可继续在 `wrangler.toml` 的 `[vars]` 段保存（占位符 `PLACEHOLDER_REPLACE_VIA_CF_DASHBOARD` 在生产会自动被 Dashboard 的机密覆盖）

### 3. 验证

部署后：
```bash
# 查看生产环境是否正确读取机密（应返回占位符之外的值）
npx wrangler pages secret list --project-name=<your-project>
```

## 📋 轮换后必须做的事

- [ ] 通知所有用户"由于安全升级需要重新登录"（JWT_SECRET 轮换会作废所有 token）
- [ ] 部署新代码（确保 `wrangler.toml` 占位符生效）
- [ ] 在 Cloudflare Dashboard 设置机密
- [ ] 删除 `.dev.vars` 中的旧真实值，重新填入轮换后的值
- [ ] `git log -- wrangler.toml` 检查是否还有其他历史泄露，必要时清理 git history
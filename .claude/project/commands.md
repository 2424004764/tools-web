---
description: 项目命令与构建部署相关
---

## 命令

```bash
# 开发
pnpm dev              # 启动开发服务器
pnpm dev:wrangler     # 启动本地 wrangler 测试函数

# 构建
pnpm build            # 开发构建（SEO 禁用）
pnpm build:pro        # 生产构建（SEO 启用，自动同步 functions/ + 配置到 dist/）
pnpm sync:functions   # 仅同步 functions/、wrangler.toml、robots.txt、sitemap.xml 到 dist/

# 预览
pnpm preview          # 预览生产构建

# 本地函数测试
wrangler pages dev .  # 本地测试 Cloudflare Functions
```

## 构建与部署说明

- `pnpm build:pro` 会自动调用 `pnpm sync:functions`，把 `functions/`、`wrangler.toml`、`robots.txt`、`sitemap.xml` 同步到 `dist/`（脚本：`scripts/sync-functions.mjs`，跨平台）
- 若已 build 过、只想再同步一次，跑 `pnpm sync:functions`
- SEO 构建需在 `.env.production` 中设置 `NODE_ENV=production`
- `/dist` 目录部署到 Cloudflare Pages（push 后由 CI/CD 触发）

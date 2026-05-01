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
pnpm build:pro        # 生产构建（SEO 启用）

# 预览
pnpm preview          # 预览生产构建

# 本地函数测试
wrangler pages dev .  # 本地测试 Cloudflare Functions
```

## 构建与部署说明

- **Windows 构建：** `pnpm build && xcopy /E /I /H /Y .\functions\* .\dist\functions\ && xcopy /Y .\wrangler.toml .\dist\ && xcopy /Y .\robots.txt .\dist\ && xcopy /Y .\sitemap.xml .\dist\`
- **Linux 构建：** `pnpm build && cp -r ./functions/* ./dist/functions/ && cp ./wrangler.toml ./dist/ && cp ./robots.txt ./dist/ && cp ./sitemap.xml ./dist/`
- SEO 构建需在 `.env.production` 中设置 `NODE_ENV=production`
- `/dist` 目录部署到 Cloudflare Pages

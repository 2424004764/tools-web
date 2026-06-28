# CLAUDE.md

本项目指南，供 Claude Code 在处理仓库代码时使用。

## 项目概述

Tools-Web 是一个基于 Vue 3 + TypeScript + Vite 的在线工具箱应用。提供 100+ 个工具，涵盖开发、文本处理、图片处理、数据可视化、游戏、AI 工具等多个分类。

**技术栈：** Vue 3（Composition API）、TypeScript、Vite、Element Plus、Tailwind CSS、Pinia、Vue Router

**部署：** Cloudflare Pages + D1 数据库，Cloudflare Workers 无服务器函数

## ⚠️ 关键约束（必须遵守）

### Cloudflare Functions 路由注册

本项目使用 Cloudflare Pages Functions 部署后端 API。**新增任何 API 接口必须在 `functions/_routes.json` 的 `include` 数组中注册路由**，否则生产环境部署后该接口会被静态资源拦截，返回 404。

**路由规则：**
- 文件路径 `functions/api/foo.js` → 对应路由 `/api/foo`
- 文件路径 `functions/api/foo/[id].js` → 对应路由 `/api/foo/:id`
- 文件路径 `functions/api/foo/[[path]].js` → 对应路由 `/api/foo/*`（通配）
- **`_routes.json` 中必须同时列出精确路径和带 `/*` 的通配路径**

**示例：** 新增 `functions/api/favorite-apps.js`，必须同时添加：
```json
"/api/favorite-apps",
"/api/favorite-apps/*"
```

**部署前自检清单：**
1. ✅ API 文件已创建于 `functions/api/`
2. ✅ 已在 `functions/_routes.json` 的 `include` 中添加对应路径
3. ✅ 已同步 `dist/functions/_routes.json`（生产部署会读 dist 目录）
4. ✅ 已同步 `dist/functions/api/` 下的新 API 文件
5. ✅ 数据库迁移 SQL 已执行（线上：`--remote`）
6. ✅ **已在 `vite.config.ts` 的 `server.proxy` 中添加同名路径代理**（指向 `http://127.0.0.1:8788`），否则 `pnpm dev` 下前端调用该 API 会 404

> 现有代理路径参考：/api/agnes-chat、/api/ai-apps、/api/letters、/api/ai-apps 等都在 `vite.config.ts` 的 `server.proxy` 中。

### 本地开发注意事项

### 本地开发注意事项

- `pnpm dev` 仅启动 Vite（端口 5173），**不加载 Cloudflare Functions**
- 测试 API 必须使用 `pnpm dev:wrangler`（端口 8788），访问 `http://127.0.0.1:8788/`
- 修改 `_routes.json` 后如遇 404，重启 wrangler 即可（缓存目录 `.wrangler` 在 Windows 上可能无法直接删除，但重启会自动刷新函数扫描）

## 快速导航

- [命令与构建](.claude/project/commands.md) — 开发命令、构建与部署
- [目录结构](.claude/project/structure.md) — 项目文件结构
- [添加新工具](.claude/project/new-tool.md) — 创建新工具的完整步骤
- [架构详情](.claude/project/architecture.md) — 状态管理、HTTP、AI、Supabase、D1、Functions
- [编码规范](.claude/project/coding-conventions.md) — 编码规范、核心原则、UI 指南
- [环境变量](.claude/project/env.md) — 环境变量说明
- [通用模式与 SEO](.claude/project/patterns.md) — 工具组件结构、SEO 要求、布局组件

---
description: 状态管理、HTTP 请求、AI 提供者、Supabase、D1 数据库、Cloudflare Functions 等架构详情
---

## 状态管理（Pinia）

- **`useComponentStore`**：左侧边栏可见性、分类筛选
- **`useToolsStore`**：工具数据、搜索、收藏
- **`useUserStore`**：用户认证、个人资料

## HTTP 请求模式

- **外部 API**：使用 `src/utils/request.ts`（axios 实例）
- **Cloudflare Functions**：使用 `src/utils/functionsRequest.ts` - 自动从 localStorage 添加 Bearer 令牌
- **Functions 代理**：通过 `VITE_SITE_URL` 环境变量路由

## AI 提供者（`src/spi/`）

抽象化的 AI 服务层，支持多个提供者：
- **Pollinations**：免费 AI 图像生成、对话
- **AiTools**：AI 工具目录

添加新提供者需在 `src/spi/common/interfaces.ts` 中实现 `AIProvider` 接口

## Supabase 集成

用于实时功能（临时聊天室）。配置：
```env
VITE_SUPABASE_URL='https://your-project.supabase.co'
VITE_SUPABASE_ANON_KEY='your-anon-key'
```

## Cloudflare D1 数据库

所有 D1 操作在 `functions/services/` 中。共享代码应提取到 `functions/utils/` 以避免重复。

## Cloudflare Functions 与定时任务

Functions 放在 `functions/` 目录下，自动映射到路由：
- `functions/api/xxx.js` → `/api/xxx`
- `functions/cron/xxx.js` → `/cron/xxx`
- `functions/xxx.js` → `/xxx`

**重要**：添加新的 Function 或定时任务时，必须在 `functions/_routes.json` 的 `include` 数组中添加对应路由，否则会返回首页 HTML。

示例：
```json
{
  "version": 1,
  "include": [
    "/cron/your-cron-job"
  ],
  "exclude": []
}
```

定时任务配合 GitHub Actions 使用，见 `.github/workflows/`。

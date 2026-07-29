---
description: 添加新工具的完整步骤
---

## 添加新工具

**双注册**：前端 `src/components/Tools/tools.ts` + 数据库 `tool_features` 表（写 migration），缺一不可。

1. **`tools.ts`** - `getToolsCate()` 对应分类的 list 里加条目
2. **数据库** - 写 migration(`migrations/031_xxx.sql`) INSERT 到 `tool_features`，用 `ON CONFLICT(url) DO UPDATE SET` 幂等
3. **执行**：本地 `wrangler d1 execute yifang-tool --local --file=...`，线上加 `--remote`
4. **`src/router/router.ts`** - 添加路由
5. **创建组件** - 复制 Example/ 并改名为你的工具名
6. **`sitemap.xml`** - 注册新工具页面
7. **`README.md`** - 更新功能日志

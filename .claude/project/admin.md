# 后台管理系统（Admin Module）

后台管理模块：用户管理、积分系统、工具功能开关。

## 访问入口

- 仅 `is_admin = 1` 的用户可见 Header 用户菜单中的「管理后台」入口
- 路由：`/admin`、`/admin/dashboard`、`/admin/users`、`/admin/credits`、`/admin/tools`
- 前端守卫：`src/router/index.ts:50-65`
- 后端二次鉴权：`functions/api/admin/_middleware.js`

## 首任管理员设置

仓库没有首任管理员引导，通过直接修改 D1 设置：

```bash
# 本地
wrangler d1 execute yifang-tool --local --command="UPDATE user SET is_admin = 1 WHERE email = 'your@email.com'"

# 远程（生产）
wrangler d1 execute yifang-tool --remote --command="UPDATE user SET is_admin = 1 WHERE email = 'your@email.com'"
```

设置后**重新登录**即可生效（JWT 内 is_admin 字段需重签）。

## 数据库迁移

按编号顺序执行 5 个新迁移文件：

| 编号 | 文件 | 内容 |
|---|---|---|
| 026 | `functions/db/026_create_user_credits.sql` | 用户积分主表 |
| 027 | `functions/db/027_create_credit_transactions.sql` | 积分流水表 |
| 028 | `functions/db/028_create_tool_features.sql` | 工具功能开关表 |
| 029 | `functions/db/029_alter_user_add_disabled.sql` | user 加 is_disabled 字段 |
| 030 | `functions/db/030_seed_tool_features.sql` | 139 个工具初始数据 |

### 重新生成 seed 数据

当 `src/components/Tools/tools.ts` 增删工具后，重新生成 030：

```bash
node scripts/seed-tool-features.mjs
```

### 执行迁移

```bash
# 本地（5 个文件）
for f in 026_create_user_credits.sql 027_create_credit_transactions.sql 028_create_tool_features.sql 029_alter_user_add_disabled.sql 030_seed_tool_features.sql; do
  wrangler d1 execute yifang-tool --local --file=functions/db/$f
done

# 远程（部署前）
for f in 026_create_user_credits.sql 027_create_credit_transactions.sql 028_create_tool_features.sql 029_alter_user_add_disabled.sql 030_seed_tool_features.sql; do
  wrangler d1 execute yifang-tool --remote --file=functions/db/$f
done
```

## 后端 API 列表

### 鉴权约定

- 所有 `/api/admin/*` 路径必须登录且 `is_admin = 1`
- `_middleware.js` 统一校验；下游 handler 无需再做权限检查
- 401 = 未登录，403 = 无管理员权限

### 用户管理

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/users?page&pageSize&keyword&disabled` | 用户分页列表（含积分） |
| GET | `/api/admin/users/:uid` | 用户详情 + 积分 + 最近 10 条流水 |
| PUT | `/api/admin/users/:uid` | 更新 username/avatar |
| POST | `/api/admin/users/:uid/toggle-disabled` | 启用/禁用（不能禁自己/其他管理员） |

### 积分管理

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/admin/users/:uid/credits` | 赠送/扣减（事务保证原子性） |
| GET | `/api/admin/users/:uid/credits/logs?page&pageSize&type` | 单用户流水 |
| GET | `/api/admin/credits/transactions?page&pageSize&type&keyword&operatorUid` | 全局流水 |

### 工具开关

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/tools?page&pageSize&categoryId&enabled&keyword` | 工具列表（含分类聚合） |
| PUT | `/api/admin/tools/:id` | 更新 is_enabled/sort_order/description/title |
| POST | `/api/admin/tools/batch-toggle` | 批量启停（body: `{ ids, is_enabled }`） |

### 仪表盘

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/dashboard` | 统计卡片 + 最近 10 条流水 |

### 公开 API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/tools` | 返回启用中的工具列表（前台消费） |

## 积分事务说明

`POST /api/admin/users/:uid/credits` 用 D1 `db.batch()` 实现事务：

- **grant**：INSERT ... ON CONFLICT(uid) DO UPDATE SET balance, total_earned + 插入流水记录
- **deduct**：UPDATE ... WHERE balance >= amount（影响行=0 表示余额不足）+ 插入流水记录

若 deduct 的 UPDATE 影响 0 行，前端会收到 `400 扣减失败：余额不足或积分记录不存在`。

## 前端结构

```
src/
├── components/Admin/
│   ├── AdminLayout.vue       # 主布局（侧栏 + 内容）
│   ├── AdminSidebar.vue      # 侧栏菜单
│   ├── AdminDashboard.vue    # 仪表盘
│   ├── AdminUsers.vue        # 用户列表 + 积分调整 + 启用/禁用
│   ├── AdminCredits.vue      # 全局积分流水
│   └── AdminTools.vue        # 工具开关
├── api/admin/                # 全部用 functionsRequest
│   ├── user.ts
│   ├── credit.ts
│   ├── tool.ts
│   └── dashboard.ts
├── store/modules/admin.ts    # 侧栏折叠状态
├── types/admin.d.ts          # 共享 TS 类型
└── router/router.ts          # /admin 路由
```

## 部署清单

部署到生产前必须同步：

1. ✅ `functions/_routes.json` 已加 `/api/admin`、`/api/admin/*`、`/api/tools`
2. ✅ 远程 D1 已执行 5 个迁移
3. ✅ `dist/functions/_routes.json` 与 `dist/functions/api/admin/` 已同步

部署命令（参考 CLAUDE.md）：

```bash
pnpm build:pro
# 等价于 pnpm build + pnpm sync:functions（同步 functions/、wrangler.toml、robots.txt、sitemap.xml 到 dist/）
```

## 扩展点

- 接入 AI 调用扣费：在 `functions/api/ai-proxy.js` 中加积分检查/扣减逻辑
- 工具可见性：在 `tool_features` 表新增 `is_visible`、`requires_auth`、`min_credits` 等字段
- 多级管理员：新增 `user_role` 字段，扩展 `_middleware.js` 鉴权
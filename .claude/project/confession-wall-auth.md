---
description: 匿名告白墙的认证架构与管理员判断逻辑
---

# 匿名告白墙 · 认证 & 管理员判断

本文档说明 **匿名告白墙**（`/confession-wall/`）如何进行用户认证、管理员判断以及数据流。

---

## 一、整体架构

告白墙涉及 **两套存储** 和 **一套认证**：

```
┌──────────────────────────────────────────────────────────────────┐
│                         浏览器（前端）                             │
│  - Vue 3 组件（ConfessionWall.vue）                                │
│  - 数据：supabase-js（直连 Supabase REST/WS，anon key）           │
│  - 管理：functionsRequest（POST /api/confession/groups/*，带 JWT） │
│  - 认证：从 localStorage 读 TOKEN，解 JWT 拿 is_admin             │
└──────────────────────────────────────────────────────────────────┘
                  │                                  │
       ┌──────────┘                                  └──────────┐
       │ anon 操作                                          │ 鉴权操作
       ▼                                                      ▼
┌──────────────────────┐                          ┌──────────────────────┐
│      Supabase        │                          │ Cloudflare Functions  │
│                      │                          │                       │
│  confession_messages │                          │  /api/confession/     │
│  confession_reactions│                          │     groups/create     │
│  confession_groups   │                          │  /api/confession/     │
│  (anon 读 + 受控写)  │                          │     groups/delete     │
└──────────────────────┘                          └──────────────────────┘
                                                              │
                                                              │ 1. 校验 JWT
                                                              │ 2. 查 D1 user.is_admin
                                                              │ 3. 用 service_role 写 Supabase
                                                              ▼
                                                    ┌──────────────────────┐
                                                    │   Cloudflare D1      │
                                                    │                      │
                                                    │  user 表（含         │
                                                    │   is_admin 字段）    │
                                                    └──────────────────────┘
```

---

## 二、管理员判断的核心：user.is_admin

**真理来源（Single Source of Truth）：Cloudflare D1 的 `user.is_admin` 字段。**

### 字段定义

```sql
-- functions/db/020_add_user_is_admin.sql
ALTER TABLE user ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_user_is_admin ON user(is_admin);
```

- `is_admin = 0`：普通用户
- `is_admin = 1`：管理员

### 字段如何填入

登录后端在生成 JWT 时把 `is_admin` 嵌入 payload：

```js
// functions/api/email-login.js:53
const token = await generateJWT(
  {
    uid: user.id,
    email: user.email,
    username: user.username,
    avatar: user.avatar || '',
    is_admin: user.is_admin ? 1 : 0   // ← 关键
  },
  env.JWT_SECRET
)
```

### 如何把某人设为管理员

直接更新 D1：

```bash
# 用 wrangler 执行
wrangler d1 execute tools-web-db --command \
  "UPDATE user SET is_admin = 1 WHERE email = 'your-email@example.com'"
```

或登录 Cloudflare 控制台 → D1 → SQL Editor：

```sql
UPDATE user SET is_admin = 1 WHERE email = 'your-email@example.com';
```

前端 JWT 重新签发后即生效（用户重新登录即可）。

---

## 三、三层身份验证（纵深防御）

### 第 1 层：前端 UI 守卫

```vue
<!-- src/components/Tools/ConfessionWall/ConfessionWall.vue -->
<script setup>
import { useUserStore } from '@/store/modules/user'
const userStore = useUserStore()

const isLoggedIn = computed(() => userStore.getLoginStatus)
const isAdmin    = computed(() => userStore.getIsAdmin)
</script>

<template>
  <!-- 未登录：跳转到项目登录页 -->
  <el-button v-if="!isLoggedIn" @click="goToLogin">管理员登录</el-button>

  <!-- 登录但非管理员：不显示创建/删除按钮 -->
  <button v-if="isAdmin" class="group-tab-add">+ 新分组</button>
</template>
```

**逻辑来源**：

```ts
// src/store/modules/user.ts:17
getIsAdmin: (state) => Boolean(state.user?.is_admin)

// src/utils/user.ts:44
// parseJwt 解 JWT payload 的 is_admin 字段
```

### 第 2 层：Cloudflare Function 鉴权

所有写入 `confession_groups` 的请求必须经后端，后端**重新**校验身份：

```js
// functions/api/confession/groups-create.js
import { extractUidFromRequest, isAdmin } from '../_lib/model-resolver.js'

export async function onRequest(context) {
  const { request, env } = context

  // 1. 从 Authorization header 解 JWT 拿 uid
  const uid = extractUidFromRequest(request)
  if (!uid) return json({ error: '未登录' }, 401)

  // 2. 实时查 D1 user.is_admin（不复用 JWT 的旧值）
  const admin = await isAdmin(env.DB, uid)
  if (!admin) return json({ error: '仅管理员可创建分组' }, 403)

  // 3. 用 SUPABASE_SERVICE_KEY 写 confession_groups
  // ... fetch(...)
}
```

`isAdmin` 工具函数（已有，直接复用）：

```js
// functions/api/_lib/model-resolver.js:271
export async function isAdmin(db, uid) {
  if (!uid) return false
  const row = await db.prepare(
    `SELECT is_admin FROM user WHERE id = ?`
  ).bind(uid).first()
  return !!row?.is_admin
}
```

### 第 3 层：Supabase RLS 兜底

即使前端绕过、Function 被绕过，**Supabase RLS 仍然保护数据库**：

```sql
-- supabase/confession-wall.sql
-- confession_groups：只有 SELECT 开放给 anon key
CREATE POLICY "anyone_read_groups" ON confession_groups FOR SELECT USING (true);
-- 没有 INSERT/UPDATE/DELETE policy → anon key 无法直接写
-- 写操作必须用 SUPABASE_SERVICE_KEY（仅 Cloudflare Function 持有）
```

---

## 四、数据流详解

### 4.1 匿名场景：读告白 / 发告白 / 点赞

```
用户打开 /confession-wall/
  ↓
supabase.from('confession_messages').select('*')
  ↓
Supabase 检查 anon key + RLS
  ↓  通过（anyone_read_messages 策略）
返回消息列表
```

无 JWT、无 auth 检查。最轻量。

### 4.2 管理员场景：创建分组

```
用户登录 → JWT 存入 localStorage
  ↓
点 "+ 新分组" → 弹出表单
  ↓
填好提交 → confessionDb.createGroup(payload)
  ↓
functionsRequest.post('/api/confession/groups/create', payload)
  ↓
Cloudflare Function 接收：
  1. extractUidFromRequest → 拿 uid
  2. isAdmin(db, uid) → 查 D1
  3. fetch(SUPABASE_URL/confession_groups, { method:'POST', service_key })
  ↓
Supabase RLS 检查通过（service_role 绕过 RLS）
  ↓
新分组写入，前端 Realtime 推送，所有用户标签栏 1 秒内出现
```

### 4.3 管理员场景：删除分组

```
管理员 hover 分组 → 看到红色 ×
  ↓
点击 → ElMessageBox.confirm 二次确认
  ↓
confessionDb.deleteGroup(groupId)
  ↓
functionsRequest.delete('/api/confession/groups/delete?id=...')
  ↓
Cloudflare Function：
  1. JWT 校验 → isAdmin 校验
  2. fetch(SUPABASE_URL/confession_groups?id=eq.xxx, { method:'DELETE', service_key })
  ↓
Supabase ON DELETE CASCADE 自动删除：
  - 该分组的所有 confession_messages
  - 所有关联的 confession_reactions
  ↓
前端 Realtime 推送 → 所有用户标签栏同步消失
```

---

## 五、为什么不在 Supabase 端做权限校验？

**否决方案 A**：在 Supabase `auth.users.app_metadata.is_admin` 存管理员标记。

❌ 缺点：
1. 需要 Supabase Management API / Edge Function 设置 custom claims
2. 与项目自身 D1 user 表数据冗余，需同步
3. 用户换登录方式（Google → Email）就要重新设置
4. 与现有 JWT 体系割裂，要维护两套

**否决方案 B**：在 Supabase 建独立的 `confession_admins` 表。

❌ 缺点：
1. 重复造轮子 —— 项目已有 D1 user.is_admin
2. 部署者要分别维护两份名单
3. 与其他工具的管理员名单不一致

**采用方案**：项目统一用 D1 `user.is_admin`，所有需要管理员权限的工具都走 Cloudflare Function 校验。

✅ 优点：
1. 单一真理来源
2. 管理员名单维护一处即可（Cloudflare D1）
3. 与其他工具（AI 工具、邮箱登录等）共用同一套权限
4. 开源项目被 fork 后，部署者只需改 D1 一行 SQL

---

## 六、部署与配置清单

### 6.1 Cloudflare 环境变量

| 变量 | 来源 | 说明 |
|---|---|---|
| `SUPABASE_URL` | Supabase 控制台 | `https://xxx.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase 控制台 → Settings → API | service_role key（**保密**！仅 Functions 用） |
| `JWT_SECRET` | 已有 | 与其他 Functions 共用 |
| `DB` (D1 binding) | wrangler.toml | 项目主数据库 |

### 6.2 Vite 代理（仅本地开发需要）

`vite.config.ts`：

```ts
'/api/confession': {
  target: 'http://127.0.0.1:8788',
  changeOrigin: true,
},
```

生产环境无需此代理 —— Cloudflare Pages 自动路由 `/api/*` 到 Functions。

### 6.3 Cloudflare Functions 路由注册

`functions/_routes.json` + `dist/functions/_routes.json`：

```json
"/api/confession/groups/create",
"/api/confession/groups/delete"
```

> ⚠️ 部署时务必同步 `dist/functions/_routes.json` 和 `dist/functions/api/confession/*.js`。

### 6.4 SQL 部署

`supabase/confession-wall.sql` 一键执行：

- 建表（confession_groups / confession_messages / confession_reactions）
- 索引
- RLS（仅 SELECT 开放给 anon，INSERT/UPDATE/DELETE 走 service_role）
- Realtime 推送开关
- 默认 5 个分组（广场/树洞/表白/许愿/吐槽）

不涉及任何管理员表 —— 管理员判断完全在 D1 user 表。

---

## 七、本地验证清单

```bash
# 1. 启动两个服务（前端 + Functions）
pnpm dev          # Vite :5173
pnpm dev:wrangler # Cloudflare Functions :8788

# 2. 部署 SQL 到 Supabase
#    复制 supabase/confession-wall.sql 内容到 SQL Editor → Run

# 3. 在 D1 把你的账号设为管理员
wrangler d1 execute tools-web-db --command \
  "UPDATE user SET is_admin = 1 WHERE email = 'your@email.com'"

# 4. 登录你的项目账号（/login）

# 5. 访问 http://127.0.0.1:5173/confession-wall/
#    - 右上角显示你的邮箱 + 🔑 标识
#    - 标签栏出现 "+ 新分组"
#    - hover 标签出现 × 删除按钮

# 6. 越权测试：
#    - 退出登录 → 看不到管理 UI
#    - 用另一个非管理员账号登录 → 同样看不到
#    - 直接 fetch /api/confession/groups/create → 应被 403 拦截
```

---

## 八、文件索引

| 文件 | 角色 |
|---|---|
| `functions/db/020_add_user_is_admin.sql` | D1 user 表加 is_admin 字段 |
| `functions/api/_lib/model-resolver.js` | 共享的 `extractUidFromRequest` / `isAdmin` |
| `functions/api/confession/groups-create.js` | 管理员创建分组 |
| `functions/api/confession/groups-delete.js` | 管理员删除分组 |
| `functions/_routes.json` | 注册 confession API 路由 |
| `supabase/confession-wall.sql` | Supabase 建表 + RLS + Realtime |
| `src/utils/user.ts` | JWT 解析（getUserFromToken） |
| `src/store/modules/user.ts` | Pinia store（getIsAdmin getter） |
| `src/utils/confessionDb.ts` | 数据层（直连 Supabase / 经 Functions） |
| `src/components/Tools/ConfessionWall/ConfessionWall.vue` | 告白墙组件 |
| `vite.config.ts` | 本地 dev 代理 /api/confession |

---

## 九、扩展阅读

- 项目其他需要管理员的工具（AI 工具、OSS 配置等）也走同样的 D1 `user.is_admin` 判断
- `functions/api/ai-proxy.js:94` 是另一个使用 `isAdmin()` 的范例
- 如需扩展"超级管理员"等分级权限，只需扩展 `isAdmin()` 函数的返回值与 user 表字段
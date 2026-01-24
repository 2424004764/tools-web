# 密码管理器数据库迁移说明

## 功能概述

密码管理器已从本地存储迁移到数据库存储，支持多设备同步和云端备份。

## 数据库表结构

### password_groups（密码分组表）
- `id`: 分组ID（主键）
- `uid`: 用户ID
- `name`: 分组名称
- `color`: 分组颜色
- `create_time`: 创建时间
- `update_time`: 更新时间

### password_entries（密码条目表）
- `id`: 条目ID（主键）
- `uid`: 用户ID
- `title`: 标题
- `username`: 用户名
- `password`: 加密后的密码
- `url`: 网站URL
- `group_id`: 分组ID（外键）
- `notes`: 备注
- `create_time`: 创建时间
- `update_time`: 更新时间

## 本地开发建表

### 方法1：使用 wrangler 命令行工具

```bash
# 创建密码分组表
wrangler d1 execute yifang-tool --command="CREATE TABLE password_groups (id TEXT PRIMARY KEY, uid TEXT NOT NULL, name TEXT NOT NULL, color TEXT NOT NULL, create_time DATETIME DEFAULT CURRENT_TIMESTAMP, update_time DATETIME DEFAULT CURRENT_TIMESTAMP);"

# 创建密码条目表
wrangler d1 execute yifang-tool --command="CREATE TABLE password_entries (id TEXT PRIMARY KEY, uid TEXT NOT NULL, title TEXT NOT NULL, username TEXT, password TEXT NOT NULL, url TEXT, group_id TEXT, notes TEXT, create_time DATETIME DEFAULT CURRENT_TIMESTAMP, update_time DATETIME DEFAULT CURRENT_TIMESTAMP);"

# 查看所有表
wrangler d1 execute yifang-tool --command="SELECT name FROM sqlite_master WHERE type='table';"
```

### 方法2：执行 SQL 文件

```bash
wrangler d1 execute yifang-tool --file=./migrations/create_password_tables.sql
```

## 线上环境建表

1. 登录 Cloudflare Dashboard
2. 进入 Workers & Pages > D1
3. 选择数据库 `yifang-tool`
4. 在 Console 中执行 `migrations/create_password_tables.sql` 中的 SQL 语句

## API 端点

### 分组管理
- `GET /api/passwords/groups` - 获取所有分组
- `GET /api/passwords/groups/{id}` - 获取单个分组
- `POST /api/passwords/groups` - 创建分组
- `PUT /api/passwords/groups/{id}` - 更新分组
- `DELETE /api/passwords/groups/{id}` - 删除分组

### 密码条目管理
- `GET /api/passwords/entries` - 获取所有密码条目
- `GET /api/passwords/entries/{id}` - 获取单个密码条目
- `POST /api/passwords/entries` - 创建密码条目
- `PUT /api/passwords/entries/{id}` - 更新密码条目
- `DELETE /api/passwords/entries/{id}` - 删除密码条目

## 安全特性

1. **密码加密**：所有密码使用 AES 加密存储在数据库中
2. **用户隔离**：每个用户只能访问自己的密码数据
3. **认证保护**：所有 API 端点都需要 JWT 认证
4. **输入验证**：所有输入都经过验证，防止注入攻击

## 文件结构

```
functions/
├── api/passwords.js                    # API 入口
├── controllers/passwordController.js  # 控制器
├── services/passwordService.js        # 业务逻辑
├── routes/passwords.js                # 路由
├── utils/db.js                        # 数据库模型
└── middlewares/validator.js           # 验证中间件

src/
├── api/password.ts                    # 前端 API 调用
└── components/Tools/PasswordManager/   # Vue 组件
```

## 注意事项

1. 必须登录后才能使用密码管理器
2. 密码在客户端使用 AES 加密后再传输到服务器
3. 加密密钥基于用户 ID 生成，确保用户间数据隔离
4. 删除分组会自动将该分组下的密码移至默认分组

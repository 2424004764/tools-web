# AGENTS.md

本仓库的 AI 编码助手工作约定。

## llms.txt 同步

- `public/llms.txt` 是给 AI 爬虫看的站点工具索引，收录了全部前台工具页链接（按分类组织，每条 `链接: 一句话描述`）。
- **每次改动涉及路由/工具时，必须检查 llms.txt 是否需要同步更新**：
  - 在 `src/router/router.ts` 新增前台工具路由 → 在 llms.txt 对应分类下补一行
  - 删除/下线工具路由 → 删除 llms.txt 中对应条目
  - 修改工具标题或功能（路由 `meta`）→ 视情况更新该条目的一句话描述
  - 仅改样式、bugfix、后台 `/admin`、登录/授权页、动态分享页（如 `/letter/:slug`）等非前台工具 → 无需改动
- 一致性自检（可选）：llms.txt 中的链接应能在 router.ts 的 `path` 中找到（去掉尾部 `/` 后比对）。

## 新增前台工具清单

每次新增前台工具，除组件本身外还需同步以下各处（完整步骤另见 `.claude/project/new-tool.md`）：

1. 组件：`src/components/Tools/<Name>/<Name>.vue`
2. 路由：`src/router/router.ts` 增加 path + `meta`（title/keywords/description）
3. 工具注册：`src/components/Tools/tools.ts` 对应分类 `list` 中补条目（`id`/`title`/`logo`/`desc`/`url`/`cateId`/`cate`）
4. logo：`public/images/logo/` 放图标后强制重绘精灵图（`FORCE_SPRITE=1 pnpm sprite:build`）；**用户未提供 logo 时 `logo` 留空字符串，不要自动生成占位 SVG**
5. D1 迁移 SQL：见下文章节
6. llms.txt：见上文「llms.txt 同步」
7. `README.md`「工具列表」对应分类补一行
8. sitemap.xml **无需手改**：部署时 `gen:page-meta` + `generate:sitemap` 自动从 router.ts 收录新路由

## 新增工具的 D1 迁移 SQL

- **必须新增迁移 SQL**：首页/侧边栏工具列表由 `/api/tools` 从 D1 `tool_features` 表读取（tools.ts 仅为空表 fallback），不写 SQL 工具不会出现在首页。
- 在 `migrations/` 下新增 `NNN_add_<tool>_tool.sql`，编号顺延当前最大值，模板照抄最近一个 `add_*_tool.sql`：
  - `id`：字符串 id（如 `<tool>-YYYY-MM-DD`），与 tools.ts 中条目 id 保持一致，避免数字 id 复用冲突
  - `url`：与路由 path 一致（含尾部 `/`）
  - `category_id`/`category_name`：与 tools.ts 的 `cateId`/`cate` 一致
  - `sort_order`：全库顺延递增（查现有 `add_*_tool.sql` 的最大值 +1）
  - 结尾用 `ON CONFLICT(url) DO UPDATE SET ...` 保证幂等
- 执行：本地 `pnpm exec wrangler d1 execute yifang-tool --local --file=migrations/NNN_xxx.sql`，线上加 `--remote`
- 纯前端、无新表的工具只需这一条 INSERT；涉及新表的工具参照 `04x_create_xxx.sql`/`075_create_shopping_lists_tables.sql` 另加建表迁移。

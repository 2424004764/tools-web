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

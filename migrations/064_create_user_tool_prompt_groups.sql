-- 用户提示词分组表 + 在 user_tool_prompts 上加 group_id 列
--
-- 需求：当用户保存了几十/上百条提示词时，单一列表很难定位。
-- 引入「分组」概念：每个登录用户可创建多个组（每场景一份，例如 ai-image-edit 下分
-- 「人物写真」「商品图」「风景」），提示词记录归属于其中一个组（可为空 = 未分组）。
--
-- 设计取舍：
--   1. 分组与 scene 不绑定：同一个用户在不同 scene（ai-image-edit / ai-outfit）下都可以
--      使用同名分组（前端按 scene 过滤组列表时保持各自的组），由前端按 scene 过滤即可。
--      后端约束：分组所属 scene 在写入时记录，列出/统计时按 scene 过滤。
--   2. 删除组时：组内提示词的 group_id 置空（提示词保留为「未分组」状态），不级联删除。
--      避免误删用户辛苦整理的内容。
--   3. 排序字段 sort_order：让用户能拖动排序组。前端暂未实现拖拽 UI，仅保留字段。
--   4. group_id TEXT 可空：迁移前已有的所有提示词默认 group_id = NULL（未分组），
--      不破坏既有数据。
--
-- 部署：
--   线上：pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/064_create_user_tool_prompt_groups.sql
--   本地：pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/064_create_user_tool_prompt_groups.sql

-- ============ 1. 分组表 ============
CREATE TABLE IF NOT EXISTS user_tool_prompt_groups (
    id          TEXT PRIMARY KEY,        -- UUID
    uid         TEXT NOT NULL,           -- 用户 ID（与 user.id / user_credits.uid 同类型）
    scene       TEXT NOT NULL,           -- 场景标识，如 'ai-image-edit' / 'ai-outfit'
    name        TEXT NOT NULL,           -- 组名（如「人物写真」）
    color       TEXT,                    -- 可选，组标签颜色（hex / Tailwind 颜色名）
    sort_order  INTEGER NOT NULL DEFAULT 0, -- 同 scene 同 uid 内排序（前端暂未做拖拽，预留）
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

-- ============ 2. 给 user_tool_prompts 加 group_id 列 ============
-- 可空：NULL 表示「未分组」，与既有数据兼容
ALTER TABLE user_tool_prompts ADD COLUMN group_id TEXT;


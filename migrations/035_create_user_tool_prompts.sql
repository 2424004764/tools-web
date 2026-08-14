-- 用户级提示词库表
--
-- 用途：在 ai-image-edit / ai-outfit 这类工具的输入框旁加「从提示词库选择」按钮，
-- 弹窗列出当前用户在该场景下保存过的提示词，可增删改查、选中后回填到输入框。
-- 用户级：每个登录用户各自一份，互不可见。
--
-- scene 字段：功能标识，与 tools.ts 中各工具 url 对齐（去掉首尾斜杠），
-- 例如 'ai-image-edit' / 'ai-outfit'。后续要扩展到其他工具时直接加新值即可。

CREATE TABLE IF NOT EXISTS user_tool_prompts (
    id          TEXT PRIMARY KEY,           -- UUID
    uid         TEXT NOT NULL,              -- 用户 ID（与 user.id / user_credits.uid 同类型）
    scene       TEXT NOT NULL,              -- 功能标识，如 'ai-image-edit' / 'ai-outfit'
    title       TEXT,                       -- 提示词标题，可选；为空时列表显示「未命名」
    content     TEXT NOT NULL,              -- 提示词正文（前端截断 5000 字符与上游 prompt 保持一致）
    created_at  TEXT NOT NULL,              -- ISO 8601
    updated_at  TEXT NOT NULL               -- ISO 8601
);
-- AI 创作素材：登录用户私有表
--
-- 业务语义：
--   /my-ai-creations/ 展示当前登录用户在 AI 工具（如 /ai-image-edit/）里生成的图片素材。
--   每张图归属于某个"组"——一次提示词任务产生的 N 张图为同一组。
--   严格按 uid 隔离，前端只能看到自己创建的，跨用户完全不可见。
--
-- 设计取舍：
--   - 不存媒体文件本身，只存外链 URL（节省 R2/OSS 配额）
--   - 两张表：ai_creation_groups 存组元数据（提示词/分类/模型/来源场景），
--              ai_creation_images 存每张图；image.group_id 关联 group.id
--   - group.prompt_id 关联 user_tool_prompts.id，可选；为空时表示该组未关联提示词库
--   - uid 维度上的 (uid, created_at DESC) 索引即可覆盖常见查询：
--       * 「我的全部作品」分页
--       * 「按分类筛选」
--       * 「按场景筛选」
--     不再加额外索引，避免写入放大

CREATE TABLE IF NOT EXISTS ai_creation_groups (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    uid         TEXT NOT NULL,                -- 用户 ID（与 user.id / user_credits.uid 同类型）
    prompt_id   TEXT,                          -- 可选，关联 user_tool_prompts.id (TEXT/UUID)
    scene       TEXT NOT NULL,                 -- 来源场景，如 'ai-image-edit' / 'ai-outfit'
    category    TEXT,                          -- 分类（前端分类筛选），可空
    model_name  TEXT,                          -- 模型标识，如 'Flux-1.0' / 'Pollinations'
    title       TEXT,                          -- 任务标题（用户命名或 prompt title）
    created_at  TEXT NOT NULL,                 -- UTC 'YYYY-MM-DD HH:mm:ss'
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aicg_uid_created
    ON ai_creation_groups (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aicg_uid_scene
    ON ai_creation_groups (uid, scene);

CREATE TABLE IF NOT EXISTS ai_creation_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id        INTEGER NOT NULL,          -- ai_creation_groups.id
    uid             TEXT NOT NULL,             -- 冗余存 uid，便于按 uid 直接索引过滤（避免每次 JOIN）
    media_type      TEXT NOT NULL DEFAULT 'image',  -- 目前只接 image，留 media_type 与公开画廊对齐
    media_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    prompt          TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    file_size       INTEGER,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (group_id) REFERENCES ai_creation_groups(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_aici_uid_created
    ON ai_creation_images (uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aici_group_id
    ON ai_creation_images (group_id);
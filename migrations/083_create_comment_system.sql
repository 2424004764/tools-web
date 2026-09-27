-- 083: 自建评论系统 + 站点配置表
-- 1) site_config：站点级 KV 配置（评论系统切换 giscus/自建、giscus 参数等）
-- 2) comments：自建评论，全部评论需后台审核（pending → approved/rejected）后展示

CREATE TABLE IF NOT EXISTS site_config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL DEFAULT '',
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS comments (
    id          TEXT PRIMARY KEY,
    page_path   TEXT NOT NULL,                 -- 评论所属页面路径，如 /md5
    page_title  TEXT DEFAULT '',               -- 提交时的页面标题（仅后台展示用）
    content     TEXT NOT NULL,
    user_id     TEXT,                          -- 已登录用户的 user.id，游客为 NULL
    nickname    TEXT NOT NULL,
    email       TEXT DEFAULT '',               -- 游客邮箱；登录用户冗余存一份便于后台联系
    avatar      TEXT DEFAULT '',               -- 登录用户头像 URL；游客为空（前端本地生成）
    status      TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    submit_ip   TEXT DEFAULT '',
    reviewed_by TEXT,                          -- 审核人 adminUid
    reviewed_at DATETIME,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 前台按页面拉取已通过评论；后台按状态筛选
CREATE INDEX IF NOT EXISTS idx_comments_page   ON comments (page_path, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments (status, created_at DESC);

-- 评论系统配置默认值：与原 Comments.vue 硬编码保持一致，切换行为不变
INSERT OR IGNORE INTO site_config (key, value) VALUES ('comment_system', 'giscus');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('giscus_repo', '');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('giscus_repo_id', 'R_kgDOPUcsXg');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('giscus_category', 'General');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('giscus_category_id', 'DIC_kwDOPUcsXs4C1Y2z');
INSERT OR IGNORE INTO site_config (key, value) VALUES ('giscus_mapping', 'title');

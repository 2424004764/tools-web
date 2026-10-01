-- 086: 站点博客
-- 1) blog_posts：博客文章。管理员直接发文（draft/published），
--    登录用户投稿一律 pending，后台审核通过（published）后前台可见。
-- 2) 相关工具（related_tools）用于详情页引流：逗号分隔的工具 url，
--    详情页优先展示；为空时前端回退展示热门工具。

CREATE TABLE IF NOT EXISTS blog_posts (
    id            TEXT PRIMARY KEY,                    -- crypto.randomUUID()
    slug          TEXT NOT NULL UNIQUE,                -- URL 标识，如 'p-a1b2c3d4'
    title         TEXT NOT NULL,
    summary       TEXT DEFAULT '',                     -- 摘要（列表展示 + SEO description）
    content       TEXT NOT NULL,                       -- Markdown 正文（前端 html:false 渲染）
    cover         TEXT DEFAULT '',                     -- 封面图 URL（可选）
    tags          TEXT DEFAULT '',                     -- 逗号分隔标签
    related_tools TEXT DEFAULT '',                     -- 逗号分隔的工具 url（引流推荐位）
    author_id     TEXT,                                -- user.id
    author_name   TEXT NOT NULL,
    author_avatar TEXT DEFAULT '',
    author_type   TEXT NOT NULL DEFAULT 'user',        -- 'admin' | 'user'（前台"站长"徽标）
    status        TEXT NOT NULL DEFAULT 'pending',     -- draft | pending | published | rejected
    reject_reason TEXT DEFAULT '',
    views         INTEGER NOT NULL DEFAULT 0,
    submit_ip     TEXT DEFAULT '',
    reviewed_by   TEXT,
    reviewed_at   DATETIME,
    published_at  DATETIME,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 前台按已发布时间倒序拉取；后台按状态筛选
CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts (author_id);

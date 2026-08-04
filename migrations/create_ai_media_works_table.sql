-- AI 媒体作品表
-- 外部脚本（如定时任务）调用 POST /api/ai-media-works/batch 批量推送的作品数据。
-- 公开浏览：audit_status = 'approved' 的行。
-- 默认 approved，可由管理员改为 pending / rejected 控制展示。
--
-- 设计取舍：
--   - 不存媒体文件本身，只存外链 URL（节省 R2/OSS）
--   - media_type 区分 image / video，但前端展示统一为卡片，可按 type 切换 tab
--   - category 用字符串而非外键，允许外部脚本自由打入新分类；前端用 DISTINCT 列表展示
--   - view_count 简单浏览次数字段，前端详情页 PATCH +1（或借助上游自行打点）

CREATE TABLE IF NOT EXISTS ai_media_works (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    media_type      TEXT NOT NULL,                  -- 'image' | 'video'
    media_url       TEXT NOT NULL,                  -- 主资源 URL（图片或视频直链）
    thumbnail_url   TEXT,                           -- 视频/封面缩略图（图片可为空，沿用 media_url）
    prompt          TEXT NOT NULL,                  -- 提示词
    category        TEXT NOT NULL,                  -- 分类，如「风景」「人物」「抽象」「动漫」
    model_name      TEXT,                           -- 使用的 AI 模型/服务名，如「Pollinations-FLUX」「Pika-1.0」
    source_name     TEXT,                           -- 推送来源标识，如「daily-cron」「manual」，便于回溯
    source_url      TEXT,                           -- 原页/原作品 URL（可选）
    width           INTEGER,                        -- 尺寸/像素
    height          INTEGER,
    duration        INTEGER,                        -- 视频时长（秒），图片可为空
    file_size       INTEGER,                        -- 文件大小（字节），可选
    tags            TEXT,                           -- 逗号分隔的额外标签，可选
    audit_status    TEXT NOT NULL DEFAULT 'approved', -- 'approved' | 'pending' | 'rejected'
    view_count      INTEGER NOT NULL DEFAULT 0,     -- 浏览次数
    created_at      TEXT NOT NULL,                  -- UTC 'YYYY-MM-DD HH:mm:ss'
    updated_at      TEXT NOT NULL
);


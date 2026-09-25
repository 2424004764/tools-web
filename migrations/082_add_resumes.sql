-- 082: 补录 resumes（简历管理）表
-- 此表此前只在线上按 wrangler.toml 注释里的手工命令创建过，仓库一直没有迁移文件，
-- 导致本地 D1 缺表、/api/resumes 报 no such table: resumes。
-- 字段与 functions/utils/db.js 的 ResumeModel.config 完全对齐（含 wrangler.toml 旧命令里漏掉的 certificates）。

CREATE TABLE IF NOT EXISTS resumes (
    id             TEXT PRIMARY KEY,
    uid            TEXT NOT NULL,
    name           TEXT,
    template       TEXT DEFAULT 'modern',
    personal_info  TEXT,
    work_experience TEXT,
    education      TEXT,
    skills         TEXT,
    projects       TEXT,
    certificates   TEXT,
    others         TEXT,
    create_time    DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time    DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 列表页固定按 uid 过滤 + update_time 倒序，组合索引覆盖
CREATE INDEX IF NOT EXISTS idx_resumes_uid ON resumes (uid, update_time DESC);

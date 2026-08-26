-- 笔记分组表
CREATE TABLE IF NOT EXISTS note_groups (
    id TEXT PRIMARY KEY,
    uid TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#667eea',
    sort_order INTEGER NOT NULL DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- notes 表新增 group_id 字段（允许 NULL 表示"未分组"）
ALTER TABLE notes ADD COLUMN group_id TEXT;


-- 数据迁移 1：为每个已有用户自动创建「默认」分组
-- 仅当该用户尚无分组时创建，避免重复执行迁移时产生多个「默认」分组
INSERT INTO note_groups (id, uid, name, color, sort_order, create_time, update_time)
SELECT
    lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
    substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab',abs(random())%4+1,1) ||
    substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6))),
    n.uid, '默认', '#667eea', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM (
    SELECT uid FROM notes
    WHERE uid NOT IN (SELECT uid FROM note_groups)
    GROUP BY uid
) n;

-- 数据迁移 2：把 group_id 为 NULL 的笔记指向该用户的「默认」分组
UPDATE notes SET group_id = (
    SELECT ng.id FROM note_groups ng
    WHERE ng.uid = notes.uid AND ng.name = '默认'
    LIMIT 1
)
WHERE group_id IS NULL
  AND EXISTS (SELECT 1 FROM note_groups ng WHERE ng.uid = notes.uid AND ng.name = '默认');
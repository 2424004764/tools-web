-- 给 salary_records 加 member_id 字段，NULL 兼容旧数据
-- 旧记录 NULL 时，前端展示为「默认成员」

ALTER TABLE salary_records ADD COLUMN member_id TEXT;

CREATE INDEX IF NOT EXISTS idx_salary_records_member_id ON salary_records(member_id);

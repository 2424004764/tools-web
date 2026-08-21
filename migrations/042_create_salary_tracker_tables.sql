-- 工资变化记录工具：单表设计（无需 member 维度）
-- monthly_income: 月收入（元）
-- effective_date: 生效日期（从这天起薪资变为 monthly_income）
-- source: 可选，记录薪资来源/公司/职级
-- note: 可选备注（调薪原因、岗位变动等）

CREATE TABLE IF NOT EXISTS salary_records (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  monthly_income REAL NOT NULL,
  effective_date TEXT NOT NULL,
  source TEXT,
  note TEXT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salary_records_uid ON salary_records(uid);
CREATE INDEX IF NOT EXISTS idx_salary_records_effective_date ON salary_records(effective_date);
-- 食物记录工具（单用户）
-- 用户记录今天吃了什么 + 大致数量,统计每天/每周的总条数与卡路里估算
-- 设计：单表 + 简单字段,无成员维度(对比 weight/height 工具)
--
-- 字段：
--   id          UUID
--   uid         用户 ID
--   name        食物名（如「白米饭」「炸鸡腿」）
--   meal        时段: breakfast/lunch/dinner/snack
--   category    分类: staple/meat/vegetable/fruit/dairy/drink/dessert/snack/other
--   quantity    数量描述(自由文本,如「1 碗」「2 个」「200g」)
--   calories    估算卡路里(kcal,整数,可选)
--   note        备注
--   eaten_at    食用时间(秒级时间戳,默认现在)
--   created_at 记录创建时间(便于审计)
--
-- 索引：
--   uid + eaten_at: 「今天」「最近 7 天」查询主路径
--   uid + meal: 按时段统计
--
-- 部署:
--   线上 pnpm exec wrangler d1 execute yifang-tool --remote --file=migrations/065_create_food_log.sql
--   本地 pnpm exec wrangler d1 execute yifang-tool --local  --file=migrations/065_create_food_log.sql

CREATE TABLE IF NOT EXISTS food_log (
    id          TEXT PRIMARY KEY,
    uid         TEXT NOT NULL,
    name        TEXT NOT NULL,
    meal        TEXT NOT NULL DEFAULT 'snack',
    category    TEXT NOT NULL DEFAULT 'other',
    quantity    TEXT,
    calories    INTEGER,
    note        TEXT,
    eaten_at    INTEGER NOT NULL,
    created_at  TEXT NOT NULL
);


-- 新增工具 /food-log/(今日吃啥)
-- 数据来源：src/components/Tools/tools.ts
-- category_id 含义：13=内容管理
INSERT INTO tool_features
  (id, title, url, category_id, category_name, description, logo, sort_order, is_enabled, created_at, updated_at)
VALUES
  ('food-log-2026-08-28', '今日吃啥', '/food-log/', 13, '内容管理',
   '记录今天吃了什么，按早中晚夜加餐分类，含卡路里估算，自动统计今日总条数与总卡路里',
   '', 150, 1, '2026-08-28 00:00:00', '2026-08-28 00:00:00')
ON CONFLICT(url) DO UPDATE SET
  title = excluded.title,
  category_id = excluded.category_id,
  category_name = excluded.category_name,
  description = excluded.description,
  logo = excluded.logo,
  sort_order = excluded.sort_order,
  updated_at = updated_at;
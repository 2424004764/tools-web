-- 物品比价（PriceComparison）
- 字段：
--   items 主表（比价物品）：
--     id           : 主键
--     uid          : 用户ID
--     name         : 物品名称（如"iPhone 15 Pro"）
--     category     : 分类（electronics/clothing/food/book/cosmetic/digital/other 等，前端预设+自由输入）
--     spec         : 规格型号（如"256GB 钛原色"）
--     note         : 物品整体备注
--     status       : 0=比价中, 1=已购买, 2=已取消, 3=已归档
--     chosen_entry_id : 最终选定的价格条目ID（已购买时指向 entries.id）
--     create_time / update_time

CREATE TABLE IF NOT EXISTS price_comparison_items (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  spec TEXT,
  note TEXT,
  status INTEGER DEFAULT 0,
  chosen_entry_id TEXT,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- 价格条目表（同一物品在不同平台的价格）
--   id           : 主键
--   uid          : 用户ID（冗余，方便按用户过滤）
--   item_id      : 关联物品主表
--   platform     : 平台名（淘宝/京东/拼多多/1688/官网/线下...）
--   unit_price   : 单价（元）
--   shipping_fee : 运费（元，可选）
--   discount     : 优惠/减免（元，可选）
--   final_price  : 实际付款价 = unit_price + shipping_fee - discount（前端可手动覆盖）
--   quantity     : 数量（默认 1）
--   currency     : 币种（CNY / USD 等，默认 CNY）
--   status       : 0=待定, 1=已下单, 2=已到货, 3=已取消
--   purchase_date: 购买日期（可选）
--   link         : 商品链接（可选）
--   seller       : 卖家/店铺（可选）
--   note         : 备注
--   is_chosen    : 是否最终选定的平台（1=是，0/null=否）
--   create_time / update_time

CREATE TABLE IF NOT EXISTS price_comparison_entries (
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  item_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  unit_price REAL NOT NULL,
  shipping_fee REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  final_price REAL NOT NULL,
  quantity INTEGER DEFAULT 1,
  currency TEXT DEFAULT 'CNY',
  status INTEGER DEFAULT 0,
  purchase_date TEXT,
  link TEXT,
  seller TEXT,
  note TEXT,
  is_chosen INTEGER DEFAULT 0,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

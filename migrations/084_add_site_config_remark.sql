-- 084: site_config 增加备注字段
-- 每个配置项写入固定说明，直接查表时能看懂各项含义；备注以代码里的元数据为准，
-- 后台 admin/site-config 每次保存时会同步刷新 remark。

ALTER TABLE site_config ADD COLUMN remark TEXT NOT NULL DEFAULT '';

UPDATE site_config SET remark = '评论系统类型：giscus = GitHub 评论（默认），custom = 自建评论（需审核后展示）'
  WHERE key = 'comment_system';
UPDATE site_config SET remark = 'giscus 仓库，格式 owner/repo 或完整 GitHub 地址；留空回退环境变量 VITE_GIT_URL'
  WHERE key = 'giscus_repo';
UPDATE site_config SET remark = 'giscus Repo ID，giscus.app 配置页生成，R_ 开头'
  WHERE key = 'giscus_repo_id';
UPDATE site_config SET remark = 'giscus 分类名（Category），如 General'
  WHERE key = 'giscus_category';
UPDATE site_config SET remark = 'giscus 分类 ID（Category ID），giscus.app 配置页生成，DIC_ 开头'
  WHERE key = 'giscus_category_id';
UPDATE site_config SET remark = 'giscus 页面映射方式（Mapping）：title / pathname / url / number'
  WHERE key = 'giscus_mapping';

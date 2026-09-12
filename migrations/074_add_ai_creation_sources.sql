-- AI 创作素材来源与原始文件名
ALTER TABLE ai_creation_groups ADD COLUMN source_type TEXT NOT NULL DEFAULT 'ai_generated';
ALTER TABLE ai_creation_images ADD COLUMN filename TEXT;

UPDATE ai_creation_groups SET source_type = 'ai_generated' WHERE source_type IS NULL OR source_type = '';
UPDATE ai_creation_images
SET filename = CASE
  WHEN media_url LIKE '%.jpg' OR media_url LIKE '%.jpeg' THEN 'ai-image.jpg'
  WHEN media_url LIKE '%.webp' THEN 'ai-image.webp'
  WHEN media_url LIKE '%.gif' THEN 'ai-image.gif'
  ELSE 'ai-image.png'
END
WHERE filename IS NULL OR filename = '';

CREATE INDEX IF NOT EXISTS idx_aicg_uid_source ON ai_creation_groups (uid, source_type, created_at DESC);

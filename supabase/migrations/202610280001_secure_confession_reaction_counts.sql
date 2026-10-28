DROP POLICY IF EXISTS "anyone_update_messages" ON confession_messages;

CREATE OR REPLACE FUNCTION update_confession_reaction_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction_type = 'like' THEN
      UPDATE confession_messages SET likes_count = likes_count + 1 WHERE id = NEW.message_id;
    ELSE
      UPDATE confession_messages SET hugs_count = hugs_count + 1 WHERE id = NEW.message_id;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.reaction_type = 'like' THEN
    UPDATE confession_messages SET likes_count = GREATEST(0, likes_count - 1) WHERE id = OLD.message_id;
  ELSE
    UPDATE confession_messages SET hugs_count = GREATEST(0, hugs_count - 1) WHERE id = OLD.message_id;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS confession_reaction_counts_insert ON confession_reactions;
CREATE TRIGGER confession_reaction_counts_insert
AFTER INSERT ON confession_reactions
FOR EACH ROW EXECUTE FUNCTION update_confession_reaction_counts();

DROP TRIGGER IF EXISTS confession_reaction_counts_delete ON confession_reactions;
CREATE TRIGGER confession_reaction_counts_delete
AFTER DELETE ON confession_reactions
FOR EACH ROW EXECUTE FUNCTION update_confession_reaction_counts();

UPDATE confession_messages AS message
SET likes_count = COALESCE(counts.likes_count, 0),
    hugs_count = COALESCE(counts.hugs_count, 0)
FROM (
  SELECT message_id,
         COUNT(*) FILTER (WHERE reaction_type = 'like')::INT AS likes_count,
         COUNT(*) FILTER (WHERE reaction_type = 'hug')::INT AS hugs_count
  FROM confession_reactions
  GROUP BY message_id
) AS counts
WHERE message.id = counts.message_id;
UPDATE confession_messages AS message
SET likes_count = 0, hugs_count = 0
WHERE NOT EXISTS (
  SELECT 1 FROM confession_reactions reaction WHERE reaction.message_id = message.id
);

REVOKE ALL ON FUNCTION update_confession_reaction_counts() FROM PUBLIC, anon, authenticated;

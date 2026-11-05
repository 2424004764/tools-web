CREATE TABLE IF NOT EXISTS note_shares (
    note_id TEXT PRIMARY KEY,
    owner_uid TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    token_ciphertext TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    create_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoke_time DATETIME
);

CREATE INDEX IF NOT EXISTS idx_note_shares_owner ON note_shares(owner_uid, note_id);

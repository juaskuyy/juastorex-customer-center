CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  order_code TEXT NOT NULL,
  wa TEXT NOT NULL,
  reason TEXT NOT NULL,
  proof_url TEXT,
  status TEXT NOT NULL DEFAULT 'Menunggu',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_claims_order_code ON claims(order_code);
CREATE INDEX IF NOT EXISTS idx_claims_status ON claims(status);

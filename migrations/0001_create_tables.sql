-- Analysis history tables

CREATE TABLE analyses (
  id TEXT PRIMARY KEY,
  user_email TEXT NOT NULL,
  date_range_start TEXT NOT NULL,
  date_range_end TEXT NOT NULL,
  total_emails INTEGER NOT NULL,
  unsubscribable_emails INTEGER NOT NULL,
  percentage INTEGER NOT NULL,
  unique_senders INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_analyses_user_email ON analyses(user_email);

CREATE TABLE analysis_senders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  analysis_id TEXT NOT NULL REFERENCES analyses(id),
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  email_count INTEGER NOT NULL,
  unsubscribe_url TEXT NOT NULL,
  unsubscribe_type TEXT NOT NULL
);

CREATE INDEX idx_analysis_senders_analysis_id ON analysis_senders(analysis_id);

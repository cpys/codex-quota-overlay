CREATE TABLE IF NOT EXISTS daily_active (
  install_hash TEXT NOT NULL,
  active_day TEXT NOT NULL,
  app_version TEXT NOT NULL,
  platform TEXT NOT NULL,
  os_version TEXT NOT NULL,
  locale TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  heartbeat_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (install_hash, active_day)
);

CREATE INDEX IF NOT EXISTS idx_daily_active_day ON daily_active(active_day);
CREATE INDEX IF NOT EXISTS idx_daily_active_version ON daily_active(app_version, active_day);
CREATE INDEX IF NOT EXISTS idx_daily_active_platform ON daily_active(platform, active_day);

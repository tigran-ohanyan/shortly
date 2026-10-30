import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  slug        TEXT NOT NULL UNIQUE,
  url         TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at  TEXT,
  clicks      INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS clicks (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id   INTEGER NOT NULL REFERENCES links(id) ON DELETE CASCADE,
  ts        TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  referrer  TEXT,
  browser   TEXT
);
CREATE INDEX IF NOT EXISTS idx_clicks_link_ts ON clicks(link_id, ts);
`;

export function openDb(file = ":memory:") {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  return new Repo(db);
}

export class Repo {
  constructor(db) {
    this.db = db;
    this.q = {
      insert: db.prepare("INSERT INTO links (slug, url, expires_at) VALUES (?, ?, ?) RETURNING *"),
      bySlug: db.prepare("SELECT * FROM links WHERE slug = ?"),
      list: db.prepare("SELECT * FROM links ORDER BY created_at DESC, id DESC LIMIT ?"),
      remove: db.prepare("DELETE FROM links WHERE slug = ?"),
      click: db.prepare("INSERT INTO clicks (link_id, referrer, browser) VALUES (?, ?, ?)"),
      bump: db.prepare("UPDATE links SET clicks = clicks + 1 WHERE id = ?"),
      perDay: db.prepare(`
        SELECT substr(ts, 1, 10) AS day, COUNT(*) AS count FROM clicks
        WHERE link_id = ? AND ts >= ? GROUP BY day ORDER BY day`),
      referrers: db.prepare(`
        SELECT COALESCE(referrer, 'direct') AS referrer, COUNT(*) AS count FROM clicks
        WHERE link_id = ? GROUP BY referrer ORDER BY count DESC LIMIT 5`),
      browsers: db.prepare(`
        SELECT COALESCE(browser, 'Other') AS browser, COUNT(*) AS count FROM clicks
        WHERE link_id = ? GROUP BY browser ORDER BY count DESC`),
      lastClick: db.prepare("SELECT MAX(ts) AS ts FROM clicks WHERE link_id = ?"),
    };
  }

  create({ slug, url, expiresAt = null }) {
    return this.q.insert.get(slug, url, expiresAt);
  }
  get(slug) {
    return this.q.bySlug.get(slug) ?? null;
  }
  list(limit = 50) {
    return this.q.list.all(limit);
  }
  remove(slug) {
    return this.q.remove.run(slug).changes > 0;
  }
  recordClick(linkId, { referrer = null, browser = null } = {}) {
    this.q.click.run(linkId, referrer, browser);
    this.q.bump.run(linkId);
  }
  stats(link, days = 7) {
    const since = new Date(Date.now() - (days - 1) * 86400000);
    since.setUTCHours(0, 0, 0, 0);
    const rows = this.q.perDay.all(link.id, since.toISOString());
    const byDay = Object.fromEntries(rows.map((r) => [r.day, r.count]));
    const series = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since.getTime() + i * 86400000).toISOString().slice(0, 10);
      series.push({ day: d, count: byDay[d] ?? 0 });
    }
    return {
      total: link.clicks,
      last_click: this.q.lastClick.get(link.id).ts,
      per_day: series,
      referrers: this.q.referrers.all(link.id),
      browsers: this.q.browsers.all(link.id),
    };
  }
  close() {
    this.db.close();
  }
}

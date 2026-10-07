// SQLite persistence (built-in node:sqlite, no native deps).
// Stores chat history, news items, job notices and markets price history.
const { DatabaseSync } = require("node:sqlite");
const fs = require("fs");
const path = require("path");

const dir = process.env.DATA_DIR || path.join(__dirname, "data");
fs.mkdirSync(dir, { recursive: true });

const db = new DatabaseSync(path.join(dir, "bharat-sutra.db"));
db.exec("PRAGMA journal_mode=WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS chat (
  id REAL PRIMARY KEY,
  name TEXT NOT NULL,
  text TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  cat TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  kind TEXT,
  ts INTEGER NOT NULL,
  summary TEXT,
  also TEXT
);
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  source TEXT,
  cat TEXT,
  type TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  ts INTEGER NOT NULL,
  mp INTEGER,
  summary TEXT,
  lastDate TEXT,
  examDate TEXT,
  startDate TEXT,
  vacancies TEXT,
  also TEXT
);
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT
);
`);

module.exports = db;

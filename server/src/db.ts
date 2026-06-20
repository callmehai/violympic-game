/**
 * db.ts — khởi tạo SQLite (better-sqlite3) + migrate schema.
 * Bật WAL để chịu được ~50 phiên ghi đồng thời. Import `db` ở mọi service.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from './config';
import type { StudentRow } from './types';

// đảm bảo thư mục data tồn tại
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// Pragmas cho concurrency + an toàn dữ liệu ở quy mô nhỏ.
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

export function migrate(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id           INTEGER PRIMARY KEY,
      student_code TEXT UNIQUE NOT NULL,
      full_name    TEXT NOT NULL,
      class_name   TEXT,
      password     TEXT NOT NULL,
      created_at   TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id            INTEGER PRIMARY KEY,
      ext_id        TEXT UNIQUE,
      subject       TEXT NOT NULL,
      grade         INTEGER,
      difficulty    TEXT NOT NULL,
      content       TEXT NOT NULL,
      options_json  TEXT NOT NULL,
      correct_index INTEGER NOT NULL,
      points        INTEGER NOT NULL DEFAULT 10,
      explanation   TEXT,
      active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id            INTEGER PRIMARY KEY,
      student_id    INTEGER NOT NULL REFERENCES students(id),
      event_id      TEXT NOT NULL,
      board_json    TEXT NOT NULL,
      progress_json TEXT,
      status        TEXT NOT NULL,
      score         INTEGER NOT NULL DEFAULT 0,
      bonus_points  INTEGER NOT NULL DEFAULT 0,
      started_at    TEXT NOT NULL,
      finished_at   TEXT,
      time_spent_ms INTEGER,
      UNIQUE(student_id, event_id)
    );

    CREATE TABLE IF NOT EXISTS events (
      event_id   TEXT PRIMARY KEY,
      is_open     INTEGER NOT NULL DEFAULT 1,
      opened_at   TEXT,
      closed_at   TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_event_status ON sessions(event_id, status);
    CREATE INDEX IF NOT EXISTS idx_sessions_event_score  ON sessions(event_id, score DESC);
    CREATE INDEX IF NOT EXISTS idx_questions_active       ON questions(active);
  `);
}

// chạy migrate ngay khi import để mọi nơi dùng db đều có schema sẵn sàng
migrate();

/** Lấy SV theo id. */
export function getStudentById(id: number): StudentRow | undefined {
  return db.prepare('SELECT * FROM students WHERE id = ?').get(id) as StudentRow | undefined;
}

/** Lấy SV theo mã (student_code), không phân biệt hoa thường. */
export function getStudentByCode(code: string): StudentRow | undefined {
  return db
    .prepare('SELECT * FROM students WHERE student_code = ? COLLATE NOCASE')
    .get(code.trim()) as StudentRow | undefined;
}

/** Tiện ích: lấy trạng thái mở/đóng event (mặc định coi như mở nếu chưa có bản ghi). */
export function isEventOpen(eventId: string): boolean {
  const row = db
    .prepare('SELECT is_open FROM events WHERE event_id = ?')
    .get(eventId) as { is_open: number } | undefined;
  return row ? row.is_open === 1 : true;
}

/** Đặt trạng thái mở/đóng event. */
export function setEventOpen(eventId: string, open: boolean, nowIso: string): void {
  db.prepare(
    `INSERT INTO events (event_id, is_open, opened_at, closed_at)
     VALUES (@id, @open, CASE WHEN @open=1 THEN @now ELSE NULL END, CASE WHEN @open=0 THEN @now ELSE NULL END)
     ON CONFLICT(event_id) DO UPDATE SET
       is_open   = @open,
       opened_at = CASE WHEN @open=1 THEN @now ELSE opened_at END,
       closed_at = CASE WHEN @open=0 THEN @now ELSE closed_at END`
  ).run({ id: eventId, open: open ? 1 : 0, now: nowIso });
}

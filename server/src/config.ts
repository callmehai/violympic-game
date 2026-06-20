/**
 * config.ts — đọc .env + hằng số cấu hình game. Import `config` ở mọi nơi cần.
 */
import 'dotenv/config';
import path from 'node:path';
import type { GameConfig, Difficulty, BonusTier } from './types';

function num(key: string, def: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function bool(key: string, def: boolean): boolean {
  const raw = process.env[key];
  if (raw === undefined || raw === '') return def;
  return raw === 'true' || raw === '1' || raw.toLowerCase() === 'yes';
}

function str(key: string, def: string): string {
  const raw = process.env[key];
  return raw === undefined || raw === '' ? def : raw;
}

const rows = num('BOARD_ROWS', 6);
const cols = num('BOARD_COLS', 6);

const difficultyPoints: Record<Difficulty, number> = {
  easy: 10,
  medium: 20,
  hard: 30,
};

// Hạng 1 = +50, hạng 2 = +30, hạng 3 = +20, hạng 4–10 = +10.
const bonusTiers: BonusTier[] = [
  { rankFrom: 1, rankTo: 1, points: 50 },
  { rankFrom: 2, rankTo: 2, points: 30 },
  { rankFrom: 3, rankTo: 3, points: 20 },
  { rankFrom: 4, rankTo: 10, points: 10 },
];

export const config: GameConfig = {
  port: num('PORT', 4000),
  appSecret: str('APP_SECRET', 'dev-secret-violympic-treasure'),
  adminKey: str('ADMIN_KEY', 'admin123'),
  eventId: str('EVENT_ID', 'violympic-2026-06'),
  eventDate: str('EVENT_DATE', '2026-06-25'),
  dbPath: path.resolve(process.cwd(), str('DB_PATH', './data/violympic.db')),

  rows,
  cols,
  timeLimitS: num('TIME_LIMIT_S', 300),
  endOnChest: bool('END_ON_CHEST', false),
  allowReplay: bool('ALLOW_REPLAY', false),
  fastAnswerMs: num('FAST_ANSWER_MS', 10000),
  fastAnswerBonus: num('FAST_ANSWER_BONUS', 5),
  wrongTimePenaltyS: num('WRONG_TIME_PENALTY_S', 0),

  boardDistribution: {
    chest: 1,
    bombs: 6,
    gems: 14,
    gemValues: [20], // mỗi kim cương cố định +20 điểm
    bombValue: -15,
    chestValue: 100,
  },
  difficultyPoints,
  bonusTiers,
};

/** Phần config an toàn để lộ cho client. */
export function publicConfig() {
  return {
    rows: config.rows,
    cols: config.cols,
    timeLimitS: config.timeLimitS,
    endOnChest: config.endOnChest,
    allowReplay: config.allowReplay,
    fastAnswerMs: config.fastAnswerMs,
    fastAnswerBonus: config.fastAnswerBonus,
    wrongTimePenaltyS: config.wrongTimePenaltyS,
  };
}

/** Luật chơi + cấu tạo bàn cờ để hiển thị ở sảnh (public, luôn khớp config). */
export function publicRules() {
  const d = config.boardDistribution;
  const total = config.rows * config.cols;
  return {
    rows: config.rows,
    cols: config.cols,
    totalCells: total,
    timeLimitS: config.timeLimitS,
    fastAnswerMs: config.fastAnswerMs,
    fastAnswerBonus: config.fastAnswerBonus,
    difficultyPoints: config.difficultyPoints,
    board: {
      chest: d.chest,
      gems: d.gems,
      bombs: d.bombs,
      empty: total - d.chest - d.gems - d.bombs,
    },
    values: {
      gemValues: d.gemValues,
      chest: d.chestValue,
      bomb: d.bombValue,
    },
  };
}

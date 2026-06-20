import { db } from '../db';
import { QuestionRow, QuestionService } from '../types';

// Prepared statements (chuẩn bị sẵn để tái dùng, hiệu năng tốt cho ~56 người chơi)
const stmtGetById = db.prepare('SELECT * FROM questions WHERE id = ?');
const stmtAllActiveIds = db.prepare(
  'SELECT id FROM questions WHERE active = 1 ORDER BY id',
);
const stmtCount = db.prepare(
  'SELECT COUNT(*) AS c FROM questions WHERE active = 1',
);

export const questionService: QuestionService = {
  getById(id: number): QuestionRow | undefined {
    return stmtGetById.get(id) as QuestionRow | undefined;
  },

  allActiveIds(): number[] {
    const rows = stmtAllActiveIds.all() as Array<{ id: number }>;
    return rows.map((r) => r.id);
  },

  count(): number {
    const row = stmtCount.get() as { c: number };
    return row.c;
  },

  parseOptions(q: QuestionRow): string[] {
    // Parse JSON options; nếu lỗi (dữ liệu hỏng) thì trả mảng rỗng để không vỡ game
    try {
      return JSON.parse(q.options_json) as string[];
    } catch {
      return [];
    }
  },
};

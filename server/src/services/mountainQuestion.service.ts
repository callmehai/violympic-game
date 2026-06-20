/**
 * mountainQuestion.service.ts — truy vấn ngân hàng câu hỏi Game 2 "Vượt Ải".
 */
import { db } from '../db';
import type { Difficulty, MountainQuestionRow, MountainQuestionService } from '../types';

const stmtGetById = db.prepare('SELECT * FROM mountain_questions WHERE id = ?');
const stmtAllActiveIds = db.prepare('SELECT id FROM mountain_questions WHERE active = 1 ORDER BY id');
const stmtAllActive = db.prepare(
  'SELECT id, difficulty FROM mountain_questions WHERE active = 1 ORDER BY id',
);
const stmtCount = db.prepare('SELECT COUNT(*) AS c FROM mountain_questions WHERE active = 1');

export const mountainQuestionService: MountainQuestionService = {
  getById(id: number): MountainQuestionRow | undefined {
    return stmtGetById.get(id) as MountainQuestionRow | undefined;
  },
  allActiveIds(): number[] {
    return (stmtAllActiveIds.all() as Array<{ id: number }>).map((r) => r.id);
  },
  allActive(): { id: number; difficulty: Difficulty }[] {
    return stmtAllActive.all() as { id: number; difficulty: Difficulty }[];
  },
  count(): number {
    return (stmtCount.get() as { c: number }).c;
  },
};

import { db } from '../db';
import type { LeaderboardEntry, LeaderboardService, SessionStatus } from '../types';

// Một dòng thô lấy từ JOIN sessions + students, đã sort sẵn ở SQL.
interface RankRow {
  student_id: number;
  student_code: string;
  full_name: string;
  score: number;
  bonus_points: number;
  time_spent_ms: number | null;
  status: SessionStatus;
}

// Câu lệnh xếp hạng dùng chung:
// - total = score + bonus_points, DESC (điểm cao đứng trước)
// - rồi time_spent_ms ASC; người chưa xong (NULL) coi như 9e15 nên xếp sau khi cùng điểm
// - rồi student_code ASC để thứ tự ổn định (tie-break tất định)
// Bao gồm MỌI session của event (cả in_progress lẫn finished).
const RANK_SQL = `
  SELECT
    ss.student_id AS student_id,
    s.student_code AS student_code,
    s.full_name AS full_name,
    ss.score AS score,
    ss.bonus_points AS bonus_points,
    ss.time_spent_ms AS time_spent_ms,
    ss.status AS status
  FROM sessions ss
  JOIN students s ON s.id = ss.student_id
  WHERE ss.event_id = ?
  ORDER BY
    (ss.score + ss.bonus_points) DESC,
    COALESCE(ss.time_spent_ms, 9e15) ASC,
    s.student_code ASC
`;

const rankStmt = db.prepare(RANK_SQL);

// Trả về toàn bộ entry đã sort + rank 1-based tính trong JS theo đúng thứ tự SQL.
// rankAll KHÔNG gắn is_me (để hàm gọi tự quyết) — đây là nguồn dùng chung.
function rankAll(eventId: string): LeaderboardEntry[] {
  const rows = rankStmt.all(eventId) as RankRow[];
  return rows.map((r, i) => ({
    rank: i + 1, // 1-based theo thứ tự đã sort
    student_code: r.student_code,
    name: r.full_name,
    total: r.score + r.bonus_points, // tổng điểm = điểm câu + bonus hạng
    score: r.score,
    bonus_points: r.bonus_points,
    time_spent_ms: r.time_spent_ms,
    status: r.status,
  }));
}

export const leaderboardService: LeaderboardService = {
  top(eventId: string, limit: number, meStudentId?: number): LeaderboardEntry[] {
    // Tính trên TOÀN BỘ rank trước rồi mới slice: is_me xác định theo rank đầy đủ,
    // nên người ngoài top vẫn không bị gắn nhầm khi cắt.
    const rows = rankStmt.all(eventId) as RankRow[];
    const result: LeaderboardEntry[] = [];
    for (let i = 0; i < rows.length && result.length < limit; i++) {
      const r = rows[i];
      const entry: LeaderboardEntry = {
        rank: i + 1, // 1-based theo thứ tự đã sort
        student_code: r.student_code,
        name: r.full_name,
        total: r.score + r.bonus_points, // tổng điểm = điểm câu + bonus hạng
        score: r.score,
        bonus_points: r.bonus_points,
        time_spent_ms: r.time_spent_ms,
        status: r.status,
      };
      if (meStudentId !== undefined && r.student_id === meStudentId) {
        entry.is_me = true;
      }
      result.push(entry);
    }
    return result;
  },

  fullRanking(eventId: string): LeaderboardEntry[] {
    return rankAll(eventId);
  },

  rankOf(eventId: string, studentId: number): number | null {
    // Dò trong danh sách thô đã sort để khớp student_id; trả rank 1-based.
    const rows = rankStmt.all(eventId) as RankRow[];
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].student_id === studentId) {
        return i + 1;
      }
    }
    return null; // SV chưa có session nào trong event
  },
};

/**
 * admin.routes.ts — endpoint quản trị (đăng nhập admin, import/export, đóng mở event, tính bonus).
 * Mount tại /api/admin.
 */
import { Router } from 'express';
import multer from 'multer';
import { config, publicConfig } from '../config';
import { db, isEventOpen, setEventOpen, getStudentByCode } from '../db';
import { asyncHandler } from '../util/http';
import { GameError } from '../util/errors';
import { adminLogin, requireAdmin } from '../auth';
import { leaderboardService } from '../services/leaderboard.service';
import { gameService } from '../services/game.service';
import {
  importStudentsFromCsv,
  importQuestionsFromJson,
} from '../services/seed.service';
import type { AdminEventState, StudentRow } from '../types';

export const adminRouter = Router();

/**
 * Bọc 1 giá trị thành ô CSV an toàn: nếu chứa dấu phẩy / nháy kép / xuống dòng
 * thì bọc trong nháy kép và escape nháy kép bằng cách nhân đôi.
 */
function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// ===================== PUBLIC: đăng nhập admin (TRƯỚC requireAdmin) =====================
adminRouter.post(
  '/login',
  asyncHandler((req, res) => {
    const adminKey = (req.body?.admin_key ?? '').toString();
    const result = adminLogin(adminKey);
    res.json(result);
  }),
);

// ===================== Mọi route phía dưới đều cần quyền admin =====================
adminRouter.use(requireAdmin);

// Upload file giữ trong bộ nhớ (quy mô nhỏ, file CSV/JSON gọn).
const upload = multer({ storage: multer.memoryStorage() });

// ---------- Import danh sách SV (CSV) ----------
adminRouter.post(
  '/students/import',
  upload.single('file'),
  asyncHandler((req, res) => {
    const csv = req.file?.buffer.toString('utf8') ?? (req.body?.csv ?? '').toString();
    if (!csv.trim()) {
      throw new GameError('NO_DATA', 'Thiếu dữ liệu CSV (file hoặc body.csv)', 400);
    }
    const result = importStudentsFromCsv(csv);
    res.json(result);
  }),
);

// ---------- Export mã truy cập (CSV) ----------
adminRouter.get(
  '/students/export',
  asyncHandler((_req, res) => {
    const rows = db
      .prepare('SELECT student_code, full_name, class_name, password FROM students ORDER BY student_code')
      .all() as Pick<StudentRow, 'student_code' | 'full_name' | 'class_name' | 'password'>[];

    const lines: string[] = ['student_code,full_name,class_name,password'];
    for (const r of rows) {
      lines.push(
        [csvCell(r.student_code), csvCell(r.full_name), csvCell(r.class_name), csvCell(r.password)].join(','),
      );
    }
    // BOM ﻿ để Excel nhận UTF-8 (hiển thị đúng tiếng Việt).
    const csv = '﻿' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="access_codes.csv"');
    res.send(csv);
  }),
);

// ---------- Import câu hỏi (JSON) ----------
adminRouter.post(
  '/questions/import',
  upload.single('file'),
  asyncHandler((req, res) => {
    const json = req.file?.buffer.toString('utf8') ?? (req.body?.json ?? '').toString();
    if (!json.trim()) {
      throw new GameError('NO_DATA', 'Thiếu dữ liệu JSON (file hoặc body.json)', 400);
    }
    const result = importQuestionsFromJson(json);
    res.json(result);
  }),
);

// ---------- Trạng thái event ----------
adminRouter.get(
  '/event',
  asyncHandler((_req, res) => {
    const eventId = config.eventId;

    const students = (db.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number }).c;
    const questions = (
      db.prepare('SELECT COUNT(*) AS c FROM questions WHERE active = 1').get() as { c: number }
    ).c;
    const sessions = (
      db.prepare('SELECT COUNT(*) AS c FROM sessions WHERE event_id = ?').get(eventId) as { c: number }
    ).c;
    const finished = (
      db
        .prepare("SELECT COUNT(*) AS c FROM sessions WHERE event_id = ? AND status = 'finished'")
        .get(eventId) as { c: number }
    ).c;

    const state: AdminEventState = {
      event_id: eventId,
      event_date: config.eventDate,
      open: isEventOpen(eventId),
      config: publicConfig(),
      counts: { students, questions, sessions, finished },
    };
    res.json(state);
  }),
);

// ---------- Mở event ----------
adminRouter.post(
  '/event/open',
  asyncHandler((_req, res) => {
    setEventOpen(config.eventId, true, new Date().toISOString());
    res.json({ open: true });
  }),
);

// ---------- Đóng event ----------
adminRouter.post(
  '/event/close',
  asyncHandler((_req, res) => {
    setEventOpen(config.eventId, false, new Date().toISOString());
    res.json({ open: false });
  }),
);

// ---------- Reset phiên 1 SV (cho chơi lại khi gặp sự cố) ----------
adminRouter.post(
  '/reset',
  asyncHandler((req, res) => {
    const code = (req.body?.student_code ?? '').toString().trim();
    if (!code) {
      throw new GameError('BAD_INPUT', 'Thiếu mã sinh viên (student_code)', 400);
    }
    const student = getStudentByCode(code);
    if (!student) {
      throw new GameError('NO_STUDENT', `Không tìm thấy SV: ${code}`, 404);
    }
    // Xoá phiên hiện tại của SV trong event → lần sau đăng nhập sẽ chơi mới từ đầu.
    gameService.resetSession(student.id, config.eventId);
    res.json({ ok: true, student_code: student.student_code, full_name: student.full_name });
  }),
);

// ---------- Reset TẤT CẢ phiên (cho cả lớp chơi lại từ đầu) ----------
adminRouter.post(
  '/reset-all',
  asyncHandler((_req, res) => {
    const deleted = gameService.resetAllSessions(config.eventId);
    res.json({ deleted });
  }),
);

// ---------- Danh sách người ĐÃ chơi (kèm điểm/trạng thái) để reset nhanh ----------
adminRouter.get(
  '/players',
  asyncHandler((_req, res) => {
    gameService.sweepExpired(config.eventId);
    res.json(leaderboardService.fullRanking(config.eventId));
  }),
);

// ---------- Export kết quả cuối (CSV) ----------
adminRouter.get(
  '/results/export',
  asyncHandler((_req, res) => {
    const eventId = config.eventId;

    // Chốt phiên hết giờ để kết quả phản ánh đúng trạng thái cuối.
    gameService.sweepExpired(eventId);

    const ranking = leaderboardService.fullRanking(eventId);

    // Lấy full_name/class_name theo student_code (LeaderboardEntry không kèm class_name).
    const studentStmt = db.prepare(
      'SELECT full_name, class_name FROM students WHERE student_code = ?',
    );

    // Cột gọn để cô/thầy tự cộng điểm thưởng trên giấy: hạng, mã, tên, lớp, điểm, thời gian.
    const header = 'rank,student_code,full_name,class_name,score,time_spent_ms,status';
    const lines: string[] = [header];

    for (const e of ranking) {
      const stu = studentStmt.get(e.student_code) as
        | Pick<StudentRow, 'full_name' | 'class_name'>
        | undefined;
      const fullName = stu?.full_name ?? e.name;
      const className = stu?.class_name ?? '';
      lines.push(
        [
          csvCell(e.rank),
          csvCell(e.student_code),
          csvCell(fullName),
          csvCell(className),
          csvCell(e.score),
          csvCell(e.time_spent_ms),
          csvCell(e.status),
        ].join(','),
      );
    }

    const csv = '﻿' + lines.join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ket_qua.csv"');
    res.send(csv);
  }),
);

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
import { mountainService } from '../services/mountain.service';
import { GAME_MOUNTAIN, resolveGame, scopedEventId } from '../games';
import type { GameId } from '../games';
import {
  importStudentsFromCsv,
  importQuestionsFromJson,
  importMountainQuestionsFromJson,
} from '../services/seed.service';
import type { AdminEventState, StudentRow } from '../types';

/** Lấy game từ query/body (?game=mountain) → event_id phạm vi + engine sweep đúng. */
function gameContext(raw: unknown): { game: GameId; eventId: string } {
  const game = resolveGame(raw);
  return { game, eventId: scopedEventId(game) };
}
function sweepFor(game: GameId, eventId: string): void {
  if (game === GAME_MOUNTAIN) mountainService.sweepExpired(eventId);
  else gameService.sweepExpired(eventId);
}

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

// ---------- Thêm nhanh 1 SV (nhập tên + MSSV) ----------
adminRouter.post(
  '/students/add',
  asyncHandler((req, res) => {
    const code = (req.body?.student_code ?? '').toString().trim();
    const fullName = (req.body?.full_name ?? '').toString().trim();
    const className = (req.body?.class_name ?? '').toString().trim() || null;
    if (!code) throw new GameError('BAD_INPUT', 'Thiếu mã sinh viên (MSSV)', 400);
    if (!fullName) throw new GameError('BAD_INPUT', 'Thiếu họ tên', 400);
    // Kiểm tra MSSV đã tồn tại chưa.
    if (getStudentByCode(code)) {
      throw new GameError('STUDENT_EXISTS', `MSSV "${code}" đã tồn tại`, 409);
    }
    // Tạo tài khoản mới: mật khẩu = MSSV (đúng quy ước đăng nhập).
    db.prepare(
      'INSERT INTO students (student_code, full_name, class_name, password) VALUES (?, ?, ?, ?)',
    ).run(code, fullName, className, code);
    res.json({ ok: true, student_code: code, full_name: fullName });
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

// ---------- Import câu hỏi Game 2 "Vượt Ải" (JSON) ----------
adminRouter.post(
  '/mountain-questions/import',
  upload.single('file'),
  asyncHandler((req, res) => {
    const json = req.file?.buffer.toString('utf8') ?? (req.body?.json ?? '').toString();
    if (!json.trim()) {
      throw new GameError('NO_DATA', 'Thiếu dữ liệu JSON (file hoặc body.json)', 400);
    }
    res.json(importMountainQuestionsFromJson(json));
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
    const mountainQuestions = (
      db.prepare('SELECT COUNT(*) AS c FROM mountain_questions WHERE active = 1').get() as {
        c: number;
      }
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
      counts: { students, questions, mountain_questions: mountainQuestions, sessions, finished },
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
// ?game=treasure|mountain (mặc định treasure).
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
    const { eventId } = gameContext(req.query.game ?? req.body?.game);
    // Xoá phiên hiện tại của SV trong event → lần sau đăng nhập sẽ chơi mới từ đầu.
    gameService.resetSession(student.id, eventId);
    res.json({ ok: true, student_code: student.student_code, full_name: student.full_name });
  }),
);

// ---------- Reset TẤT CẢ phiên (cho cả lớp chơi lại từ đầu) ----------
adminRouter.post(
  '/reset-all',
  asyncHandler((req, res) => {
    const { eventId } = gameContext(req.query.game ?? req.body?.game);
    const deleted = gameService.resetAllSessions(eventId);
    res.json({ deleted });
  }),
);

// ---------- Danh sách người ĐÃ chơi (kèm điểm/trạng thái) để reset nhanh ----------
adminRouter.get(
  '/players',
  asyncHandler((req, res) => {
    const { game, eventId } = gameContext(req.query.game);
    sweepFor(game, eventId);
    res.json(leaderboardService.fullRanking(eventId));
  }),
);

// ---------- Export kết quả cuối (CSV) ----------
adminRouter.get(
  '/results/export',
  asyncHandler((req, res) => {
    const { game, eventId } = gameContext(req.query.game);

    // Chốt phiên hết giờ để kết quả phản ánh đúng trạng thái cuối.
    sweepFor(game, eventId);

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
    res.setHeader('Content-Disposition', `attachment; filename="ket_qua_${game}.csv"`);
    res.send(csv);
  }),
);

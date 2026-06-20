/**
 * game.routes.ts — định tuyến luồng chơi (TẤT CẢ yêu cầu requireAuth).
 *
 * Mỗi route lấy student = getStudentById(req.auth.sub); nếu không có → 401.
 * eventId luôn lấy từ config.eventId (1 sự kiện/buổi).
 */
import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { asyncHandler } from '../util/http';
import { GameError, isGameError } from '../util/errors';
import { requireAuth } from '../auth';
import { getStudentById } from '../db';
import { config } from '../config';
import { gameService } from '../services/game.service';
import type { StudentRow } from '../types';

export const gameRouter = Router();

// mọi route trong router này đều cần đăng nhập
gameRouter.use(requireAuth);

/** Lấy SV từ token; ném 401 nếu không tìm thấy (token cũ / SV đã bị xoá). */
function getStudent(req: Request): StudentRow {
  const student = getStudentById(req.auth!.sub);
  if (!student) {
    throw new GameError('NO_STUDENT', 'Không tìm thấy SV', 401);
  }
  return student;
}

const eventId = config.eventId;

/** POST /start — bắt đầu (hoặc resume) phiên chơi. */
gameRouter.post(
  '/start',
  asyncHandler((req: Request, res: Response) => {
    const student = getStudent(req);
    const state = gameService.startSession(student, eventId);
    res.json(state);
  })
);

/** GET /state — trạng thái hiện tại; trả null an toàn nếu chưa có phiên. */
gameRouter.get(
  '/state',
  asyncHandler((req: Request, res: Response) => {
    const student = getStudent(req);
    const state = gameService.getState(student, eventId);
    res.json(state ?? null);
  })
);

/**
 * GET /next-question — phát câu hỏi hiện tại.
 * Nếu game đã hết giờ / kết thúc (TIME_UP | GAME_OVER) → trả { done: true }.
 * Các lỗi khác → đẩy sang error middleware.
 */
gameRouter.get(
  '/next-question',
  (req: Request, res: Response, next: NextFunction) => {
    try {
      const student = getStudent(req);
      const dto = gameService.nextQuestion(student, eventId);
      res.json(dto);
    } catch (e) {
      // Hết giờ hoặc đã kết thúc thì coi như "done", không phải lỗi.
      if (isGameError(e) && (e.code === 'TIME_UP' || e.code === 'GAME_OVER')) {
        res.json({ done: true });
        return;
      }
      next(e);
    }
  }
);

/** POST /answer — chấm 1 câu trả lời. */
gameRouter.post(
  '/answer',
  asyncHandler((req: Request, res: Response) => {
    const student = getStudent(req);
    const body = (req.body ?? {}) as { question_token?: unknown; selected_index?: unknown };

    if (typeof body.question_token !== 'string' || body.question_token === '') {
      throw new GameError('BAD_INPUT', 'Thiếu question_token', 400);
    }
    const selectedIndex = Number(body.selected_index);
    if (!Number.isFinite(selectedIndex)) {
      throw new GameError('BAD_INPUT', 'selected_index phải là số', 400);
    }

    const dto = gameService.answer(student, eventId, body.question_token, selectedIndex);
    res.json(dto);
  })
);

/** POST /dig — đào 1 ô (chỉ khi vừa trả lời đúng). */
gameRouter.post(
  '/dig',
  asyncHandler((req: Request, res: Response) => {
    const student = getStudent(req);
    const body = (req.body ?? {}) as { cell_index?: unknown };

    const cellIndex = Number(body.cell_index);
    if (!Number.isFinite(cellIndex)) {
      throw new GameError('BAD_INPUT', 'cell_index phải là số', 400);
    }

    const dto = gameService.dig(student, eventId, cellIndex);
    res.json(dto);
  })
);

/** POST /finish — kết thúc phiên, chốt điểm + hạng. */
gameRouter.post(
  '/finish',
  asyncHandler((req: Request, res: Response) => {
    const student = getStudent(req);
    const dto = gameService.finish(student, eventId);
    res.json(dto);
  })
);

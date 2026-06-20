/**
 * mountain.routes.ts — luồng chơi Game 2 "Vượt Ải Trí Tuệ" (MÊ CUNG, requireAuth).
 * Mount tại /api/mountain. event_id phạm vi '::mountain' (xem games.ts).
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../util/http';
import { GameError } from '../util/errors';
import { requireAuth } from '../auth';
import { getStudentById } from '../db';
import { GAME_MOUNTAIN, scopedEventId } from '../games';
import { mountainService } from '../services/mountain.service';
import type { StudentRow } from '../types';

export const mountainRouter = Router();
mountainRouter.use(requireAuth);

const eventId = scopedEventId(GAME_MOUNTAIN);

function getStudent(req: Request): StudentRow {
  const student = getStudentById(req.auth!.sub);
  if (!student) throw new GameError('NO_STUDENT', 'Không tìm thấy SV', 401);
  return student;
}

/** POST /start — bắt đầu (hoặc resume) phiên mê cung. */
mountainRouter.post(
  '/start',
  asyncHandler((req: Request, res: Response) => {
    res.json(mountainService.startSession(getStudent(req), eventId));
  }),
);

/** GET /state — trạng thái mê cung hiện tại (null nếu chưa có phiên). */
mountainRouter.get(
  '/state',
  asyncHandler((req: Request, res: Response) => {
    res.json(mountainService.getState(getStudent(req), eventId) ?? null);
  }),
);

/** POST /move { r, c } — bước nhân vật sang ô kề. Vào cổng khoá → trả câu hỏi. */
mountainRouter.post(
  '/move',
  asyncHandler((req: Request, res: Response) => {
    const body = (req.body ?? {}) as { r?: unknown; c?: unknown };
    const r = Number(body.r);
    const c = Number(body.c);
    if (!Number.isFinite(r) || !Number.isFinite(c)) {
      throw new GameError('BAD_INPUT', 'r, c phải là số', 400);
    }
    res.json(mountainService.move(getStudent(req), eventId, r, c));
  }),
);

/** POST /answer { question_token, response } — chấm câu ở cổng đang chờ. */
mountainRouter.post(
  '/answer',
  asyncHandler((req: Request, res: Response) => {
    const body = (req.body ?? {}) as { question_token?: unknown; response?: unknown };
    if (typeof body.question_token !== 'string' || body.question_token === '') {
      throw new GameError('BAD_INPUT', 'Thiếu question_token', 400);
    }
    res.json(mountainService.answerGate(getStudent(req), eventId, body.question_token, body.response));
  }),
);

/** POST /finish — kết thúc phiên, chốt điểm + hạng. */
mountainRouter.post(
  '/finish',
  asyncHandler((req: Request, res: Response) => {
    res.json(mountainService.finish(getStudent(req), eventId));
  }),
);

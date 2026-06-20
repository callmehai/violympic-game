/**
 * leaderboard.routes.ts — bảng xếp hạng công khai.
 * Mount tại /api/leaderboard.
 */
import { Router } from 'express';
import { config } from '../config';
import { asyncHandler } from '../util/http';
import { verifyAuth } from '../util/jwt';
import { leaderboardService } from '../services/leaderboard.service';
import { gameService } from '../services/game.service';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  asyncHandler((req, res) => {
    const eventId = req.query.event?.toString() || config.eventId;

    // Thử đọc Bearer token để gắn cờ is_me cho người chơi; lỗi → coi như public, bỏ qua.
    let meId: number | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const payload = verifyAuth(authHeader.slice('Bearer '.length).trim());
        if (payload.role === 'player' && payload.sub > 0) {
          meId = payload.sub;
        }
      } catch {
        // token sai/hết hạn → vẫn cho xem leaderboard công khai
      }
    }

    // Quét & tự finish các phiên hết giờ trước khi đọc bảng xếp hạng cho số liệu chuẩn.
    gameService.sweepExpired(eventId);

    res.json(leaderboardService.top(eventId, 20, meId));
  }),
);

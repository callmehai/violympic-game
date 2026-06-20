/**
 * leaderboard.routes.ts — bảng xếp hạng công khai.
 * Mount tại /api/leaderboard.
 */
import { Router } from 'express';
import { asyncHandler } from '../util/http';
import { verifyAuth } from '../util/jwt';
import { leaderboardService } from '../services/leaderboard.service';
import { gameService } from '../services/game.service';
import { mountainService } from '../services/mountain.service';
import { GAME_MOUNTAIN, resolveGame, scopedEventId } from '../games';

export const leaderboardRouter = Router();

leaderboardRouter.get(
  '/',
  asyncHandler((req, res) => {
    // Ưu tiên ?game=treasure|mountain; fallback ?event= (tương thích cũ).
    const game = resolveGame(req.query.game);
    const eventId = req.query.event?.toString() || scopedEventId(game);

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

    // Quét & tự finish các phiên hết giờ (đúng engine của game) trước khi đọc.
    if (game === GAME_MOUNTAIN) mountainService.sweepExpired(eventId);
    else gameService.sweepExpired(eventId);

    res.json(leaderboardService.top(eventId, 20, meId));
  }),
);

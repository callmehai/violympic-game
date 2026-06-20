/**
 * games.ts — danh bạ các game trên cùng 1 sự kiện.
 *
 * Mỗi game dùng CHUNG bảng `sessions` nhưng tách nhau bằng `event_id` có hậu tố:
 *   - treasure (game 1): event_id = config.eventId          (giữ nguyên dữ liệu cũ)
 *   - mountain (game 2): event_id = config.eventId + '::mountain'
 * Nhờ UNIQUE(student_id, event_id), 1 SV có thể chơi CẢ HAI game (mỗi game 1 phiên).
 * Bảng xếp hạng query theo event_id ⇒ tự động tách bảng cho từng game.
 * Cách này KHÔNG cần đổi schema ⇒ an toàn cho dữ liệu live đang chạy.
 */
import { config } from './config';

export const GAME_TREASURE = 'treasure';
export const GAME_MOUNTAIN = 'mountain';
export type GameId = typeof GAME_TREASURE | typeof GAME_MOUNTAIN;

export const GAMES: { id: GameId; name: string }[] = [
  { id: GAME_TREASURE, name: 'Đi tìm kho báu' },
  { id: GAME_MOUNTAIN, name: 'Vượt Ải Trí Tuệ' },
];

/** event_id phạm vi cho 1 game (treasure giữ nguyên eventId gốc). */
export function scopedEventId(game: GameId): string {
  return game === GAME_MOUNTAIN ? `${config.eventId}::mountain` : config.eventId;
}

/** Chuẩn hoá tham số `game` từ query/body về GameId hợp lệ (mặc định treasure). */
export function resolveGame(raw: unknown): GameId {
  return raw === GAME_MOUNTAIN ? GAME_MOUNTAIN : GAME_TREASURE;
}

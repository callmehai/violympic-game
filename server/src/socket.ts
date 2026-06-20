/**
 * socket.ts — kênh realtime bảng xếp hạng, TÁCH PHÒNG theo từng game.
 *
 * Mỗi game có 1 event_id riêng (xem games.ts). Client `subscribe { game }` →
 * server cho join room `evt:<eventId>` và chỉ nhận cập nhật của đúng game đó.
 * Throttle ~800ms TÍNH RIÊNG từng event để 2 game không "đè" nhau.
 */
import { Server } from 'socket.io';
import { leaderboardService } from './services/leaderboard.service';
import { resolveGame, scopedEventId } from './games';

const NS = '/live';
const THROTTLE_MS = 800;

let io: Server | null = null;

function roomOf(eventId: string): string {
  return `evt:${eventId}`;
}

function emitNow(eventId: string): void {
  if (!io) return;
  const state = throttleState.get(eventId);
  if (state) state.lastEmit = Date.now();
  io.of(NS).to(roomOf(eventId)).emit('leaderboard:update', leaderboardService.top(eventId, 20));
}

interface ThrottleEntry {
  lastEmit: number;
  timer: NodeJS.Timeout | null;
}
const throttleState = new Map<string, ThrottleEntry>();

export function setupSocket(server: Server): void {
  io = server;
  const live = io.of(NS);

  live.on('connection', (socket) => {
    // Client đăng ký nhận cập nhật của 1 game cụ thể.
    socket.on('subscribe', (msg: { game?: unknown } | undefined) => {
      const eventId = scopedEventId(resolveGame(msg?.game));
      socket.join(roomOf(eventId));
      socket.emit('leaderboard:update', leaderboardService.top(eventId, 20));
    });
  });
}

/** Phát bảng xếp hạng cho room của 1 event với throttle leading + trailing. */
export function broadcastLeaderboard(eventId: string): void {
  if (!io) return;
  let state = throttleState.get(eventId);
  if (!state) {
    state = { lastEmit: 0, timer: null };
    throttleState.set(eventId, state);
  }

  const elapsed = Date.now() - state.lastEmit;
  if (elapsed >= THROTTLE_MS) {
    emitNow(eventId);
    return;
  }
  if (state.timer) return;
  state.timer = setTimeout(() => {
    if (state) state.timer = null;
    emitNow(eventId);
  }, THROTTLE_MS - elapsed);
}

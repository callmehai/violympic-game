/**
 * socket.ts — kết nối Socket.IO namespace /live để nhận leaderboard real-time.
 */
import { io, type Socket } from 'socket.io-client';
import { SOCKET_NAMESPACE, SOCKET_EVENTS, type LeaderboardEntry } from './contract';

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

/**
 * Mở kết nối live, subscribe theo event và nhận cập nhật leaderboard.
 * Trả về hàm dọn dẹp (ngắt kết nối).
 */
export function connectLeaderboard(
  eventId: string,
  onUpdate: (rows: LeaderboardEntry[]) => void,
  onStatus?: (connected: boolean) => void
): () => void {
  const socket: Socket = io(BASE + SOCKET_NAMESPACE, {
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    onStatus?.(true);
    socket.emit(SOCKET_EVENTS.subscribe, { event_id: eventId });
  });
  socket.on('disconnect', () => onStatus?.(false));
  socket.on(SOCKET_EVENTS.leaderboardUpdate, (rows: LeaderboardEntry[]) => onUpdate(rows));

  return () => {
    socket.removeAllListeners();
    socket.disconnect();
  };
}

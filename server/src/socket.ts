import { Server } from 'socket.io';
import { leaderboardService } from './services/leaderboard.service';
import { config } from './config';

// Namespace cho kênh realtime bảng xếp hạng
const NS = '/live';

// io được gán khi setupSocket chạy; null nếu chưa khởi tạo
let io: Server | null = null;

// Trạng thái throttle cho broadcast leaderboard
const THROTTLE_MS = 800;
let lastEmit = 0; // mốc thời gian emit gần nhất (ms)
let trailingTimer: NodeJS.Timeout | null = null; // timer cho emit "trailing"

/**
 * Emit ngay lập tức bảng xếp hạng top 20 tới mọi client trong namespace.
 */
function emitNow(eventId: string): void {
  if (!io) return;
  lastEmit = Date.now();
  const rows = leaderboardService.top(eventId, 20);
  io.of(NS).emit('leaderboard:update', rows);
}

export function setupSocket(server: Server): void {
  io = server;
  const live = io.of(NS);

  live.on('connection', (socket) => {
    // Client chủ động đăng ký nhận cập nhật → trả về snapshot hiện tại
    socket.on('subscribe', () => {
      socket.emit('leaderboard:update', leaderboardService.top(config.eventId, 20));
    });

    // Gửi luôn snapshot khi vừa kết nối
    socket.emit('leaderboard:update', leaderboardService.top(config.eventId, 20));
  });
}

/**
 * Phát bảng xếp hạng cho client với cơ chế throttle ~800ms (leading + trailing).
 * - Nếu đã quá 800ms kể từ lần emit trước: emit ngay (leading edge).
 * - Nếu vừa emit trong vòng 800ms: hẹn 1 lần emit cuối (trailing) để không
 *   bỏ sót cập nhật mới nhất, đồng thời tránh spam khi có nhiều thay đổi dồn dập.
 */
export function broadcastLeaderboard(eventId: string): void {
  if (!io) return; // guard: chưa khởi tạo socket thì bỏ qua

  const now = Date.now();
  const elapsed = now - lastEmit;

  if (elapsed >= THROTTLE_MS) {
    // Đủ thời gian giãn cách → emit ngay
    emitNow(eventId);
    return;
  }

  // Đang trong cửa sổ throttle → đảm bảo có đúng 1 emit trailing ở cuối cửa sổ
  if (trailingTimer) return; // đã hẹn rồi thì không hẹn thêm

  const wait = THROTTLE_MS - elapsed;
  trailingTimer = setTimeout(() => {
    trailingTimer = null;
    emitNow(eventId);
  }, wait);
}

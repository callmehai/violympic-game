/**
 * index.ts — bootstrap server (Express + Socket.io).
 * Khởi tạo app, mount router, serve client build, mở HTTP/WebSocket.
 */
import express from 'express';
import http from 'node:http';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { Server } from 'socket.io';

import { config, publicRules, publicMountainRules } from './config';
import { errorMiddleware } from './util/http';
import { authRouter } from './routes/auth.routes';
import { gameRouter } from './routes/game.routes';
import { mountainRouter } from './routes/mountain.routes';
import { leaderboardRouter } from './routes/leaderboard.routes';
import { adminRouter } from './routes/admin.routes';
import { getActiveTheme } from './services/theme.service';
import { setupSocket, broadcastLeaderboard } from './socket';
import { gameService, setLeaderboardNotifier } from './services/game.service';
import { mountainService, setMountainNotifier } from './services/mountain.service';
import { GAMES, GAME_MOUNTAIN, scopedEventId } from './games';
// Import db để bảo đảm schema đã migrate xong trước khi nhận request.
import { db } from './db';

void db; // giữ tham chiếu, tránh bị tree-shake/unused.

const app = express();
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Health check.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, event: config.eventId });
});

// Luật chơi + cấu tạo bàn cờ Game 1 (public, cho màn sảnh) + theme giao diện đang bật
// (client đọc lúc mở trang — xem client/src/theme.ts). no-store để admin đổi theme là
// lần tải trang kế tiếp thấy ngay.
app.get('/api/config', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ...publicRules(), theme: getActiveTheme() });
});

// Luật chơi Game 2 "Vượt Ải" (public).
app.get('/api/mountain/config', (_req, res) => {
  res.json(publicMountainRules());
});

// Danh sách game (cho màn chọn game ở trang chủ).
app.get('/api/games', (_req, res) => {
  res.json(GAMES);
});

// API routers.
app.use('/api/auth', authRouter);
app.use('/api/game', gameRouter);
app.use('/api/mountain', mountainRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/admin', adminRouter);

// Serve client build nếu có (SPA fallback, không nuốt /api và /socket.io).
const clientDist = path.resolve(process.cwd(), '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api|socket\.io).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Error middleware đặt cuối cùng.
app.use(errorMiddleware);

// HTTP + WebSocket.
const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: true } });
setupSocket(io);
setLeaderboardNotifier(broadcastLeaderboard);
setMountainNotifier(broadcastLeaderboard);

const mountainEventId = scopedEventId(GAME_MOUNTAIN);

// Quét định kỳ các phiên hết giờ (cả 2 game) để chốt điểm/đóng phiên.
setInterval(() => {
  try {
    gameService.sweepExpired(config.eventId);
    mountainService.sweepExpired(mountainEventId);
  } catch (e) {
    // nuốt lỗi để vòng quét không chết.
  }
}, 5000);

httpServer.listen(config.port, () => {
  console.log('server chạy cổng ' + config.port + ' event ' + config.eventId);
});

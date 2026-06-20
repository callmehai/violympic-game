# 🏆 Đi tìm kho báu — Violympic

Web game thi đấu trắc nghiệm kiểu Violympic cho ~50 người chơi trong 1 buổi thuyết trình.
Trả lời đúng câu hỏi → được **đào 1 ô** trên bàn cờ kho báu để nhặt 💎, né 💣, tìm 🏆.
Có **đồng hồ đếm giờ**, **điểm real-time** và **bảng xếp hạng trực tiếp**.

- Người chơi đăng nhập bằng **mã sinh viên (MSSV) + mật khẩu** (lấy từ `seed/accounts.csv`, mật khẩu = MSSV).
- Mỗi người chơi **1 phiên / sự kiện**. Admin có thể **reset** cho ai gặp sự cố để vào lại.
- Chấm điểm + trạng thái bàn cờ **chỉ ở server** (chống gian lận tối thiểu).

## Yêu cầu

- Node.js ≥ 20 (đã test trên Node 24), npm ≥ 10.
- 1 máy chạy là đủ (không cần Docker/Redis). DB là 1 file SQLite (`server/data/violympic.db`).

## Cài đặt

```bash
npm install        # cài cả root + server + client (postinstall tự lo)
cp .env.example server/.env   # (đã có sẵn server/.env mặc định để chạy dev ngay)
```

## Nạp dữ liệu (seed)

Nạp danh sách sinh viên (`seed/accounts.csv`) + ngân hàng câu hỏi (`seed/questions.sample.json`):

```bash
npm run seed
```

Lệnh sẽ in số SV + số câu hỏi đã nạp, kèm bảng mẫu (MSSV → mật khẩu).
Có thể nạp file khác: `npm run seed -- <accounts.csv> <questions.json>`.

## Chạy (dev)

```bash
npm run dev
```

- Client: http://localhost:5173
- Server API: http://localhost:4000 (client tự proxy `/api` + `/socket.io`)

Đăng nhập bằng một MSSV trong `seed/accounts.csv`, mật khẩu = chính MSSV đó.

> 🔒 `accounts.csv` (chứa tên + MSSV sinh viên) **không được đẩy lên Git** — giữ ở máy
> để seed local. Trên server triển khai, import danh sách SV qua trang **/admin**.

## Trang quản trị

Mở http://localhost:5173/admin → nhập **admin key** (mặc định `Vhai2005`, đổi trong `server/.env`).

Tại đây: mở/đóng sự kiện, import SV/câu hỏi, **reset người chơi** gặp sự cố,
**xuất danh sách access code (CSV)**, **xuất kết quả (CSV)** để giáo viên tự cộng điểm thưởng.

## Cấu hình

Sửa `server/.env` (xem `.env.example` để biết tất cả biến):

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `TIME_LIMIT_S` | Thời gian 1 phiên (giây) | 300 (5 phút) |
| `BOARD_ROWS` / `BOARD_COLS` | Kích thước bàn cờ | 6 × 6 |
| `FAST_ANSWER_MS` / `FAST_ANSWER_BONUS` | Thưởng trả lời nhanh | 10000 / 5 |
| `WRONG_TIME_PENALTY_S` | Phạt thời gian khi sai | 0 |
| `END_ON_CHEST` | Đào trúng 🏆 là kết thúc? | false |
| `ALLOW_REPLAY` | Cho chơi lại nhiều lần? | false |
| `EVENT_ID` / `EVENT_DATE` | Định danh sự kiện | violympic-2026-06 |
| `ADMIN_KEY` | Khóa trang admin | ????? |
| `APP_SECRET` | Bí mật ký JWT | (đổi khi chạy thật) |

Phân bổ ô bàn cờ và điểm theo độ khó nằm trong `server/src/config.ts`.

## Build & deploy 1 máy

```bash
npm run build      # build server (dist/) + client (client/dist/)
npm start          # chạy server; tự serve client/dist nếu có (1 cổng duy nhất)
```

Khi đã build, server phục vụ luôn giao diện ở `http://localhost:4000`.
Backup dữ liệu = sao chép `server/data/violympic.db` (kèm `-wal`, `-shm` nếu có).

## Cấu trúc

```
violympic-treasure/
├── seed/            # accounts.csv (SV) + questions.sample.json (câu hỏi)
├── server/          # Express + SQLite + Socket.IO (TypeScript)
│   └── src/         # config, db, types, auth, services/, routes/, socket, index
└── client/          # React + Vite + Tailwind (TypeScript)
    └── src/         # api/, store/, pages/, components/
```

## Luật chơi (tóm tắt)

1. Trả lời 1 câu hỏi trắc nghiệm (6 môn trộn lẫn).
2. **Đúng** → +điểm theo độ khó (+thưởng tốc độ) → được **đào 1 ô**.
3. **Đào**: 💎 cộng điểm, 💣 trừ điểm (không âm tổng), 🏆 jackpot, ▫️ trống.
4. **Sai** → không được đào, sang câu kế.
5. Hết giờ **hoặc** hết câu hỏi → chốt điểm.
6. Xếp hạng: **điểm** cao hơn thắng; bằng điểm thì **nhanh hơn** thắng.

---
🤖 Sinh bởi [Claude Code](https://claude.com/claude-code)

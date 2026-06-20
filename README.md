# 🎮 Violympic Mini Games

Web game thi đấu kiểu Violympic cho ~50 người chơi trong 1 buổi thuyết trình.
Trang chủ cho **chọn game**; dùng **chung tài khoản**, mỗi game có **bảng xếp hạng riêng**:

- **Game 1 — Đi tìm kho báu** ⛏️: trả lời đúng → **đào 1 ô** bàn cờ để nhặt 💎, né 💣, tìm 🏆.
- **Game 2 — Vượt Ải Trí Tuệ** ⛰️: leo núi nhiều mạng, mỗi ải một **kiểu câu khác nhau**
  (trắc nghiệm · điền đáp án · đúng/sai · sắp xếp thứ tự). Sai mất mạng, lên đỉnh được thưởng lớn.

Cả 2 game đều có **đồng hồ đếm giờ**, **điểm real-time** và **bảng xếp hạng trực tiếp**.

- Người chơi đăng nhập bằng **mã sinh viên (MSSV) + mật khẩu** (lấy từ `seed/accounts.csv`, mật khẩu = MSSV).
- Mỗi người chơi **1 phiên / game / sự kiện**. Admin có thể **reset** (theo từng game) cho ai gặp sự cố.
- Chấm điểm + trạng thái game **chỉ ở server** (chống gian lận tối thiểu).

## Yêu cầu

- Node.js ≥ 20 (đã test trên Node 24), npm ≥ 10.
- 1 máy chạy là đủ (không cần Docker/Redis). DB là 1 file SQLite (`server/data/violympic.db`).

## Cài đặt

```bash
npm install        # cài cả root + server + client (postinstall tự lo)
cp .env.example server/.env   # (đã có sẵn server/.env mặc định để chạy dev ngay)
```

## Nạp dữ liệu (seed)

Nạp danh sách sinh viên (`seed/accounts.csv`) + câu hỏi Game 1 (`seed/questions.sample.json`)
+ câu hỏi Game 2 (`seed/mountain.sample.json`):

```bash
npm run seed
```

Lệnh sẽ in số SV + số câu hỏi mỗi game đã nạp, kèm bảng mẫu (MSSV → mật khẩu).
Có thể nạp file khác: `npm run seed -- <accounts.csv> <questions_g1.json> <questions_g2.json>`.
Hoặc import qua trang **/admin** (2 ô import riêng cho Kho báu và Vượt Ải).

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
| `ALLOW_REPLAY` | Cho chơi lại nhiều lần? (cả 2 game) | false |
| `MOUNTAIN_LIVES` | Game 2: số mạng | 3 |
| `MOUNTAIN_TIME_LIMIT_S` | Game 2: thời gian cả hành trình | 600 (10 phút) |
| `MOUNTAIN_SPEED_BONUS_MAX` | Game 2: thưởng tốc độ tối đa/câu | 8 |
| `MOUNTAIN_FINISH_BASE` / `_TIME_BONUS` / `_LIFE_BONUS` | Game 2: thưởng về đích | 50 / 150 / 20 |
| `EVENT_ID` / `EVENT_DATE` | Định danh sự kiện | violympic-2026-06 |
| `ADMIN_KEY` | Khóa trang admin | ????? |
| `APP_SECRET` | Bí mật ký JWT | (đổi khi chạy thật) |

Phân bổ ô bàn cờ và điểm theo độ khó nằm trong `server/src/config.ts`.
Hai game dùng chung bảng `sessions` nhưng tách nhau bằng `event_id` (Game 2 có hậu tố `::mountain`) —
xem `server/src/games.ts`. Nhờ vậy 1 SV chơi được cả 2 game và mỗi game có bảng xếp hạng riêng.

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
├── seed/            # accounts.csv (SV) + questions.sample.json (G1) + mountain.sample.json (G2)
├── server/          # Express + SQLite + Socket.IO (TypeScript)
│   └── src/         # config, db, games, types, auth, services/, routes/, socket, index
└── client/          # React + Vite + Tailwind (TypeScript)
    └── src/         # api/, store/, pages/, components/
```

## Luật chơi (tóm tắt)

### Game 1 — Đi tìm kho báu ⛏️
1. Trả lời 1 câu hỏi trắc nghiệm (6 môn trộn lẫn).
2. **Đúng** → +điểm theo độ khó (+thưởng tốc độ) → được **đào 1 ô**.
3. **Đào**: 💎 cộng điểm, 💣 trừ điểm (không âm tổng), 🏆 jackpot, ▫️ trống.
4. **Sai** → không được đào, sang câu kế.
5. Hết giờ **hoặc** hết câu hỏi → chốt điểm.

### Game 2 — Vượt Ải Trí Tuệ 🗺️ (MÊ CUNG 2D)
Điều khiển nhân vật thợ mỏ đi trong **mê cung** (bản đồ fix cứng, **3 lối**) tới **kho báu 💎**.
1. Đi bằng **phím mũi tên / WASD** hoặc **bấm ô sáng** kề bên. Né đá 🪨.
2. Bước vào ô **cổng "?"** → 1 câu hỏi (kiểu ngẫu nhiên: trắc nghiệm · điền · đúng/sai · sắp xếp kéo–thả; **xếp theo độ khó dễ→khó**).
   - **Đúng** → cổng mở, đi qua + điểm theo độ khó + **thưởng tốc độ** (trả lời ngay +8 → 0 trong 10s, có thanh đếm ngược).
   - **Sai** → cổng **thành đá** (chặn) + **mất 1 mạng** → phải đi **tuyến khác**.
3. Kết thúc khi: **tới kho báu** · hết mạng · kẹt hết lối · hết giờ.
4. **Tới kho báu = thưởng lớn theo phong độ**: `base + (%thời gian còn × X) + (mạng còn × Y)` → về sớm & giữ mạng = điểm to (~260).

Bản đồ mê cung fix cứng trong `server/src/services/mountain.service.ts` (`MAZE_MAP`).
Cả 2 game xếp hạng: **điểm** cao hơn thắng; bằng điểm thì **nhanh hơn** thắng → ai tới kho báu sớm nhất đứng đầu.
Định dạng câu hỏi Game 2: xem ví dụ trong `seed/mountain.sample.json` (mỗi câu có `type` =
`mcq` | `fill` | `truefalse` | `order`).

---
🤖 Sinh bởi [Claude Code](https://claude.com/claude-code)

# CLAUDE.md — Game "Đi tìm kho báu" (Violympic-style) cho 50 người chơi

> Đây là tài liệu context để Claude Code (VSCode) tự build dự án. Đọc kỹ phần
> **Cách làm việc** trước, rồi build theo **Phases**. Mỗi phase phải chạy được và test được
> trước khi qua phase sau. Hỏi lại khi gặp quyết định lớn ngoài tài liệu này.

---

## 1. Mục tiêu

Dựng một web app thi đấu kiểu Violympic "Đi tìm kho báu":

- Người chơi (≤ 50, dùng đồng thời) đăng nhập bằng **mã sinh viên + access code** (sinh tự động, deterministic).
- Mỗi người chơi nhận chuỗi câu hỏi trắc nghiệm (Văn, Toán, Anh, Sinh, Sử, Địa). Trả lời đúng → được "đào" một ô trên **bàn cờ kho báu** để nhặt kim cương / né bom / tìm rương báu.
- Có **đồng hồ đếm giờ**, **điểm số real-time**, và **bảng xếp hạng (leaderboard) trực tiếp**.
- Xếp hạng theo `điểm` (chính), `thời gian hoàn thành` (phụ — nhanh hơn thắng).
- Sau sự kiện, hệ thống tính **điểm bonus cho Top N** người chơi hay nhất (cấu hình được) để giáo viên cộng điểm.
- Nội dung câu hỏi **seed sau** → ngân hàng câu hỏi phải nạp được từ JSON/CSV mà không sửa code. Dùng **1 bộ đề duy nhất trộn lẫn 6 môn** (tất cả câu chung 1 file, không tách theo môn). Tạm dùng bộ mẫu trong `seed/questions.sample.json`.

Quy mô nhỏ (50 user) → ưu tiên **đơn giản, zero-config, dễ deploy 1 máy**, không over-engineer.

---

## 2. Tech stack (đã chốt — không tự đổi nếu không có lý do)

| Layer | Chọn | Lý do |
|---|---|---|
| Frontend | **React + Vite + TypeScript + TailwindCSS** | nhanh, gọn |
| Backend | **Node.js + Express + TypeScript** | quen thuộc, đủ dùng |
| DB | **SQLite qua `better-sqlite3`** | zero-config, 50 user thừa sức, 1 file `.db` |
| Real-time | **Socket.IO** | leaderboard live, đẩy điểm |
| Auth | **JWT** (jsonwebtoken) | stateless, đơn giản |
| Validate | **zod** | validate input/seed file |
| Dev | **concurrently** chạy client+server | 1 lệnh `npm run dev` |

Không dùng ORM nặng (Prisma) — viết SQL thẳng qua `better-sqlite3` cho gọn. Không cần Redis.

---

## 3. Cấu trúc thư mục mục tiêu

```
violympic-treasure/
├── CLAUDE.md                 # file này
├── README.md                 # hướng dẫn chạy (Claude Code tự viết)
├── package.json              # root: scripts dev/build chung
├── .env.example
├── seed/
│   ├── questions.sample.json # ngân hàng câu hỏi mẫu (đã có sẵn)
│   └── students.sample.csv   # danh sách SV mẫu (đã có sẵn)
├── server/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts          # bootstrap express + socket
│   │   ├── config.ts         # đọc .env, hằng số cấu hình game
│   │   ├── db.ts             # khởi tạo SQLite, migrate schema
│   │   ├── auth.ts           # JWT, sinh access_code
│   │   ├── socket.ts         # Socket.IO: leaderboard live
│   │   ├── routes/
│   │   │   ├── auth.routes.ts
│   │   │   ├── game.routes.ts
│   │   │   ├── leaderboard.routes.ts
│   │   │   └── admin.routes.ts
│   │   ├── services/
│   │   │   ├── question.service.ts
│   │   │   ├── game.service.ts     # state máy bàn cờ + chấm điểm
│   │   │   ├── scoring.service.ts  # công thức điểm + bonus
│   │   │   └── seed.service.ts     # import students/questions
│   │   └── types.ts
│   └── data/                 # chứa violympic.db (gitignore)
└── client/
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── main.tsx
    │   ├── App.tsx
    │   ├── api/              # gọi REST + socket client
    │   ├── store/           # zustand (state nhẹ) hoặc context
    │   ├── pages/
    │   │   ├── LoginPage.tsx
    │   │   ├── LobbyPage.tsx
    │   │   ├── GamePage.tsx
    │   │   ├── LeaderboardPage.tsx
    │   │   └── AdminPage.tsx
    │   └── components/
    │       ├── TreasureBoard.tsx
    │       ├── QuestionCard.tsx
    │       ├── Timer.tsx
    │       ├── ScorePanel.tsx
    │       └── RankTable.tsx
    └── ...
```

---

## 4. Cơ chế game (quan trọng nhất — đọc kỹ)

Mô phỏng theo ảnh gốc: thợ mỏ trên lưới ô, trả lời câu hỏi để đào ô lấy kho báu.

### 4.1 Bàn cờ kho báu
- Lưới `ROWS × COLS` (mặc định **6×6 = 36 ô**, cấu hình trong `config.ts`).
- Mỗi ô ẩn 1 trong các loại (phân bổ ngẫu nhiên theo seed riêng từng người chơi để công bằng/khác nhau):
  - `gem` — kim cương: +điểm (giá trị nhỏ/vừa/lớn).
  - `bomb` — bom: −điểm hoặc −thời gian (penalty).
  - `empty` — trống: không gì.
  - `chest` — rương báu: jackpot (+điểm lớn, hiếm, 1 ô/bàn).
- Phân bổ mặc định (36 ô): 1 chest, ~14 gem (mix giá trị), ~6 bomb, còn lại empty. Để trong config.

### 4.2 Vòng chơi (game loop)
1. Người chơi bấm **Bắt đầu** → tạo `session`, sinh bàn cờ (seed = `student_id + event_id`), bắt đầu đếm giờ tổng (mặc định **20 phút**, cấu hình).
2. Hệ thống phát **1 câu hỏi** từ **một bộ đề duy nhất trộn lẫn 6 môn** (Văn/Toán/Anh/Sinh/Sử/Địa nằm chung 1 ngân hàng, KHÔNG tách theo môn, KHÔNG cân tỉ lệ môn). Thứ tự = xáo trộn 1 lần khi `start` (seed = `student_id + event_id`), phát tuần tự không lặp tới hết bộ đề hoặc hết giờ.
3. Người chơi chọn đáp án:
   - **Đúng** → +điểm cơ bản theo độ khó; mở quyền **đào 1 ô** → chọn ô trên bàn → nhận phần thưởng ô đó.
   - **Sai** → không được đào; tùy chọn phạt nhẹ thời gian (mặc định 0, cấu hình `WRONG_TIME_PENALTY_S`).
4. Lặp lại bước 2.
5. **Kết thúc** khi: hết giờ **HOẶC** hết câu hỏi **HOẶC** đào trúng `chest` (cấu hình `END_ON_CHEST`, mặc định false — chest chỉ là jackpot, game vẫn chạy tiếp).
6. Chốt `score`, `time_spent_ms`, lưu session = `finished`.

> Mỗi event chỉ cho mỗi người chơi **1 lần chơi** (1 session `finished`/người/event). Có flag admin cho phép chơi lại.

### 4.3 Chống gian lận tối thiểu (đủ cho lớp học)
- Chấm điểm & state bàn cờ **chỉ ở server**. Client không tự cộng điểm.
- Câu hỏi gửi xuống **không kèm `correct_index`**. Server chấm.
- Mỗi câu có `question_token` (ký JWT ngắn hạn) để chống replay/đoán.
- Timer authoritative ở server (lưu `started_at`), client chỉ hiển thị.

---

## 5. Đăng nhập — "seed access code theo mã sinh viên"

Không tự đăng ký. Admin nạp danh sách mã SV trước. Hệ thống sinh **access_code deterministic**:

```
access_code = BASE32( HMAC_SHA256(key = APP_SECRET + EVENT_DATE, msg = student_code) )[0..6]
```

- Lấy 6 ký tự đầu, viết hoa → ví dụ `K7Q2MX`.
- **Deterministic**: cùng `student_code + EVENT_DATE + APP_SECRET` luôn ra cùng code → admin in/phát cho SV, không cần lưu mật khẩu thật.
- `EVENT_DATE` (vd `2026-06-25`) đưa vào key → đổi ngày event là **đổi toàn bộ code** (chống dùng lại code cũ). Đây là phần "seed date".
- Đăng nhập: nhập `student_code` + `access_code` → server tính lại & so khớp → cấp JWT.

> Nếu sau này muốn dùng mật khẩu cố định/Google login thì thay module `auth.ts`, phần còn lại không đổi. Để API auth tách bạch.

Admin có endpoint **xuất danh sách (mã SV → access_code)** ra CSV để phát cho SV.

---

## 6. Data model (SQLite schema)

```sql
-- người chơi
CREATE TABLE students (
  id           INTEGER PRIMARY KEY,
  student_code TEXT UNIQUE NOT NULL,
  full_name    TEXT NOT NULL,
  class_name   TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

-- ngân hàng câu hỏi
CREATE TABLE questions (
  id           INTEGER PRIMARY KEY,
  ext_id       TEXT UNIQUE,           -- id từ file seed (q001...)
  subject      TEXT NOT NULL,         -- Toán|Văn|Anh|Sinh|Sử|Địa
  grade        INTEGER,
  difficulty   TEXT NOT NULL,         -- easy|medium|hard
  content      TEXT NOT NULL,
  options_json TEXT NOT NULL,         -- JSON array string[]
  correct_index INTEGER NOT NULL,
  points       INTEGER NOT NULL DEFAULT 10,
  explanation  TEXT,
  active       INTEGER NOT NULL DEFAULT 1
);

-- phiên chơi (giữ toàn bộ state game ngay trên đây — không cần bảng log riêng)
CREATE TABLE sessions (
  id           INTEGER PRIMARY KEY,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  event_id     TEXT NOT NULL,
  board_json   TEXT NOT NULL,         -- bàn cờ đã sinh + ô đã đào (server-side truth)
  progress_json TEXT,                 -- con trỏ câu hỏi hiện tại, câu đã phát, quyền đào... (để resume)
  status       TEXT NOT NULL,         -- in_progress|finished|abandoned
  score        INTEGER NOT NULL DEFAULT 0,
  bonus_points INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT NOT NULL,
  finished_at  TEXT,
  time_spent_ms INTEGER,
  UNIQUE(student_id, event_id)
);
```

> **Quyết định (đơn giản hoá cho buổi thuyết trình):** BỎ 2 bảng log `answers` và `digs`.
> Lý do: user fix, câu hỏi fix, mỗi người chơi 1 lần — không cần audit chi tiết từng
> câu/từng lần đào. Toàn bộ state cần thiết nằm gọn trong `sessions`:
> - **Ô đã đào + loại ô** → lưu trong `board_json` (mỗi cell có cờ `dug: true/false` + `type`).
> - **Tiến độ câu hỏi để resume khi rớt mạng** → `progress_json` (index câu hiện tại, đã trả lời câu nào, có đang được quyền đào không).
> - **Điểm** → cộng dồn thẳng vào `sessions.score`.
>
> **Reset 1 người chơi (nút admin):** chỉ cần `DELETE` (hoặc set `status='abandoned'`)
> đúng row `sessions` của student đó cho `event_id` hiện tại → họ `start` lại từ đầu.
> Nếu muốn sau buổi vẫn xem lại được ai trả lời gì thì mới cần thêm lại 2 bảng log trên.

Leaderboard là **query**, không phải bảng:
```sql
SELECT s.full_name, s.student_code, ss.score + ss.bonus_points AS total,
       ss.time_spent_ms, ss.status
FROM sessions ss JOIN students s ON s.id = ss.student_id
WHERE ss.event_id = ?
ORDER BY total DESC, ss.time_spent_ms ASC;
```

---

## 7. Công thức điểm & bonus

`scoring.service.ts`:

- **Điểm câu đúng** theo độ khó: easy=10, medium=20, hard=30 (lấy từ `question.points`, mặc định map theo difficulty nếu thiếu).
- **Thưởng tốc độ (optional, mặc định bật)**: trả lời < `FAST_ANSWER_MS` (vd 5s) → +5. Để cấu hình bật/tắt.
- **Phần thưởng ô đào**:
  - gem: +{5,10,20} tùy giá trị ô.
  - chest: +100 (jackpot).
  - bomb: −15 (không âm tổng — clamp ≥ 0).
  - empty: 0.
- **Tổng điểm hiển thị** = sum(điểm câu) + sum(điểm đào).
- **Xếp hạng**: `ORDER BY total DESC, time_spent_ms ASC` (đồng điểm → nhanh hơn trên).

### Điểm bonus cho Top N (tính sau khi event đóng)
- Admin bấm **"Tính bonus"** (hoặc tự chạy khi đóng event).
- Cấu hình `BONUS_TIERS`, mặc định: hạng 1 = +50, hạng 2 = +30, hạng 3 = +20, hạng 4–10 = +10.
- Ghi vào `sessions.bonus_points`. Leaderboard cuối đánh dấu ai được bonus (badge 🏅).
- Có nút **xuất kết quả + bonus ra CSV/Excel** để giáo viên cộng điểm.

---

## 8. API (REST) + Socket

### REST
```
POST /api/auth/login          { student_code, access_code } -> { token, profile }
GET  /api/auth/me             -> profile (JWT)

POST /api/game/start          -> { session_id, board_meta(rows,cols, masked), time_limit_s }
GET  /api/game/state          -> { score, time_left_s, board_revealed[], dig_available }
GET  /api/game/next-question  -> { question_id, question_token, subject, content, options[] }   // KHÔNG có correct_index
POST /api/game/answer         { question_token, selected_index } -> { is_correct, delta, can_dig }
POST /api/game/dig            { cell_index } -> { cell_type, delta, new_score }
POST /api/game/finish         -> { score, time_spent_ms, rank }

GET  /api/leaderboard?event=  -> [ { rank, name, total, time_spent_ms, bonus } ]   // public-ish

-- Admin (yêu cầu role admin trong JWT) --
POST /api/admin/login              { admin_key } -> token(role=admin)
POST /api/admin/students/import    (CSV) -> sinh access_code
GET  /api/admin/students/export    -> CSV (mã SV + access_code)
POST /api/admin/questions/import   (JSON/CSV) -> nạp ngân hàng
GET  /api/admin/event              -> trạng thái event (open/closed, config)
POST /api/admin/event/open|close
POST /api/admin/bonus/calculate    -> áp BONUS_TIERS
GET  /api/admin/results/export     -> CSV kết quả cuối + bonus
```

### Socket.IO
- Namespace `/live`. Server **broadcast `leaderboard:update`** mỗi khi có `answer/dig/finish` (throttle ~1–2s, gửi top 20).
- Client trang Leaderboard & ScorePanel subscribe để cập nhật real-time, fallback polling 3s nếu socket lỗi.

---

## 9. UI/UX yêu cầu

Phong cách vui tươi, "game hoá" giống ảnh gốc (rừng, gỗ, kho báu) nhưng **gọn, không cầu kỳ**. Dùng Tailwind, không cần asset bản quyền — dùng emoji/SVG đơn giản (💎 🪨 💣 🏆 ⛏️).

- **LoginPage**: ô mã SV + access code, nút Đăng nhập, thông báo lỗi rõ.
- **LobbyPage**: tên người chơi, luật chơi ngắn, đồng hồ chưa chạy, nút **Bắt đầu**. Nếu đã chơi rồi → hiện kết quả + rank.
- **GamePage** (màn chính, layout giống ảnh):
  - Trái: **QuestionCard** (đề + 4 đáp án dạng nút lớn) + **Timer** đếm ngược.
  - Phải: **TreasureBoard** (lưới ô). Khi được quyền đào, ô hover sáng, click để đào; ô đã đào lật mở (💎/💣/⛏️/🏆).
  - Trên: **ScorePanel** (điểm hiện tại, tên, mini-rank "Bạn đang hạng #x").
  - Phản hồi đúng/sai bằng màu + animation nhẹ.
- **LeaderboardPage**: **RankTable** top 20 live, highlight chính mình; badge 🏅 cho Top được bonus (sau khi đóng event).
- **AdminPage**: import SV, import câu hỏi, xuất access code, mở/đóng event, bấm tính bonus, xuất kết quả. Bảo vệ bằng `admin_key`.

Responsive: ưu tiên desktop/laptop (phòng máy), nhưng không vỡ trên tablet.

---

## 10. Cấu hình (.env.example + config.ts)

```
PORT=4000
APP_SECRET=doi-secret-nay         # dùng ký access_code + JWT
ADMIN_KEY=admin-doi-key
EVENT_ID=violympic-2026-06
EVENT_DATE=2026-06-25             # đưa vào seed access_code
TIME_LIMIT_S=1200                 # 20 phút
BOARD_ROWS=6
BOARD_COLS=6
WRONG_TIME_PENALTY_S=0
FAST_ANSWER_MS=5000
END_ON_CHEST=false
ALLOW_REPLAY=false
```

`config.ts` còn chứa: phân bổ ô bàn cờ, map điểm theo difficulty, `BONUS_TIERS`.

---

## 11. Phases build (làm tuần tự, mỗi phase phải chạy + test được)

**Phase 0 — Khởi tạo**
- Tạo monorepo (root scripts), server + client skeleton, Tailwind, `.env.example`, README.
- `npm run dev` chạy đồng thời client (5173) + server (4000), proxy API.
- ✅ Test: mở client thấy trang trắng "Hello", `GET /api/health` trả 200.

**Phase 1 — DB + Seed**
- `db.ts` migrate schema. `seed.service.ts` đọc `seed/questions.sample.json` & `seed/students.sample.csv` nạp vào DB (chạy `npm run seed`).
- Sinh access_code cho từng SV; lệnh in ra bảng (mã SV → code).
- ✅ Test: query đếm được 50 SV + N câu hỏi; access_code deterministic (chạy lại ra y hệt).

**Phase 2 — Auth**
- `/api/auth/login` + JWT + middleware. Admin login bằng `admin_key`.
- Client LoginPage hoạt động, lưu token, redirect Lobby.
- ✅ Test: login đúng/sai mã & code; route bảo vệ chặn khi thiếu token.

**Phase 3 — Game core (server)**
- `game.service.ts`: start session, sinh bàn cờ theo seed, phát câu hỏi (kèm question_token), chấm answer, xử lý dig, finish, timer authoritative.
- `scoring.service.ts` công thức điểm.
- ✅ Test (vài unit test + REST): chơi 1 phiên giả lập bằng curl/script → điểm cộng đúng, hết giờ tự finish, không lộ correct_index.

**Phase 4 — Game UI**
- GamePage: QuestionCard, TreasureBoard, Timer, ScorePanel nối API. Flow đúng → sai → đào hoạt động mượt.
- ✅ Test thủ công: chơi trọn 1 phiên trên trình duyệt.

**Phase 5 — Leaderboard real-time**
- Socket.IO broadcast, RankTable live, fallback polling. LeaderboardPage.
- ✅ Test: mở 2–3 tab chơi song song, bảng xếp hạng cập nhật.

**Phase 6 — Admin + Bonus + Export**
- AdminPage: import SV/câu hỏi (upload file), xuất access code CSV, mở/đóng event, tính bonus, xuất kết quả CSV (kèm bonus).
- ✅ Test: nạp file câu hỏi mới (seed sau) không cần sửa code; tính bonus áp đúng BONUS_TIERS; xuất CSV mở được.

**Phase 7 — Hardening**
- Validate zod toàn bộ input, rate-limit login, chống chơi lại (UNIQUE session), xử lý mất kết nối giữa chừng (resume session đang in_progress).
- Seed script chịu tải: test 50 phiên đồng thời (script gọi song song) không lỗi/khoá DB (bật WAL mode cho SQLite).
- README: hướng dẫn deploy 1 máy (PM2 hoặc `node dist`), backup file `.db`.

---

## 12. Định dạng file seed (đã có mẫu trong /seed)

**questions.sample.json** — mảng object:
```json
{
  "id": "toan-001",
  "subject": "Toán",
  "grade": 5,
  "difficulty": "easy",
  "content": "Hiện nay tuổi của hai anh em cộng lại là 12 tuổi. Hỏi 3 năm nữa tuổi của hai anh em cộng lại là bao nhiêu?",
  "options": ["14", "16", "18", "20"],
  "correct_index": 3,
  "points": 10,
  "explanation": "Mỗi người tăng 3 tuổi → cộng thêm 6 → 12 + 6 = 18."
}
```
> Importer phải validate: `correct_index` trong [0, len(options)-1], subject thuộc tập cho phép, không trùng `id`.

**students.sample.csv**:
```
student_code,full_name,class_name
2021001,Nguyễn Văn An,CNTT-K46
```

---

## 13. Acceptance criteria (định nghĩa "xong")

- [ ] 50 SV import từ CSV, mỗi người có access_code in ra được; login đúng/sai xử lý chuẩn.
- [ ] Chơi trọn 1 phiên: trả lời → đào → điểm cộng đúng (server-side), timer chính xác, finish lưu time_spent.
- [ ] Không lộ đáp án đúng ở payload câu hỏi.
- [ ] Leaderboard live cập nhật khi nhiều người chơi cùng lúc; tie-break theo thời gian.
- [ ] Nạp được bộ câu hỏi mới (seed sau) qua Admin mà không sửa code; tối thiểu 6 môn chạy được.
- [ ] Tính & gán điểm bonus Top N đúng cấu hình; xuất CSV kết quả + bonus.
- [ ] Chạy ổn định 50 phiên đồng thời (SQLite WAL), không vỡ UI.
- [ ] README chạy được từ đầu: `npm install` → `npm run seed` → `npm run dev`.

---

## 14. Cách làm việc (cho Claude Code)

- Build **theo từng phase**, commit nhỏ, viết test/khả năng test cho mỗi phase trước khi qua phase sau.
- **Không** tự đổi tech stack hay schema lớn mà không ghi chú lý do.
- Giữ logic chấm điểm & state game **chỉ ở server**.
- Ưu tiên code rõ ràng, ít phụ thuộc; bình luận chỗ logic game/điểm.
- Khi gặp quyết định ngoài tài liệu (vd: muốn đổi luật đào, đổi cơ chế chống gian lận), **dừng và hỏi** thay vì đoán.
- Cập nhật README mỗi khi thêm lệnh/biến môi trường mới.

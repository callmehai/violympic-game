# 🚀 Deploy lên Render

Game chạy như **1 Web Service duy nhất**: server Node vừa chạy API + Socket.IO, vừa
phục vụ luôn giao diện (client đã build). Không cần tách 2 service, không lo CORS.

> Đã có sẵn [`render.yaml`](../render.yaml) ở gốc repo → deploy kiểu **Blueprint** một cú click.

---

## 0. Chuẩn bị: đẩy code lên GitHub

Render deploy từ Git. Nếu chưa có repo trên GitHub:

```bash
cd violympic-game
git init
git add .
git commit -m "Violympic treasure game"
# tạo repo rỗng trên github.com rồi:
git remote add origin https://github.com/<tài-khoản>/<repo>.git
git branch -M main
git push -u origin main
```

> File `.env` đã được `.gitignore` (không lên GitHub) — đúng, vì khóa bí mật sẽ đặt trên Render.
> `seed/questions.sample.json` **có** trong repo (để tự seed câu hỏi).
> `accounts.csv` (tên + MSSV sinh viên) **KHÔNG** lên Git vì là thông tin cá nhân → sau khi
> deploy, import danh sách SV qua trang **/admin** (xem bước 1.5).

---

## 1. Cách A — Blueprint (khuyên dùng, nhanh nhất)

1. Vào https://dashboard.render.com → **New +** → **Blueprint**.
2. Chọn repo GitHub vừa push. Render tự đọc `render.yaml`.
3. Bấm **Apply**. Render tạo 1 Web Service tên `violympic-treasure`.
4. Vào service → tab **Environment** → đặt **`ADMIN_KEY`** = `Vhai2005` (hoặc khóa bạn muốn).
   (Các biến khác `render.yaml` đã set sẵn; `APP_SECRET` Render tự sinh.)
5. Đợi build ~2–4 phút. Xong sẽ có URL dạng `https://violympic-treasure.onrender.com`.

**1.5. Import danh sách sinh viên** (vì `accounts.csv` không có trong repo):
- Mở `https://...onrender.com/admin` → nhập `ADMIN_KEY`.
- Thẻ **Import sinh viên** → chọn file `accounts.csv` trên máy bạn → **Tải lên & Import**.
- (Câu hỏi đã được tự seed sẵn — không cần import.)

**Xong!** Mở URL đó:
- Người chơi: `https://...onrender.com/`
- Bảng xếp hạng: `https://...onrender.com/leaderboard`
- Quản trị: `https://...onrender.com/admin` (nhập `ADMIN_KEY`)

> Server **tự seed 18 câu hỏi** mỗi lần khởi động (idempotent, **không xoá điểm**).
> Danh sách SV thì import 1 lần qua /admin như trên; với persistent disk, SV đã import
> sẽ **được giữ** qua các lần restart.

---

## 2. Cách B — tạo Web Service thủ công (không cần render.yaml)

New + → **Web Service** → chọn repo, rồi điền:

| Mục | Giá trị |
|---|---|
| Region | **Singapore** (gần VN) |
| Runtime | **Node** |
| Build Command | `npm install && npm --prefix server install --include=dev && npm --prefix client install --include=dev && npm run build` |
| Start Command | `cd server && node dist/seed.cli.js && node dist/index.js` |
| Health Check Path | `/api/health` |

Rồi vào **Environment** thêm các biến (mục 4 bên dưới).

---

## 3. ⚙️ Persistent Disk — giữ điểm khi restart

`render.yaml` đã khai báo 1 ổ đĩa **1 GB** mount tại `/var/data`, và `DB_PATH=/var/data/violympic.db`.
Nhờ đó file SQLite **không bị mất** khi service restart/redeploy → điểm số an toàn cả buổi.

> ⚠️ Ổ đĩa yêu cầu **plan trả phí** (Starter ~7$/tháng). `render.yaml` đặt sẵn `plan: starter`.
> Với buổi thuyết trình ~50 người, mình **khuyên dùng Starter** vì:
> - **Không bị ngủ** (free tier ngủ sau 15 phút không ai vào → lần sau load mất ~50 giây).
> - **Không mất điểm** khi có sự cố restart.
> Dùng xong xoá service là hết tính phí (tính theo giờ).

---

## 4. Biến môi trường (Environment)

| Biến | Giá trị | Ghi chú |
|---|---|---|
| `ADMIN_KEY` | `Vhai2005` | **Bắt buộc tự đặt** (không commit) |
| `APP_SECRET` | *(tự sinh)* | Render tạo ngẫu nhiên; đừng đổi giữa buổi (đổi = mọi người phải đăng nhập lại) |
| `TIME_LIMIT_S` | `300` | 5 phút |
| `FAST_ANSWER_MS` | `10000` | 10 giây thưởng tốc độ |
| `FAST_ANSWER_BONUS` | `5` | |
| `EVENT_ID` / `EVENT_DATE` | `violympic-2026-06` / `2026-06-25` | |
| `DB_PATH` | `/var/data/violympic.db` | trỏ vào ổ đĩa bền (nếu có) |
| `NODE_VERSION` | `22` | bản Node ổn định cho `better-sqlite3` |

> Nếu KHÔNG đặt, code có default hợp lý (5 phút, 10s, board 6×6…) trừ `ADMIN_KEY`
> (default `admin123`) và `APP_SECRET` → **nên đặt 2 cái này**.

---

## 5. Phương án FREE (nếu không muốn trả phí)

Chấp nhận đánh đổi, làm 3 việc:
1. Sửa [`render.yaml`](../render.yaml): đổi `plan: starter` → `plan: free`, **xoá** cả khối `disk:`,
   và đổi `DB_PATH` → `./data/violympic.db`.
2. Deploy như cách A.
3. **Lưu ý quan trọng khi chạy free:**
   - Service **ngủ sau 15 phút** không có ai truy cập → lần đầu vào lại chờ ~50 giây.
   - Ổ đĩa tạm → **restart/ngủ dậy là MẤT hết điểm** (SV + câu hỏi tự seed lại, nhưng phiên chơi mất).
   - → Trước giờ thi, mở sẵn trang cho "nóng máy"; đừng để gián đoạn 15 phút giữa chừng.

---

## 6. ✅ Checklist trước buổi thi

- [ ] Build trên Render xanh (Logs hiện `server chạy cổng ...`).
- [ ] Vào `/admin` bằng `ADMIN_KEY` → **Import sinh viên** (upload `accounts.csv`).
- [ ] Kiểm tra **Trạng thái sự kiện = Mở**, đủ số SV vừa import + 18 câu.
- [ ] Mở URL `/` đăng nhập thử 1 MSSV bất kỳ trong `accounts.csv` (mật khẩu = MSSV).
- [ ] Mở 2–3 tab chơi thử → `/leaderboard` cập nhật real-time.
- [ ] Phát cho lớp đúng **URL gốc** (`https://...onrender.com`) + dặn mật khẩu = MSSV.
- [ ] (Nếu cần làm sạch điểm chơi thử) vào `/admin` **reset** từng SV, hoặc redeploy
      với DB sạch — xem ghi chú dưới.

> **Làm sạch điểm trước buổi thật:** nếu dùng persistent disk, dữ liệu chơi thử còn đó.
> Cách nhanh: trong Render Shell (tab Shell) chạy
> `rm /var/data/violympic.db*` rồi **Restart** service (sẽ tự seed lại sạch).

---

## 7. Cập nhật về sau

`autoDeploy: true` → cứ `git push` lên nhánh `main` là Render tự build lại.
Sửa câu hỏi: đổi `seed/questions.sample.json` → push → service restart sẽ tự seed lại
(upsert, không mất điểm). **Đừng** đổi cấu hình/đẩy code **giữa lúc đang có người chơi dở**.

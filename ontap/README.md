# Ôn tập MLN122 — trang tĩnh 526 câu

`index.html` là **một file HTML tự chứa** (HTML + CSS + JS + toàn bộ 526 câu hỏi nhúng sẵn,
~210 KB). Không cần server, không cần build, không gọi API — mở bằng trình duyệt là chạy.

## Tính năng

- Không đăng nhập, không đếm giờ.
- Bấm 1 trong các đáp án → hiện đúng/sai ngay; sang câu khác là trạng thái reset (ôn đi ôn lại được).
- Câu nhiều đáp án (25 câu) → ô đã chọn tô xanh + ☑, **bấm lại để bỏ chọn**, xong bấm **✅ Kiểm tra** (hoặc Enter) mới lật đáp án.

### Sân chơi (khoảng trống dưới câu hỏi)

3 ô đặt ngay dưới thẻ câu hỏi — chỗ trước đây bỏ trống. **Bấm vào ô nào là chơi ô đó ngay**,
thuần ngẫu nhiên, không cược/không điểm/không thưởng phạt:

- 🎲 **Xúc xắc** — một viên xúc xắc 3D thật (6 mặt CSS `transform-style: preserve-3d`), nảy lên và
  lăn nhiều vòng rồi dừng đúng mặt, có bóng đổ co giãn theo. Phím tắt <kbd>D</kbd>.
- 🪙 **Đồng xu** — xu bay lên theo hình vòng cung, xoay `rotateY` nhiều vòng rồi rơi xuống đúng mặt Sấp/Ngửa.
- 🔮 **Bốc quẻ ôn thi** — quả cầu phát sáng và toả khói (particle mờ bay lên) trước khi hiện một trong 10 lời phán.

Thanh trên cùng có 🔥 số câu đúng liên tiếp và 🎯 tỉ lệ đúng — chỉ để tự theo dõi, không phải điểm số.
Đúng 5 câu liên tiếp thì có confetti chúc mừng.
- Chuyển câu: nút Trước / Câu sau, 🎲 Ngẫu nhiên, hoặc nhập số câu rồi bấm **Đi**.
- Lọc theo từ khoá (bỏ dấu vẫn tìm được), ★ đánh dấu câu khó + chế độ chỉ ôn câu đã đánh dấu, 🔀 trộn thứ tự.
- Sáng/tối, phím tắt (← → chuyển câu, A–E hoặc 1–5 chọn đáp án, Space, R, S).
- Tiến độ / câu đánh dấu lưu ở `localStorage` của mỗi người, không gửi đi đâu cả.

## Deploy miễn phí

Chỉ cần đưa `index.html` lên bất kỳ static host nào:

| Cách | Thao tác |
|---|---|
| **Netlify Drop** | Vào https://app.netlify.com/drop → kéo thả **thư mục `ontap/`** → có link ngay, không cần tài khoản để thử |
| **Cloudflare Pages** | Tạo project → Upload assets → chọn thư mục `ontap/` |
| **GitHub Pages** | Push repo → Settings → Pages → Deploy from branch `main`, folder `/ (root)` → link là `https://<user>.github.io/<repo>/ontap/` |
| **Vercel** | `npx vercel deploy ontap --prod` |

Không cần Render / không tốn tiền, vì đây chỉ là file tĩnh.

## Trong app game

Bản sao nằm ở `client/public/ontap/index.html` để trang login link tới `/ontap/`.
Sau khi sửa file gốc, chạy:

```bash
npm run ontap:sync
```

## Nguồn dữ liệu

`questions.json` được trích tự động từ bộ 526 thẻ ghi nhớ MLN122 (Quizlet) do người dùng cung cấp,
định dạng:

```jsonc
{ "id": 1, "q": "nội dung câu hỏi", "options": ["...", "..."], "answers": [3] }
```

`answers` là **chỉ số** (0 = A). Sửa/bổ sung câu hỏi thì sửa `questions.json` rồi nhúng lại vào
`index.html` (khối `<script id="qdata">`).

> Ghi chú: bản PDF gốc thiếu phương án D ở câu **#222** và **#291** (dù đáp án chấm là D).
> Hai câu này đã được bổ sung phương án D và có gắn nhãn cảnh báo hiển thị ngay trên trang.

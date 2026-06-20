/**
 * seed.cli.ts — script nạp dữ liệu thật vào DB. Chạy: `npm run seed` (tsx).
 * Cách dùng:
 *   npm run seed [đường-dẫn-accounts.csv] [đường-dẫn-questions.json]
 * Mặc định đọc ../seed/accounts.csv và ../seed/questions.sample.json (cwd = thư mục server).
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from './db';
import {
  importStudentsFromCsv,
  importQuestionsFromJson,
  importMountainQuestionsFromJson,
} from './services/seed.service';

/** Đọc file nếu có; trả null nếu không tồn tại (KHÔNG làm sập tiến trình). */
function readIfExists(file: string): string | null {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

function main(): void {
  const studentsPath =
    process.argv[2] || path.resolve(process.cwd(), '../seed/accounts.csv');
  const questionsPath =
    process.argv[3] || path.resolve(process.cwd(), '../seed/questions.sample.json');
  const mountainPath =
    process.argv[4] || path.resolve(process.cwd(), '../seed/mountain.sample.json');

  console.log('=== Violympic — Seed dữ liệu ===');
  console.log(`SV         : ${studentsPath}`);
  console.log(`Câu hỏi G1 : ${questionsPath}`);
  console.log(`Câu hỏi G2 : ${mountainPath}\n`);

  // --- Nạp SV (TÙY CHỌN: file accounts.csv chứa thông tin cá nhân, không kèm trong repo).
  //     Trên server triển khai (vd Render) thường không có file này → bỏ qua, import qua /admin.
  const csv = readIfExists(studentsPath);
  if (csv) {
    const s = importStudentsFromCsv(csv);
    console.log(`[Học sinh]  thêm mới: ${s.inserted}, cập nhật: ${s.updated}`);
  } else {
    console.log(`[Học sinh]  BỎ QUA — không thấy ${studentsPath}.`);
    console.log(`            → Import danh sách SV qua trang /admin (Import sinh viên).`);
  }

  // --- Nạp câu hỏi ---
  const json = readIfExists(questionsPath);
  if (json) {
    const q = importQuestionsFromJson(json);
    console.log(`[Câu hỏi]   thêm mới: ${q.inserted}, cập nhật: ${q.updated}`);
    if (q.errors.length > 0) {
      console.log(`[Câu hỏi]   ${q.errors.length} lỗi (đã bỏ qua):`);
      for (const err of q.errors) console.log(`            - ${err}`);
    }
  } else {
    console.log(`[Câu hỏi]   BỎ QUA — không thấy ${questionsPath}.`);
  }

  // --- Nạp câu hỏi Game 2 "Vượt Ải" ---
  const mtnJson = readIfExists(mountainPath);
  if (mtnJson) {
    const m = importMountainQuestionsFromJson(mtnJson);
    console.log(`[Vượt Ải]   thêm mới: ${m.inserted}, cập nhật: ${m.updated}`);
    if (m.errors.length > 0) {
      console.log(`[Vượt Ải]   ${m.errors.length} lỗi (đã bỏ qua):`);
      for (const err of m.errors) console.log(`            - ${err}`);
    }
  } else {
    console.log(`[Vượt Ải]   BỎ QUA — không thấy ${mountainPath}.`);
  }

  // --- Bảng kiểm: 10 SV đầu (mã → mật khẩu) + tổng số ---
  const total = (db.prepare('SELECT COUNT(*) AS c FROM students').get() as { c: number }).c;
  const sample = db
    .prepare('SELECT student_code, password FROM students ORDER BY id LIMIT 10')
    .all() as { student_code: string; password: string }[];

  console.log('\n--- 10 tài khoản đầu (MSSV → mật khẩu) ---');
  for (const row of sample) {
    console.log(`  ${row.student_code.padEnd(14)} → ${row.password}`);
  }
  console.log(`\nTổng số học sinh trong DB: ${total}`);
  console.log('Đăng nhập bằng MSSV + mật khẩu (mật khẩu = MSSV).\n');

  // đóng kết nối để process không treo
  db.close();
  process.exit(0);
}

main();

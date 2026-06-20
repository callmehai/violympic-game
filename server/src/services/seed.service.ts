/**
 * seed.service.ts — nạp dữ liệu SV (accounts.csv) và câu hỏi (questions.json) vào DB.
 * UPSERT idempotent: chạy lại nhiều lần không nhân đôi dữ liệu.
 */
import { db } from '../db';
import { config } from '../config';
import type { Subject, Difficulty, MountainQuestionType } from '../types';
import { SUBJECTS, DIFFICULTIES, MOUNTAIN_TYPES } from '../types';

// ===================== CSV parser (chuẩn tối thiểu) =====================
/**
 * Parse text CSV → mảng hàng (mỗi hàng là mảng cell).
 * - Hỗ trợ field bọc nháy kép có chứa phẩy và nháy kép escape ("").
 * - Tự nhận diện dấu phân tách: , hoặc ; (ưu tiên cái xuất hiện nhiều hơn ở dòng đầu).
 * - Bỏ qua các dòng trống.
 */
export function parseCsv(text: string): string[][] {
  // bỏ BOM nếu có
  const clean = text.replace(/^﻿/, '');

  // tự nhận diện dấu phân tách dựa trên dòng header (đếm ngoài vùng nháy đơn giản)
  const firstLine = clean.split(/\r?\n/, 1)[0] ?? '';
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const delim = semiCount > commaCount ? ';' : ',';

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let started = false; // đã có ký tự/đã bắt đầu 1 record chưa (để biết hàng có rỗng không)

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    // bỏ hàng hoàn toàn trống (mọi cell rỗng)
    const isEmpty = row.every((c) => c.trim() === '');
    if (!isEmpty) rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];

    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          // nháy kép escape ""
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      started = true;
      continue;
    }
    if (ch === delim) {
      pushField();
      started = true;
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    if (ch === '\n') {
      if (started || field !== '' || row.length > 0) pushRow();
      else {
        // dòng trống thuần
        field = '';
        row = [];
      }
      continue;
    }
    field += ch;
    started = true;
  }
  // record cuối nếu không kết thúc bằng newline
  if (started || field !== '' || row.length > 0) pushRow();

  return rows;
}

// ===================== Import students =====================
interface StudentExists {
  c: number;
}

/**
 * Nạp SV từ CSV. Map cột linh hoạt theo tên header.
 * UPSERT theo student_code. Mật khẩu mặc định = student_code nếu thiếu cột.
 */
export function importStudentsFromCsv(csv: string): { inserted: number; updated: number } {
  const rows = parseCsv(csv);
  if (rows.length === 0) return { inserted: 0, updated: 0 };

  const header = rows[0].map((h) => h.trim());
  const lower = header.map((h) => h.toLowerCase());

  // tìm index cột theo từ khoá (không phân biệt hoa thường)
  const findCol = (...keys: string[]): number => {
    for (let i = 0; i < lower.length; i++) {
      for (const k of keys) {
        if (lower[i].includes(k.toLowerCase())) return i;
      }
    }
    return -1;
  };

  const codeCol = findCol('mssv', 'student_code', 'tài khoản', 'tai khoan');
  const nameCol = findCol('họ và tên', 'ho va ten', 'full_name', 'name');
  const passCol = findCol('mật khẩu', 'mat khau', 'password');
  const classCol = findCol('class_name', 'lớp', 'lop');

  if (codeCol < 0) {
    throw new Error('CSV thiếu cột mã SV (MSSV/Tài khoản/student_code)');
  }

  const existsStmt = db.prepare(
    'SELECT COUNT(*) AS c FROM students WHERE student_code = ?'
  );
  const upsertStmt = db.prepare(
    `INSERT INTO students (student_code, full_name, class_name, password)
     VALUES (@code, @name, @class, @pass)
     ON CONFLICT(student_code) DO UPDATE SET
       full_name  = excluded.full_name,
       class_name = excluded.class_name,
       password   = excluded.password`
  );

  let inserted = 0;
  let updated = 0;

  const run = db.transaction(() => {
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      const code = (cells[codeCol] ?? '').trim();
      if (code === '') continue; // validate: mã không rỗng → bỏ qua

      const name = nameCol >= 0 ? (cells[nameCol] ?? '').trim() : '';
      const pass =
        passCol >= 0 && (cells[passCol] ?? '').trim() !== ''
          ? (cells[passCol] ?? '').trim()
          : code; // thiếu mật khẩu → dùng chính mã làm mật khẩu
      const className =
        classCol >= 0 && (cells[classCol] ?? '').trim() !== ''
          ? (cells[classCol] ?? '').trim()
          : null;

      const existed = (existsStmt.get(code) as StudentExists).c > 0;
      upsertStmt.run({
        code,
        name: name || code, // tránh full_name rỗng (NOT NULL)
        class: className,
        pass,
      });
      if (existed) updated++;
      else inserted++;
    }
  });
  run();

  return { inserted, updated };
}

// ===================== Import questions =====================
interface RawQuestion {
  id?: unknown;
  subject?: unknown;
  grade?: unknown;
  difficulty?: unknown;
  content?: unknown;
  options?: unknown;
  correct_index?: unknown;
  points?: unknown;
  explanation?: unknown;
}

interface QuestionExists {
  c: number;
}

/**
 * Nạp câu hỏi từ JSON (mảng object). Validate từng câu; lỗi → push vào errors và bỏ qua.
 * UPSERT theo ext_id (= q.id).
 */
export function importQuestionsFromJson(json: string): {
  inserted: number;
  updated: number;
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { inserted: 0, updated: 0, errors: [`JSON không hợp lệ: ${(e as Error).message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { inserted: 0, updated: 0, errors: ['JSON phải là một mảng câu hỏi'] };
  }

  const existsStmt = db.prepare('SELECT COUNT(*) AS c FROM questions WHERE ext_id = ?');
  const upsertStmt = db.prepare(
    `INSERT INTO questions
       (ext_id, subject, grade, difficulty, content, options_json, correct_index, points, explanation, active)
     VALUES
       (@ext_id, @subject, @grade, @difficulty, @content, @options_json, @correct_index, @points, @explanation, 1)
     ON CONFLICT(ext_id) DO UPDATE SET
       subject       = excluded.subject,
       grade         = excluded.grade,
       difficulty    = excluded.difficulty,
       content       = excluded.content,
       options_json  = excluded.options_json,
       correct_index = excluded.correct_index,
       points        = excluded.points,
       explanation   = excluded.explanation,
       active        = 1`
  );

  let inserted = 0;
  let updated = 0;

  const run = db.transaction(() => {
    for (let i = 0; i < (parsed as RawQuestion[]).length; i++) {
      const q = (parsed as RawQuestion[])[i];
      const idLabel =
        typeof q?.id === 'string' || typeof q?.id === 'number' ? String(q.id) : `#${i}`;

      // --- Validate ---
      const subject = q?.subject as Subject;
      if (!SUBJECTS.includes(subject)) {
        errors.push(`[${idLabel}] subject không hợp lệ: ${String(q?.subject)}`);
        continue;
      }
      const difficulty = q?.difficulty as Difficulty;
      if (!DIFFICULTIES.includes(difficulty)) {
        errors.push(`[${idLabel}] difficulty không hợp lệ: ${String(q?.difficulty)}`);
        continue;
      }
      if (!Array.isArray(q?.options) || (q.options as unknown[]).length < 2) {
        errors.push(`[${idLabel}] options phải là mảng >= 2 phần tử`);
        continue;
      }
      const options = (q.options as unknown[]).map((o) => String(o));
      const ci = q?.correct_index;
      if (
        typeof ci !== 'number' ||
        !Number.isInteger(ci) ||
        ci < 0 ||
        ci > options.length - 1
      ) {
        errors.push(`[${idLabel}] correct_index ngoài khoảng [0, ${options.length - 1}]`);
        continue;
      }
      const content = typeof q?.content === 'string' ? q.content.trim() : '';
      if (content === '') {
        errors.push(`[${idLabel}] content rỗng`);
        continue;
      }

      // --- Chuẩn hoá trường ---
      const extId = idLabel; // dùng làm khoá UPSERT
      // điểm: ưu tiên q.points (số dương), fallback theo độ khó
      const points =
        typeof q?.points === 'number' && Number.isFinite(q.points) && q.points > 0
          ? Math.round(q.points)
          : config.difficultyPoints[difficulty];
      const grade =
        typeof q?.grade === 'number' && Number.isFinite(q.grade) ? Math.round(q.grade) : null;
      const explanation = typeof q?.explanation === 'string' ? q.explanation : null;

      const existed = (existsStmt.get(extId) as QuestionExists).c > 0;
      upsertStmt.run({
        ext_id: extId,
        subject,
        grade,
        difficulty,
        content,
        options_json: JSON.stringify(options),
        correct_index: ci,
        points,
        explanation,
      });
      if (existed) updated++;
      else inserted++;
    }
  });
  run();

  return { inserted, updated, errors };
}

// ===================== Import câu hỏi Game 2 "Vượt Ải" =====================
interface RawMountain {
  id?: unknown;
  type?: unknown;
  subject?: unknown;
  difficulty?: unknown;
  content?: unknown;
  points?: unknown;
  explanation?: unknown;
  // theo kiểu:
  options?: unknown; // mcq
  answer_index?: unknown; // mcq
  accept?: unknown; // fill
  suffix?: unknown; // fill (nhãn đơn vị, tuỳ chọn)
  answer?: unknown; // truefalse (boolean)
  items?: unknown; // order (đúng thứ tự)
}

/**
 * Nạp câu hỏi Game 2 từ JSON. Mỗi câu có `type` quyết định cách validate + chuẩn hoá:
 *  - mcq:       options[] (>=2) + answer_index trong [0, len-1]
 *  - fill:      accept[] (>=1 chuỗi không rỗng) + suffix? (nhãn)
 *  - truefalse: answer là boolean
 *  - order:     items[] (>=2) — LƯU theo ĐÚNG thứ tự (server tự trộn khi hiển thị)
 * UPSERT theo ext_id (= q.id).
 */
export function importMountainQuestionsFromJson(json: string): {
  inserted: number;
  updated: number;
  errors: string[];
} {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return { inserted: 0, updated: 0, errors: [`JSON không hợp lệ: ${(e as Error).message}`] };
  }
  if (!Array.isArray(parsed)) {
    return { inserted: 0, updated: 0, errors: ['JSON phải là một mảng câu hỏi'] };
  }

  const existsStmt = db.prepare('SELECT COUNT(*) AS c FROM mountain_questions WHERE ext_id = ?');
  const upsertStmt = db.prepare(
    `INSERT INTO mountain_questions
       (ext_id, type, subject, difficulty, content, payload_json, answer_json, points, explanation, active)
     VALUES
       (@ext_id, @type, @subject, @difficulty, @content, @payload_json, @answer_json, @points, @explanation, 1)
     ON CONFLICT(ext_id) DO UPDATE SET
       type         = excluded.type,
       subject      = excluded.subject,
       difficulty   = excluded.difficulty,
       content      = excluded.content,
       payload_json = excluded.payload_json,
       answer_json  = excluded.answer_json,
       points       = excluded.points,
       explanation  = excluded.explanation,
       active       = 1`,
  );

  let inserted = 0;
  let updated = 0;

  const run = db.transaction(() => {
    const arr = parsed as RawMountain[];
    for (let i = 0; i < arr.length; i++) {
      const q = arr[i];
      const idLabel =
        typeof q?.id === 'string' || typeof q?.id === 'number' ? String(q.id) : `#${i}`;

      const type = q?.type as MountainQuestionType;
      if (!MOUNTAIN_TYPES.includes(type)) {
        errors.push(`[${idLabel}] type không hợp lệ: ${String(q?.type)}`);
        continue;
      }
      const difficulty = q?.difficulty as Difficulty;
      if (!DIFFICULTIES.includes(difficulty)) {
        errors.push(`[${idLabel}] difficulty không hợp lệ: ${String(q?.difficulty)}`);
        continue;
      }
      const content = typeof q?.content === 'string' ? q.content.trim() : '';
      if (content === '') {
        errors.push(`[${idLabel}] content rỗng`);
        continue;
      }

      // --- validate + chuẩn hoá theo kiểu ---
      let payload: unknown;
      let answer: unknown;

      if (type === 'mcq') {
        if (!Array.isArray(q?.options) || (q.options as unknown[]).length < 2) {
          errors.push(`[${idLabel}] mcq cần options[] >= 2`);
          continue;
        }
        const options = (q.options as unknown[]).map((o) => String(o));
        const ai = q?.answer_index;
        if (typeof ai !== 'number' || !Number.isInteger(ai) || ai < 0 || ai > options.length - 1) {
          errors.push(`[${idLabel}] mcq answer_index ngoài [0, ${options.length - 1}]`);
          continue;
        }
        payload = { options };
        answer = { index: ai };
      } else if (type === 'fill') {
        if (!Array.isArray(q?.accept) || (q.accept as unknown[]).length < 1) {
          errors.push(`[${idLabel}] fill cần accept[] >= 1 đáp án`);
          continue;
        }
        const accept = (q.accept as unknown[]).map((a) => String(a).trim()).filter((a) => a !== '');
        if (accept.length < 1) {
          errors.push(`[${idLabel}] fill accept[] toàn rỗng`);
          continue;
        }
        const suffix = typeof q?.suffix === 'string' ? q.suffix : '';
        payload = suffix ? { suffix } : {};
        answer = { accept };
      } else if (type === 'truefalse') {
        if (typeof q?.answer !== 'boolean') {
          errors.push(`[${idLabel}] truefalse cần answer là true/false`);
          continue;
        }
        payload = {};
        answer = { value: q.answer };
      } else {
        // order
        if (!Array.isArray(q?.items) || (q.items as unknown[]).length < 2) {
          errors.push(`[${idLabel}] order cần items[] >= 2 (theo ĐÚNG thứ tự)`);
          continue;
        }
        const items = (q.items as unknown[]).map((it) => String(it));
        payload = { items };
        answer = {}; // đúng thứ tự = thứ tự items trong file
      }

      const points =
        typeof q?.points === 'number' && Number.isFinite(q.points) && q.points > 0
          ? Math.round(q.points)
          : config.difficultyPoints[difficulty];
      const subject = typeof q?.subject === 'string' ? q.subject : null;
      const explanation = typeof q?.explanation === 'string' ? q.explanation : null;

      const existed = (existsStmt.get(idLabel) as { c: number }).c > 0;
      upsertStmt.run({
        ext_id: idLabel,
        type,
        subject,
        difficulty,
        content,
        payload_json: JSON.stringify(payload),
        answer_json: JSON.stringify(answer),
        points,
        explanation,
      });
      if (existed) updated++;
      else inserted++;
    }
  });
  run();

  return { inserted, updated, errors };
}

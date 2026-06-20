/**
 * Load test script — mô phỏng tới N phiên chơi đồng thời để kiểm tra
 * SQLite (WAL) không bị khoá/lỗi khi nhiều người chơi cùng lúc.
 *
 * Chạy: tsx server/scripts/loadtest.ts [N]
 * Env: BASE (mặc định http://localhost:4000)
 *
 * File này NẰM NGOÀI tsconfig build (thư mục scripts) — chỉ chạy bằng tsx.
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE = process.env.BASE || 'http://localhost:4000';
const N = Number(process.argv[2] || 50);

interface Account {
  code: string;
  password: string;
}

/** Đọc seed/accounts.csv, lấy tối đa N tài khoản (student_code, password=student_code). */
function loadAccounts(limit: number): Account[] {
  const csvPath = path.resolve(process.cwd(), '../seed/accounts.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  // Bỏ dòng header
  const body = lines.slice(1);
  const out: Account[] = [];
  for (const line of body) {
    if (out.length >= limit) break;
    // Cột: STT, Tài khoản (MSSV), Mật khẩu, Họ và tên
    const cols = line.split(',');
    const code = (cols[1] || '').trim();
    if (!code) continue;
    // password = student_code theo yêu cầu
    out.push({ code, password: code });
  }
  return out;
}

/** POST JSON helper, có thể kèm Bearer token. */
async function postJson(pathName: string, payload: any, token?: string): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathName}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload ?? {}),
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`POST ${pathName} -> ${res.status} ${text}`);
  }
  return data;
}

/** GET JSON helper với Bearer token. */
async function getJson(pathName: string, token?: string): Promise<any> {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${pathName}`, { method: 'GET', headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`GET ${pathName} -> ${res.status} ${text}`);
  }
  return data;
}

const MAX_ROUNDS = 200;

/** Chạy một phiên chơi đầy đủ cho 1 sinh viên. */
async function runSession(acc: Account): Promise<void> {
  // 1) Đăng nhập lấy token
  const loginRes = await postJson('/api/auth/login', {
    code: acc.code,
    password: acc.password,
  });
  const token: string = loginRes.token;
  if (!token) throw new Error('login: thiếu token');

  // 2) Bắt đầu phiên chơi
  await postJson('/api/game/start', {}, token);

  // 3) Vòng lặp chơi: lấy câu hỏi -> trả lời -> (nếu được) đào
  for (let i = 0; i < MAX_ROUNDS; i++) {
    const nq = await getJson('/api/game/next-question', token);
    if (nq && nq.done === true) break;

    const questionToken: string = nq.question_token;
    if (!questionToken) {
      // Không có token câu hỏi mà cũng chưa done -> tránh vòng lặp vô hạn
      break;
    }

    // Luôn chọn đáp án index 0 (không cần đúng, chỉ để tạo tải)
    const ans = await postJson(
      '/api/game/answer',
      { question_token: questionToken, selected_index: 0 },
      token,
    );

    // Nếu được phép đào, chọn 1 ô chưa đào ngẫu nhiên theo index
    if (ans && ans.can_dig === true) {
      const cellIndex = pickUndugCell(ans, i);
      await postJson('/api/game/dig', { cell_index: cellIndex }, token);
    }
  }

  // 4) Kết thúc phiên
  await postJson('/api/game/finish', {}, token);
}

/**
 * Chọn 1 ô chưa đào để đào. Cố gắng đọc board từ response answer;
 * nếu không có thông tin board thì fallback theo index vòng lặp i.
 */
function pickUndugCell(ans: any, i: number): number {
  const cells: any[] | undefined =
    ans?.state?.board?.cells || ans?.board?.cells || ans?.cells;
  if (Array.isArray(cells) && cells.length > 0) {
    const undug = cells
      .map((c: any, idx: number) => ({ idx: c.index ?? idx, dug: !!c.dug }))
      .filter((c) => !c.dug);
    if (undug.length > 0) {
      const pick = undug[Math.floor(Math.random() * undug.length)];
      return pick.idx;
    }
  }
  // Fallback: chọn theo index vòng lặp
  return i;
}

async function main(): Promise<void> {
  const accounts = loadAccounts(N);
  console.log(`Load test: ${accounts.length} phiên đồng thời -> ${BASE}`);

  const t0 = Date.now();
  let ok = 0;
  let fail = 0;
  const errors: string[] = [];

  // Chạy tất cả phiên song song; mỗi lỗi được bắt riêng, không kill cả script
  const results = await Promise.all(
    accounts.map((acc) =>
      runSession(acc)
        .then(() => ({ ok: true as const }))
        .catch((e: any) => ({ ok: false as const, code: acc.code, err: String(e?.message || e) })),
    ),
  );

  for (const r of results) {
    if (r.ok) {
      ok++;
    } else {
      fail++;
      errors.push(`[${(r as any).code}] ${(r as any).err}`);
    }
  }

  const ms = Date.now() - t0;
  console.log('==============================');
  console.log(`Tổng phiên : ${accounts.length}`);
  console.log(`Thành công : ${ok}`);
  console.log(`Thất bại   : ${fail}`);
  console.log(`Thời gian  : ${ms} ms (${(ms / 1000).toFixed(2)} s)`);
  if (errors.length > 0) {
    console.log('--- Lỗi ---');
    for (const e of errors.slice(0, 50)) console.log(e);
  }
  console.log('==============================');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('Load test crashed:', e);
  process.exit(2);
});

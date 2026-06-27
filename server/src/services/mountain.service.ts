/**
 * mountain.service.ts — TRÁI TIM Game 2 "Vượt Ải Trí Tuệ" = MÊ CUNG 2D.
 *
 * Người chơi điều khiển nhân vật đi trong lưới cố định (fix cứng map) tới KHO BÁU.
 *  - Đi tự do trên ô trống. Bước vào ô CỬA (số 1/2/3 = độ khó) → phải trả lời 1 câu.
 *      • Đúng → cửa MỞ (đi qua được) + điểm (+thưởng tốc độ).
 *      • Sai  → cửa thành ĐÁ (chặn) → phải đi tuyến khác (KHÔNG mất mạng).
 *  - Map cố định nhiều tuyến tới đích; chỉ THUA khi KHÔNG còn đường nào tới đích (kẹt).
 *  - Tới đích = thắng (thưởng lớn theo thời gian còn).
 *
 * Mỗi cửa gán SẴN 1 câu ĐÚNG độ khó của cửa (1 dễ, 2 TB, 3 khó).
 * Mọi chấm điểm + trạng thái ở SERVER. Dùng chung bảng sessions (event '::mountain').
 */
import type {
  MountainService,
  MazeStateDTO,
  MazeCell,
  MazeProgress,
  MoveResultDTO,
  MazeAnswerDTO,
  MazeFinishDTO,
  GateStatus,
  MountainQuestionRow,
  StudentRow,
  SessionRow,
  LeaderboardNotifier,
  QuestionTokenPayload,
  Difficulty,
} from '../types';
import { config } from '../config';
import { db, isEventOpen } from '../db';
import { hashSeed, seededShuffle } from '../util/seededRandom';
import { reachable } from '../util/maze';
import { signQuestionToken, verifyQuestionToken } from '../util/jwt';
import { GameError } from '../util/errors';
import { leaderboardService } from './leaderboard.service';
import { mountainQuestionService } from './mountainQuestion.service';

// ===================== Bản đồ CỐ ĐỊNH (theo thiết kế người dùng) =====================
// '#' đá · '.' lối đi · 'S' xuất phát · 'E' đích
// '1' cổng DỄ · '2' cổng TB · '3' cổng KHÓ (số in trên cửa = độ khó câu hỏi cửa đó phát ra).
// Cửa rải theo đường chéo trên→trái xuống dưới→phải, dễ trước khó sau.
// Đã verify BFS: BẮT BUỘC qua cửa mới tới đích (không có đường né), mỗi tầng đều bắt buộc, không kẹt oan.
const MAZE_VER = 5; // đổi map/luật/điểm ⇒ bump để phiên cũ tự tạo lại
const MAZE_MAP = [
  '#########',
  '#S..#..##',
  '#...1..##',
  '#..1#..##',
  '#1#...2.#',
  '#...#.#.#',
  '#....2..#',
  '##2.#.#3#',
  '#..#.3..#',
  '##..3..E#',
  '#########',
];

/** Mức số trên cửa → độ khó câu hỏi. */
const LEVEL_DIFF: Record<number, Difficulty> = { 1: 'easy', 2: 'medium', 3: 'hard' };

interface ParsedMaze {
  rows: number;
  cols: number;
  base: MazeCell[]; // 0 tường, 1 lối, 3 xuất phát, 4 đích (cổng lưu riêng)
  gates: number[]; // index các ô cổng
  gateLevel: Record<number, number>; // ô cổng → 1/2/3
  start: number;
  exit: number;
}

function parseMaze(): ParsedMaze {
  const rows = MAZE_MAP.length;
  const cols = MAZE_MAP[0].length;
  const base: MazeCell[] = new Array(rows * cols).fill(0);
  const gates: number[] = [];
  const gateLevel: Record<number, number> = {};
  let start = 0;
  let exit = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = MAZE_MAP[r][c];
      const i = r * cols + c;
      if (ch === '#') base[i] = 0;
      else if (ch === '.') base[i] = 1;
      else if (ch === 'S') {
        base[i] = 3;
        start = i;
      } else if (ch === 'E') {
        base[i] = 4;
        exit = i;
      } else if (ch === '1' || ch === '2' || ch === '3') {
        base[i] = 1; // nền là lối đi; "cổng" là lớp phủ động
        gates.push(i);
        gateLevel[i] = Number(ch);
      }
    }
  }
  return { rows, cols, base, gates, gateLevel, start, exit };
}

const MAZE = parseMaze();
const GATE_SET = new Set(MAZE.gates);

// ===================== Notifier =====================
let notifier: LeaderboardNotifier = () => {};
export function setMountainNotifier(fn: LeaderboardNotifier): void {
  notifier = fn;
}

// ===================== Thời gian =====================
function nowIso(): string {
  return new Date().toISOString();
}
function nowMs(): number {
  return Date.now();
}
function elapsedMs(s: SessionRow): number {
  return nowMs() - Date.parse(s.started_at);
}
/** Tổng thời gian KHÔNG tính giờ: pausedMs đã cộng + khoảng đang xem đáp án (nếu có). */
function pausedTotal(prog: MazeProgress): number {
  return (prog.pausedMs ?? 0) + (prog.readingSince !== undefined ? nowMs() - prog.readingSince : 0);
}
/** Thời gian thực sự đã chơi (đã trừ phần xem đáp án). */
function activeMs(s: SessionRow, prog: MazeProgress): number {
  return Math.max(0, elapsedMs(s) - pausedTotal(prog));
}
function timeLeftS(s: SessionRow, prog: MazeProgress): number {
  return Math.max(0, Math.floor((config.mountain.timeLimitS * 1000 - activeMs(s, prog)) / 1000));
}
function isExpired(s: SessionRow, prog: MazeProgress): boolean {
  return config.mountain.timeLimitS * 1000 - activeMs(s, prog) <= 0;
}

// ===================== Load / save =====================
function loadSession(studentId: number, eventId: string): SessionRow | undefined {
  return db
    .prepare('SELECT * FROM sessions WHERE student_id = ? AND event_id = ?')
    .get(studentId, eventId) as SessionRow | undefined;
}
function parseProgress(s: SessionRow): MazeProgress {
  return JSON.parse(s.progress_json ?? '{}') as MazeProgress;
}
function saveSession(
  s: SessionRow,
  prog: MazeProgress,
  patch?: Partial<Pick<SessionRow, 'status' | 'score' | 'finished_at' | 'time_spent_ms'>>,
): void {
  const status = patch?.status ?? s.status;
  const score = patch?.score ?? s.score;
  const finishedAt = patch?.finished_at !== undefined ? patch.finished_at : s.finished_at;
  const timeSpent = patch?.time_spent_ms !== undefined ? patch.time_spent_ms : s.time_spent_ms;
  const progJson = JSON.stringify(prog);
  db.prepare(
    `UPDATE sessions SET progress_json=@prog, status=@status, score=@score,
       finished_at=@finished, time_spent_ms=@timeSpent WHERE id=@id`,
  ).run({
    id: s.id,
    prog: progJson,
    status,
    score,
    finished: finishedAt,
    timeSpent,
  });
  // QUAN TRỌNG: đồng bộ luôn bản in-memory để buildState(s) ngay sau đó đọc đúng tiến độ mới.
  s.progress_json = progJson;
  s.status = status;
  s.score = score;
  s.finished_at = finishedAt;
  s.time_spent_ms = timeSpent;
}

// ===================== Tiện ích =====================
function gateStatusOf(prog: MazeProgress, cell: number): GateStatus {
  return prog.gateStatus[cell] ?? 'locked';
}
/** Ô có đi qua được không (cho di chuyển/đường BFS). Cổng 'blocked' = đá. */
function passable(prog: MazeProgress, i: number): boolean {
  if (GATE_SET.has(i)) return gateStatusOf(prog, i) !== 'blocked';
  return MAZE.base[i] !== 0; // 1/3/4 đi được, 0 tường
}
function isAdjacent(a: number, b: number): boolean {
  const ar = Math.floor(a / MAZE.cols);
  const ac = a % MAZE.cols;
  const br = Math.floor(b / MAZE.cols);
  const bc = b % MAZE.cols;
  return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
}
function displayPerm(studentCode: string, eventId: string, qid: number, n: number): number[] {
  return seededShuffle(
    Array.from({ length: n }, (_, i) => i),
    hashSeed(studentCode, eventId, qid, 'opt'),
  );
}
function foldVi(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'd');
}
function normFill(s: string): string {
  return foldVi(s.trim().toLowerCase()).replace(/\s+/g, ' ').replace(/[.?!]+$/, '').trim();
}
function pointsOf(q: MountainQuestionRow): number {
  // Điểm theo ĐỘ KHÓ cửa (game 2 riêng): dễ 100 · TB 200 · khó 300. Bỏ qua q.points của seed.
  return config.mountain.difficultyPoints[q.difficulty] ?? config.difficultyPoints[q.difficulty] ?? 100;
}

/**
 * Gán SẴN câu hỏi cho TỪNG cửa theo ĐÚNG độ khó của cửa (1=dễ, 2=TB, 3=khó).
 * Tránh trùng câu giữa các cửa khi còn đủ câu. Fallback nếu thiếu câu 1 độ khó
 * (vd ngân hàng chưa có câu "khó" → cửa "3" tạm lấy TB rồi dễ).
 */
function assignGates(): Record<number, number> {
  const pools: Record<Difficulty, number[]> = { easy: [], medium: [], hard: [] };
  for (const q of mountainQuestionService.allActive()) pools[q.difficulty].push(q.id);
  const seed = () => (Math.random() * 0x100000000) >>> 0;
  const shuffled: Record<Difficulty, number[]> = {
    easy: seededShuffle(pools.easy, seed()),
    medium: seededShuffle(pools.medium, seed()),
    hard: seededShuffle(pools.hard, seed()),
  };
  // Thứ tự ưu tiên lấy câu khi độ khó mong muốn thiếu.
  const fallback: Record<Difficulty, Difficulty[]> = {
    easy: ['easy', 'medium', 'hard'],
    medium: ['medium', 'hard', 'easy'],
    hard: ['hard', 'medium', 'easy'],
  };
  const cur: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const used = new Set<number>();
  const gateQ: Record<number, number> = {};

  for (const cell of MAZE.gates) {
    const want = LEVEL_DIFF[MAZE.gateLevel[cell]] ?? 'easy';
    let qid: number | undefined;
    // ưu tiên câu CHƯA dùng đúng độ khó (rồi fallback độ khó khác)
    for (const d of fallback[want]) {
      const pool = shuffled[d];
      for (let k = 0; k < pool.length; k++) {
        const cand = pool[(cur[d] + k) % pool.length];
        if (!used.has(cand)) {
          qid = cand;
          cur[d] = (cur[d] + k + 1) % Math.max(1, pool.length);
          break;
        }
      }
      if (qid !== undefined) break;
    }
    // hết câu chưa dùng → cho phép trùng (ngân hàng quá ít câu)
    if (qid === undefined) {
      for (const d of fallback[want]) {
        if (shuffled[d].length) {
          qid = shuffled[d][cur[d] % shuffled[d].length];
          cur[d]++;
          break;
        }
      }
    }
    if (qid !== undefined) {
      gateQ[cell] = qid;
      used.add(qid);
    }
  }
  return gateQ;
}

// ===================== Build DTO =====================
/** Xây challenge DTO cho cổng đang pending — dùng để phát lần đầu (move) và restore sau reload (getState). */
function buildChallengeDTO(
  student: StudentRow,
  s: SessionRow,
  prog: MazeProgress,
  cell: number,
  eventId: string,
): import('../types').NextChallengeDTO | undefined {
  const qid = prog.gateQ[cell];
  if (qid === undefined) return undefined;
  const q = mountainQuestionService.getById(qid);
  if (!q) return undefined;
  const pl = JSON.parse(q.payload_json) as { options?: string[]; items?: string[]; suffix?: string };
  const elapsed = prog.questionShownAt !== undefined ? nowMs() - prog.questionShownAt : 0;
  const dto: import('../types').NextChallengeDTO = {
    question_id: qid,
    question_token: signQuestionToken({ sid: s.id, qid, cur: 0, cell }, timeLeftS(s, prog)),
    type: q.type,
    subject: q.subject,
    difficulty: q.difficulty,
    content: q.content,
    points: pointsOf(q),
    speed_bonus: config.mountain.speedBonusMax,
    speed_window_ms: config.fastAnswerMs,
    speed_elapsed_ms: elapsed,
  };
  if (q.type === 'mcq' && pl.options) {
    const perm = displayPerm(student.student_code, eventId, qid, pl.options.length);
    dto.options = perm.map((o) => pl.options![o]);
  } else if (q.type === 'order' && pl.items) {
    const perm = displayPerm(student.student_code, eventId, qid, pl.items.length);
    dto.items = perm.map((o) => pl.items![o]);
  } else if (q.type === 'fill') {
    dto.suffix = pl.suffix;
  }
  return dto;
}

function buildState(student: StudentRow, s: SessionRow, eventId: string): MazeStateDTO {
  const prog = parseProgress(s);
  const cells: MazeCell[] = MAZE.base.slice();
  for (const g of MAZE.gates) {
    const st = gateStatusOf(prog, g);
    cells[g] = st === 'open' ? 5 : st === 'blocked' ? 6 : 2; // 5 mở, 6 chặn, 2 khoá
  }
  const state: MazeStateDTO = {
    session_id: s.id,
    status: s.status,
    score: s.score,
    rows: MAZE.rows,
    cols: MAZE.cols,
    cells,
    gate_levels: MAZE.gateLevel, // tĩnh theo map: ô cổng → 1/2/3 (để in số lên cửa)
    pos: prog.pos,
    start: MAZE.start,
    exit: MAZE.exit,
    time_limit_s: config.mountain.timeLimitS,
    time_left_s: timeLeftS(s, prog),
    rank: leaderboardService.rankOf(eventId, student.id),
    finished: s.status === 'finished',
    reached: !!prog.reached,
    gates_opened: prog.correct,
  };
  // Khi có cổng đang chờ trả lời, đính kèm câu hỏi để FE có thể restore sau reload.
  if (s.status === 'in_progress' && prog.pending !== null) {
    state.pending_challenge = buildChallengeDTO(student, s, prog, prog.pending, eventId);
  }
  return state;
}

function finishInternal(s: SessionRow, prog: MazeProgress): void {
  if (s.status === 'finished') return;
  const timeSpent = Math.min(activeMs(s, prog), config.mountain.timeLimitS * 1000);
  saveSession(s, prog, { status: 'finished', finished_at: nowIso(), time_spent_ms: timeSpent });
}

// ===================== Chấm 1 câu (theo kiểu) =====================
interface Graded {
  isCorrect: boolean;
  correct_index?: number;
  correct_text?: string;
  correct_value?: boolean;
  correct_order?: string[];
}
function grade(
  q: MountainQuestionRow,
  studentCode: string,
  eventId: string,
  response: unknown,
): Graded {
  const payload = JSON.parse(q.payload_json) as { options?: string[]; items?: string[] };
  const ans = JSON.parse(q.answer_json) as { index?: number; accept?: string[]; value?: boolean };
  const out: Graded = { isCorrect: false };

  if (q.type === 'mcq' && payload.options) {
    const n = payload.options.length;
    const perm = displayPerm(studentCode, eventId, q.id, n);
    const sel = Number(response);
    if (Number.isInteger(sel) && sel >= 0 && sel < n) out.isCorrect = perm[sel] === ans.index;
    out.correct_index = perm.indexOf(ans.index ?? -1);
  } else if (q.type === 'fill') {
    const accept = ans.accept ?? [];
    const raw = typeof response === 'string' ? response : String(response ?? '');
    const userN = normFill(raw);
    const userNum = Number(raw.trim().replace(',', '.'));
    out.isCorrect = accept.some((a) => {
      if (normFill(a) === userN && userN !== '') return true;
      const aNum = Number(String(a).trim().replace(',', '.'));
      return Number.isFinite(aNum) && Number.isFinite(userNum) && aNum === userNum;
    });
    out.correct_text = accept[0];
  } else if (q.type === 'truefalse') {
    const val = response === true || response === 'true';
    out.isCorrect = val === ans.value;
    out.correct_value = ans.value;
  } else if (q.type === 'order' && payload.items) {
    const n = payload.items.length;
    const perm = displayPerm(studentCode, eventId, q.id, n);
    if (Array.isArray(response) && response.length === n) {
      const seen = new Set<number>();
      let valid = true;
      const origSeq: number[] = [];
      for (const d of response) {
        const di = Number(d);
        if (!Number.isInteger(di) || di < 0 || di >= n || seen.has(di)) {
          valid = false;
          break;
        }
        seen.add(di);
        origSeq.push(perm[di]);
      }
      out.isCorrect = valid && origSeq.every((v, i) => v === i);
    }
    out.correct_order = payload.items;
  }
  return out;
}

// ===================== Service =====================
export const mountainService: MountainService = {
  startSession(student: StudentRow, eventId: string): MazeStateDTO {
    sweepExpired(eventId);
    let s = loadSession(student.id, eventId);

    if (s) {
      if (s.status === 'finished') {
        if (config.allowReplay) {
          db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
          s = undefined;
        } else {
          return buildState(student, s, eventId);
        }
      } else if (s.status === 'in_progress') {
        const prog = parseProgress(s);
        if (typeof prog.pos !== 'number' || prog.ver !== MAZE_VER) {
          // Phiên cũ (map/định dạng trước) → bỏ, tạo lại phiên mê cung mới.
          db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
          s = undefined;
        } else {
          if (isExpired(s, prog)) {
            finishInternal(s, prog);
            notifier(eventId);
          }
          return buildState(student, s, eventId);
        }
      } else {
        return buildState(student, s, eventId);
      }
    }

    if (!isEventOpen(eventId)) {
      throw new GameError('EVENT_CLOSED', 'Sự kiện chưa mở/đã đóng', 403);
    }
    const gateQ = assignGates();
    if (Object.keys(gateQ).length === 0) {
      throw new GameError('NO_QUESTIONS', 'Chưa có câu hỏi cho Game Vượt Ải', 409);
    }
    const prog: MazeProgress = {
      rows: MAZE.rows,
      cols: MAZE.cols,
      pos: MAZE.start,
      gateStatus: {},
      gateQ, // gán SẴN cho mọi cửa theo độ khó
      ver: MAZE_VER,
      pending: null,
      pausedMs: 0,
      answered: 0,
      correct: 0,
    };
    const info = db
      .prepare(
        `INSERT INTO sessions
           (student_id, event_id, board_json, progress_json, status, score, bonus_points, started_at)
         VALUES (@studentId, @eventId, '{}', @prog, 'in_progress', 0, 0, @started)`,
      )
      .run({ studentId: student.id, eventId, prog: JSON.stringify(prog), started: nowIso() });
    const created = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(info.lastInsertRowid as number) as SessionRow;
    notifier(eventId);
    return buildState(student, created, eventId);
  },

  getState(student: StudentRow, eventId: string): MazeStateDTO | null {
    sweepExpired(eventId);
    const s = loadSession(student.id, eventId);
    if (!s) return null;
    if (s.status === 'in_progress') {
      const prog = parseProgress(s);
      if (typeof prog.pos !== 'number' || prog.ver !== MAZE_VER) {
        // Phiên cũ (map/định dạng khác) → xoá để người chơi bắt đầu lại mê cung.
        db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
        return null;
      }
      if (isExpired(s, prog)) {
        finishInternal(s, prog);
        notifier(eventId);
      }
    }
    return buildState(student, s, eventId);
  },

  move(student: StudentRow, eventId: string, r: number, c: number): MoveResultDTO {
    const s = loadSession(student.id, eventId);
    if (!s || s.status !== 'in_progress') {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    const prog = parseProgress(s);
    if (isExpired(s, prog)) {
      finishInternal(s, prog);
      notifier(eventId);
      throw new GameError('TIME_UP', 'Hết giờ', 409);
    }
    if (prog.pending !== null) {
      throw new GameError('AWAITING_ANSWER', 'Phải trả lời câu hỏi ở cổng trước', 409);
    }
    // Người chơi đã đọc xong đáp án và đi tiếp → cộng dồn thời gian xem đáp án, chạy lại đồng hồ.
    if (prog.readingSince !== undefined) {
      prog.pausedMs = (prog.pausedMs ?? 0) + (nowMs() - prog.readingSince);
      prog.readingSince = undefined;
    }
    if (!Number.isInteger(r) || !Number.isInteger(c) || r < 0 || r >= MAZE.rows || c < 0 || c >= MAZE.cols) {
      throw new GameError('BAD_MOVE', 'Ô không hợp lệ', 400);
    }
    const target = r * MAZE.cols + c;
    if (!isAdjacent(prog.pos, target)) {
      throw new GameError('BAD_MOVE', 'Chỉ đi sang ô kề', 400);
    }
    // Tường hoặc cổng đã chặn → không đi được.
    if (MAZE.base[target] === 0 || (GATE_SET.has(target) && gateStatusOf(prog, target) === 'blocked')) {
      throw new GameError('BLOCKED', 'Ô bị chặn', 400);
    }

    // Cổng còn khoá → phát câu hỏi (đã gán sẵn theo độ khó cửa lúc start).
    if (GATE_SET.has(target) && gateStatusOf(prog, target) === 'locked') {
      const qid = prog.gateQ[target];
      if (qid === undefined) {
        // an toàn: cửa chưa có câu (ngân hàng rỗng) → mở luôn cho khỏi kẹt
        prog.gateStatus[target] = 'open';
        prog.pos = target;
        saveSession(s, prog);
        notifier(eventId);
        return { gate: false, state: buildState(student, s, eventId) };
      }
      prog.pending = target;
      prog.questionShownAt = nowMs();
      saveSession(s, prog);

      const dto = buildChallengeDTO(student, s, prog, target, eventId);
      if (!dto) {
        // câu biến mất → tự mở cổng cho khỏi kẹt
        prog.gateStatus[target] = 'open';
        prog.pending = null;
        prog.pos = target;
        saveSession(s, prog);
        notifier(eventId);
        return { gate: false, state: buildState(student, s, eventId) };
      }
      return { gate: true, question: dto };
    }

    // Ô đi tự do (lối/đã-mở/đích).
    prog.pos = target;
    if (target === MAZE.exit) {
      // VỀ ĐÍCH → thưởng lớn, ÁP ĐẢO điểm câu cộng dồn để "về càng sớm điểm càng cao"
      // luôn đúng (xem giải thích ở config.mountain.finishTimeBonus). frac dùng activeMs
      // (đã trừ thời gian xem đáp án) nên thời gian đọc không ảnh hưởng điểm.
      prog.reached = true;
      const totalMs = config.mountain.timeLimitS * 1000;
      const frac = totalMs > 0 ? Math.max(0, Math.min(1, (totalMs - activeMs(s, prog)) / totalMs)) : 0;
      const bonus =
        config.mountain.finishBase + Math.round(config.mountain.finishTimeBonus * frac);
      saveSession(s, prog, { score: Math.max(0, s.score + bonus) });
      finishInternal(s, prog);
    } else {
      saveSession(s, prog);
    }
    notifier(eventId);
    return { gate: false, state: buildState(student, s, eventId) };
  },

  answerGate(student: StudentRow, eventId: string, token: string, response: unknown): MazeAnswerDTO {
    const s = loadSession(student.id, eventId);
    if (!s || s.status !== 'in_progress') {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    const prog = parseProgress(s);
    if (isExpired(s, prog)) {
      finishInternal(s, prog);
      notifier(eventId);
      throw new GameError('TIME_UP', 'Hết giờ', 409);
    }
    let tok: QuestionTokenPayload;
    try {
      tok = verifyQuestionToken(token);
    } catch {
      throw new GameError('BAD_TOKEN', 'Token câu hỏi không hợp lệ/hết hạn', 409);
    }
    if (prog.pending === null || tok.sid !== s.id || tok.cell !== prog.pending) {
      throw new GameError('BAD_TOKEN', 'Token không khớp cổng đang hỏi', 409);
    }
    const cell = prog.pending;
    if (tok.qid !== prog.gateQ[cell]) {
      throw new GameError('BAD_TOKEN', 'Token sai câu hỏi', 409);
    }
    const q = mountainQuestionService.getById(tok.qid);
    if (!q) throw new GameError('BAD_TOKEN', 'Câu hỏi không tồn tại', 409);

    const g = grade(q, student.student_code, eventId, response);
    const windowMs = config.fastAnswerMs;
    const timeTaken = prog.questionShownAt !== undefined ? nowMs() - prog.questionShownAt : windowMs;

    let delta = 0;
    let fast = 0;
    prog.answered++;
    prog.pending = null;
    prog.questionShownAt = undefined;

    if (g.isCorrect) {
      const base = pointsOf(q);
      if (config.mountain.speedBonusMax > 0 && windowMs > 0) {
        fast = Math.round((config.mountain.speedBonusMax * Math.max(0, windowMs - timeTaken)) / windowMs);
      }
      delta = base + fast;
      prog.correct++;
      prog.gateStatus[cell] = 'open';
      prog.pos = cell; // bước vào ô cổng vừa mở
    } else {
      prog.gateStatus[cell] = 'blocked'; // cổng thành đá (KHÔNG mất mạng)
    }

    const score = Math.max(0, s.score + delta);

    // Bỏ cơ chế mạng: chỉ THUA khi sai mà KHÔNG CÒN đường nào tới đích (kẹt).
    let willFinish = false;
    if (!g.isCorrect) {
      const stuck = !reachable(MAZE.rows, MAZE.cols, prog.pos, MAZE.exit, (i) => passable(prog, i));
      if (stuck) willFinish = true;
    }
    // Chưa kết thúc → bắt đầu "xem đáp án": đóng băng đồng hồ cho tới lần đi kế tiếp.
    if (!willFinish) prog.readingSince = nowMs();
    saveSession(s, prog, { score });
    if (willFinish) finishInternal(s, prog);
    notifier(eventId);

    return {
      is_correct: g.isCorrect,
      delta,
      fast_bonus: fast,
      explanation: q.explanation,
      correct_index: g.correct_index,
      correct_text: g.correct_text,
      correct_value: g.correct_value,
      correct_order: g.correct_order,
      state: buildState(student, s, eventId), // finished phản ánh đúng s.status sau finishInternal
    };
  },

  finish(student: StudentRow, eventId: string): MazeFinishDTO {
    const s = loadSession(student.id, eventId);
    if (!s) throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    if (s.status !== 'finished') {
      finishInternal(s, parseProgress(s));
      notifier(eventId);
    }
    const prog = parseProgress(s);
    return {
      score: s.score,
      reached: !!prog.reached,
      gates_opened: prog.correct,
      time_spent_ms: s.time_spent_ms ?? 0,
      rank: leaderboardService.rankOf(eventId, student.id) ?? 0,
      status: s.status,
    };
  },

  sweepExpired(eventId: string): number {
    return sweepExpired(eventId);
  },
};

// ===================== Sweep =====================
function sweepExpired(eventId: string): number {
  const rows = db
    .prepare(`SELECT * FROM sessions WHERE event_id = ? AND status = 'in_progress'`)
    .all(eventId) as SessionRow[];
  if (rows.length === 0) return 0;
  let finished = 0;
  const run = db.transaction(() => {
    for (const s of rows) {
      if (isExpired(s, parseProgress(s))) {
        db.prepare(
          `UPDATE sessions SET status='finished', finished_at=@now, time_spent_ms=@limit WHERE id=@id`,
        ).run({ now: nowIso(), limit: config.mountain.timeLimitS * 1000, id: s.id });
        finished++;
      }
    }
  });
  run();
  if (finished > 0) notifier(eventId);
  return finished;
}

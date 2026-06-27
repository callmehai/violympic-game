/**
 * game.service.ts — TRÁI TIM của game (treasure-hunt).
 *
 * TẤT CẢ method ĐỒNG BỘ (không async) để đảm bảo tính nguyên tử:
 * Node đơn luồng + better-sqlite3 ghi/đọc đồng bộ ⇒ mỗi request chạy trọn vẹn
 * trước khi request kế tiếp bắt đầu, không có race condition trên 1 phiên.
 *
 * Máy trạng thái 1 phiên: awaiting='question' (chờ trả lời) ↔ 'dig' (chờ đào).
 * - Trả lời ĐÚNG  → awaiting='dig'  (KHÔNG tăng cursor; sẽ đào 1 ô).
 * - Trả lời SAI   → awaiting='question', cursor++ (+ phạt thời gian).
 * - Đào xong      → awaiting='question', cursor++ (sang câu kế).
 */
import type {
  GameService,
  GameStateDTO,
  NextQuestionDTO,
  AnswerResponseDTO,
  DigResponseDTO,
  FinishResponseDTO,
  StudentRow,
  SessionRow,
  Board,
  BoardCell,
  PublicCell,
  SessionProgress,
  LeaderboardNotifier,
  QuestionRow,
  QuestionTokenPayload,
} from '../types';
import { config } from '../config';
import { db, isEventOpen } from '../db';
import { hashSeed, mulberry32, randInt, seededShuffle } from '../util/seededRandom';
import { signQuestionToken, verifyQuestionToken } from '../util/jwt';
import { GameError } from '../util/errors';
import { scoringService } from './scoring.service';
import { questionService } from './question.service';
import { leaderboardService } from './leaderboard.service';

// ===================== Notifier (báo socket broadcast leaderboard) =====================
let notifier: LeaderboardNotifier = () => {};

/** Đăng ký hàm broadcast leaderboard. Gọi từ index/socket khi khởi tạo. */
export function setLeaderboardNotifier(fn: LeaderboardNotifier): void {
  notifier = fn;
}

// ===================== Hàm phụ thời gian =====================
function nowIso(): string {
  return new Date().toISOString();
}
function nowMs(): number {
  return Date.now();
}

/**
 * Hoán vị đáp án theo từng (người chơi, câu hỏi) → mỗi người thấy thứ tự A/B/C/D khác nhau
 * (chống nhìn bài nhau). Deterministic ⇒ refetch /next-question vẫn ra đúng thứ tự cũ.
 * Trả về perm với: perm[viTriHienThi] = chiSoGoc trong options của câu hỏi.
 */
function optionOrder(studentCode: string, eventId: string, qid: number, n: number): number[] {
  const base = Array.from({ length: n }, (_, i) => i);
  return seededShuffle(base, hashSeed(studentCode, eventId, qid, 'opt'));
}

/** Thời gian đã trôi (ms) kể từ khi bắt đầu phiên (chưa kể phạt). */
function elapsedMs(s: SessionRow): number {
  return nowMs() - Date.parse(s.started_at);
}

/** Tổng thời gian KHÔNG tính giờ: pausedMs đã cộng + khoảng đang xem đáp án (nếu có). */
function pausedTotal(prog: SessionProgress): number {
  return (prog.pausedMs ?? 0) + (prog.readingSince !== undefined ? nowMs() - prog.readingSince : 0);
}

/** Thời gian còn lại (giây) sau khi trừ thời gian trôi + phạt, CỘNG LẠI phần xem đáp án. */
function timeLeftS(s: SessionRow, prog: SessionProgress): number {
  const remainMs = config.timeLimitS * 1000 - elapsedMs(s) - prog.penaltyMs + pausedTotal(prog);
  return Math.max(0, Math.floor(remainMs / 1000));
}

/** Phiên đã hết giờ chưa (đã trừ phạt + không tính thời gian xem đáp án). */
function isExpired(s: SessionRow, prog: SessionProgress): boolean {
  return config.timeLimitS * 1000 - elapsedMs(s) - prog.penaltyMs + pausedTotal(prog) <= 0;
}

// ===================== Load / parse / save phiên =====================
function loadSession(studentId: number, eventId: string): SessionRow | undefined {
  return db
    .prepare('SELECT * FROM sessions WHERE student_id = ? AND event_id = ?')
    .get(studentId, eventId) as SessionRow | undefined;
}

function parseBoard(s: SessionRow): Board {
  return JSON.parse(s.board_json) as Board;
}

function parseProgress(s: SessionRow): SessionProgress {
  // progress_json về lý thuyết có thể null (cột nullable), nhưng phiên do ta tạo luôn có.
  return JSON.parse(s.progress_json ?? '{}') as SessionProgress;
}

/** Ghi lại trạng thái phiên (board + progress + điểm + status + thời gian). */
function saveSession(
  s: SessionRow,
  board: Board,
  prog: SessionProgress,
  patch?: Partial<Pick<SessionRow, 'status' | 'score' | 'bonus_points' | 'finished_at' | 'time_spent_ms'>>
): void {
  const status = patch?.status ?? s.status;
  const score = patch?.score ?? s.score;
  const bonus = patch?.bonus_points ?? s.bonus_points;
  const finishedAt = patch?.finished_at !== undefined ? patch.finished_at : s.finished_at;
  const timeSpent = patch?.time_spent_ms !== undefined ? patch.time_spent_ms : s.time_spent_ms;
  db.prepare(
    `UPDATE sessions
       SET board_json = @board,
           progress_json = @prog,
           status = @status,
           score = @score,
           bonus_points = @bonus,
           finished_at = @finished,
           time_spent_ms = @timeSpent
     WHERE id = @id`
  ).run({
    id: s.id,
    board: JSON.stringify(board),
    prog: JSON.stringify(prog),
    status,
    score,
    bonus,
    finished: finishedAt,
    timeSpent,
  });
  // cập nhật lại object trong bộ nhớ để các bước sau dùng đúng giá trị
  s.status = status;
  s.score = score;
  s.bonus_points = bonus;
  s.finished_at = finishedAt;
  s.time_spent_ms = timeSpent;
}

// ===================== Sinh bàn cờ theo seed =====================
/**
 * Sinh bàn cờ deterministic theo seed.
 * Tổng số ô = rows*cols. Phân bổ theo config.boardDistribution:
 *   1 chest (value=chestValue), `bombs` ô bomb (value=bombValue),
 *   `gems` ô gem (value bốc ngẫu nhiên từ gemValues theo rng),
 *   phần còn lại empty (value=0). Sau đó xáo trộn vị trí theo seed.
 */
function genBoard(seed: number): Board {
  const total = config.rows * config.cols;
  const d = config.boardDistribution;
  const rng = mulberry32(seed); // RNG để bốc giá trị gem (deterministic theo seed)

  const cells: BoardCell[] = [];

  // 1 ô kho báu
  for (let i = 0; i < d.chest; i++) {
    cells.push({ type: 'chest', value: d.chestValue, dug: false });
  }
  // các ô bom (value âm)
  for (let i = 0; i < d.bombs; i++) {
    cells.push({ type: 'bomb', value: d.bombValue, dug: false });
  }
  // các ô gem — mỗi ô bốc 1 giá trị ngẫu nhiên trong gemValues
  for (let i = 0; i < d.gems; i++) {
    const gv = d.gemValues.length > 0 ? d.gemValues[randInt(rng, d.gemValues.length)] : 0;
    cells.push({ type: 'gem', value: gv, dug: false });
  }
  // phần còn lại là ô rỗng (không cộng/trừ điểm)
  while (cells.length < total) {
    cells.push({ type: 'empty', value: 0, dug: false });
  }
  // nếu cấu hình vượt quá tổng ô thì cắt bớt cho khớp lưới
  const fitted = cells.slice(0, total);

  // xáo trộn vị trí ô theo seed để rải đều phân bổ
  const shuffled = seededShuffle(fitted, seed);
  return { rows: config.rows, cols: config.cols, cells: shuffled };
}

/** Chuyển board nội bộ → board public: chỉ lộ type/value khi ô đã đào. */
function toPublicBoard(board: Board): PublicCell[] {
  return board.cells.map((c, index) =>
    c.dug ? { index, dug: true, type: c.type, value: c.value } : { index, dug: false }
  );
}

// ===================== Build GameStateDTO =====================
function buildState(student: StudentRow, s: SessionRow): GameStateDTO {
  const board = parseBoard(s);
  const prog = parseProgress(s);
  return {
    session_id: s.id,
    status: s.status,
    score: s.score,
    time_limit_s: config.timeLimitS,
    time_left_s: timeLeftS(s, prog),
    awaiting: prog.awaiting,
    dig_available: prog.awaiting === 'dig',
    board: toPublicBoard(board),
    rows: board.rows,
    cols: board.cols,
    answered: prog.answered,
    correct: prog.correct,
    total_questions: prog.questionOrder.length,
    rank: leaderboardService.rankOf(s.event_id, student.id),
  };
}

// ===================== Finish nội bộ (dùng lại, tránh load lại phiên) =====================
/**
 * Chốt phiên: tính thời gian dùng (đã trừ phạt, không vượt timeLimit), set finished.
 * Idempotent: nếu đã finished thì không ghi lại.
 */
function finishInternal(s: SessionRow, prog: SessionProgress, board: Board): void {
  if (s.status === 'finished') return;
  // tổng thời gian = thời gian trôi thực + phạt − thời gian xem đáp án, kẹp trong giới hạn buổi
  const active = elapsedMs(s) + prog.penaltyMs - pausedTotal(prog);
  const timeSpent = Math.min(Math.max(0, active), config.timeLimitS * 1000);
  saveSession(s, board, prog, {
    status: 'finished',
    finished_at: nowIso(),
    time_spent_ms: timeSpent,
  });
}

/** Dựng FinishResponseDTO từ 1 phiên đã (hoặc vừa) finished. */
function buildFinishDTO(student: StudentRow, s: SessionRow): FinishResponseDTO {
  const rank = leaderboardService.rankOf(s.event_id, student.id) ?? 0;
  return {
    score: s.score,
    bonus_points: s.bonus_points,
    total: s.score + s.bonus_points,
    time_spent_ms: s.time_spent_ms ?? 0,
    rank,
    status: s.status,
  };
}

// ===================== Service implementation =====================
export const gameService: GameService = {
  startSession(student: StudentRow, eventId: string): GameStateDTO {
    sweepExpired(eventId);
    let s = loadSession(student.id, eventId);

    if (s) {
      if (s.status === 'finished') {
        // Đã hoàn thành: mặc định KHÔNG cho chơi lại.
        if (config.allowReplay) {
          // Cho chơi lại: xoá phiên cũ rồi rơi xuống nhánh tạo mới bên dưới.
          db.prepare('DELETE FROM sessions WHERE id = ?').run(s.id);
          s = undefined;
        } else {
          return buildState(student, s);
        }
      } else if (s.status === 'in_progress') {
        const prog = parseProgress(s);
        if (isExpired(s, prog)) {
          // Hết giờ trong lúc resume → chốt phiên rồi trả trạng thái cuối.
          finishInternal(s, prog, parseBoard(s));
          notifier(eventId);
          return buildState(student, s);
        }
        // Còn giờ → resume (trả nguyên trạng thái hiện tại).
        return buildState(student, s);
      } else {
        // abandoned hoặc trạng thái khác: trả về trạng thái hiện có.
        return buildState(student, s);
      }
    }

    // Không có phiên (hoặc vừa xoá do allowReplay) → tạo mới.
    if (!isEventOpen(eventId)) {
      throw new GameError('EVENT_CLOSED', 'Sự kiện chưa mở/đã đóng', 403);
    }

    // RANDOM theo từng PHIÊN: mỗi lần bắt đầu (mỗi người, kể cả chơi lại) ra bàn cờ +
    // thứ tự câu hỏi KHÁC nhau hoàn toàn. Cả 2 được lưu vào phiên (board_json/progress_json)
    // nên reload giữa chừng KHÔNG bị xáo lại → resume vẫn đúng.
    const board = genBoard((Math.random() * 0x100000000) >>> 0);
    const ids = questionService.allActiveIds();
    const order = seededShuffle(ids, (Math.random() * 0x100000000) >>> 0);
    const prog: SessionProgress = {
      questionOrder: order,
      cursor: 0,
      awaiting: 'question',
      answered: 0,
      correct: 0,
      digsDone: 0,
      penaltyMs: 0,
      pausedMs: 0,
    };
    const startedAt = nowIso();
    const info = db
      .prepare(
        `INSERT INTO sessions
           (student_id, event_id, board_json, progress_json, status, score, bonus_points, started_at)
         VALUES (@studentId, @eventId, @board, @prog, 'in_progress', 0, 0, @started)`
      )
      .run({
        studentId: student.id,
        eventId,
        board: JSON.stringify(board),
        prog: JSON.stringify(prog),
        started: startedAt,
      });

    const created = db
      .prepare('SELECT * FROM sessions WHERE id = ?')
      .get(info.lastInsertRowid as number) as SessionRow;
    notifier(eventId);
    return buildState(student, created);
  },

  getState(student: StudentRow, eventId: string): GameStateDTO | null {
    sweepExpired(eventId);
    const s = loadSession(student.id, eventId);
    if (!s) return null;
    if (s.status === 'in_progress') {
      const prog = parseProgress(s);
      if (isExpired(s, prog)) {
        finishInternal(s, prog, parseBoard(s));
        notifier(eventId);
      }
    }
    return buildState(student, s);
  },

  nextQuestion(student: StudentRow, eventId: string): NextQuestionDTO {
    const s = loadSession(student.id, eventId);
    if (!s || s.status !== 'in_progress') {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    const prog = parseProgress(s);
    // Người chơi đã đọc xong đáp án và sang câu kế → cộng dồn thời gian xem, chạy lại đồng hồ.
    if (prog.readingSince !== undefined) {
      prog.pausedMs = (prog.pausedMs ?? 0) + (nowMs() - prog.readingSince);
      prog.readingSince = undefined;
    }
    if (isExpired(s, prog)) {
      finishInternal(s, prog, parseBoard(s));
      notifier(eventId);
      throw new GameError('TIME_UP', 'Hết giờ', 409);
    }
    if (prog.awaiting !== 'question') {
      throw new GameError('AWAITING_DIG', 'Phải đào ô trước', 409);
    }

    // Tìm câu hợp lệ kế tiếp; bỏ qua các id thiếu (câu bị xoá/inactive sau khi seed).
    const board = parseBoard(s);
    let q: QuestionRow | undefined;
    while (prog.cursor < prog.questionOrder.length) {
      const qid = prog.questionOrder[prog.cursor];
      q = questionService.getById(qid);
      if (q) break;
      // câu không còn → nhảy qua (ghi lại để không lặp vô hạn lần sau)
      prog.cursor++;
    }
    if (!q || prog.cursor >= prog.questionOrder.length) {
      // hết câu hỏi → chốt phiên
      saveSession(s, board, prog); // lưu cursor đã đẩy qua các câu thiếu
      finishInternal(s, prog, board);
      notifier(eventId);
      throw new GameError('GAME_OVER', 'Đã hết câu hỏi', 409);
    }
    // Mốc đo thời gian trả lời: set 1 lần khi câu được phát LẦN ĐẦU.
    // Gọi lại /next-question (refetch/reload) KHÔNG reset mốc → không farm được fast-bonus.
    if (prog.questionShownAt === undefined) {
      prog.questionShownAt = nowMs();
    }
    // lưu lại tiến độ cursor + mốc thời gian
    saveSession(s, board, prog);

    const qid = prog.questionOrder[prog.cursor];
    // Trộn thứ tự đáp án riêng cho người chơi này (chống nhìn bài).
    const originalOptions = questionService.parseOptions(q);
    const perm = optionOrder(student.student_code, eventId, qid, originalOptions.length);
    const shuffledOptions = perm.map((orig) => originalOptions[orig]);
    const token = signQuestionToken({ sid: s.id, qid, cur: prog.cursor }, timeLeftS(s, prog));
    return {
      question_id: qid,
      question_token: token,
      subject: q.subject,
      difficulty: q.difficulty,
      content: q.content,
      options: shuffledOptions,
      index: prog.cursor + 1,
      total: prog.questionOrder.length,
      points: scoringService.questionPoints(q),
      speed_bonus: config.fastAnswerBonus,
      speed_window_ms: config.fastAnswerMs,
      speed_elapsed_ms: prog.questionShownAt !== undefined ? nowMs() - prog.questionShownAt : 0,
    };
  },

  answer(
    student: StudentRow,
    eventId: string,
    token: string,
    selectedIndex: number
  ): AnswerResponseDTO {
    const s = loadSession(student.id, eventId);
    if (!s || s.status !== 'in_progress') {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    const prog = parseProgress(s);
    const board = parseBoard(s);
    if (isExpired(s, prog)) {
      finishInternal(s, prog, board);
      notifier(eventId);
      throw new GameError('TIME_UP', 'Hết giờ', 409);
    }

    // Xác thực question_token (chống replay/đoán câu khác).
    let payload: QuestionTokenPayload;
    try {
      payload = verifyQuestionToken(token);
    } catch {
      throw new GameError('BAD_TOKEN', 'Token câu hỏi không hợp lệ/hết hạn', 409);
    }
    if (
      payload.sid !== s.id ||
      payload.cur !== prog.cursor ||
      payload.qid !== prog.questionOrder[prog.cursor]
    ) {
      throw new GameError('BAD_TOKEN', 'Token câu hỏi không hợp lệ/hết hạn', 409);
    }
    if (prog.awaiting !== 'question') {
      throw new GameError('AWAITING_DIG', 'Phải đào ô trước', 409);
    }

    const q = questionService.getById(payload.qid);
    if (!q) {
      // câu biến mất giữa chừng: coi như sai, đẩy cursor để không kẹt.
      throw new GameError('BAD_TOKEN', 'Token câu hỏi không hợp lệ/hết hạn', 409);
    }

    // thời gian trả lời = bây giờ - mốc phát câu (server-side, ms). Không tin iat của token
    // vì client có thể refetch /next-question để ép iat≈now và farm thưởng tốc độ.
    const timeTaken = prog.questionShownAt !== undefined ? nowMs() - prog.questionShownAt : 0;

    // selectedIndex là vị trí HIỂN THỊ (đã trộn) → map về chỉ số gốc để chấm.
    const originalOptions = questionService.parseOptions(q);
    const perm = optionOrder(student.student_code, eventId, payload.qid, originalOptions.length);
    if (!Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex >= perm.length) {
      throw new GameError('BAD_INPUT', 'Đáp án không hợp lệ', 400);
    }
    const originalSelected = perm[selectedIndex];
    const isCorrect = originalSelected === q.correct_index;
    // Chỉ số đáp án đúng theo thứ tự HIỂN THỊ (để client tô đúng nút).
    const displayCorrectIndex = perm.indexOf(q.correct_index);

    // Tính điểm: chỉ cộng khi đúng; cộng thêm thưởng tốc độ nếu trả lời nhanh.
    const base = isCorrect ? scoringService.questionPoints(q) : 0;
    const fast = isCorrect ? scoringService.fastAnswerBonus(timeTaken) : 0;
    const delta = base + fast;
    const score = Math.max(0, s.score + delta);

    prog.answered++;
    // Câu hiện tại đã được trả lời → xoá mốc thời gian để câu kế tính lại từ đầu.
    prog.questionShownAt = undefined;
    if (isCorrect) {
      // Đúng → được quyền đào 1 ô; KHÔNG tăng cursor (cursor đẩy sau khi đào).
      prog.correct++;
      prog.awaiting = 'dig';
    } else {
      // Sai → sang câu kế + chịu phạt thời gian (nếu cấu hình bật).
      prog.awaiting = 'question';
      prog.cursor++;
      prog.penaltyMs += config.wrongTimePenaltyS * 1000;
    }
    // Bắt đầu "xem đáp án": đóng băng đồng hồ tới khi người chơi bấm sang câu kế.
    prog.readingSince = nowMs();

    saveSession(s, board, prog, { score });
    notifier(eventId);

    return {
      is_correct: isCorrect,
      correct_index: displayCorrectIndex,
      delta,
      fast_bonus: fast,
      can_dig: isCorrect,
      score,
      awaiting: prog.awaiting,
      explanation: q.explanation,
    };
  },

  dig(student: StudentRow, eventId: string, cellIndex: number): DigResponseDTO {
    const s = loadSession(student.id, eventId);
    if (!s || s.status !== 'in_progress') {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    const prog = parseProgress(s);
    const board = parseBoard(s);
    if (isExpired(s, prog)) {
      finishInternal(s, prog, board);
      notifier(eventId);
      throw new GameError('TIME_UP', 'Hết giờ', 409);
    }
    if (prog.awaiting !== 'dig') {
      throw new GameError('NOT_DIGGING', 'Chưa được đào', 409);
    }
    if (cellIndex < 0 || cellIndex >= board.cells.length || board.cells[cellIndex].dug) {
      throw new GameError('BAD_CELL', 'Ô không hợp lệ', 400);
    }

    // Đào ô: lộ ô + cộng delta (gem dương, bomb âm, chest lớn, empty 0).
    const cell = board.cells[cellIndex];
    cell.dug = true;
    const delta = cell.value;
    const score = Math.max(0, s.score + delta);

    prog.digsDone++;
    prog.awaiting = 'question';
    prog.cursor++; // sang câu hỏi kế tiếp
    prog.questionShownAt = undefined; // câu kế sẽ tính mốc thời gian mới

    saveSession(s, board, prog, { score });

    let ended = false;
    // Đào trúng kho báu + cấu hình END_ON_CHEST → kết thúc luôn.
    if (cell.type === 'chest' && config.endOnChest) {
      finishInternal(s, prog, board);
      ended = true;
    }
    notifier(eventId);

    return {
      cell_index: cellIndex,
      cell_type: cell.type,
      value: cell.value,
      delta,
      new_score: score,
      awaiting: prog.awaiting,
      ended,
    };
  },

  finish(student: StudentRow, eventId: string): FinishResponseDTO {
    const s = loadSession(student.id, eventId);
    if (!s) {
      throw new GameError('NO_SESSION', 'Chưa có phiên đang chơi', 409);
    }
    if (s.status === 'finished') {
      // Idempotent: đã chốt rồi → trả lại kết quả đã lưu + hạng hiện tại.
      return buildFinishDTO(student, s);
    }
    const prog = parseProgress(s);
    const board = parseBoard(s);
    finishInternal(s, prog, board);
    notifier(eventId);
    return buildFinishDTO(student, s);
  },

  resetSession(studentId: number, eventId: string): void {
    db.prepare('DELETE FROM sessions WHERE student_id = ? AND event_id = ?').run(studentId, eventId);
    notifier(eventId);
  },

  resetAllSessions(eventId: string): number {
    const info = db.prepare('DELETE FROM sessions WHERE event_id = ?').run(eventId);
    notifier(eventId);
    return info.changes;
  },

  sweepExpired(eventId: string): number {
    return sweepExpired(eventId);
  },
};

// ===================== Sweep các phiên hết giờ =====================
/**
 * Quét toàn bộ phiên in_progress của event; phiên nào hết giờ thì tự finish.
 * Dùng transaction để gom nhiều UPDATE vào 1 lần ghi. Trả số phiên đã chốt.
 */
function sweepExpired(eventId: string): number {
  const rows = db
    .prepare(`SELECT * FROM sessions WHERE event_id = ? AND status = 'in_progress'`)
    .all(eventId) as SessionRow[];
  if (rows.length === 0) return 0;

  let finished = 0;
  const run = db.transaction(() => {
    for (const s of rows) {
      const prog = parseProgress(s);
      if (isExpired(s, prog)) {
        // hết giờ → chốt với time_spent = đúng giới hạn buổi
        db.prepare(
          `UPDATE sessions
             SET status = 'finished',
                 finished_at = @now,
                 time_spent_ms = @limit
           WHERE id = @id`
        ).run({ now: nowIso(), limit: config.timeLimitS * 1000, id: s.id });
        finished++;
      }
    }
  });
  run();

  if (finished > 0) notifier(eventId);
  return finished;
}

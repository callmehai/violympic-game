/**
 * types.ts — HỢP ĐỒNG (contract) dùng chung cho toàn server.
 *
 * Đây là "nguồn sự thật": mọi service/route phải tuân theo các kiểu + interface ở đây.
 * Client có bản mirror tại client/src/api/contract.ts — khi đổi DTO ở đây thì sửa cả 2.
 */

// ===================== Domain enums =====================
// Nhãn môn hiển thị trên thẻ câu hỏi. Thêm mục mới khi nạp bộ đề môn khác
// (vd 'Tư tưởng HCM') — importer chặn subject lạ nên thiếu mục là import lỗi.
export type Subject =
  | 'Toán'
  | 'Văn'
  | 'Anh'
  | 'Sinh'
  | 'Sử'
  | 'Địa'
  | 'Kinh tế'
  | 'Tư tưởng HCM';
export const SUBJECTS: Subject[] = [
  'Toán',
  'Văn',
  'Anh',
  'Sinh',
  'Sử',
  'Địa',
  'Kinh tế',
  'Tư tưởng HCM',
];

export type Difficulty = 'easy' | 'medium' | 'hard';
export const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

export type CellType = 'gem' | 'bomb' | 'empty' | 'chest';
export type SessionStatus = 'in_progress' | 'finished' | 'abandoned';
export type Role = 'player' | 'admin';

// ===================== Bàn cờ kho báu =====================
/** 1 ô trên bàn cờ. `value` là delta điểm đã được chốt sẵn lúc sinh bàn (đào → cộng value). */
export interface BoardCell {
  type: CellType;
  value: number; // gem: dương; bomb: âm; chest: +100; empty: 0
  dug: boolean;
}

export interface Board {
  rows: number;
  cols: number;
  cells: BoardCell[]; // length = rows*cols, index = r*cols + c
}

/** Phiên bản gửi cho client: chỉ lộ type/value khi ô đã được đào. */
export interface PublicCell {
  index: number;
  dug: boolean;
  type?: CellType;
  value?: number;
}

// ===================== Tiến độ phiên (progress_json) =====================
export interface SessionProgress {
  questionOrder: number[]; // danh sách question.id đã xáo trộn theo seed
  cursor: number; // index ô câu hỏi hiện tại trong questionOrder (0-based)
  awaiting: 'question' | 'dig'; // máy trạng thái: chờ trả lời hay chờ đào
  answered: number;
  correct: number;
  digsDone: number;
  penaltyMs: number; // tổng phạt thời gian (do trả lời sai) tính bằng ms
  // Mốc (ms) phát câu hỏi hiện tại LẦN ĐẦU — dùng đo thời gian trả lời cho thưởng tốc độ.
  // Lưu ở server, KHÔNG reset khi client refetch /next-question (chống farm fast-bonus).
  questionShownAt?: number;
  pausedMs?: number; // tổng thời gian KHÔNG tính giờ (đang xem đáp án)
  readingSince?: number; // mốc bắt đầu xem đáp án (đồng hồ đang đóng băng)
}

// ===================== DB row types =====================
export interface StudentRow {
  id: number;
  student_code: string;
  full_name: string;
  class_name: string | null;
  password: string; // mật khẩu phát cho SV (từ accounts.csv) — dữ liệu demo, không nhạy cảm
  created_at: string;
}

export interface QuestionRow {
  id: number;
  ext_id: string | null;
  subject: Subject;
  grade: number | null;
  difficulty: Difficulty;
  content: string;
  options_json: string; // JSON array string[]
  correct_index: number;
  points: number;
  explanation: string | null;
  active: number; // 0|1
}

export interface SessionRow {
  id: number;
  student_id: number;
  event_id: string;
  board_json: string; // JSON Board (server-side truth, gồm cả ô đã đào)
  progress_json: string | null; // JSON SessionProgress
  status: SessionStatus;
  score: number;
  bonus_points: number;
  started_at: string; // ISO
  finished_at: string | null;
  time_spent_ms: number | null;
}

// ===================== JWT payloads =====================
export interface AuthTokenPayload {
  sub: number; // student id (0 cho admin)
  role: Role;
  code: string; // student_code, hoặc 'admin'
  name?: string;
  iat?: number;
  exp?: number;
}

export interface QuestionTokenPayload {
  sid: number; // session id
  qid: number; // question id
  cur: number; // cursor index lúc phát câu (Game 1)
  cell?: number; // ô cổng mê cung đang hỏi (Game 2)
  iat?: number;
  exp?: number;
}

// ===================== DTO (client-facing) =====================
export interface Profile {
  student_id: number;
  student_code: string;
  full_name: string;
  class_name: string | null;
  role: Role;
}

export interface LoginResponse {
  token: string;
  profile: Profile;
}

export interface GameStateDTO {
  session_id: number;
  status: SessionStatus;
  score: number;
  time_limit_s: number;
  time_left_s: number;
  awaiting: 'question' | 'dig';
  dig_available: boolean;
  board: PublicCell[];
  rows: number;
  cols: number;
  answered: number;
  correct: number;
  total_questions: number;
  rank: number | null;
}

export interface NextQuestionDTO {
  question_id: number;
  question_token: string;
  subject: Subject;
  difficulty: Difficulty;
  content: string;
  options: string[]; // KHÔNG kèm correct_index
  index: number; // thứ tự câu (1-based) để hiển thị
  total: number;
  points: number; // điểm cơ bản nếu trả lời đúng (để client hiển thị "được mấy điểm")
  speed_bonus: number; // điểm thưởng tốc độ nếu trả lời kịp
  speed_window_ms: number; // cửa sổ thời gian (ms) còn được thưởng tốc độ
  speed_elapsed_ms: number; // thời gian đã trôi kể từ khi câu được phát (để client resume đúng sau reload)
}

export interface AnswerResponseDTO {
  is_correct: boolean;
  correct_index: number; // lộ SAU khi đã trả lời (để hiển thị đúng/sai)
  delta: number; // điểm câu hỏi cộng thêm (gồm cả fast bonus)
  fast_bonus: number;
  can_dig: boolean;
  score: number;
  awaiting: 'question' | 'dig';
  explanation: string | null;
}

export interface DigResponseDTO {
  cell_index: number;
  cell_type: CellType;
  value: number;
  delta: number;
  new_score: number;
  awaiting: 'question' | 'dig';
  ended: boolean; // true nếu đào chest và END_ON_CHEST
}

export interface FinishResponseDTO {
  score: number;
  bonus_points: number;
  total: number;
  time_spent_ms: number;
  rank: number;
  status: SessionStatus;
}

export interface LeaderboardEntry {
  rank: number;
  student_code: string;
  name: string;
  total: number;
  score: number;
  bonus_points: number;
  time_spent_ms: number | null;
  status: SessionStatus;
  is_me?: boolean;
}

export interface AdminEventState {
  event_id: string;
  event_date: string;
  open: boolean;
  config: PublicGameConfig;
  counts: {
    students: number;
    questions: number;
    mountain_questions: number;
    sessions: number;
    finished: number;
  };
  /** Theme giao diện đang áp dụng cho mọi người chơi. */
  theme: string;
  /** Danh sách theme chọn được (để admin render dropdown). */
  themes: string[];
}

// ===================== Config =====================
export interface BonusTier {
  rankFrom: number; // 1-based, inclusive
  rankTo: number; // inclusive
  points: number;
}

export interface PublicGameConfig {
  rows: number;
  cols: number;
  timeLimitS: number;
  endOnChest: boolean;
  allowReplay: boolean;
  fastAnswerMs: number;
  fastAnswerBonus: number;
  wrongTimePenaltyS: number;
}

export interface GameConfig extends PublicGameConfig {
  // Số câu hỏi tối đa phát ra trong 1 phiên Game 1 (0 = phát hết bộ đề). Server-side.
  questionsPerSession: number;
  port: number;
  appSecret: string;
  adminKey: string;
  eventId: string;
  eventDate: string;
  dbPath: string;
  /** Theme dùng khi bảng `settings` chưa có bản ghi nào (lần chạy đầu). */
  defaultTheme: string;
  // phân bổ ô bàn cờ (cho tổng số ô = rows*cols)
  boardDistribution: {
    chest: number;
    bombs: number;
    gems: number; // số ô gem; phần còn lại là empty
    gemValues: number[]; // giá trị gem để bốc ngẫu nhiên (vd [5,10,20])
    bombValue: number; // âm, vd -15
    chestValue: number; // vd 100
  };
  difficultyPoints: Record<Difficulty, number>;
  bonusTiers: BonusTier[];
  // Cấu hình Game 2 "Vượt Ải Trí Tuệ" (mê cung 2D).
  mountain: {
    difficultyPoints: Record<Difficulty, number>; // điểm mỗi câu theo độ khó (riêng game 2)
    timeLimitS: number; // giới hạn thời gian cả hành trình
    mazeRows: number; // (dự phòng nếu sinh mê cung) — bản hiện tại fix cứng map
    mazeCols: number;
    braid: number;
    gateEvery: number;
    extraGates: number;
    speedBonusMax: number; // thưởng tốc độ tối đa mỗi câu (giảm dần về 0)
    finishBase: number; // thưởng nền khi về đích
    finishTimeBonus: number; // thưởng đích theo % thời gian còn lại
  };
}

// ===================== Service interfaces (lock signatures) =====================
export interface ScoringService {
  /** Điểm cơ bản của câu đúng (ưu tiên question.points, fallback theo difficulty). */
  questionPoints(q: QuestionRow): number;
  /** Thưởng tốc độ nếu trả lời nhanh hơn ngưỡng (0 nếu tắt/không đạt). */
  fastAnswerBonus(timeTakenMs: number): number;
  /** Điểm bonus theo hạng (từ BONUS_TIERS), 0 nếu ngoài tier. */
  bonusForRank(rank: number): number;
}

export interface QuestionService {
  getById(id: number): QuestionRow | undefined;
  allActiveIds(): number[];
  count(): number;
  parseOptions(q: QuestionRow): string[];
}

export interface LeaderboardService {
  /** Top N theo total DESC, time_spent ASC. meStudentId để gắn cờ is_me. */
  top(eventId: string, limit: number, meStudentId?: number): LeaderboardEntry[];
  /** Toàn bộ ranking (để tính bonus + export). */
  fullRanking(eventId: string): LeaderboardEntry[];
  /** Hạng hiện tại của 1 student (1-based) hoặc null nếu chưa có phiên. */
  rankOf(eventId: string, studentId: number): number | null;
}

export interface GameService {
  /** Bắt đầu phiên mới HOẶC resume phiên in_progress. Tự sinh bàn cờ + thứ tự câu theo seed. */
  startSession(student: StudentRow, eventId: string): GameStateDTO;
  /** Trạng thái hiện tại (đã đồng bộ timeout). null nếu chưa có phiên. */
  getState(student: StudentRow, eventId: string): GameStateDTO | null;
  /** Phát câu hỏi hiện tại (kèm question_token). Ném lỗi nếu đang chờ đào / đã kết thúc. */
  nextQuestion(student: StudentRow, eventId: string): NextQuestionDTO;
  /** Chấm 1 câu trả lời. Xác thực question_token để chống replay/đoán. */
  answer(student: StudentRow, eventId: string, token: string, selectedIndex: number): AnswerResponseDTO;
  /** Đào 1 ô (chỉ khi vừa trả lời đúng → awaiting='dig'). */
  dig(student: StudentRow, eventId: string, cellIndex: number): DigResponseDTO;
  /** Kết thúc phiên, chốt điểm + thời gian + hạng. */
  finish(student: StudentRow, eventId: string): FinishResponseDTO;
  /** Admin: reset phiên của 1 SV để cho chơi lại (xoá phiên hiện tại). */
  resetSession(studentId: number, eventId: string): void;
  /** Admin: reset TẤT CẢ phiên của event (cho cả lớp chơi lại). Trả số phiên đã xoá. */
  resetAllSessions(eventId: string): number;
  /** Quét & tự finish các phiên in_progress đã hết giờ (gọi định kỳ + trước khi đọc leaderboard). */
  sweepExpired(eventId: string): number;
}

/** Hàm thông báo "có thay đổi điểm" để socket layer broadcast leaderboard. */
export type LeaderboardNotifier = (eventId: string) => void;

// =====================================================================
// ===================== GAME 2: VƯỢT ẢI TRÍ TUỆ =======================
// =====================================================================

/** Các kiểu câu hỏi của Game 2 (mỗi ải 1 kiểu). */
export type MountainQuestionType = 'mcq' | 'fill' | 'truefalse' | 'order';
export const MOUNTAIN_TYPES: MountainQuestionType[] = ['mcq', 'fill', 'truefalse', 'order'];

/** Bản ghi câu hỏi Game 2 (bảng mountain_questions). answer_json CHỈ ở server. */
export interface MountainQuestionRow {
  id: number;
  ext_id: string | null;
  type: MountainQuestionType;
  subject: string | null;
  difficulty: Difficulty;
  content: string;
  payload_json: string; // dữ liệu hiển thị theo kiểu (options/items/suffix...)
  answer_json: string; // đáp án đúng theo kiểu (KHÔNG gửi xuống client)
  points: number;
  explanation: string | null;
  active: number; // 0|1
}

/**
 * Mã hiển thị 1 ô mê cung gửi cho client:
 * 0 tường · 1 lối đi · 2 cổng (khoá, cần trả lời) · 3 xuất phát · 4 đích
 * 5 cổng đã mở (đi được) · 6 cổng đã chặn (thành đá do trả lời sai)
 */
export type MazeCell = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type GateStatus = 'locked' | 'open' | 'blocked';

/** Tiến độ 1 phiên Game 2 (mê cung) — lưu trong sessions.progress_json. */
export interface MazeProgress {
  rows: number;
  cols: number;
  pos: number; // vị trí nhân vật (index = r*cols + c)
  gateStatus: Record<number, GateStatus>; // trạng thái từng ô cổng
  gateQ: Record<number, number>; // ô cổng → mountain_questions.id (gán SẴN lúc start theo độ khó cửa)
  ver?: number; // phiên bản map; lệch → phiên cũ, tạo lại
  pending: number | null; // ô cổng đang chờ trả lời (đã bước vào)
  questionShownAt?: number;
  pausedMs: number; // tổng thời gian KHÔNG tính giờ (đang xem đáp án)
  readingSince?: number; // mốc bắt đầu xem đáp án (đồng hồ đang đóng băng)
  answered: number;
  correct: number;
  reached?: boolean; // đã tới đích chưa
}

/** Trạng thái phiên mê cung trả cho client. */
export interface MazeStateDTO {
  session_id: number;
  status: SessionStatus;
  score: number;
  rows: number;
  cols: number;
  cells: MazeCell[]; // bản đồ hiển thị (đã gộp tĩnh + trạng thái cổng)
  gate_levels: Record<number, number>; // ô cổng → mức độ khó 1(dễ)/2(TB)/3(khó) để in số lên cửa
  pos: number;
  start: number;
  exit: number;
  time_limit_s: number;
  time_left_s: number;
  rank: number | null;
  finished: boolean;
  reached: boolean;
  gates_opened: number; // số cổng đã mở (câu đúng)
  pending_challenge?: NextChallengeDTO; // câu đang chờ tại cổng — gửi khi reload để FE restore
}

/** Câu hỏi tại 1 cổng (KHÔNG kèm đáp án đúng). */
export interface NextChallengeDTO {
  question_id: number;
  question_token: string;
  type: MountainQuestionType;
  subject: string | null;
  difficulty: Difficulty;
  content: string;
  options?: string[]; // mcq — đã trộn riêng từng người
  items?: string[]; // order — đã trộn riêng từng người
  suffix?: string; // fill — nhãn đơn vị
  points: number; // điểm nếu đúng
  speed_bonus: number;
  speed_window_ms: number;
  speed_elapsed_ms: number; // thời gian đã trôi kể từ khi câu được phát (để resume đúng sau reload)
}

/** Kết quả 1 lần bước (free move) hoặc bước-vào-cổng (kèm câu hỏi). */
export interface MoveResultDTO {
  gate: boolean;
  state?: MazeStateDTO; // khi đi tự do (gate=false)
  question?: NextChallengeDTO; // khi bước vào cổng khoá (gate=true)
}

/** Kết quả chấm 1 câu ở cổng (lộ đáp án đúng SAU khi trả lời). */
export interface MazeAnswerDTO {
  is_correct: boolean;
  delta: number;
  fast_bonus: number;
  explanation: string | null;
  correct_index?: number;
  correct_text?: string;
  correct_value?: boolean;
  correct_order?: string[];
  state: MazeStateDTO; // trạng thái mê cung sau khi chấm
}

export interface MazeFinishDTO {
  score: number;
  reached: boolean;
  gates_opened: number;
  time_spent_ms: number;
  rank: number;
  status: SessionStatus;
}

export interface MountainQuestionService {
  getById(id: number): MountainQuestionRow | undefined;
  allActiveIds(): number[];
  count(): number;
  /** Tất cả câu active kèm difficulty (để xếp thứ tự theo độ khó). */
  allActive(): { id: number; difficulty: Difficulty }[];
}

export interface MountainService {
  startSession(student: StudentRow, eventId: string): MazeStateDTO;
  getState(student: StudentRow, eventId: string): MazeStateDTO | null;
  /** Bước nhân vật tới ô (r,c). Nếu là cổng khoá → trả câu hỏi (chưa di chuyển). */
  move(student: StudentRow, eventId: string, r: number, c: number): MoveResultDTO;
  /** Chấm câu ở cổng đang chờ. Đúng → mở cổng + bước vào; Sai → chặn cổng (thua nếu kẹt). */
  answerGate(student: StudentRow, eventId: string, token: string, response: unknown): MazeAnswerDTO;
  finish(student: StudentRow, eventId: string): MazeFinishDTO;
  sweepExpired(eventId: string): number;
}

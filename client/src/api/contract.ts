/**
 * contract.ts — bản mirror của server/src/types.ts cho phía client.
 * Chỉ chứa các DTO/enums client cần. Khi server đổi DTO thì sửa cả 2 file.
 */

export type Subject = 'Toán' | 'Văn' | 'Anh' | 'Sinh' | 'Sử' | 'Địa' | 'Kinh tế';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type CellType = 'gem' | 'bomb' | 'empty' | 'chest';
export type SessionStatus = 'in_progress' | 'finished' | 'abandoned';
export type Role = 'player' | 'admin';

export interface PublicCell {
  index: number;
  dug: boolean;
  type?: CellType;
  value?: number;
}

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
  options: string[];
  index: number;
  total: number;
  points: number;
  speed_bonus: number;
  speed_window_ms: number;
  speed_elapsed_ms: number;
}

export interface AnswerResponseDTO {
  is_correct: boolean;
  correct_index: number;
  delta: number;
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
  ended: boolean;
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
}

export interface RulesDTO {
  rows: number;
  cols: number;
  totalCells: number;
  timeLimitS: number;
  fastAnswerMs: number;
  fastAnswerBonus: number;
  difficultyPoints: { easy: number; medium: number; hard: number };
  board: { chest: number; gems: number; bombs: number; empty: number };
  values: { gemValues: number[]; chest: number; bomb: number };
}

// ===================== GAME 2: VƯỢT ẢI TRÍ TUỆ =====================
export type GameId = 'treasure' | 'mountain';
export interface GameInfo {
  id: GameId;
  name: string;
}

export type MountainQuestionType = 'mcq' | 'fill' | 'truefalse' | 'order';

export interface MountainRulesDTO {
  timeLimitS: number;
  speedWindowMs: number;
  speedBonusMax: number;
  finishBase: number;
  finishTimeBonus: number;
  difficultyPoints: { easy: number; medium: number; hard: number };
}

/** 0 tường·1 lối·2 cổng khoá·3 xuất phát·4 đích·5 cổng mở·6 cổng chặn */
export type MazeCell = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface MazeStateDTO {
  session_id: number;
  status: SessionStatus;
  score: number;
  rows: number;
  cols: number;
  cells: MazeCell[];
  gate_levels: Record<number, number>; // ô cổng → 1(dễ)/2(TB)/3(khó) để in số lên cửa
  pos: number;
  start: number;
  exit: number;
  time_limit_s: number;
  time_left_s: number;
  rank: number | null;
  finished: boolean;
  reached: boolean;
  gates_opened: number;
  pending_challenge?: NextChallengeDTO; // câu đang chờ tại cổng — để FE restore sau reload
}

export interface NextChallengeDTO {
  question_id: number;
  question_token: string;
  type: MountainQuestionType;
  subject: string | null;
  difficulty: Difficulty;
  content: string;
  options?: string[]; // mcq
  items?: string[]; // order (đã trộn)
  suffix?: string; // fill
  points: number;
  speed_bonus: number;
  speed_window_ms: number;
  speed_elapsed_ms: number;
}

export interface MoveResultDTO {
  gate: boolean;
  state?: MazeStateDTO; // khi đi tự do
  question?: NextChallengeDTO; // khi vào cổng khoá
}

export interface MazeAnswerDTO {
  is_correct: boolean;
  delta: number;
  fast_bonus: number;
  explanation: string | null;
  correct_index?: number;
  correct_text?: string;
  correct_value?: boolean;
  correct_order?: string[];
  state: MazeStateDTO;
}

export interface MazeFinishDTO {
  score: number;
  reached: boolean;
  gates_opened: number;
  time_spent_ms: number;
  rank: number;
  status: SessionStatus;
}

// ===================== Endpoint paths =====================
export const API = {
  config: '/api/config',
  mountainConfig: '/api/mountain/config',
  games: '/api/games',
  login: '/api/auth/login',
  me: '/api/auth/me',
  adminLogin: '/api/admin/login',

  // Game 1 — Kho báu
  start: '/api/game/start',
  state: '/api/game/state',
  nextQuestion: '/api/game/next-question',
  answer: '/api/game/answer',
  dig: '/api/game/dig',
  finish: '/api/game/finish',

  // Game 2 — Vượt Ải (mê cung)
  mtnStart: '/api/mountain/start',
  mtnState: '/api/mountain/state',
  mtnMove: '/api/mountain/move',
  mtnAnswer: '/api/mountain/answer',
  mtnFinish: '/api/mountain/finish',

  leaderboard: '/api/leaderboard',

  adminStudentsImport: '/api/admin/students/import',
  adminStudentsAdd: '/api/admin/students/add',
  adminStudentsExport: '/api/admin/students/export',
  adminQuestionsImport: '/api/admin/questions/import',
  adminQuestionsClear: '/api/admin/questions/clear',
  adminMountainImport: '/api/admin/mountain-questions/import',
  adminMountainClear: '/api/admin/mountain-questions/clear',
  adminEvent: '/api/admin/event',
  adminEventOpen: '/api/admin/event/open',
  adminEventClose: '/api/admin/event/close',
  adminResultsExport: '/api/admin/results/export',
  adminReset: '/api/admin/reset',
  adminResetAll: '/api/admin/reset-all',
  adminPlayers: '/api/admin/players',
} as const;

// ===================== Socket =====================
export const SOCKET_NAMESPACE = '/live';
export const SOCKET_EVENTS = {
  subscribe: 'subscribe', // client -> server: { event_id }
  leaderboardUpdate: 'leaderboard:update', // server -> client: LeaderboardEntry[]
} as const;

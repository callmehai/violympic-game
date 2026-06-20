/**
 * contract.ts — bản mirror của server/src/types.ts cho phía client.
 * Chỉ chứa các DTO/enums client cần. Khi server đổi DTO thì sửa cả 2 file.
 */

export type Subject = 'Toán' | 'Văn' | 'Anh' | 'Sinh' | 'Sử' | 'Địa';
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
    sessions: number;
    finished: number;
  };
}

// ===================== Endpoint paths =====================
export const API = {
  login: '/api/auth/login',
  me: '/api/auth/me',
  adminLogin: '/api/admin/login',

  start: '/api/game/start',
  state: '/api/game/state',
  nextQuestion: '/api/game/next-question',
  answer: '/api/game/answer',
  dig: '/api/game/dig',
  finish: '/api/game/finish',

  leaderboard: '/api/leaderboard',

  adminStudentsImport: '/api/admin/students/import',
  adminStudentsExport: '/api/admin/students/export',
  adminQuestionsImport: '/api/admin/questions/import',
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

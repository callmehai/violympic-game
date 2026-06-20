/**
 * errors.ts — lỗi nghiệp vụ có mã + HTTP status để route map ra response gọn.
 */
export class GameError extends Error {
  code: string;
  httpStatus: number;
  constructor(code: string, message: string, httpStatus = 400) {
    super(message);
    this.name = 'GameError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export function isGameError(e: unknown): e is GameError {
  return e instanceof GameError;
}

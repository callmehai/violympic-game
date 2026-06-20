/**
 * http.ts — tiện ích express: bọc async route + middleware xử lý lỗi tập trung.
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { isGameError } from './errors';

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => unknown): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export function sendError(res: Response, e: unknown): void {
  if (isGameError(e)) {
    res.status(e.httpStatus).json({ error: e.message, code: e.code });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[unhandled]', e);
  res.status(500).json({ error: 'Lỗi hệ thống', code: 'INTERNAL' });
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  sendError(res, err);
}

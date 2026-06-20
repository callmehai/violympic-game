/**
 * auth.routes.ts — định tuyến xác thực người chơi.
 * - POST /login: đăng nhập bằng student_code + mật khẩu (password hoặc access_code).
 * - GET  /me:    trả profile dựng từ token (requireAuth).
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { asyncHandler } from '../util/http';
import { GameError } from '../util/errors';
import { login, requireAuth } from '../auth';
import { getStudentById } from '../db';
import type { LoginResponse, Profile } from '../types';

export const authRouter = Router();

/**
 * POST /login
 * body: { student_code, password?, access_code? }
 * Chấp nhận cả `password` lẫn `access_code` (alias) — mật khẩu phát cho SV.
 */
authRouter.post(
  '/login',
  asyncHandler((req: Request, res: Response) => {
    const body = (req.body ?? {}) as {
      student_code?: unknown;
      password?: unknown;
      access_code?: unknown;
    };

    const studentCode = body.student_code;
    if (typeof studentCode !== 'string' || studentCode.trim() === '') {
      throw new GameError('BAD_INPUT', 'Thiếu mã học sinh', 400);
    }

    // pwd = password ?? access_code (chấp nhận cả 2 tên trường)
    const pwdRaw = body.password ?? body.access_code;
    if (typeof pwdRaw !== 'string' || pwdRaw === '') {
      throw new GameError('BAD_INPUT', 'Thiếu mật khẩu', 400);
    }

    const result: LoginResponse = login(studentCode, pwdRaw);
    res.json(result);
  })
);

/**
 * GET /me (requireAuth)
 * Trả profile dựng từ req.auth; lấy thêm class_name từ DB nếu có.
 */
authRouter.get(
  '/me',
  requireAuth,
  asyncHandler((req: Request, res: Response) => {
    const auth = req.auth!;

    // class_name không nằm trong token → tra DB (nếu là admin sub=0 sẽ không có).
    const student = getStudentById(auth.sub);

    const profile: Profile = {
      student_id: auth.sub,
      student_code: auth.code,
      full_name: auth.name ?? student?.full_name ?? '',
      class_name: student?.class_name ?? null,
      role: auth.role,
    };

    res.json(profile);
  })
);

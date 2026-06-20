import { RequestHandler } from 'express';
import { AuthTokenPayload, LoginResponse } from './types';
import { config } from './config';
import { getStudentByCode } from './db';
import { signAuth, verifyAuth } from './util/jwt';
import { GameError } from './util/errors';

// Augment Express.Request để middleware có thể gán req.auth sau khi xác thực.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthTokenPayload;
    }
  }
}

export function login(code: string, password: string): LoginResponse {
  const s = getStudentByCode(code);
  if (!s || s.password !== password) {
    throw new GameError('BAD_CREDENTIALS', 'Sai mã sinh viên hoặc mật khẩu', 401);
  }
  const token = signAuth({
    sub: s.id,
    role: 'player',
    code: s.student_code,
    name: s.full_name,
  });
  return {
    token,
    profile: {
      student_id: s.id,
      student_code: s.student_code,
      full_name: s.full_name,
      class_name: s.class_name,
      role: 'player',
    },
  };
}

export function adminLogin(adminKey: string): { token: string } {
  if (adminKey !== config.adminKey) {
    throw new GameError('BAD_ADMIN_KEY', 'Sai admin key', 401);
  }
  const token = signAuth({
    sub: 0,
    role: 'admin',
    code: 'admin',
    name: 'Admin',
  });
  return { token };
}

// Đọc token từ header "Authorization: Bearer <token>".
function extractBearer(header: string | undefined): string {
  if (!header || !header.startsWith('Bearer ')) {
    throw new GameError('UNAUTHORIZED', 'Cần đăng nhập', 401);
  }
  return header.slice('Bearer '.length).trim();
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  try {
    const token = extractBearer(req.headers.authorization);
    req.auth = verifyAuth(token);
    next();
  } catch (e) {
    // Mọi lỗi (thiếu header, token sai/hết hạn) đều coi là chưa đăng nhập.
    if (e instanceof GameError) {
      next(e);
    } else {
      next(new GameError('UNAUTHORIZED', 'Cần đăng nhập', 401));
    }
  }
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  try {
    const token = extractBearer(req.headers.authorization);
    req.auth = verifyAuth(token);
    if (req.auth.role !== 'admin') {
      throw new GameError('FORBIDDEN', 'Chỉ admin', 403);
    }
    next();
  } catch (e) {
    if (e instanceof GameError) {
      next(e);
    } else {
      next(new GameError('UNAUTHORIZED', 'Cần đăng nhập', 401));
    }
  }
};

export {};

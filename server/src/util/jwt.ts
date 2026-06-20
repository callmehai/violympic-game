/**
 * jwt.ts — wrapper ký/verify JWT cho 2 loại token:
 *  - auth token (đăng nhập): payload AuthTokenPayload, hạn dài (cả buổi).
 *  - question token (chống replay/đoán): payload QuestionTokenPayload, hạn ngắn.
 */
import jwt from 'jsonwebtoken';
import { config } from '../config';
import type { AuthTokenPayload, QuestionTokenPayload } from '../types';

const AUTH_TTL = '12h';

export function signAuth(payload: AuthTokenPayload): string {
  const { iat, exp, ...rest } = payload;
  return jwt.sign(rest, config.appSecret, { expiresIn: AUTH_TTL });
}

export function verifyAuth(token: string): AuthTokenPayload {
  return jwt.verify(token, config.appSecret) as unknown as AuthTokenPayload;
}

/** expiresInSec: thời hạn câu hỏi (vd = thời gian còn lại của phiên, tối đa). */
export function signQuestionToken(payload: QuestionTokenPayload, expiresInSec: number): string {
  const { iat, exp, ...rest } = payload;
  return jwt.sign(rest, config.appSecret, { expiresIn: Math.max(5, Math.floor(expiresInSec)) });
}

export function verifyQuestionToken(token: string): QuestionTokenPayload {
  return jwt.verify(token, config.appSecret) as unknown as QuestionTokenPayload;
}

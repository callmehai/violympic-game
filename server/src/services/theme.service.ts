/**
 * theme.service.ts — theme giao diện đang áp dụng, lưu trong bảng `settings`.
 *
 * Vì sao ở server chứ không phải env/localStorage: cần BẢO ĐẢM mọi người chơi
 * trong cùng một buổi thấy đúng một giao diện. Env thì phải redeploy mới đổi
 * (gián đoạn giữa buổi), localStorage thì mỗi máy một kiểu.
 *
 * Thêm theme mới: thêm tên vào THEMES ở đây VÀ khai báo block biến màu tương ứng
 * trong client/src/index.css (`:root[data-theme='ten-moi']`).
 */
import { getSetting, setSetting } from '../db';
import { config } from '../config';
import { GameError } from '../util/errors';

export const THEMES = ['treasure', 'philoverse'] as const;
export type ThemeName = (typeof THEMES)[number];

const SETTING_KEY = 'active_theme';

function isTheme(v: string): v is ThemeName {
  return (THEMES as readonly string[]).includes(v);
}

/** Theme đang áp dụng. Chưa từng set → lấy DEFAULT_THEME trong env. */
export function getActiveTheme(): ThemeName {
  const stored = getSetting(SETTING_KEY, config.defaultTheme);
  return isTheme(stored) ? stored : 'treasure';
}

/** Đổi theme đang áp dụng. Tên không hợp lệ → 400. */
export function setActiveTheme(raw: unknown): ThemeName {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!isTheme(value)) {
    throw new GameError(
      'BAD_THEME',
      `Theme không hợp lệ: ${value || '(trống)'}. Chọn một trong: ${THEMES.join(', ')}`,
      400,
    );
  }
  setSetting(SETTING_KEY, value);
  return value;
}

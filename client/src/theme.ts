/**
 * theme.ts — chọn theme giao diện lúc runtime (THUẦN FE, không đụng server).
 *
 * Thứ tự ưu tiên:
 *   1. ?theme=... trên URL   → dùng để xem trước ngay, KHÔNG cần deploy lại.
 *                              Chọn xong ghi vào localStorage nên các lần sau
 *                              vào link trần vẫn giữ theme đó.
 *   2. localStorage          → lựa chọn đã ghi ở bước 1.
 *   3. VITE_THEME            → mặc định của bản build (đặt trong env của Render).
 *                              Đổi env → Render tự build lại → TẤT CẢ máy đổi theo.
 *   4. 'treasure'            → bản gốc.
 *
 * Thêm theme mới: khai báo màu trong src/index.css (block [data-theme='...']),
 * thêm tên vào THEMES và branding tương ứng trong themes/branding.ts.
 */
import { BRANDING, type ThemeName } from './themes/branding';

export const THEMES = ['treasure', 'philoverse'] as const;

const STORAGE_KEY = 'vt_theme';
const DEFAULT_THEME: ThemeName = 'treasure';

function isTheme(v: string | null): v is ThemeName {
  return !!v && (THEMES as readonly string[]).includes(v);
}

/** Theme đang áp dụng (đọc lại logic ưu tiên ở trên). */
export function resolveTheme(): ThemeName {
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (isTheme(fromUrl)) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl;
  }
  // ?theme=xxx sai tên → bỏ qua, rơi xuống các mức dưới (không crash).

  const stored = localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) return stored;

  const fromEnv = import.meta.env.VITE_THEME as string | undefined;
  if (isTheme(fromEnv ?? null)) return fromEnv as ThemeName;

  return DEFAULT_THEME;
}

/**
 * Gắn theme vào <html> + đặt tiêu đề/favicon theo branding.
 * PHẢI gọi trước khi React render để không bị nháy theme cũ.
 */
export function applyTheme(): ThemeName {
  const theme = resolveTheme();
  document.documentElement.dataset.theme = theme;

  const brand = BRANDING[theme];
  document.title = brand.docTitle;

  const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (icon) {
    icon.href =
      'data:image/svg+xml,' +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${brand.favicon}</text></svg>`,
      );
  }

  return theme;
}

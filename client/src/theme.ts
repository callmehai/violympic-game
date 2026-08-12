/**
 * theme.ts — chọn theme giao diện lúc mở trang.
 *
 * SERVER LÀ NGUỒN SỰ THẬT: theme lưu trong bảng `settings` ở server, admin đổi
 * tại /admin. Nhờ vậy mọi máy vào trong cùng một buổi đều nhận đúng một giao
 * diện, và đổi theme KHÔNG cần redeploy.
 *
 * CỐ Ý không lưu localStorage: nếu lưu, máy nào từng xem theme khác sẽ dính
 * theme đó về sau và không còn khớp với lựa chọn của admin nữa.
 *
 * ?theme=... chỉ để XEM THỬ trên đúng tab đang mở (không ghi lại, không ảnh
 * hưởng người khác) — tiện khi cần soi giao diện trước khi bật cho cả lớp.
 */
import { API } from './api/contract';
import { BRANDING, type ThemeName } from './themes/branding';

export const THEMES = ['treasure', 'philoverse'] as const;

const FALLBACK_THEME: ThemeName = 'treasure';

function isTheme(v: string | null | undefined): v is ThemeName {
  return !!v && (THEMES as readonly string[]).includes(v);
}

/** Theme của cả hệ thống, hỏi server. Lỗi mạng → dùng FALLBACK_THEME. */
async function fetchServerTheme(): Promise<ThemeName> {
  try {
    const res = await fetch(API.config, { headers: { Accept: 'application/json' } });
    if (!res.ok) return FALLBACK_THEME;
    const data = (await res.json()) as { theme?: string };
    return isTheme(data.theme) ? data.theme : FALLBACK_THEME;
  } catch {
    return FALLBACK_THEME;
  }
}

/**
 * Gắn theme vào <html> + đặt tiêu đề/favicon theo branding.
 * PHẢI await trước khi React render — index.css ẩn body tới khi có data-theme
 * nên không bao giờ nhìn thấy theme sai loé lên.
 */
export async function applyTheme(): Promise<ThemeName> {
  // Bản trước từng lưu theme vào localStorage → dọn để máy cũ không giữ theme
  // khác với lựa chọn của admin. (Có thể bỏ dòng này sau vài buổi.)
  localStorage.removeItem('vt_theme');

  const preview = new URLSearchParams(window.location.search).get('theme');
  const theme = isTheme(preview) ? preview : await fetchServerTheme();

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

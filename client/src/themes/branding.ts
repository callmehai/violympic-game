/**
 * branding.ts — chữ + logo riêng cho từng theme (hardcode, theo yêu cầu).
 *
 * CHỈ chứa phần "thương hiệu": tên tổ chức, logo, tiêu đề tab.
 * KHÔNG chứa tên/luật trò chơi ("Đi tìm kho báu", "Vượt Ải Trí Tuệ", cách tính
 * điểm…) — hai theme dùng chung một trò chơi, luật không đổi.
 */
export type ThemeName = 'treasure' | 'philoverse';

export interface Branding {
  /** Logo dạng emoji, đứng trước tên ở header. */
  logo: string;
  /** Tên hiển thị ở header trang chủ. */
  appName: string;
  /** Dòng phụ dưới tiêu đề trang Đăng nhập / Quản trị. */
  tagline: string;
  /** Tiêu đề tab trình duyệt. */
  docTitle: string;
  /** Emoji làm favicon. */
  favicon: string;
}

export const BRANDING: Record<ThemeName, Branding> = {
  treasure: {
    logo: '🎮',
    appName: 'Violympic Mini Games',
    tagline: 'Violympic 💎🏆',
    docTitle: 'Đi tìm kho báu — Violympic',
    favicon: '🏆',
  },
  philoverse: {
    logo: '🦉',
    appName: 'Học Viện PhiloVerse',
    tagline: 'Học Viện PhiloVerse 📖',
    docTitle: 'Học Viện PhiloVerse',
    favicon: '📖',
  },
};

/** Branding của theme đang chạy (đọc từ data-theme mà theme.ts đã gắn). */
export function useBranding(): Branding {
  const theme = document.documentElement.dataset.theme as ThemeName | undefined;
  return BRANDING[theme ?? 'treasure'] ?? BRANDING.treasure;
}

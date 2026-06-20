/**
 * client.ts — fetch wrapper + lưu token. Mọi gọi REST đi qua apiFetch.
 */
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const TOKEN_KEY = 'vt_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

interface FetchOpts {
  method?: string;
  body?: unknown; // object -> JSON; FormData -> gửi nguyên
  auth?: boolean; // mặc định true: tự gắn Bearer token
  headers?: Record<string, string>;
}

export async function apiFetch<T>(path: string, opts: FetchOpts = {}): Promise<T> {
  const { method = 'GET', body, auth = true, headers = {} } = opts;
  const h: Record<string, string> = { ...headers };
  let payload: BodyInit | undefined;

  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    h['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  if (auth) {
    const token = getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(BASE + path, { method, headers: h, body: payload });

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : await res.text();

  if (!res.ok) {
    const msg =
      (isJson && data && typeof data === 'object' && 'error' in data
        ? String((data as { error: unknown }).error)
        : typeof data === 'string' && data
          ? data
          : `Lỗi ${res.status}`) || `Lỗi ${res.status}`;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

/** Tải file (blob) — dùng cho export CSV. */
export async function apiDownload(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = getToken();
  const res = await fetch(BASE + path, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError(res.status, `Lỗi tải file (${res.status})`);
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const m = /filename="?([^"]+)"?/.exec(cd);
  return { blob, filename: m ? m[1] : 'export.csv' };
}

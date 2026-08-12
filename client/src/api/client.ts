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

// Timeout mỗi request (ms). Render restart/cold-start có thể chậm → để rộng rãi.
const REQUEST_TIMEOUT_MS = 12000;
// Số lần thử lại cho request GET (idempotent) khi timeout/lỗi mạng/5xx.
const GET_RETRIES = 3;
const RETRY_BACKOFF_MS = 800;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  // Chỉ tự retry cho GET — POST (answer/dig/finish) KHÔNG retry để tránh gửi trùng.
  const isGet = method.toUpperCase() === 'GET';
  const maxAttempts = isGet ? GET_RETRIES : 1;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    // Timeout bằng AbortController để không treo vô thời hạn khi server đang restart.
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch(BASE + path, {
        method,
        headers: h,
        body: payload,
        signal: ctrl.signal,
      });
      clearTimeout(timer);

      const isJson = res.headers.get('content-type')?.includes('application/json');
      const data = isJson ? await res.json().catch(() => null) : await res.text();

      if (!res.ok) {
        // 5xx (server đang khởi động lại) → thử lại nếu là GET; còn lại ném luôn.
        if (isGet && res.status >= 500 && attempt < maxAttempts) {
          lastErr = new ApiError(res.status, `Lỗi ${res.status}`, data);
          await sleep(RETRY_BACKOFF_MS * attempt);
          continue;
        }
        const msg =
          (isJson && data && typeof data === 'object' && 'error' in data
            ? String((data as { error: unknown }).error)
            : typeof data === 'string' && data
              ? data
              : `Lỗi ${res.status}`) || `Lỗi ${res.status}`;
        throw new ApiError(res.status, msg, data);
      }
      return data as T;
    } catch (err) {
      clearTimeout(timer);
      // ApiError (từ nhánh !res.ok ở trên) → không nuốt, ném thẳng.
      if (err instanceof ApiError) throw err;
      // Lỗi mạng hoặc abort (timeout): retry nếu còn lượt và là GET.
      lastErr = err;
      if (attempt < maxAttempts) {
        await sleep(RETRY_BACKOFF_MS * attempt);
        continue;
      }
      const aborted = err instanceof DOMException && err.name === 'AbortError';
      throw new ApiError(
        0,
        aborted ? 'Máy chủ phản hồi chậm, vui lòng thử lại.' : 'Lỗi kết nối máy chủ.',
        lastErr,
      );
    }
  }
  // Không tới đây, nhưng để TS yên tâm.
  throw new ApiError(0, 'Lỗi kết nối máy chủ.', lastErr);
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

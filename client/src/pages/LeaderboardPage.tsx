/**
 * LeaderboardPage.tsx — bảng xếp hạng real-time (Socket.IO) có fallback poll.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API, type LeaderboardEntry } from '../api/contract';
import { connectLeaderboard } from '../api/socket';
import { useAuth } from '../store/auth';
import RankTable from '../components/RankTable';

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const isAuthed = useAuth((s) => s.isAuthed);
  const profile = useAuth((s) => s.profile);
  const meCode = profile?.student_code;

  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Giữ trạng thái connected mới nhất cho vòng poll mà không cần đăng ký lại effect.
  const connectedRef = useRef(false);
  connectedRef.current = connected;

  // Tải bảng xếp hạng 1 lần (auth: true để server gắn cờ is_me nếu đã đăng nhập).
  async function loadOnce() {
    try {
      const data = await apiFetch<LeaderboardEntry[]>(API.leaderboard, { auth: true });
      setRows(data);
      setError(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message || 'Không tải được bảng xếp hạng.');
      } else {
        setError('Không kết nối được máy chủ, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Lần tải đầu khi mount.
  useEffect(() => {
    void loadOnce();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kết nối real-time. eventId không biết từ client -> chuỗi rỗng (server broadcast theo event hiện tại).
  useEffect(() => {
    const cleanup = connectLeaderboard(
      '',
      (next) => {
        setRows(next);
        setLoading(false);
        setError(null);
      },
      (c) => setConnected(c),
    );
    return cleanup;
  }, []);

  // Fallback poll mỗi 3s khi socket chưa connected.
  useEffect(() => {
    if (connected) return;
    const id = window.setInterval(() => {
      if (!connectedRef.current) void loadOnce();
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div className="min-h-screen bg-treasure-bg p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
        {/* Header */}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-treasure-gold">🏆 Bảng xếp hạng</h1>
            <div className="mt-1 flex items-center gap-2 text-sm">
              <span
                className={`inline-block h-2.5 w-2.5 rounded-full ${
                  connected ? 'animate-pop bg-treasure-gem' : 'bg-orange-400'
                }`}
              />
              <span className={connected ? 'text-treasure-gem' : 'text-orange-300'}>
                {connected ? 'Live' : 'Đang cập nhật…'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to="/" className="btn btn-ghost">
              Về sảnh
            </Link>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => navigate(isAuthed ? '/' : '/login')}
            >
              ⛏️ Chơi
            </button>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-lg border border-treasure-danger bg-treasure-danger/20 px-3 py-2 text-sm font-semibold text-treasure-danger animate-shake"
          >
            {error}
          </div>
        )}

        {loading && rows.length === 0 ? (
          <div className="panel p-8 text-center text-treasure-gem/70">Đang tải bảng xếp hạng…</div>
        ) : (
          <RankTable rows={rows} meCode={meCode} />
        )}
      </div>
    </div>
  );
}

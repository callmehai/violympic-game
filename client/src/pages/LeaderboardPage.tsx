/**
 * LeaderboardPage.tsx — bảng xếp hạng real-time (Socket.IO) có fallback poll.
 * Có TAB chọn game (Kho báu | Vượt Ải) — mỗi game 1 bảng riêng.
 */
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API, type GameId, type LeaderboardEntry } from '../api/contract';
import { connectLeaderboard } from '../api/socket';
import { useAuth } from '../store/auth';
import RankTable from '../components/RankTable';

const GAME_TABS: { id: GameId; label: string }[] = [
  { id: 'treasure', label: '⛏️ Kho báu' },
  { id: 'mountain', label: '⛰️ Vượt Ải' },
];

export default function LeaderboardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const isAuthed = useAuth((s) => s.isAuthed);
  const profile = useAuth((s) => s.profile);
  const meCode = profile?.student_code;

  const initial: GameId = params.get('game') === 'mountain' ? 'mountain' : 'treasure';
  const [game, setGame] = useState<GameId>(initial);

  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const connectedRef = useRef(false);
  connectedRef.current = connected;
  const gameRef = useRef<GameId>(game);
  gameRef.current = game;

  async function loadOnce(g: GameId) {
    try {
      const data = await apiFetch<LeaderboardEntry[]>(`${API.leaderboard}?game=${g}`, { auth: true });
      if (gameRef.current === g) {
        setRows(data);
        setError(null);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message || 'Không tải được bảng xếp hạng.' : 'Không kết nối được máy chủ.');
    } finally {
      setLoading(false);
    }
  }

  // Đổi game → cập nhật URL, reset bảng, tải lại + nối socket mới.
  useEffect(() => {
    setLoading(true);
    setRows([]);
    setParams(game === 'treasure' ? {} : { game }, { replace: true });
    void loadOnce(game);

    const cleanup = connectLeaderboard(
      game,
      (next) => {
        if (gameRef.current === game) {
          setRows(next);
          setLoading(false);
          setError(null);
        }
      },
      (c) => setConnected(c),
    );
    return cleanup;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  // Fallback poll mỗi 3s khi socket chưa connected.
  useEffect(() => {
    if (connected) return;
    const id = window.setInterval(() => {
      if (!connectedRef.current) void loadOnce(gameRef.current);
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected]);

  return (
    <div className="min-h-screen bg-treasure-bg p-4 sm:p-6">
      <div className="mx-auto w-full max-w-3xl">
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
              ← Trang chủ
            </Link>
            <button
              type="button"
              className="btn btn-gold"
              onClick={() => navigate(isAuthed ? '/' : '/login')}
            >
              🎮 Chơi
            </button>
          </div>
        </div>

        {/* Tab chọn game */}
        <div className="mb-4 inline-flex rounded-xl bg-black/30 p-1">
          {GAME_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setGame(t.id)}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                game === t.id ? 'bg-treasure-gold text-treasure-bg' : 'text-white/70 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
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

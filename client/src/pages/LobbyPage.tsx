/**
 * LobbyPage — màn chờ/sảnh chính của người chơi.
 * Lấy trạng thái phiên chơi (GameStateDTO|null) và render phù hợp:
 *  - null            → màn chuẩn bị + nút "Bắt đầu chơi"
 *  - in_progress     → nút "Tiếp tục chơi"
 *  - finished        → thẻ kết quả + xem bảng xếp hạng
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API } from '../api/contract';
import type { GameStateDTO } from '../api/contract';
import { useAuth } from '../store/auth';

/** Đổi mili-giây → chuỗi "mm:ss". */
function formatMs(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<GameStateDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await apiFetch<GameStateDTO | null>(API.state);
        if (alive) setState(s);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'Không tải được trạng thái phiên chơi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      await apiFetch<GameStateDTO>(API.start, { method: 'POST' });
      navigate('/game');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không bắt đầu được lượt chơi.');
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-treasure-bg text-white">
      {/* Thanh trên cùng */}
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h1 className="text-2xl font-bold text-treasure-gold">
          ⛏️ Đi tìm kho báu
        </h1>
        <div className="flex items-center gap-2">
          <Link to="/leaderboard" className="btn btn-ghost">
            🏆 Bảng xếp hạng
          </Link>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12">
        {/* Lời chào */}
        {profile && (
          <p className="mb-4 text-lg">
            Xin chào,{' '}
            <span className="font-bold text-treasure-gem">{profile.full_name}</span>{' '}
            <span className="text-treasure-woodlt">({profile.student_code})</span>
          </p>
        )}

        {error && (
          <div className="panel mb-4 animate-shake border border-treasure-danger/60 text-treasure-danger">
            {error}
          </div>
        )}

        {loading ? (
          <div className="panel animate-pop text-center text-treasure-woodlt">
            Đang tải trạng thái lượt chơi…
          </div>
        ) : state === null ? (
          <PrepareCard onStart={handleStart} starting={starting} />
        ) : state.status === 'in_progress' ? (
          <ContinueCard onContinue={() => navigate('/game')} />
        ) : state.status === 'finished' ? (
          <ResultCard state={state} onLeaderboard={() => navigate('/leaderboard')} />
        ) : (
          // abandoned hoặc trạng thái khác → cho chơi lại như màn chuẩn bị
          <PrepareCard onStart={handleStart} starting={starting} />
        )}
      </main>
    </div>
  );
}

/* ===================== Thẻ con (chỉ dùng trong page này) ===================== */

function PrepareCard({ onStart, starting }: { onStart: () => void; starting: boolean }) {
  return (
    <div className="panel animate-pop">
      <h2 className="mb-3 text-xl font-bold text-treasure-gold">Sẵn sàng đào kho báu?</h2>
      <ul className="mb-5 space-y-2 text-treasure-woodlt">
        <li>📝 Trả lời đúng câu hỏi để được đào một ô.</li>
        <li>💎 Ô ngọc: cộng điểm.</li>
        <li>💣 Ô bom: trừ điểm — cẩn thận nhé!</li>
        <li>🏆 Rương jackpot: trúng lớn, kết thúc lượt chơi.</li>
        <li>⏱️ Có đồng hồ đếm tổng thời gian cho cả lượt.</li>
        <li>📊 Xếp hạng theo điểm số, bằng điểm thì xét thời gian.</li>
      </ul>
      <button
        type="button"
        className="btn btn-gold w-full"
        onClick={onStart}
        disabled={starting}
      >
        {starting ? 'Đang bắt đầu…' : '⛏️ Bắt đầu chơi'}
      </button>
    </div>
  );
}

function ContinueCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="panel animate-pop">
      <h2 className="mb-3 text-xl font-bold text-treasure-gold">Lượt chơi đang diễn ra</h2>
      <p className="mb-5 text-treasure-woodlt">
        Bạn còn một lượt chơi chưa hoàn thành. Quay lại để tiếp tục đào kho báu!
      </p>
      <button type="button" className="btn btn-gold w-full" onClick={onContinue}>
        ▶️ Tiếp tục chơi
      </button>
    </div>
  );
}

function ResultCard({
  state,
  onLeaderboard,
}: {
  state: GameStateDTO;
  onLeaderboard: () => void;
}) {
  const timeSpentMs = Math.max(0, (state.time_limit_s - state.time_left_s) * 1000);
  return (
    <div className="panel animate-pop text-center">
      <h2 className="mb-4 text-xl font-bold text-treasure-gold">🏆 Bạn đã hoàn thành!</h2>
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-treasure-wood p-3">
          <div className="text-2xl font-bold text-treasure-gem">{state.score}</div>
          <div className="text-sm text-treasure-woodlt">Điểm</div>
        </div>
        <div className="rounded-lg bg-treasure-wood p-3">
          <div className="text-2xl font-bold text-treasure-gold">
            {state.rank != null ? `#${state.rank}` : '—'}
          </div>
          <div className="text-sm text-treasure-woodlt">Hạng</div>
        </div>
        <div className="rounded-lg bg-treasure-wood p-3">
          <div className="text-2xl font-bold">{formatMs(timeSpentMs)}</div>
          <div className="text-sm text-treasure-woodlt">Thời gian</div>
        </div>
      </div>
      <p className="mb-5 text-treasure-woodlt">
        Bạn đã hoàn thành lượt chơi và không thể chơi lại (trừ khi được ban tổ chức reset).
      </p>
      <button type="button" className="btn btn-gold w-full" onClick={onLeaderboard}>
        🏆 Xem bảng xếp hạng
      </button>
    </div>
  );
}

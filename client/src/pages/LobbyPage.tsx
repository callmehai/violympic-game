/**
 * LobbyPage — màn sảnh của người chơi.
 *  - null        → màn chuẩn bị (luật chơi + cách tính điểm + cấu tạo bàn cờ) + "Bắt đầu chơi"
 *  - in_progress → "Tiếp tục chơi"
 *  - finished    → thẻ kết quả + xem bảng xếp hạng
 * Số liệu điểm/bàn cờ lấy từ /api/config nên luôn khớp cấu hình server.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API } from '../api/contract';
import type { GameStateDTO, RulesDTO } from '../api/contract';
import { useAuth } from '../store/auth';

function formatMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

function fmtMinutes(s: number): string {
  if (s % 60 === 0) return `${s / 60} phút`;
  return `${Math.floor(s / 60)} phút ${s % 60} giây`;
}

function fmtGem(values: number[]): string {
  if (!values.length) return '+điểm';
  return values.length === 1 ? `+${values[0]}` : values.map((v) => `+${v}`).join(' / ');
}

export default function LobbyPage() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<GameStateDTO | null>(null);
  const [rules, setRules] = useState<RulesDTO | null>(null);
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
        if (alive)
          setError(e instanceof ApiError ? e.message : 'Không tải được trạng thái phiên chơi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    // Luật chơi (public, best-effort — lỗi thì dùng số mặc định).
    apiFetch<RulesDTO>(API.config, { auth: false })
      .then((r) => {
        if (alive) setRules(r);
      })
      .catch(() => {});
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
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h1 className="font-display text-2xl font-extrabold text-accent">⛏️ Đi tìm kho báu</h1>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn btn-ghost">
            ← Trang chủ
          </Link>
          <Link to="/leaderboard?game=treasure" className="btn btn-ghost">
            🏆 Bảng xếp hạng
          </Link>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-4 pb-12">
        {profile && (
          <p className="mb-4 text-lg">
            Xin chào, <span className="font-bold text-info">{profile.full_name}</span>{' '}
            <span className="text-ink/50">({profile.student_code})</span>
          </p>
        )}

        {error && (
          <div className="panel mb-4 animate-shake border border-bad/60 p-4 text-bad">
            {error}
          </div>
        )}

        {loading ? (
          <div className="panel animate-pop p-6 text-center text-ink/60">
            Đang tải trạng thái lượt chơi…
          </div>
        ) : state === null || state.status === 'abandoned' ? (
          <PrepareCard rules={rules} onStart={handleStart} starting={starting} />
        ) : state.status === 'in_progress' ? (
          <ContinueCard onContinue={() => navigate('/game')} />
        ) : (
          <ResultCard state={state} onLeaderboard={() => navigate('/leaderboard')} />
        )}
      </main>
    </div>
  );
}

/* ===================== Thẻ con ===================== */

function DiffChip({ label, pts, tone }: { label: string; pts: number; tone: string }) {
  return (
    <div className={`rounded-xl border px-2 py-3 text-center ${tone}`}>
      <div className="text-xs font-semibold opacity-80">{label}</div>
      <div className="font-display text-2xl font-extrabold">+{pts}</div>
    </div>
  );
}

function CellCard({
  icon,
  name,
  count,
  value,
  kind,
}: {
  icon: string;
  name: string;
  count: number;
  value: string;
  kind: 'good' | 'bad' | 'neutral';
}) {
  const tone =
    kind === 'good'
      ? 'border-ok-400/30 bg-ok-500/10'
      : kind === 'bad'
        ? 'border-bad-400/30 bg-bad-500/10'
        : 'border-ink/10 bg-shade/30';
  const vcls =
    kind === 'good' ? 'text-ok-300' : kind === 'bad' ? 'text-bad-300' : 'text-ink/50';
  return (
    <div className={`rounded-xl border p-3 text-center ${tone}`}>
      <div className="text-3xl leading-none">{icon}</div>
      <div className="mt-1.5 text-sm font-bold text-ink">{name}</div>
      <div className="text-xs text-ink/50">{count} ô</div>
      <div className={`mt-1 font-display text-lg font-extrabold ${vcls}`}>{value}</div>
    </div>
  );
}

function PrepareCard({
  rules,
  onStart,
  starting,
}: {
  rules: RulesDTO | null;
  onStart: () => void;
  starting: boolean;
}) {
  const dp = rules?.difficultyPoints ?? { easy: 10, medium: 20, hard: 30 };
  const board = rules?.board ?? { gems: 14, chest: 1, bombs: 6, empty: 15 };
  const gemText = rules ? fmtGem(rules.values.gemValues) : '+20';
  const chestText = `+${rules?.values.chest ?? 100}`;
  const bombText = `−${Math.abs(rules?.values.bomb ?? -15)}`;
  const fastSec = (rules?.fastAnswerMs ?? 10000) / 1000;
  const fastBonus = rules?.fastAnswerBonus ?? 5;
  const rows = rules?.rows ?? 6;
  const cols = rules?.cols ?? 6;
  const totalCells = rules?.totalCells ?? rows * cols;
  const timeLimitS = rules?.timeLimitS ?? 300;

  return (
    <div className="panel animate-pop space-y-6 p-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-extrabold text-accent">
          Sẵn sàng đào kho báu? ⛏️
        </h2>
        <p className="mt-1 text-sm text-ink/60">Trả lời đúng câu hỏi → được đào 1 ô để săn 💎🏆</p>
      </div>

      {/* Điểm câu hỏi */}
      <section className="space-y-3">
        <h3 className="font-bold text-info">🎯 Điểm khi trả lời đúng (theo độ khó)</h3>
        <div className="grid grid-cols-3 gap-2">
          <DiffChip label="Dễ" pts={dp.easy} tone="border-ok-400/40 bg-ok-500/10 text-ok-200" />
          <DiffChip label="Trung bình" pts={dp.medium} tone="border-warn-400/40 bg-warn-500/10 text-warn-200" />
          <DiffChip label="Khó" pts={dp.hard} tone="border-bad-400/40 bg-bad-500/10 text-bad-200" />
        </div>
        <div className="rounded-xl border border-info/30 bg-info/10 px-3 py-2.5 text-sm">
          ⚡ Trả lời trong <b>{fastSec} giây</b> đầu → được thêm{' '}
          <b className="text-info">+{fastBonus} điểm</b> thưởng tốc độ.
        </div>
      </section>

      {/* Bàn cờ kho báu */}
      <section className="space-y-3">
        <h3 className="font-bold text-accent">
          🗺️ Bàn cờ {rows}×{cols} = {totalCells} ô (mỗi câu đúng đào 1 ô)
        </h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <CellCard icon="💎" name="Kim cương" count={board.gems} value={gemText} kind="good" />
          <CellCard icon="🏆" name="Rương vàng" count={board.chest} value={chestText} kind="good" />
          <CellCard icon="💣" name="Bom" count={board.bombs} value={bombText} kind="bad" />
          <CellCard icon="🕳️" name="Ô trống" count={board.empty} value="0" kind="neutral" />
        </div>
        <p className="text-center text-xs text-ink/50">
          💡 Điểm <b className="text-ink/70">không bao giờ bị âm</b> — đào trúng bom chỉ về 0.
        </p>
      </section>

      {/* Luật + xếp hạng */}
      <section className="space-y-1.5 rounded-xl border border-ink/10 bg-shade/20 p-4 text-sm text-ink/80">
        <div>
          ⏱️ Thời gian: <b className="text-ink">{fmtMinutes(timeLimitS)}</b> cho cả lượt.
        </div>
        <div className="rounded-lg bg-info/15 px-2.5 py-2 font-semibold text-info">
          ⏸️ Lúc xem <b>giải thích đáp án thì đồng hồ TẠM DỪNG</b> — cứ bình tĩnh đọc kỹ, không lo mất thời gian nhé!
        </div>
        <div>❌ Trả lời sai: 0 điểm, không được đào, sang câu kế tiếp.</div>
        <div>
          🏅 Xếp hạng: <b className="text-ink">điểm cao</b> thắng; bằng điểm thì{' '}
          <b className="text-ink">nhanh hơn</b> thắng.
        </div>
        <div>
          🔁 Mỗi người chơi <b className="text-ink">1 lần</b> (thứ tự câu hỏi + đáp án xáo trộn
          riêng từng người).
        </div>
      </section>

      <button
        type="button"
        className="btn-gold w-full py-3.5 text-lg"
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
    <div className="panel animate-pop p-6 text-center">
      <div className="text-4xl">⏳</div>
      <h2 className="mt-2 font-display text-xl font-extrabold text-accent">
        Lượt chơi đang diễn ra
      </h2>
      <p className="mb-5 mt-1 text-ink/70">
        Bạn còn một lượt chơi chưa hoàn thành. Quay lại để tiếp tục đào kho báu!
      </p>
      <button type="button" className="btn-gold w-full py-3" onClick={onContinue}>
        ▶️ Tiếp tục chơi
      </button>
    </div>
  );
}

function ResultCard({ state, onLeaderboard }: { state: GameStateDTO; onLeaderboard: () => void }) {
  const timeSpentMs = Math.max(0, (state.time_limit_s - state.time_left_s) * 1000);
  return (
    <div className="panel animate-pop p-6 text-center">
      <div className="text-5xl">🏆</div>
      <h2 className="mt-2 font-display text-xl font-extrabold text-accent">
        Bạn đã hoàn thành!
      </h2>
      <div className="my-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-accent">{state.score}</div>
          <div className="text-xs text-ink/50">Điểm</div>
        </div>
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-info">
            {state.rank != null ? `#${state.rank}` : '—'}
          </div>
          <div className="text-xs text-ink/50">Hạng</div>
        </div>
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-ink">
            {formatMs(timeSpentMs)}
          </div>
          <div className="text-xs text-ink/50">Thời gian</div>
        </div>
      </div>
      <p className="mb-5 text-sm text-ink/60">
        Bạn đã hoàn thành lượt chơi, không thể chơi lại (trừ khi được ban tổ chức reset).
      </p>
      <button type="button" className="btn-gold w-full py-3" onClick={onLeaderboard}>
        🏆 Xem bảng xếp hạng
      </button>
    </div>
  );
}

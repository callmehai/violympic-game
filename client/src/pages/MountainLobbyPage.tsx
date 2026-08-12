/**
 * MountainLobbyPage — sảnh Game 2 "Vượt Ải Trí Tuệ".
 *  - null/abandoned → màn chuẩn bị (luật + cách tính điểm + 4 kiểu câu) + "Bắt đầu leo"
 *  - in_progress    → "Tiếp tục leo"
 *  - finished       → kết quả + xem bảng xếp hạng
 * Số liệu lấy từ /api/mountain/config nên luôn khớp cấu hình server.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API } from '../api/contract';
import type { MazeStateDTO, MountainRulesDTO } from '../api/contract';
import { useAuth } from '../store/auth';

function fmtMinutes(s: number): string {
  if (s % 60 === 0) return `${s / 60} phút`;
  return `${Math.floor(s / 60)} phút ${s % 60} giây`;
}

export default function MountainLobbyPage() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<MazeStateDTO | null>(null);
  const [rules, setRules] = useState<MountainRulesDTO | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await apiFetch<MazeStateDTO | null>(API.mtnState);
        if (alive) setState(s);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : 'Không tải được trạng thái.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    apiFetch<MountainRulesDTO>(API.mountainConfig, { auth: false })
      .then((r) => alive && setRules(r))
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
      await apiFetch<MazeStateDTO>(API.mtnStart, { method: 'POST' });
      navigate('/mountain/play');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không bắt đầu được lượt chơi.');
      setStarting(false);
    }
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h1 className="font-display text-2xl font-extrabold text-accent">⛰️ Vượt Ải Trí Tuệ</h1>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn btn-ghost">
            ← Trang chủ
          </Link>
          <Link to="/leaderboard?game=mountain" className="btn btn-ghost">
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
          <div className="panel animate-pop p-6 text-center text-ink/60">Đang tải…</div>
        ) : state === null || state.status === 'abandoned' ? (
          <PrepareCard rules={rules} onStart={handleStart} starting={starting} />
        ) : state.status === 'in_progress' ? (
          <ContinueCard onContinue={() => navigate('/mountain/play')} />
        ) : (
          <ResultCard state={state} onLeaderboard={() => navigate('/leaderboard?game=mountain')} />
        )}
      </main>
    </div>
  );
}

const TYPES = [
  { icon: '🔘', name: 'Trắc nghiệm', desc: 'Chọn 1 đáp án đúng' },
  { icon: '⌨️', name: 'Điền đáp án', desc: 'Gõ đáp án / con số' },
  { icon: '⚖️', name: 'Đúng / Sai', desc: 'Phán đoán khẳng định' },
  { icon: '🔢', name: 'Sắp xếp', desc: 'Kéo về đúng thứ tự' },
];

function PrepareCard({
  rules,
  onStart,
  starting,
}: {
  rules: MountainRulesDTO | null;
  onStart: () => void;
  starting: boolean;
}) {
  const dp = rules?.difficultyPoints ?? { easy: 10, medium: 20, hard: 30 };
  const fastSec = (rules?.speedWindowMs ?? 10000) / 1000;
  const speedMax = rules?.speedBonusMax ?? 8;
  const finishBase = rules?.finishBase ?? 50;
  const finishTime = rules?.finishTimeBonus ?? 1000;
  const finishMax = finishBase + finishTime;
  const timeLimitS = rules?.timeLimitS ?? 300;
  // Mỗi giây CHƯA về đích → mất bao nhiêu điểm thưởng đích.
  const lossPerSec = timeLimitS > 0 ? finishTime / timeLimitS : 0;
  const lossText = lossPerSec.toFixed(1).replace('.', ',');

  return (
    <div className="panel animate-pop space-y-6 p-6">
      <div className="text-center">
        <h2 className="font-display text-2xl font-extrabold text-accent">
          Sẵn sàng vào mê cung? 🗺️
        </h2>
        <p className="mt-1 text-sm text-ink/60">
          Điều khiển nhân vật tìm đường tới kho báu 💎. Qua <b className="text-warn-300">cửa 🚪/bẫy</b> phải trả lời — sai thì cửa khoá, đổi tuyến!
        </p>
      </div>

      {/* Thời gian + cửa + thưởng */}
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="⏱️" big={fmtMinutes(timeLimitS)} label="Thời gian" tone="text-accent" />
        <Stat icon="🚪" big="9" label="Số cửa hỏi" tone="text-warn-300" />
        <Stat icon="💎" big={`+${finishMax.toLocaleString('vi-VN')}`} label="Thưởng đích" tone="text-ok-300" />
      </div>

      {/* 4 kiểu câu */}
      <section className="space-y-3">
        <h3 className="font-bold text-info">🧩 4 kiểu câu hỏi (dễ → khó dần)</h3>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TYPES.map((t) => (
            <div key={t.name} className="rounded-xl border border-ink/10 bg-shade/30 p-3 text-center">
              <div className="text-2xl">{t.icon}</div>
              <div className="mt-1 text-sm font-bold text-ink">{t.name}</div>
              <div className="text-xs text-ink/50">{t.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Điểm */}
      <section className="space-y-2 rounded-xl border border-ink/10 bg-shade/20 p-4 text-sm text-ink/80">
        <div>
          🚶 Đi bằng <b className="text-ink">phím mũi tên</b> hoặc <b className="text-ink">bấm ô kề</b> bên. Né 🪨, tìm 💎.
        </div>
        <div>
          🎯 Qua <b className="text-warn-300">cửa/bẫy</b> (số trên cửa = độ khó) → trả lời. <b className="text-ink">Đúng</b> = mở đường + điểm theo độ khó (<b className="text-ok-300">1 Dễ</b> +{dp.easy} · <b className="text-warn-300">2 TB</b> +{dp.medium} · <b className="text-bad-300">3 Khó</b> +{dp.hard}).
        </div>
        <div>
          ⚡ Trả lời càng nhanh càng được thưởng (tối đa{' '}
          <b className="text-info">+{speedMax}đ</b>, giảm dần về 0 trong{' '}
          <b className="text-ink">{fastSec} giây</b>).
        </div>
        <div>
          ❌ <b className="text-ink">Sai</b>: cửa đó thành đá → phải đi tuyến khác (không mất mạng). Chỉ{' '}
          <b className="text-ink">DỪNG khi không còn đường nào</b> tới kho báu.
        </div>
        <div>
          💎 Về tới kho báu = <b className="text-ok-300">thưởng đích</b> = {finishBase} + (%giờ còn × {finishTime.toLocaleString('vi-VN')}) — tối đa ~{finishMax.toLocaleString('vi-VN')}đ.
        </div>
        <div className="rounded-xl border border-bad-400/50 bg-bad-500/10 px-3 py-2.5 text-sm font-bold text-ink">
          ⏳ Với <span className="text-bad-300">mỗi giây bạn chưa về đích = đang mất ~{lossText} điểm</span> thưởng → trả lời gọn rồi nhanh chân về đích!
        </div>
        <div>
          ⏱️ Thời gian: <b className="text-ink">{fmtMinutes(timeLimitS)}</b>. Xếp hạng theo <b className="text-ink">điểm</b>, bằng điểm thì <b className="text-ink">nhanh hơn</b> thắng.
        </div>
        <div className="rounded-lg bg-info/15 px-2.5 py-2 font-semibold text-info">
          ⏸️ Lúc xem <b>giải thích đáp án thì đồng hồ TẠM DỪNG</b> — cứ bình tĩnh đọc kỹ, không lo mất thời gian nhé!
        </div>
      </section>

      <button
        type="button"
        className="btn-gold w-full py-3.5 text-lg"
        onClick={onStart}
        disabled={starting}
      >
        {starting ? 'Đang bắt đầu…' : '🗺️ Vào mê cung'}
      </button>
    </div>
  );
}

function Stat({ icon, big, label, tone }: { icon: string; big: string; label: string; tone: string }) {
  return (
    <div className="rounded-xl border border-ink/10 bg-shade/30 p-3 text-center">
      <div className="text-2xl">{icon}</div>
      <div className={`font-display text-2xl font-extrabold ${tone}`}>{big}</div>
      <div className="text-xs text-ink/50">{label}</div>
    </div>
  );
}

function ContinueCard({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="panel animate-pop p-6 text-center">
      <div className="text-4xl">🗺️</div>
      <h2 className="mt-2 font-display text-xl font-extrabold text-accent">
        Hành trình đang dở dang
      </h2>
      <p className="mb-5 mt-1 text-ink/70">Bạn còn một lượt đi chưa về đích. Quay lại tiếp tục!</p>
      <button type="button" className="btn-gold w-full py-3" onClick={onContinue}>
        ▶️ Tiếp tục đi
      </button>
    </div>
  );
}

function ResultCard({
  state,
  onLeaderboard,
}: {
  state: MazeStateDTO;
  onLeaderboard: () => void;
}) {
  const reached = state.reached;
  return (
    <div className="panel animate-pop p-6 text-center">
      <div className="text-5xl">{reached ? '💎' : '🪨'}</div>
      <h2 className="mt-2 font-display text-xl font-extrabold text-accent">
        {reached ? 'Đã tới kho báu!' : 'Đã kết thúc hành trình'}
      </h2>
      <div className="my-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-accent">{state.score}</div>
          <div className="text-xs text-ink/50">Điểm</div>
        </div>
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-info">
            {state.gates_opened}
          </div>
          <div className="text-xs text-ink/50">Cổng mở</div>
        </div>
        <div className="rounded-xl bg-shade/30 p-3">
          <div className="font-display text-2xl font-extrabold text-ink">
            {state.rank != null ? `#${state.rank}` : '—'}
          </div>
          <div className="text-xs text-ink/50">Hạng</div>
        </div>
      </div>
      <p className="mb-5 text-sm text-ink/60">
        Mỗi người chơi 1 lần (trừ khi được ban tổ chức reset).
      </p>
      <button type="button" className="btn-gold w-full py-3" onClick={onLeaderboard}>
        🏆 Xem bảng xếp hạng
      </button>
    </div>
  );
}

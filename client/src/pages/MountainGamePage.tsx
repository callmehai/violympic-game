/**
 * MountainGamePage — Game 2 "Vượt Ải Trí Tuệ" = MÊ CUNG 2D.
 * Điều khiển nhân vật đi trong lưới tới kho báu 💎. Vào ô "?" → trả lời.
 * Đúng → qua; Sai → cổng thành đá → đi tuyến khác. Chỉ THUA khi kẹt hết lối. Mọi state ở server.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import {
  API,
  type MazeStateDTO,
  type NextChallengeDTO,
  type MazeAnswerDTO,
  type MazeFinishDTO,
  type MoveResultDTO,
} from '../api/contract';
import { useAuth } from '../store/auth';
import Timer from '../components/Timer';
import ChallengeCard, { type ChallengeFeedback } from '../components/ChallengeCard';
import MazeBoard, { type ScenePulse } from '../components/MazeBoard';

function fmtMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function MountainGamePage() {
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [maze, setMaze] = useState<MazeStateDTO | null>(null);
  const [gateQ, setGateQ] = useState<NextChallengeDTO | null>(null);
  const [gateA, setGateA] = useState<MazeAnswerDTO | null>(null);
  const [result, setResult] = useState<MazeFinishDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null);
  const [pulse, setPulse] = useState<ScenePulse | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const finishingRef = useRef(false);
  const movingRef = useRef(false);
  const answeringRef = useRef(false);
  const keyRef = useRef(0);
  const toastTimer = useRef<number | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }, []);

  const doFinish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      setResult(await apiFetch<MazeFinishDTO>(API.mtnFinish, { method: 'POST' }));
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Không thể kết thúc.');
      navigate('/leaderboard?game=mountain');
    }
  }, [navigate, showToast]);

  // Mount
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await apiFetch<MazeStateDTO | null>(API.mtnState);
        if (!alive) return;
        if (!st || st.status !== 'in_progress') {
          navigate('/mountain');
          return;
        }
        setMaze(st);
        // Nếu reload lúc đang ở cổng chờ trả lời → restore câu hỏi để player không bị mất progress.
        if (st.pending_challenge) {
          setGateQ(st.pending_challenge);
          setGateA(null);
        }
      } catch (err) {
        if (!alive) return;
        showToast(err instanceof ApiError ? err.message : 'Không tải được trạng thái.');
        navigate('/mountain');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
      if (toastTimer.current) window.clearTimeout(toastTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMove = useCallback(
    async (r: number, c: number) => {
      if (busy || gateQ || result || movingRef.current) return;
      movingRef.current = true;
      setBusy(true);
      try {
        const res = await apiFetch<MoveResultDTO>(API.mtnMove, { method: 'POST', body: { r, c } });
        if (res.gate && res.question) {
          setGateQ(res.question);
          setGateA(null);
        } else if (res.state) {
          setMaze(res.state);
          if (res.state.finished) await doFinish();
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const code = (err.body as { code?: string } | null)?.code;
          // AWAITING_ANSWER = cổng đang chờ trả lời (không phải kết thúc game).
          // Trường hợp này chỉ xảy ra nếu gateQ chưa được restore đúng — hiển thị toast, không finish.
          if (code === 'AWAITING_ANSWER') {
            showToast('Hãy trả lời câu hỏi ở cổng trước.');
            return;
          }
          await doFinish();
          return;
        }
        // 400 (ô bị chặn / không kề) → bỏ qua im lặng
        if (!(err instanceof ApiError && err.status === 400)) {
          showToast(err instanceof ApiError ? err.message : 'Không đi được.');
        }
      } finally {
        movingRef.current = false;
        setBusy(false);
      }
    },
    [busy, gateQ, result, doFinish, showToast],
  );

  const handleAnswer = useCallback(
    async (response: number | boolean | string | number[]) => {
      if (!gateQ || gateA || answeringRef.current) return;
      answeringRef.current = true;
      setBusy(true);
      try {
        const res = await apiFetch<MazeAnswerDTO>(API.mtnAnswer, {
          method: 'POST',
          body: { question_token: gateQ.question_token, response },
        });
        setGateA(res);
        setMaze(res.state);
        keyRef.current += 1;
        setPulse({ correct: res.is_correct, key: keyRef.current });
        if (res.delta !== 0) setDelta({ value: res.delta, key: keyRef.current });
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const code = (err.body as { code?: string } | null)?.code;
          // BAD_TOKEN 409 = token hết hạn (reload lâu) → hiển thị lỗi, không force-finish.
          if (code === 'BAD_TOKEN') {
            showToast('Token câu hỏi hết hạn. Tải lại trang để tiếp tục.');
            return;
          }
          await doFinish();
          return;
        }
        showToast(err instanceof ApiError ? err.message : 'Không gửi được đáp án.');
      } finally {
        answeringRef.current = false;
        setBusy(false);
      }
    },
    [gateQ, gateA, doFinish, showToast],
  );

  const closeGate = useCallback(() => {
    const finished = maze?.finished;
    setGateQ(null);
    setGateA(null);
    if (finished) void doFinish();
  }, [maze, doFinish]);

  const handleExpire = useCallback(() => void doFinish(), [doFinish]);

  if (loading || !maze) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="panel animate-pop px-8 py-6 text-center">
          <div className="text-3xl">🗺️</div>
          <div className="mt-2 font-display text-lg font-bold text-treasure-gold">Đang vào mê cung…</div>
        </div>
      </div>
    );
  }

  const fb: ChallengeFeedback | null = gateA
    ? {
        is_correct: gateA.is_correct,
        correct_index: gateA.correct_index,
        correct_text: gateA.correct_text,
        correct_value: gateA.correct_value,
        correct_order: gateA.correct_order,
        explanation: gateA.explanation,
      }
    : null;

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-pop rounded-xl bg-treasure-danger px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {toast}
        </div>
      )}

      {/* HUD */}
      <div className="panel relative flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <div className="truncate text-sm text-white/60">{profile?.full_name ?? 'Người chơi'}</div>
          <div className="font-display text-2xl font-extrabold text-treasure-gold">
            {maze.score}
            <span className="ml-1 text-sm font-semibold text-white/50">điểm</span>
          </div>
        </div>
        <div className="text-center">
          <div className="text-sm text-white/60">Cửa đã mở</div>
          <div className="font-display text-xl font-extrabold text-emerald-300">{maze.gates_opened}</div>
        </div>
        <div className="text-right">
          <div className="text-sm text-white/60">Hạng</div>
          <div className="font-display text-xl font-extrabold text-treasure-gem">
            {maze.rank != null ? `#${maze.rank}` : '—'}
          </div>
        </div>
        {delta && (
          <span
            key={delta.key}
            className={`pointer-events-none absolute right-4 top-2 animate-floatup font-display text-xl font-extrabold ${
              delta.value > 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}
          >
            {delta.value > 0 ? `+${delta.value}` : delta.value}
          </span>
        )}
      </div>

      <Timer
        timeLeftS={maze.time_left_s}
        totalS={maze.time_limit_s}
        onExpire={handleExpire}
        paused={!!gateA}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Mê cung */}
        <MazeBoard
          state={maze}
          canMove={!gateQ && !result}
          busy={busy}
          pulse={pulse}
          onMove={handleMove}
        />

        {/* Cột phải: câu hỏi tại cổng, hoặc hướng dẫn */}
        <div className="flex flex-col gap-3">
          {gateQ ? (
            <>
              <ChallengeCard
                key={gateQ.question_id}
                challenge={gateQ}
                feedback={fb}
                disabled={busy}
                onAnswer={handleAnswer}
              />
              {gateA && (
                <button type="button" className="btn-gold w-full py-3 text-lg" onClick={closeGate}>
                  {maze.finished ? '🏁 Xem kết quả' : gateA.is_correct ? 'Đi tiếp →' : 'Thử tuyến khác →'}
                </button>
              )}
            </>
          ) : (
            <HintPanel gatesOpened={maze.gates_opened} />
          )}
        </div>
      </div>

      {/* Overlay kết quả */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="panel w-full max-w-md animate-pop p-8 text-center">
            <div className="relative mx-auto h-20 w-20">
              {result.reached && (
                <>
                  <span
                    className="absolute inset-2 animate-treasureaura rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(86,200,255,0.55), transparent 70%)' }}
                  />
                  <span className="absolute -left-1 top-0 animate-sparkle text-xl">✨</span>
                  <span className="absolute right-0 top-1 animate-sparkle text-lg" style={{ animationDelay: '0.3s' }}>⭐</span>
                  <span className="absolute bottom-0 left-3 animate-sparkle text-base" style={{ animationDelay: '0.6s' }}>✨</span>
                </>
              )}
              <div
                className={`relative grid h-full w-full place-items-center text-6xl ${
                  result.reached ? 'drop-shadow-[0_0_10px_rgba(120,220,255,0.8)]' : ''
                }`}
              >
                {result.reached ? '💎' : '🪨'}
              </div>
            </div>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-treasure-gold">
              {result.reached ? 'Tới kho báu!' : 'Kẹt đường rồi!'}
            </h2>
            <p className="mt-1 text-white/70">
              {result.reached ? `Giỏi lắm ${profile?.full_name ?? 'bạn'}!` : 'Không còn đường tới kho báu (hoặc hết giờ). Thử lại sau nhé!'}
            </p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <Cell big={`${result.score}`} label="Điểm" tone="text-treasure-gold" />
              <Cell big={`${result.gates_opened}`} label="Cổng mở" tone="text-treasure-gem" />
              <Cell big={fmtMs(result.time_spent_ms)} label="Thời gian" tone="text-white" />
            </div>
            <div className="mt-6 flex gap-3">
              <button type="button" className="btn-gold flex-1" onClick={() => navigate('/leaderboard?game=mountain')}>
                🏆 Xem BXH
              </button>
              <button type="button" className="btn-ghost flex-1" onClick={() => navigate('/')}>
                Trang chủ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HintPanel({ gatesOpened }: { gatesOpened: number }) {
  return (
    <div className="panel space-y-3 p-5">
      <h3 className="font-display text-lg font-extrabold text-treasure-gold">🧭 Tìm đường tới 💎</h3>
      <p className="text-sm text-white/70">
        Dùng <b className="text-white">phím mũi tên</b> hoặc <b className="text-white">bấm ô kề</b> bên để đi.
        Tới <b className="text-amber-300">cửa 🚪 / bẫy</b> sẽ có câu hỏi — đúng thì qua, sai thì nó khoá lại, phải vòng đường khác.
      </p>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Legend icon="🧱" text="Đá — không đi được" />
        <Legend icon="🚪" text="Cửa/bẫy — trả lời để qua" amber />
        <Legend icon="💎" text="Kho báu — đích đến" />
        <Legend icon="🚩" text="Điểm xuất phát" />
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
        Số trên cửa = độ khó câu hỏi: <b className="text-emerald-300">1 Dễ</b> · <b className="text-amber-300">2 Trung bình</b> ·{' '}
        <b className="text-rose-300">3 Khó</b>. Càng về gần kho báu cửa càng khó.
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white/70">
        Đã mở <b className="text-treasure-gem">{gatesOpened}</b> cổng. Có <b className="text-white">3 lối</b> tới kho báu — chọn khéo nhé!
      </div>
    </div>
  );
}

function Legend({ icon, text, amber }: { icon: string; text: string; amber?: boolean }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5">
      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded ${amber ? 'bg-amber-500/25 font-bold text-amber-300' : 'bg-white/5'}`}>
        {icon}
      </span>
      <span className="text-white/70">{text}</span>
    </div>
  );
}

function Cell({ big, label, tone }: { big: string; label: string; tone: string }) {
  return (
    <div className="rounded-xl bg-black/30 px-3 py-3">
      <div className={`font-display text-2xl font-extrabold ${tone}`}>{big}</div>
      <div className="text-xs text-white/50">{label}</div>
    </div>
  );
}

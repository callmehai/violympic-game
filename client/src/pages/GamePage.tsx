/**
 * GamePage.tsx — màn chơi chính "Đi tìm kho báu".
 * Flow: tải câu → trả lời → (đúng thì) đào ô → ĐỌC giải thích/kết quả → bấm "Câu tiếp theo".
 * KHÔNG tự chuyển câu. Mọi điểm/state lấy từ server (không tự cộng điểm phía client).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import {
  API,
  type AnswerResponseDTO,
  type DigResponseDTO,
  type FinishResponseDTO,
  type GameStateDTO,
  type NextQuestionDTO,
  type PublicCell,
} from '../api/contract';
import { useAuth } from '../store/auth';
import ScorePanel from '../components/ScorePanel';
import QuestionCard from '../components/QuestionCard';
import Timer from '../components/Timer';
import TreasureBoard from '../components/TreasureBoard';

interface Feedback {
  selected: number;
  correct_index: number;
  is_correct: boolean;
}

interface LocalState {
  score: number;
  board: PublicCell[];
  rows: number;
  cols: number;
  timeLeftS: number;
  timeLimitS: number;
  awaiting: 'question' | 'dig';
  answered: number;
  correct: number;
  rank: number | null;
  total: number;
}

function fmtMs(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

export default function GamePage() {
  const navigate = useNavigate();
  const profile = useAuth((s) => s.profile);

  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<LocalState | null>(null);
  const [question, setQuestion] = useState<NextQuestionDTO | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [explanation, setExplanation] = useState<string | null>(null);
  const [lastDig, setLastDig] = useState<{ index: number; delta: number } | null>(null);
  const [digResult, setDigResult] = useState<DigResponseDTO | null>(null);
  const [scoreDelta, setScoreDelta] = useState<{ value: number; key: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [result, setResult] = useState<FinishResponseDTO | null>(null);

  const finishingRef = useRef(false);
  const loadingNextRef = useRef(false);
  const answeringRef = useRef(false);
  const diggingRef = useRef(false);
  const deltaKeyRef = useRef(0);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2500);
  }, []);

  const flashDelta = useCallback((value: number) => {
    if (value === 0) return;
    deltaKeyRef.current += 1;
    setScoreDelta({ value, key: deltaKeyRef.current });
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ---- doFinish ----
  const doFinish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    try {
      const res = await apiFetch<FinishResponseDTO>(API.finish, { method: 'POST' });
      setResult(res);
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Không thể kết thúc phiên chơi.');
      navigate('/leaderboard');
    }
  }, [navigate, showToast]);

  // ---- loadNextQuestion (gọi khi bấm "Câu tiếp theo" hoặc lúc mount) ----
  const loadNextQuestion = useCallback(async () => {
    if (loadingNextRef.current || finishingRef.current) return;
    loadingNextRef.current = true;
    setBusy(true);
    try {
      const res = await apiFetch<NextQuestionDTO | { done: true }>(API.nextQuestion);
      if ('done' in res) {
        await doFinish();
        return;
      }
      setQuestion(res);
      setFeedback(null);
      setExplanation(null);
      setLastDig(null);
      setDigResult(null);
      setState((s) => (s ? { ...s, awaiting: 'question' } : s));
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        await doFinish();
        return;
      }
      showToast(err instanceof ApiError ? err.message : 'Không tải được câu hỏi.');
    } finally {
      loadingNextRef.current = false;
      setBusy(false);
    }
  }, [doFinish, showToast]);

  // ---- Mount ----
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const st = await apiFetch<GameStateDTO | null>(API.state);
        if (!alive) return;
        if (!st || st.status !== 'in_progress') {
          navigate('/');
          return;
        }
        setState({
          score: st.score,
          board: st.board,
          rows: st.rows,
          cols: st.cols,
          timeLeftS: st.time_left_s,
          timeLimitS: st.time_limit_s,
          awaiting: st.awaiting,
          answered: st.answered,
          correct: st.correct,
          rank: st.rank,
          total: st.total_questions,
        });
        if (st.awaiting === 'question') {
          await loadNextQuestion();
        }
      } catch (err) {
        if (!alive) return;
        showToast(err instanceof ApiError ? err.message : 'Không tải được trạng thái.');
        navigate('/');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Trả lời (KHÔNG tự chuyển câu) ----
  const handleAnswer = useCallback(
    async (i: number) => {
      if (!question || !state || feedback || answeringRef.current) return;
      answeringRef.current = true;
      setBusy(true);
      try {
        const res = await apiFetch<AnswerResponseDTO>(API.answer, {
          method: 'POST',
          body: { question_token: question.question_token, selected_index: i },
        });
        setFeedback({ selected: i, correct_index: res.correct_index, is_correct: res.is_correct });
        setExplanation(res.explanation);
        flashDelta(res.delta);
        setState((s) =>
          s
            ? {
                ...s,
                score: res.score,
                answered: s.answered + 1,
                correct: s.correct + (res.is_correct ? 1 : 0),
                awaiting: res.awaiting,
              }
            : s
        );
        // Đúng → chờ người chơi tự đào. Sai → chờ bấm "Câu tiếp theo". Không auto.
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          await doFinish();
          return;
        }
        showToast(err instanceof ApiError ? err.message : 'Không gửi được đáp án.');
      } finally {
        answeringRef.current = false;
        setBusy(false);
      }
    },
    [question, state, feedback, flashDelta, doFinish, showToast]
  );

  // ---- Đào (KHÔNG tự chuyển câu) ----
  const handleDig = useCallback(
    async (index: number) => {
      if (!state || state.awaiting !== 'dig' || diggingRef.current) return;
      diggingRef.current = true;
      setBusy(true);
      try {
        const res = await apiFetch<DigResponseDTO>(API.dig, {
          method: 'POST',
          body: { cell_index: index },
        });
        setDigResult(res);
        setLastDig({ index: res.cell_index, delta: res.delta });
        flashDelta(res.delta);
        setState((s) =>
          s
            ? {
                ...s,
                score: res.new_score,
                awaiting: res.awaiting,
                board: s.board.map((c) =>
                  c.index === res.cell_index
                    ? { ...c, dug: true, type: res.cell_type, value: res.value }
                    : c
                ),
              }
            : s
        );
        if (res.ended) {
          await doFinish();
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          await doFinish();
          return;
        }
        showToast(err instanceof ApiError ? err.message : 'Không đào được ô này.');
      } finally {
        diggingRef.current = false;
        setBusy(false);
      }
    },
    [state, flashDelta, doFinish, showToast]
  );

  const handleExpire = useCallback(() => {
    void doFinish();
  }, [doFinish]);

  if (loading || !state) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="panel animate-pop px-8 py-6 text-center">
          <div className="text-3xl">⛏️ 💎</div>
          <div className="mt-2 font-display text-lg font-bold text-accent">
            Đang vào hang kho báu…
          </div>
        </div>
      </div>
    );
  }

  const canDig = state.awaiting === 'dig' && !result;
  const answerDisabled = busy || !!feedback || state.awaiting === 'dig';
  // Được bấm "Câu tiếp theo" khi: đã trả lời xong VÀ không còn phải đào nữa.
  const canProceed = !!feedback && state.awaiting === 'question' && !result;

  return (
    <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 p-4">
      {toast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 animate-pop rounded-xl bg-bad px-4 py-2 text-sm font-semibold text-ink shadow-lg">
          {toast}
        </div>
      )}

      <ScorePanel
        score={state.score}
        name={profile?.full_name ?? 'Người chơi'}
        rank={state.rank}
        answered={state.answered}
        correct={state.correct}
        total={state.total}
        delta={scoreDelta}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Cột trái: timer + câu hỏi + điều khiển */}
        <div className="flex flex-col gap-4">
          <Timer
            timeLeftS={state.timeLeftS}
            totalS={state.timeLimitS}
            onExpire={handleExpire}
            paused={!!feedback}
          />
          {question ? (
            <QuestionCard
              question={question}
              disabled={answerDisabled}
              feedback={feedback ?? undefined}
              explanation={explanation}
              onAnswer={handleAnswer}
            />
          ) : (
            <div className="panel flex items-center justify-center p-8 text-ink/60">
              Đang tải câu hỏi…
            </div>
          )}

          {/* Nhắc đào khi vừa trả lời đúng */}
          {state.awaiting === 'dig' && !digResult && (
            <div className="animate-pop rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-center font-semibold text-accent">
              ✅ Chính xác! Chọn 1 ô bên phải để đào kho báu 👉
            </div>
          )}

          {/* Kết quả đào — rõ ràng cả khi bị trừ điểm */}
          {digResult && (
            <div
              className={`animate-pop rounded-xl border px-4 py-3 text-center font-bold ${
                digResult.delta > 0
                  ? 'border-ok-400/40 bg-ok-500/15 text-ok-200'
                  : digResult.delta < 0
                    ? 'border-bad-400/50 bg-bad-500/15 text-bad-200'
                    : 'border-ink/15 bg-ink/5 text-ink/70'
              }`}
            >
              {digResult.cell_type === 'chest'
                ? `🏆 JACKPOT! Rương vàng +${digResult.delta} điểm!`
                : digResult.cell_type === 'gem'
                  ? `💎 Đào được kim cương! +${digResult.delta} điểm`
                  : digResult.cell_type === 'bomb'
                    ? `💣 Dính bom! −${Math.abs(digResult.delta)} điểm`
                    : '🪨 Ô trống, không có gì (+0)'}
            </div>
          )}

          {/* Nút sang câu kế — người chơi tự bấm sau khi đọc giải thích/kết quả */}
          {canProceed && (
            <button
              type="button"
              className="btn-gold w-full py-3 text-lg"
              onClick={() => void loadNextQuestion()}
              disabled={busy}
            >
              Câu tiếp theo →
            </button>
          )}
        </div>

        {/* Cột phải: bãi kho báu */}
        <TreasureBoard
          cells={state.board}
          rows={state.rows}
          cols={state.cols}
          canDig={canDig}
          onDig={handleDig}
          lastDig={lastDig}
        />
      </div>

      {/* Overlay kết quả */}
      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-shade/70 p-4">
          <div className="panel w-full max-w-md animate-pop p-8 text-center">
            <div className="text-5xl">🏆</div>
            <h2 className="mt-2 font-display text-2xl font-extrabold text-accent">
              Hoàn thành!
            </h2>
            <p className="mt-1 text-ink/70">Chúc mừng {profile?.full_name ?? 'bạn'}!</p>

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-shade/30 px-3 py-3">
                <div className="font-display text-2xl font-extrabold text-accent">
                  {result.score}
                </div>
                <div className="text-xs text-ink/50">Điểm</div>
              </div>
              <div className="rounded-xl bg-shade/30 px-3 py-3">
                <div className="font-display text-2xl font-extrabold text-info">
                  #{result.rank}
                </div>
                <div className="text-xs text-ink/50">Xếp hạng</div>
              </div>
              <div className="rounded-xl bg-shade/30 px-3 py-3">
                <div className="font-display text-2xl font-extrabold text-ink">
                  {fmtMs(result.time_spent_ms)}
                </div>
                <div className="text-xs text-ink/50">Thời gian</div>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                className="btn-gold flex-1"
                onClick={() => navigate('/leaderboard')}
              >
                🏆 Xem BXH
              </button>
              <button type="button" className="btn-ghost flex-1" onClick={() => navigate('/')}>
                Về sảnh
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

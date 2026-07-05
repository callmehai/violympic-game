/**
 * ChallengeCard — hiển thị 1 ải của Game 2 theo KIỂU câu:
 *  - mcq:       4 nút chọn 1 đáp án (trả lời ngay khi bấm).
 *  - truefalse: 2 nút Đúng / Sai (trả lời ngay).
 *  - fill:      ô nhập đáp án + nút Trả lời.
 *  - order:     danh sách kéo thứ tự bằng ▲▼ + nút Trả lời.
 * Mỗi câu remount (key=question_id) nên state nội bộ luôn mới.
 */
import { useEffect, useRef, useState } from 'react';
import type { NextChallengeDTO } from '../api/contract';

export interface ChallengeFeedback {
  is_correct: boolean;
  correct_index?: number;
  correct_text?: string;
  correct_value?: boolean;
  correct_order?: string[];
  explanation: string | null;
}

interface Props {
  challenge: NextChallengeDTO;
  feedback: ChallengeFeedback | null;
  disabled: boolean;
  onAnswer: (response: number | boolean | string | number[]) => void;
}

const TYPE_LABEL: Record<string, string> = {
  mcq: 'Trắc nghiệm',
  fill: 'Điền đáp án',
  truefalse: 'Đúng hay Sai?',
  order: 'Sắp xếp thứ tự',
};

export default function ChallengeCard({ challenge, feedback, disabled, onAnswer }: Props) {
  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-treasure-gem/20 px-2.5 py-1 text-xs font-bold text-treasure-gem">
          {TYPE_LABEL[challenge.type] ?? challenge.type}
        </span>
        {challenge.subject && (
          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white/70">
            {challenge.subject}
          </span>
        )}
        <span className="ml-auto text-sm font-semibold text-treasure-gold">
          +{challenge.points}đ
        </span>
      </div>

      <SpeedBar
        windowMs={challenge.speed_window_ms}
        elapsedMs={challenge.speed_elapsed_ms ?? 0}
        maxBonus={challenge.speed_bonus}
        frozen={!!feedback}
      />

      <h2 className="text-lg font-bold leading-snug text-white">{challenge.content}</h2>

      {challenge.type === 'mcq' && (
        <McqInput challenge={challenge} feedback={feedback} disabled={disabled} onAnswer={onAnswer} />
      )}
      {challenge.type === 'truefalse' && (
        <TrueFalseInput feedback={feedback} disabled={disabled} onAnswer={onAnswer} />
      )}
      {challenge.type === 'fill' && (
        <FillInput challenge={challenge} feedback={feedback} disabled={disabled} onAnswer={onAnswer} />
      )}
      {challenge.type === 'order' && (
        <OrderInput challenge={challenge} feedback={feedback} disabled={disabled} onAnswer={onAnswer} />
      )}

      {feedback && (
        <div
          className={`animate-pop rounded-xl border px-4 py-3 text-sm font-semibold ${
            feedback.is_correct
              ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
              : 'border-rose-400/50 bg-rose-500/15 text-rose-200'
          }`}
        >
          <div className="mb-1 font-bold">
            {feedback.is_correct ? '✅ Chính xác!' : '❌ Chưa đúng'}
          </div>
          {feedback.explanation && <div className="text-white/80">{feedback.explanation}</div>}
        </div>
      )}
    </div>
  );
}

/* ===================== Thanh đếm ngược thưởng tốc độ ===================== */
function SpeedBar({
  windowMs,
  elapsedMs,
  maxBonus,
  frozen,
}: {
  windowMs: number;
  elapsedMs: number;
  maxBonus: number;
  frozen: boolean;
}) {
  // Neo mốc kết thúc theo server elapsed để countdown đúng kể cả sau reload.
  const endAt = useRef<number>(Date.now() + Math.max(0, windowMs - elapsedMs));
  const [frac, setFrac] = useState(() => Math.max(0, (windowMs - elapsedMs) / windowMs));

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const tick = () => {
      const f = Math.max(0, (endAt.current - Date.now()) / windowMs);
      setFrac(f);
      if (f > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [frozen, windowMs]);

  if (maxBonus <= 0) return null;
  const bonus = Math.round(maxBonus * frac);
  const active = bonus > 0 && !frozen;

  return (
    <div
      className={`rounded-xl border px-3 py-2 ${
        active ? 'border-treasure-gem/40 bg-treasure-gem/10' : 'border-white/10 bg-black/20'
      }`}
    >
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="font-semibold text-white/70">⚡ Trả lời nhanh để được thưởng</span>
        <span
          className={`font-display font-extrabold ${active ? 'text-treasure-gem' : 'text-white/40'}`}
        >
          {active ? `+${bonus}đ` : frozen ? 'đã chốt' : 'hết thưởng'}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-black/40">
        <div
          className="h-full rounded-full bg-gradient-to-r from-treasure-gem to-emerald-400"
          style={{ width: `${frac * 100}%` }}
        />
      </div>
    </div>
  );
}

/* ===================== MCQ ===================== */
function McqInput({ challenge, feedback, disabled, onAnswer }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const opts = challenge.options ?? [];
  const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
  return (
    <div className="grid gap-2.5">
      {opts.map((opt, i) => {
        let cls = 'border-white/15 bg-black/30 hover:border-treasure-gold hover:bg-black/40';
        if (feedback) {
          if (i === feedback.correct_index)
            cls = 'border-emerald-400 bg-emerald-500/20 text-emerald-100';
          else if (i === selected) cls = 'border-rose-400 bg-rose-500/20 text-rose-100';
          else cls = 'border-white/10 bg-black/20 opacity-60';
        }
        return (
          <button
            key={i}
            type="button"
            disabled={disabled || !!feedback}
            onClick={() => {
              setSelected(i);
              onAnswer(i);
            }}
            className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed ${cls}`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-white/10 text-sm font-bold">
              {labels[i]}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ===================== TRUE / FALSE ===================== */
function TrueFalseInput({ feedback, disabled, onAnswer }: Omit<Props, 'challenge'>) {
  const [selected, setSelected] = useState<boolean | null>(null);
  function tone(forVal: boolean): string {
    if (!feedback) return 'border-white/15 bg-black/30 hover:border-treasure-gold';
    if (feedback.correct_value === forVal) return 'border-emerald-400 bg-emerald-500/20 text-emerald-100';
    if (selected === forVal) return 'border-rose-400 bg-rose-500/20 text-rose-100';
    return 'border-white/10 bg-black/20 opacity-60';
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {[true, false].map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={disabled || !!feedback}
          onClick={() => {
            setSelected(v);
            onAnswer(v);
          }}
          className={`rounded-xl border py-5 text-lg font-bold transition active:scale-[0.99] disabled:cursor-not-allowed ${tone(v)}`}
        >
          {v ? '✔️ Đúng' : '✖️ Sai'}
        </button>
      ))}
    </div>
  );
}

/* ===================== FILL ===================== */
function FillInput({ challenge, feedback, disabled, onAnswer }: Props) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim() || disabled || feedback) return;
    onAnswer(text.trim());
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <input
          className="input flex-1 text-lg"
          placeholder="Nhập đáp án…"
          value={text}
          disabled={disabled || !!feedback}
          autoFocus
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        {challenge.suffix && <span className="font-semibold text-white/70">{challenge.suffix}</span>}
      </div>
      {!feedback && (
        <button
          type="button"
          className="btn-gold w-full py-3"
          disabled={disabled || !text.trim()}
          onClick={submit}
        >
          Trả lời
        </button>
      )}
      {feedback && !feedback.is_correct && feedback.correct_text && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm">
          Đáp án đúng: <b className="text-emerald-200">{feedback.correct_text}</b>
        </div>
      )}
    </div>
  );
}

/* ===================== ORDER (tap chọn thứ tự) ===================== */
function OrderInput({ challenge, feedback, disabled, onAnswer }: Props) {
  // Người chơi TAP lần lượt các ô theo thứ tự 1→n. `picked` giữ danh sách
  // CHỈ SỐ HIỂN THỊ đã chọn (đúng thứ tự tap). Chọn đủ hết → nút Trả lời sáng.
  const items = challenge.items ?? [];
  const [picked, setPicked] = useState<number[]>([]);
  const locked = disabled || !!feedback;
  const allPicked = picked.length === items.length;

  function toggle(displayIdx: number) {
    if (locked) return;
    setPicked((prev) =>
      prev.includes(displayIdx)
        ? prev.filter((x) => x !== displayIdx) // tap lại để bỏ chọn
        : [...prev, displayIdx],
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">
        👆 Chạm lần lượt các ô theo đúng thứ tự (1 → {items.length}). Chạm lại để bỏ chọn.
      </p>
      <div className="space-y-2">
        {items.map((label, displayIdx) => {
          const order = picked.indexOf(displayIdx); // -1 nếu chưa chọn
          const isPicked = order !== -1;
          return (
            <button
              key={displayIdx}
              type="button"
              disabled={locked}
              onClick={() => toggle(displayIdx)}
              style={{ touchAction: 'manipulation' }}
              className={`flex w-full select-none items-center gap-3 rounded-xl border px-3 py-3 text-left font-semibold transition active:scale-[0.99] disabled:cursor-not-allowed ${
                isPicked
                  ? 'border-treasure-gold bg-treasure-gold/15 text-white'
                  : 'border-white/15 bg-black/30 hover:border-treasure-gold hover:bg-black/40'
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${
                  isPicked
                    ? 'bg-treasure-gold text-black'
                    : 'bg-white/10 text-white/50'
                }`}
              >
                {isPicked ? order + 1 : '•'}
              </span>
              <span className="flex-1">{label}</span>
            </button>
          );
        })}
      </div>
      {!feedback && (
        <button
          type="button"
          className="btn-gold w-full py-3"
          disabled={disabled || !allPicked}
          onClick={() => onAnswer(picked)}
        >
          {allPicked ? 'Trả lời' : `Còn ${items.length - picked.length} ô chưa chọn`}
        </button>
      )}
      {feedback && !feedback.is_correct && feedback.correct_order && (
        <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm">
          Thứ tự đúng:{' '}
          <b className="text-emerald-200">{feedback.correct_order.join('  →  ')}</b>
        </div>
      )}
    </div>
  );
}

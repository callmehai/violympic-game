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
  maxBonus,
  frozen,
}: {
  windowMs: number;
  maxBonus: number;
  frozen: boolean;
}) {
  const [frac, setFrac] = useState(1);
  const start = useRef<number>(Date.now());

  useEffect(() => {
    if (frozen) return;
    let raf = 0;
    const tick = () => {
      const f = Math.max(0, 1 - (Date.now() - start.current) / windowMs);
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

/* ===================== ORDER (kéo–thả) ===================== */
function OrderInput({ challenge, feedback, disabled, onAnswer }: Props) {
  // order theo CHỈ SỐ HIỂN THỊ: bắt đầu [0,1,2,...]; người chơi kéo đổi vị trí.
  const items = challenge.items ?? [];
  const [order, setOrder] = useState<number[]>(items.map((_, i) => i));
  const [dragPos, setDragPos] = useState<number | null>(null);
  const [dragDy, setDragDy] = useState(0);
  const startY = useRef(0);
  const rowH = useRef(0);
  const locked = disabled || !!feedback;

  function onDown(pos: number, e: React.PointerEvent<HTMLDivElement>) {
    if (locked) return;
    const el = e.currentTarget;
    rowH.current = el.getBoundingClientRect().height + 8; // + khoảng cách space-y-2
    startY.current = e.clientY;
    setDragPos(pos);
    setDragDy(0);
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* bỏ qua nếu trình duyệt không hỗ trợ */
    }
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (dragPos === null) return;
    let dy = e.clientY - startY.current;
    let pos = dragPos;
    const arr = order.slice();
    let changed = false;
    const h = rowH.current || 56;
    while (dy > h / 2 && pos < arr.length - 1) {
      [arr[pos], arr[pos + 1]] = [arr[pos + 1], arr[pos]];
      pos++;
      startY.current += h;
      dy -= h;
      changed = true;
    }
    while (dy < -h / 2 && pos > 0) {
      [arr[pos], arr[pos - 1]] = [arr[pos - 1], arr[pos]];
      pos--;
      startY.current -= h;
      dy += h;
      changed = true;
    }
    if (changed) {
      setOrder(arr);
      setDragPos(pos);
    }
    setDragDy(dy);
  }

  function onUp(e: React.PointerEvent<HTMLDivElement>) {
    if (dragPos === null) return;
    setDragPos(null);
    setDragDy(0);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-white/50">🖐️ Kéo các ô về đúng thứ tự rồi bấm Trả lời.</p>
      <div className="space-y-2">
        {order.map((displayIdx, pos) => {
          const dragging = pos === dragPos;
          return (
            <div
              key={displayIdx}
              onPointerDown={(e) => onDown(pos, e)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              style={{
                touchAction: 'none',
                transform: dragging ? `translateY(${dragDy}px) scale(1.02)` : undefined,
                position: dragging ? 'relative' : undefined,
                zIndex: dragging ? 30 : undefined,
              }}
              className={`flex select-none items-center gap-3 rounded-xl border px-3 py-2.5 ${
                locked ? 'border-white/15 bg-black/30' : 'cursor-grab active:cursor-grabbing'
              } ${
                dragging
                  ? 'border-treasure-gold bg-black/60 shadow-2xl ring-2 ring-treasure-gold/50'
                  : 'border-white/15 bg-black/30'
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-treasure-gold/20 text-sm font-bold text-treasure-gold">
                {pos + 1}
              </span>
              <span className="flex-1 font-semibold">{items[displayIdx]}</span>
              {!locked && <span className="shrink-0 text-lg text-white/40">⠿</span>}
            </div>
          );
        })}
      </div>
      {!feedback && (
        <button
          type="button"
          className="btn-gold w-full py-3"
          disabled={disabled}
          onClick={() => onAnswer(order)}
        >
          Trả lời
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

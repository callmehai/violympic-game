/**
 * QuestionCard.tsx — hiển thị câu hỏi + 4 đáp án A/B/C/D.
 * - Trên cùng: "trả lời đúng được +X điểm" kèm THANH ĐẾM NGƯỢC thưởng tốc độ:
 *   còn thanh thì +điểm thưởng, hết thanh → về điểm mặc định.
 * - Khi có feedback: tô xanh đáp án đúng, đỏ đáp án chọn sai, disable hết + hiện giải thích.
 */
import { useEffect, useRef, useState } from 'react';
import type { NextQuestionDTO } from '../api/contract';

interface Feedback {
  selected: number;
  correct_index: number;
  is_correct: boolean;
}

interface QuestionCardProps {
  question: NextQuestionDTO;
  disabled: boolean;
  feedback?: Feedback;
  explanation?: string | null;
  onAnswer: (i: number) => void;
}

const LABELS = ['A', 'B', 'C', 'D'];

const DIFF_LABEL: Record<string, string> = {
  easy: 'Dễ',
  medium: 'Trung bình',
  hard: 'Khó',
};

const DIFF_CLASS: Record<string, string> = {
  easy: 'bg-emerald-500/20 text-emerald-300',
  medium: 'bg-amber-500/20 text-amber-300',
  hard: 'bg-rose-500/20 text-rose-300',
};

export default function QuestionCard({
  question,
  disabled,
  feedback,
  explanation,
  onAnswer,
}: QuestionCardProps) {
  const answered = !!feedback;

  // ----- Đếm ngược cửa sổ thưởng tốc độ (neo theo wall-clock, reset mỗi câu) -----
  // speed_elapsed_ms = thời gian đã trôi tính từ server (chính xác kể cả sau reload).
  const remaining0 = Math.max(0, question.speed_window_ms - (question.speed_elapsed_ms ?? 0));
  const [speedMsLeft, setSpeedMsLeft] = useState(remaining0);
  const endAtRef = useRef(Date.now() + remaining0);

  useEffect(() => {
    const rem = Math.max(0, question.speed_window_ms - (question.speed_elapsed_ms ?? 0));
    endAtRef.current = Date.now() + rem;
    setSpeedMsLeft(rem);
  }, [question.question_id, question.speed_window_ms, question.speed_elapsed_ms]);

  useEffect(() => {
    if (answered) return; // đã trả lời → khóa đồng hồ thưởng
    const id = window.setInterval(() => {
      const left = Math.max(0, endAtRef.current - Date.now());
      setSpeedMsLeft(left);
      if (left <= 0) window.clearInterval(id);
    }, 100);
    return () => window.clearInterval(id);
  }, [answered, question.question_id]);

  const hasSpeed = question.speed_bonus > 0;
  const speedActive = !answered && hasSpeed && speedMsLeft > 0;
  const speedPct =
    question.speed_window_ms > 0 ? (speedMsLeft / question.speed_window_ms) * 100 : 0;
  const potential = question.points + (speedActive ? question.speed_bonus : 0);

  return (
    <div className="panel flex flex-col gap-4 p-5">
      {/* Header: môn + độ khó + số thứ tự */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-treasure-gem/20 px-3 py-1 text-sm font-bold text-treasure-gem">
          {question.subject}
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            DIFF_CLASS[question.difficulty] ?? 'bg-white/10 text-white'
          }`}
        >
          {DIFF_LABEL[question.difficulty] ?? question.difficulty}
        </span>
        <span className="ml-auto text-sm font-semibold text-white/60">
          Câu {question.index}/{question.total}
        </span>
      </div>

      {/* Điểm tiềm năng + thanh thưởng tốc độ (ẩn sau khi đã trả lời) */}
      {!answered && (
        <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-white/70">Trả lời đúng được</span>
            <span
              className={`font-display text-2xl font-extrabold tabular-nums transition-colors ${
                speedActive ? 'text-treasure-gem' : 'text-treasure-gold'
              }`}
            >
              +{potential}đ
            </span>
          </div>

          {hasSpeed && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-xs">
                <span
                  className={
                    speedActive ? 'font-bold text-treasure-gem' : 'font-semibold text-white/40'
                  }
                >
                  {speedActive
                    ? `⚡ Thưởng tốc độ +${question.speed_bonus}đ — trả lời nhanh!`
                    : '⚡ Hết thưởng tốc độ'}
                </span>
                <span
                  className={`tabular-nums ${
                    speedActive ? 'font-bold text-treasure-gem' : 'text-white/40'
                  }`}
                >
                  {(speedMsLeft / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-black/40">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-treasure-gem to-treasure-gold transition-[width] duration-100 ease-linear"
                  style={{ width: `${speedPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Nội dung câu hỏi */}
      <div className="text-lg font-semibold leading-relaxed text-white">{question.content}</div>

      {/* Đáp án */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {question.options.map((opt, i) => {
          const isCorrectChoice = feedback && i === feedback.correct_index;
          const isWrongPick = feedback && i === feedback.selected && !feedback.is_correct;

          let cls = 'bg-treasure-wood/60 hover:bg-treasure-woodlt hover:scale-[1.02] text-amber-50';
          if (feedback) {
            if (isCorrectChoice) {
              cls = 'bg-emerald-500/80 text-white ring-2 ring-emerald-300';
            } else if (isWrongPick) {
              cls = 'bg-treasure-danger/80 text-white ring-2 ring-rose-300 animate-shake';
            } else {
              cls = 'bg-white/5 text-white/50';
            }
          }

          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => onAnswer(i)}
              className={`flex items-center gap-3 rounded-xl px-4 py-4 text-left text-base font-semibold
                transition disabled:cursor-not-allowed ${cls}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-black/30 font-display text-lg font-extrabold">
                {LABELS[i] ?? i + 1}
              </span>
              <span className="min-w-0 break-words">{opt}</span>
            </button>
          );
        })}
      </div>

      {/* Giải thích (hiện đến khi bấm "Câu tiếp theo") */}
      {feedback && (
        <div
          className={`animate-pop rounded-xl border px-4 py-3 text-sm ${
            feedback.is_correct
              ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-400/40 bg-rose-500/10 text-rose-200'
          }`}
        >
          <span className="font-bold">
            {feedback.is_correct ? '🎉 Chính xác! ' : '❌ Chưa đúng. '}
          </span>
          {explanation ? explanation : feedback.is_correct ? 'Bạn được đào kho báu!' : null}
        </div>
      )}
    </div>
  );
}

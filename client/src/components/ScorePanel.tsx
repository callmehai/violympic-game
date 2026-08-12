/**
 * ScorePanel.tsx — thanh trên cùng: điểm, tên người chơi, hạng, số câu đúng.
 * Khi điểm đổi, hiện hiệu ứng +x / −x bay lên ngay cạnh số điểm (rõ cả khi bị trừ).
 */

interface ScorePanelProps {
  score: number;
  name: string;
  rank: number | null;
  answered: number;
  correct: number;
  total: number;
  /** delta điểm vừa thay đổi — key đổi mỗi lần để chạy lại animation. */
  delta?: { value: number; key: number } | null;
}

function fmtDelta(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return '0';
}

export default function ScorePanel({
  score,
  name,
  rank,
  answered,
  correct,
  total,
  delta,
}: ScorePanelProps) {
  return (
    <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-3">
        <span className="relative font-display text-3xl font-extrabold text-accent drop-shadow">
          🏆 {score}
          {delta && delta.value !== 0 && (
            <span
              key={delta.key}
              className={`pointer-events-none absolute -top-4 left-full ml-1 animate-floatup font-display text-2xl font-extrabold drop-shadow ${
                delta.value > 0 ? 'text-ok-300' : 'text-bad-400'
              }`}
            >
              {fmtDelta(delta.value)}
            </span>
          )}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-ink/50">điểm</span>
      </div>

      <div className="flex min-w-0 flex-col items-center">
        <span className="truncate text-lg font-bold text-ink" title={name}>
          {name || 'Người chơi'}
        </span>
        <span className="text-xs text-ink/50">Đi tìm kho báu 💎</span>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex flex-col items-center">
          <span className="font-display text-xl font-extrabold text-info">
            #{rank ?? '—'}
          </span>
          <span className="text-xs text-ink/50">Hạng</span>
        </div>
        <div className="h-8 w-px bg-ink/15" />
        <div className="flex flex-col items-center">
          <span className="font-display text-xl font-extrabold text-ink">
            {correct}/{answered}
          </span>
          <span className="text-xs text-ink/50">Đúng (tổng {total} câu)</span>
        </div>
      </div>
    </div>
  );
}

/**
 * TreasureBoard.tsx — lưới ô kho báu rows×cols.
 * Ô chưa đào hiện ⛏️ mờ; khi canDig thì sáng + click được.
 * Ô đã đào lật mở: 💎/💣/🏆 + giá trị; ô TRỐNG không hiện icon (chỉ chữ mờ "trống").
 * Ô vừa đào: animate-pop + điểm +x/−x bay lên rõ ràng.
 */
import type { CellType, PublicCell } from '../api/contract';

interface TreasureBoardProps {
  cells: PublicCell[];
  rows: number;
  cols: number;
  canDig: boolean;
  onDig: (index: number) => void;
  lastDig?: { index: number; delta: number } | null;
}

// Ô trống: KHÔNG icon (theo yêu cầu) — render chữ mờ thay vì emoji.
const TYPE_EMOJI: Record<CellType, string> = {
  gem: '💎',
  bomb: '💣',
  chest: '🏆',
  empty: '',
};

function fmtDelta(v: number): string {
  if (v > 0) return `+${v}`;
  if (v < 0) return `−${Math.abs(v)}`;
  return '0';
}

export default function TreasureBoard({
  cells,
  rows,
  cols,
  canDig,
  onDig,
  lastDig,
}: TreasureBoardProps) {
  return (
    <div className="panel flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="font-display text-lg font-extrabold text-accent">
          ⛏️ Bãi kho báu
        </span>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            canDig ? 'animate-pop bg-accent/20 text-accent' : 'bg-ink/10 text-ink/50'
          }`}
        >
          {canDig ? 'Chọn ô để đào!' : 'Trả lời đúng để được đào'}
        </span>
      </div>

      <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {cells.map((cell) => {
          const isLast = lastDig?.index === cell.index;

          if (cell.dug) {
            const type = cell.type ?? 'empty';
            const value = cell.value ?? 0;
            const good = value > 0;
            const bad = value < 0;
            const isEmpty = type === 'empty';
            return (
              <div
                key={cell.index}
                className={`relative flex aspect-square flex-col items-center justify-center rounded-xl border
                  ${good ? 'border-ok-400/40 bg-ok-500/15' : ''}
                  ${bad ? 'border-bad-400/40 bg-bad-500/15' : ''}
                  ${!good && !bad ? 'border-ink/10 bg-shade/40' : ''}
                  ${isLast ? 'animate-pop' : ''}`}
              >
                {isEmpty ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink/25">
                    trống
                  </span>
                ) : (
                  <>
                    <span className="text-2xl leading-none">{TYPE_EMOJI[type]}</span>
                    {value !== 0 && (
                      <span
                        className={`mt-0.5 text-xs font-extrabold ${
                          good ? 'text-ok-300' : 'text-bad-300'
                        }`}
                      >
                        {fmtDelta(value)}
                      </span>
                    )}
                  </>
                )}

                {/* Điểm vừa nhận bay lên — to, rõ, đỏ khi trừ điểm */}
                {isLast && lastDig && (
                  <span
                    className={`pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 animate-floatup whitespace-nowrap rounded-full px-2 py-0.5 font-display text-lg font-extrabold shadow-lg ${
                      lastDig.delta > 0
                        ? 'bg-ok-500/90 text-ink'
                        : lastDig.delta < 0
                          ? 'bg-bad text-ink'
                          : 'bg-ink/20 text-ink'
                    }`}
                  >
                    {fmtDelta(lastDig.delta)}
                  </span>
                )}
              </div>
            );
          }

          // Ô chưa đào
          return (
            <button
              key={cell.index}
              type="button"
              disabled={!canDig}
              onClick={() => canDig && onDig(cell.index)}
              className={`flex aspect-square items-center justify-center rounded-xl border border-shade/30
                bg-gradient-to-b from-woodlt to-wood text-2xl transition
                ${
                  canDig
                    ? 'cursor-pointer opacity-100 hover:scale-105 hover:brightness-110 hover:ring-2 hover:ring-accent'
                    : 'cursor-default opacity-50'
                }`}
              aria-label={`Ô ${cell.index + 1}`}
            >
              <span className={canDig ? 'opacity-80' : 'opacity-30'}>⛏️</span>
            </button>
          );
        })}
      </div>

      <div className="text-center text-xs text-ink/40">
        {rows}×{cols} ô · 💎 +điểm · 💣 −điểm · 🏆 rương lớn
      </div>
    </div>
  );
}

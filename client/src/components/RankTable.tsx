/**
 * RankTable.tsx — bảng xếp hạng người chơi.
 * Hiển thị Hạng | Người chơi | Điểm | Thời gian | Trạng thái.
 * Dòng của chính mình (is_me hoặc trùng meCode) được highlight viền vàng.
 */
import type { LeaderboardEntry, SessionStatus } from '../api/contract';

interface RankTableProps {
  rows: LeaderboardEntry[];
  meCode?: string;
}

/** Định dạng mm:ss từ mili-giây. */
function fmtMs(ms: number | null): string {
  if (ms == null) return '--:--';
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Icon huy chương cho top 3, còn lại hiển thị số hạng. */
function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-2xl">🥇</span>;
  if (rank === 2) return <span className="text-2xl">🥈</span>;
  if (rank === 3) return <span className="text-2xl">🥉</span>;
  return <span className="font-display text-lg font-bold text-ink/70">{rank}</span>;
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  in_progress: 'Đang chơi',
  finished: 'Hoàn thành',
  abandoned: 'Bỏ dở',
};

function StatusPill({ status }: { status: SessionStatus }) {
  const cls =
    status === 'finished'
      ? 'bg-info/20 text-info border-info/50'
      : status === 'in_progress'
        ? 'bg-alert-400/20 text-alert-300 border-alert-400/50'
        : 'bg-ink/10 text-ink/60 border-ink/20';
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cls}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}

export default function RankTable({ rows, meCode }: RankTableProps) {
  if (rows.length === 0) {
    return (
      <div className="panel p-8 text-center text-info/70">
        Chưa có ai trên bảng xếp hạng. Hãy là người đầu tiên! ⛏️
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <div className="max-h-[70vh] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-wood">
            <tr className="text-left text-ink/70">
              <th className="px-3 py-3 text-center font-semibold">Hạng</th>
              <th className="px-3 py-3 font-semibold">Người chơi</th>
              <th className="px-3 py-3 text-right font-semibold">Điểm</th>
              <th className="px-3 py-3 text-right font-semibold">Thời gian</th>
              <th className="px-3 py-3 text-center font-semibold">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isMe = r.is_me || (!!meCode && r.student_code === meCode);
              const inProgress = r.status === 'in_progress';
              return (
                <tr
                  key={r.student_code}
                  className={`border-t border-ink/10 transition-colors ${
                    isMe
                      ? 'bg-accent/10 outline outline-2 -outline-offset-2 outline-accent'
                      : 'hover:bg-ink/5'
                  }`}
                >
                  {/* Hạng */}
                  <td className="px-3 py-3 text-center align-middle">{rankBadge(r.rank)}</td>

                  {/* Người chơi */}
                  <td className="px-3 py-3 align-middle">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink">{r.name}</span>
                      {isMe && (
                        <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-canvas">
                          BẠN
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-info/70">{r.student_code}</div>
                  </td>

                  {/* Điểm */}
                  <td className="px-3 py-3 text-right align-middle">
                    <span className="font-display text-lg font-extrabold text-accent tabular-nums">
                      {r.total}
                    </span>
                  </td>

                  {/* Thời gian */}
                  <td className="px-3 py-3 text-right align-middle tabular-nums">
                    {inProgress ? (
                      <span className="text-alert-300">Đang chơi…</span>
                    ) : (
                      <span className="text-ink/80">{fmtMs(r.time_spent_ms)}</span>
                    )}
                  </td>

                  {/* Trạng thái */}
                  <td className="px-3 py-3 text-center align-middle">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

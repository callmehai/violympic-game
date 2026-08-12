/**
 * MazeBoard — lưới mê cung 2D cho Game 2 (giao diện sáng & đa dạng).
 * Nhân vật là lớp phủ ĐỘC LẬP trượt mượt giữa các ô (transition), idle nhún nhẹ.
 *  - Sàn: đá sa thạch sáng (có sỏi/nấm rải rác). Tường: đá ấm + đuốc 🔥 / rêu / vết nứt.
 *  - Cổng "?": CỬA GỖ hoặc BẪY CHÔNG (đổi xen kẽ theo ô) — trả lời để vượt qua.
 *  - Đúng → vòng sáng & tia ✨. Sai → đá rơi + bụi + rung khung (1 lần). Tới 💎 = thắng.
 * Điều khiển: CLICK ô kề hoặc PHÍM mũi tên / WASD.
 */
import { useEffect, useRef, useState } from 'react';
import type { MazeStateDTO, MazeCell } from '../api/contract';

export interface ScenePulse {
  correct: boolean;
  key: number;
}

interface Props {
  state: MazeStateDTO;
  canMove: boolean;
  busy: boolean;
  pulse: ScenePulse | null;
  onMove: (r: number, c: number) => void;
}

/** Ô có bước vào được không: không phải tường (0) và không phải cổng đã chặn (6). */
function walkable(code: MazeCell): boolean {
  return code !== 0 && code !== 6;
}

/** Hash ổn định theo chỉ số ô → chọn biến thể trang trí (không nhấp nháy khi render). */
function pick(i: number, mod: number): number {
  let h = ((i + 1) * 374761393 + 0x9e3779b1) >>> 0;
  h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;
  return h % mod;
}

/** Màu sắc theo độ khó của cửa: 1 dễ (xanh lá) · 2 TB (vàng) · 3 khó (đỏ). */
const LEVEL_META: Record<number, { plaqueBg: string; plaqueText: string; ring: string; glow: string }> = {
  1: { plaqueBg: '#d1fae5', plaqueText: '#065f46', ring: '#10b981', glow: 'rgba(52,211,153,0.55)' },
  2: { plaqueBg: '#fef3c7', plaqueText: '#92400e', ring: '#f59e0b', glow: 'rgba(255,196,70,0.55)' },
  3: { plaqueBg: '#ffe4e6', plaqueText: '#9f1239', ring: '#f43f5e', glow: 'rgba(255,90,90,0.55)' },
};

export default function MazeBoard({ state, canMove, busy, pulse, onMove }: Props) {
  const { rows, cols, cells, pos } = state;
  const pr = Math.floor(pos / cols);
  const pc = pos % cols;

  // fx MỘT LẦN: nhận từ pulse rồi tự tắt sau ~0.9s (đá không rơi lặp lại).
  const [fx, setFx] = useState<ScenePulse | null>(null);
  const lastKey = useRef(-1);
  useEffect(() => {
    if (!pulse || pulse.key === lastKey.current) return;
    lastKey.current = pulse.key;
    setFx(pulse);
    const t = window.setTimeout(() => setFx(null), 900);
    return () => window.clearTimeout(t);
  }, [pulse]);

  // Điều khiển bằng phím.
  useEffect(() => {
    if (!canMove || busy) return;
    function onKey(e: KeyboardEvent) {
      const map: Record<string, [number, number]> = {
        ArrowUp: [-1, 0], KeyW: [-1, 0],
        ArrowDown: [1, 0], KeyS: [1, 0],
        ArrowLeft: [0, -1], KeyA: [0, -1],
        ArrowRight: [0, 1], KeyD: [0, 1],
      };
      const d = map[e.code];
      if (!d) return;
      e.preventDefault();
      const r = pr + d[0];
      const c = pc + d[1];
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      if (walkable(cells[r * cols + c])) onMove(r, c);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canMove, busy, pr, pc, cols, rows, cells, onMove]);

  const wrong = !!fx && !fx.correct;

  return (
    <div className="panel relative overflow-hidden p-3 sm:p-4">
      {/* ánh sáng nền ấm + đom đóm bay */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: 'radial-gradient(120% 80% at 50% -5%, rgba(255,210,120,0.12), transparent 55%)' }}
      />
      <Motes />

      {/* khung gỗ sáng + chiều sâu; rung nhẹ khi trả lời sai */}
      <div
        className={`relative mx-auto rounded-2xl border-[5px] border-[#6b4423] p-1.5 shadow-[0_12px_30px_rgba(0,0,0,0.4)] ${
          wrong ? 'animate-boardshake' : ''
        }`}
        style={{ maxWidth: `${cols * 48 + 24}px`, background: 'linear-gradient(180deg,#7b5c3e,#553f2a)' }}
      >
        {/* vùng khớp đúng lưới — nhân vật định vị theo % của vùng này */}
        <div className="relative overflow-hidden rounded-lg">
          <div
            className="grid gap-[2px] p-[2px]"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, background: '#4a3a2c' }}
          >
            {cells.map((code, i) => {
              const r = Math.floor(i / cols);
              const c = i % cols;
              const adj = Math.abs(r - pr) + Math.abs(c - pc) === 1;
              const clickable = canMove && !busy && adj && walkable(code);
              return (
                <Cell
                  key={i}
                  code={code}
                  idx={i}
                  level={state.gate_levels?.[i]}
                  clickable={clickable}
                  onClick={clickable ? () => onMove(r, c) : undefined}
                />
              );
            })}
          </div>

          {/* vignette nhẹ cho chiều sâu (đã giảm để map sáng) */}
          <div className="pointer-events-none absolute inset-0 rounded-lg shadow-[inset_0_0_24px_rgba(0,0,0,0.28)]" />

          {/* Nhân vật: lớp phủ tuyệt đối, trượt mượt theo pos */}
          <div
            className="pointer-events-none absolute transition-all duration-200 ease-out"
            style={{
              left: `${(pc / cols) * 100}%`,
              top: `${(pr / rows) * 100}%`,
              width: `${100 / cols}%`,
              height: `${100 / rows}%`,
            }}
          >
            <div className="relative grid h-full w-full place-items-center p-[8%]">
              {/* bóng đổ dưới chân */}
              <span className="absolute bottom-[5%] left-1/2 h-[12%] w-[52%] -translate-x-1/2 rounded-[50%] bg-shade/40 blur-[1px]" />

              {/* ĐÚNG: vòng sáng loang + tia lấp lánh */}
              {fx && fx.correct && (
                <>
                  <span className="absolute left-1/2 top-1/2 h-3/4 w-3/4 -translate-x-1/2 -translate-y-1/2 animate-ripple rounded-full border-2 border-ok-300/80" />
                  <span className="absolute -top-1 left-0 animate-sparkle text-sm">✨</span>
                  <span className="absolute -top-1 right-0 animate-sparkle text-sm" style={{ animationDelay: '0.15s' }}>⭐</span>
                </>
              )}
              {/* SAI: đá rơi trúng đầu + sao + bụi tung */}
              {fx && !fx.correct && (
                <>
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 animate-rockdrop text-lg">🪨</span>
                  <span className="absolute -left-1 -top-1 animate-twinkle text-xs">💫</span>
                  <span className="absolute -right-1 -top-1 animate-twinkle text-xs" style={{ animationDelay: '0.1s' }}>⭐</span>
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 animate-dust text-base">💨</span>
                </>
              )}

              {/* thân: idle nhún khi đứng yên, hop/bonk khi phản hồi */}
              <div className={`h-full w-full ${fx ? (fx.correct ? 'animate-hop' : 'animate-bonk') : 'animate-idlebob'}`}>
                <Miner />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-ink/55">
        Phím <b className="text-ink/75">◀ ▲ ▼ ▶</b> hoặc bấm ô kề để đi · qua <b className="text-warn-300">cửa/bẫy</b> phải trả lời
        <br />
        Số trên cửa = độ khó: <b className="text-ok-300">1 dễ</b> · <b className="text-warn-300">2 TB</b> ·{' '}
        <b className="text-bad-300">3 khó</b> · tới <b className="text-info">💎</b> là thắng
      </p>
    </div>
  );
}

/** Một ô của mê cung. */
function Cell({
  code,
  idx,
  level,
  clickable,
  onClick,
}: {
  code: MazeCell;
  idx: number;
  level?: number;
  clickable: boolean;
  onClick?: () => void;
}) {
  const meta = LEVEL_META[level ?? 0] ?? LEVEL_META[2];
  // 0 tường · 1 lối · 2 cổng khoá · 3 xuất phát · 4 đích · 5 cổng mở · 6 cổng chặn
  const isWall = code === 0;
  const isBlocked = code === 6;
  const isGate = code === 2;
  const isExit = code === 4;
  const isStart = code === 3;
  const isOpenGate = code === 5;
  const isFloor = !isWall && !isBlocked;
  const plainFloor = code === 1; // lối trống (cho phép trang trí sỏi/nấm)

  const gateDoor = pick(idx, 2) === 0; // 0 cửa gỗ · 1 bẫy chông
  const torch = isWall && pick(idx, 7) === 0;
  const moss = isWall && !torch && pick(idx, 5) === 1;
  const crack = isWall && !torch && !moss && pick(idx, 6) === 2;
  const pebble = plainFloor && pick(idx, 4) === 0;
  const mush = plainFloor && !pebble && pick(idx, 19) === 3;

  const bg = isWall
    ? 'linear-gradient(160deg,#c8b89c,#9f8d72 45%,#75644d)'
    : isBlocked
      ? 'linear-gradient(160deg,#7d4d40,#52372d 60%,#3a261f)'
      : 'linear-gradient(155deg,#f0dcb0,#dcc08c 55%,#c4a46e)';
  const depth = isWall
    ? 'shadow-[inset_0_0_0_2px_rgba(54,42,28,0.38),inset_0_3px_0_rgba(255,255,255,0.30),inset_0_-5px_7px_rgba(0,0,0,0.35)]'
    : isBlocked
      ? 'shadow-[inset_0_0_0_2px_rgba(30,18,12,0.5),inset_0_-4px_6px_rgba(0,0,0,0.5)]'
      : 'shadow-[inset_0_0_0_1px_rgba(120,92,52,0.28),inset_0_2px_5px_rgba(0,0,0,0.14)]';

  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      style={{ backgroundImage: bg }}
      className={`relative aspect-square w-full rounded-md border border-shade/25 ${depth} transition ${
        clickable
          ? 'cursor-pointer ring-2 ring-warn-200/0 hover:z-10 hover:ring-warn-200 hover:brightness-110'
          : 'cursor-default'
      }`}
    >
      {/* texture chấm li ti cho nền đá */}
      {isFloor && (
        <span
          className="pointer-events-none absolute inset-0 rounded-md opacity-20"
          style={{
            backgroundImage: 'radial-gradient(rgba(110,82,44,0.6) 1px, transparent 1.4px)',
            backgroundSize: '7px 7px',
          }}
        />
      )}

      {/* ===== trang trí TƯỜNG ===== */}
      {torch && (
        <>
          <span
            className="pointer-events-none absolute left-1/2 top-0 h-5 w-5 -translate-x-1/2"
            style={{ background: 'radial-gradient(circle, rgba(255,170,60,0.75), transparent 70%)' }}
          />
          <span className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 animate-idlebob text-sm">🔥</span>
        </>
      )}
      {moss && (
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 rounded-b-md"
          style={{ background: 'linear-gradient(0deg, rgba(74,124,46,0.8), transparent)' }}
        />
      )}
      {crack && (
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full opacity-35">
          <path d="M46 4 L58 34 L44 52 L60 78 L52 98" stroke="#2a2018" strokeWidth="3" fill="none" />
        </svg>
      )}

      {/* ===== trang trí SÀN ===== */}
      {pebble && (
        <>
          <span className="pointer-events-none absolute left-[24%] top-[60%] h-1 w-1.5 rounded-full bg-warn-900/40" />
          <span className="pointer-events-none absolute left-[62%] top-[34%] h-1 w-1 rounded-full bg-warn-900/35" />
        </>
      )}
      {mush && <span className="pointer-events-none absolute bottom-0.5 right-0.5 text-[11px]">🍄</span>}

      {/* xuất phát */}
      {isStart && (
        <span className="pointer-events-none absolute inset-0 grid place-items-center text-base drop-shadow sm:text-lg">🚩</span>
      )}

      {/* cổng đã mở: lối đi tối (đã vượt qua) */}
      {isOpenGate && <OpenArch />}

      {/* cổng khoá: CỬA hoặc BẪY + quầng sáng (màu theo độ khó) + SỐ độ khó */}
      {isGate && (
        <>
          <span
            className="pointer-events-none absolute inset-0 animate-gateglow rounded-md"
            style={{ background: `radial-gradient(circle, ${meta.glow}, transparent 68%)` }}
          />
          {gateDoor ? <DoorGate /> : <TrapGate />}
          {/* biển SỐ = độ khó cửa (1 dễ · 2 TB · 3 khó) */}
          <span
            className="pointer-events-none absolute left-1/2 top-[40%] flex h-[42%] w-[42%] min-h-[15px] min-w-[15px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full font-display text-sm font-black leading-none sm:text-base"
            style={{
              background: meta.plaqueBg,
              color: meta.plaqueText,
              border: `1.6px solid ${meta.ring}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.55)',
            }}
          >
            {level}
          </span>
        </>
      )}

      {/* cổng đã chặn: cửa bị đóng đinh + số mờ để nhớ độ khó */}
      {isBlocked && (
        <>
          <BlockedGate />
          {level != null && (
            <span className="pointer-events-none absolute right-0.5 top-0.5 font-display text-[10px] font-black text-ink/55">
              {level}
            </span>
          )}
        </>
      )}

      {/* đích: kho báu toả hào quang + lấp lánh */}
      {isExit && (
        <>
          <span
            className="pointer-events-none absolute inset-0 animate-treasureaura rounded-md"
            style={{ background: 'radial-gradient(circle, rgba(86,200,255,0.6), transparent 66%)' }}
          />
          <span className="relative grid h-full w-full place-items-center text-xl drop-shadow-[0_0_7px_rgba(120,220,255,0.85)] sm:text-2xl">
            💎
          </span>
          <span className="pointer-events-none absolute -left-0.5 -top-0.5 animate-sparkle text-xs">✨</span>
          <span className="pointer-events-none absolute -right-0.5 bottom-0 animate-sparkle text-[10px]" style={{ animationDelay: '0.5s' }}>
            ✨
          </span>
        </>
      )}
    </button>
  );
}

/** Cửa gỗ vòm (cổng "?" biến thể 1). */
function DoorGate() {
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-[7%] h-[86%] w-[86%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
      <path d="M4 31 V13 a12 12 0 0 1 24 0 V31 Z" fill="#6b4a2a" />
      <path d="M6.5 31 V13.5 a9.5 9.5 0 0 1 19 0 V31 Z" fill="#b07b41" />
      <path d="M6.5 31 V13.5 a9.5 9.5 0 0 1 19 0 V20 H6.5 Z" fill="#bd8a52" />
      <line x1="12.7" y1="5.5" x2="12.7" y2="31" stroke="#8c5d2c" strokeWidth="1.1" />
      <line x1="19.3" y1="5.5" x2="19.3" y2="31" stroke="#8c5d2c" strokeWidth="1.1" />
      <circle cx="9" cy="14" r="0.8" fill="#5d3d1c" />
      <circle cx="23" cy="14" r="0.8" fill="#5d3d1c" />
      <circle cx="22.6" cy="22" r="1.5" fill="#ffd86b" stroke="#a9792c" strokeWidth="0.7" />
    </svg>
  );
}

/** Bẫy chông (cổng "?" biến thể 2). */
function TrapGate() {
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-[7%] h-[86%] w-[86%] drop-shadow-[0_2px_2px_rgba(0,0,0,0.55)]">
      <rect x="3" y="5" width="26" height="24" rx="3" fill="#241c15" />
      <path d="M4 6 l3 6 l3 -6 l3 6 l3 -6 l3 6 l3 -6 l3 6 l3 -6 V6 Z" fill="#d3d7dc" />
      <path d="M4 28 l3 -6 l3 6 l3 -6 l3 6 l3 -6 l3 6 l3 -6 l3 6 V29 H4 Z" fill="#aab0b6" />
      <rect x="3" y="5" width="26" height="24" rx="3" fill="none" stroke="#54402a" strokeWidth="1.4" />
    </svg>
  );
}

/** Cửa đã bị đóng đinh chặn (cổng "?" đã chặn). */
function BlockedGate() {
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-[6%] h-[88%] w-[88%]">
      <path d="M4 31 V13 a12 12 0 0 1 24 0 V31 Z" fill="#4a3526" />
      <rect x="1" y="14" width="30" height="4.2" rx="1" fill="#7c5a34" transform="rotate(17 16 16)" />
      <rect x="1" y="13" width="30" height="4.2" rx="1" fill="#6b4d2c" transform="rotate(-17 16 19)" />
      <circle cx="6" cy="12.5" r="0.9" fill="#2e2114" />
      <circle cx="26" cy="20" r="0.9" fill="#2e2114" />
    </svg>
  );
}

/** Lối đi đã mở (cổng đã vượt qua) — vòm tối. */
function OpenArch() {
  return (
    <svg viewBox="0 0 32 32" className="absolute inset-[7%] h-[86%] w-[86%]">
      <path d="M5 31 V13 a11 11 0 0 1 22 0 V31 Z" fill="#6a5740" />
      <path d="M9 31 V14.5 a7 7 0 0 1 14 0 V31 Z" fill="#1d2620" />
      <path d="M9 31 V14.5 a7 7 0 0 1 14 0" fill="none" stroke="#46c6ff" strokeWidth="0.8" opacity="0.4" />
    </svg>
  );
}

/** Đom đóm/bụi sáng trôi lơ lửng tạo không khí. */
function Motes() {
  const spots = [
    { left: '12%', top: '72%', delay: '0s', size: 'h-1 w-1' },
    { left: '30%', top: '86%', delay: '1.2s', size: 'h-1.5 w-1.5' },
    { left: '54%', top: '78%', delay: '0.6s', size: 'h-1 w-1' },
    { left: '76%', top: '88%', delay: '1.9s', size: 'h-1.5 w-1.5' },
    { left: '90%', top: '70%', delay: '2.6s', size: 'h-1 w-1' },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {spots.map((sp, i) => (
        <span
          key={i}
          className={`absolute ${sp.size} animate-mote rounded-full bg-warn-200/80 shadow-[0_0_6px_2px_rgba(244,197,66,0.5)]`}
          style={{ left: sp.left, top: sp.top, animationDelay: sp.delay }}
        />
      ))}
    </div>
  );
}

/** Nhân vật thợ mỏ (SVG) — dễ thương: mũ bảo hộ + đèn sáng, má hồng, mắt long lanh. */
function Miner() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full drop-shadow-[0_3px_3px_rgba(0,0,0,0.5)]">
      <circle cx="24" cy="9" r="6" fill="#fff6c0" opacity="0.35" />
      <rect x="16.5" y="40" width="6.5" height="4" rx="2" fill="#5b3a1d" />
      <rect x="25" y="40" width="6.5" height="4" rx="2" fill="#5b3a1d" />
      <rect x="14" y="26" width="20" height="16" rx="6" fill="#2f80ed" />
      <rect x="14" y="26" width="20" height="6" rx="3" fill="#3b8ff2" />
      <rect x="17.5" y="22" width="3" height="8" rx="1.5" fill="#2563c9" />
      <rect x="27.5" y="22" width="3" height="8" rx="1.5" fill="#2563c9" />
      <circle cx="19" cy="33" r="1.1" fill="#ffd34d" />
      <circle cx="29" cy="33" r="1.1" fill="#ffd34d" />
      <rect x="9" y="27" width="6" height="12" rx="3" fill="#f6c89a" />
      <rect x="33" y="27" width="6" height="12" rx="3" fill="#f6c89a" />
      <circle cx="24" cy="18" r="9.5" fill="#f6c89a" />
      <circle cx="18.6" cy="20.2" r="1.8" fill="#ff9d8a" opacity="0.7" />
      <circle cx="29.4" cy="20.2" r="1.8" fill="#ff9d8a" opacity="0.7" />
      <circle cx="20.6" cy="18" r="1.7" fill="#33270f" />
      <circle cx="27.4" cy="18" r="1.7" fill="#33270f" />
      <circle cx="21.3" cy="17.3" r="0.55" fill="#fff" />
      <circle cx="28.1" cy="17.3" r="0.55" fill="#fff" />
      <path d="M21 22 q3 2.7 6 0" stroke="#b5651d" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <path d="M13.5 16 a10.5 10.5 0 0 1 21 0 Z" fill="#f6b73c" />
      <rect x="11" y="14.4" width="26" height="3.4" rx="1.7" fill="#e6a92e" />
      <circle cx="24" cy="11.4" r="2.8" fill="#fff7cc" stroke="#e0a92e" strokeWidth="1" />
      <circle cx="24" cy="11.4" r="1.2" fill="#fffdf0" />
    </svg>
  );
}

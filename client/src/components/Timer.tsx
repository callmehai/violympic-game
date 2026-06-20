/**
 * Timer.tsx — đồng hồ đếm ngược cho phiên chơi.
 * - Neo vào mốc thời gian tuyệt đối (wall-clock) → chính xác kể cả khi tab bị throttle.
 * - `paused`: ĐÓNG BĂNG đồng hồ (đang xem đáp án → không tính giờ); bỏ pause thì chạy tiếp
 *   từ đúng chỗ đã dừng. Server cũng loại trừ khoảng thời gian này nên hai bên khớp nhau.
 */
import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  timeLeftS: number;
  totalS: number;
  onExpire: () => void;
  paused?: boolean;
}

function fmt(s: number): string {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function Timer({ timeLeftS, totalS, onExpire, paused = false }: TimerProps) {
  const [remaining, setRemaining] = useState<number>(Math.max(0, Math.floor(timeLeftS)));
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  const endAtRef = useRef<number>(Date.now() + Math.max(0, timeLeftS) * 1000);
  const pausedRef = useRef<boolean>(paused);
  const frozenMsRef = useRef<number>(Math.max(0, timeLeftS) * 1000);

  // Đồng bộ khi server gửi time_left_s mới.
  useEffect(() => {
    if (pausedRef.current) {
      frozenMsRef.current = Math.max(0, timeLeftS) * 1000;
    } else {
      endAtRef.current = Date.now() + Math.max(0, timeLeftS) * 1000;
    }
    setRemaining(Math.max(0, Math.floor(timeLeftS)));
    if (timeLeftS > 0) expiredRef.current = false;
  }, [timeLeftS]);

  // Xử lý chuyển trạng thái pause.
  useEffect(() => {
    if (paused && !pausedRef.current) {
      // vào pause: đóng băng số ms còn lại
      frozenMsRef.current = Math.max(0, endAtRef.current - Date.now());
    } else if (!paused && pausedRef.current) {
      // ra khỏi pause: neo lại mốc kết thúc từ chỗ đã dừng
      endAtRef.current = Date.now() + frozenMsRef.current;
    }
    pausedRef.current = paused;
  }, [paused]);

  // Tick.
  useEffect(() => {
    const tick = () => {
      if (pausedRef.current) {
        setRemaining(Math.max(0, Math.ceil(frozenMsRef.current / 1000)));
        return;
      }
      setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    };
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, []);

  // Bắn onExpire một lần khi về 0 (không bắn khi đang pause).
  useEffect(() => {
    if (!pausedRef.current && remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [remaining]);

  const pct = totalS > 0 ? Math.max(0, Math.min(100, (remaining / totalS) * 100)) : 0;
  const danger = remaining < 20;
  const warn = !danger && remaining < 60;
  const color = paused ? 'text-treasure-gem' : danger ? 'text-treasure-danger' : warn ? 'text-orange-400' : 'text-white';
  const barColor = paused ? 'bg-treasure-gem/60' : danger ? 'bg-treasure-danger' : warn ? 'bg-orange-400' : 'bg-treasure-gem';

  return (
    <div className="panel px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70">
          {paused ? '⏸️ Tạm dừng — đang xem đáp án' : '⏳ Thời gian còn lại'}
        </span>
        <span
          className={`font-display text-2xl font-extrabold tabular-nums ${color} ${
            danger && !paused ? 'animate-pop' : ''
          }`}
        >
          {fmt(remaining)}
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-black/40">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

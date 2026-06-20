/**
 * Timer.tsx — đồng hồ đếm ngược cho phiên chơi.
 * Đồng bộ lại nội bộ mỗi khi prop timeLeftS đổi (server là nguồn sự thật).
 * Gọi onExpire đúng 1 lần khi chạm 0.
 */
import { useEffect, useRef, useState } from 'react';

interface TimerProps {
  timeLeftS: number;
  totalS: number;
  onExpire: () => void;
}

function fmt(s: number): string {
  const safe = Math.max(0, Math.floor(s));
  const m = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export default function Timer({ timeLeftS, totalS, onExpire }: TimerProps) {
  const [remaining, setRemaining] = useState<number>(Math.max(0, Math.floor(timeLeftS)));
  const expiredRef = useRef(false);
  const onExpireRef = useRef(onExpire);
  onExpireRef.current = onExpire;

  // Neo vào MỐC THỜI GIAN TUYỆT ĐỐI (wall-clock) thay vì trừ dần 1 mỗi tick.
  // Khi tab ở nền bị throttle setInterval, cách này vẫn tự bù về đúng giờ thực
  // và đảm bảo chạm 0 đúng lúc → onExpire bắn đúng thời điểm.
  const endAtRef = useRef<number>(Date.now() + Math.max(0, timeLeftS) * 1000);

  // Đồng bộ lại mốc kết thúc khi server gửi time_left_s mới.
  useEffect(() => {
    endAtRef.current = Date.now() + Math.max(0, timeLeftS) * 1000;
    setRemaining(Math.max(0, Math.floor(timeLeftS)));
    if (timeLeftS > 0) expiredRef.current = false;
  }, [timeLeftS]);

  // Cập nhật mỗi giây, tính từ mốc tuyệt đối (không tích lũy sai số).
  useEffect(() => {
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000)));
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Bắn onExpire một lần khi về 0.
  useEffect(() => {
    if (remaining <= 0 && !expiredRef.current) {
      expiredRef.current = true;
      onExpireRef.current();
    }
  }, [remaining]);

  const pct = totalS > 0 ? Math.max(0, Math.min(100, (remaining / totalS) * 100)) : 0;
  const danger = remaining < 20;
  const warn = !danger && remaining < 60;
  const color = danger ? 'text-treasure-danger' : warn ? 'text-orange-400' : 'text-white';
  const barColor = danger ? 'bg-treasure-danger' : warn ? 'bg-orange-400' : 'bg-treasure-gem';

  return (
    <div className="panel px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-white/70">⏳ Thời gian còn lại</span>
        <span
          className={`font-display text-2xl font-extrabold tabular-nums ${color} ${
            danger ? 'animate-pop' : ''
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

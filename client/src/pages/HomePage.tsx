/**
 * HomePage — TRANG CHỦ: chọn game để chơi.
 *  - Game 1: Đi tìm kho báu (trả lời → đào ô).
 *  - Game 2: Vượt Ải Trí Tuệ (mê cung 2D, cửa theo độ khó, nhiều kiểu câu).
 * Dùng chung tài khoản; mỗi game có bảng xếp hạng riêng.
 */
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

export default function HomePage() {
  const navigate = useNavigate();
  const { profile, logout } = useAuth();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="min-h-screen bg-treasure-bg text-white">
      <header className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
        <h1 className="font-display text-2xl font-extrabold text-treasure-gold">
          🎮 Violympic Mini Games
        </h1>
        <div className="flex items-center gap-2">
          <Link to="/leaderboard" className="btn btn-ghost">
            🏆 Bảng xếp hạng
          </Link>
          <button type="button" className="btn btn-ghost" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl px-4 pb-12">
        {profile && (
          <p className="mb-6 text-center text-lg">
            Xin chào, <span className="font-bold text-treasure-gem">{profile.full_name}</span>{' '}
            <span className="text-white/50">({profile.student_code})</span>
          </p>
        )}

        <h2 className="mb-5 text-center font-display text-xl font-extrabold text-white/90">
          Chọn trò chơi 👇
        </h2>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <GameCard
            onPlay={() => navigate('/treasure')}
            emoji="⛏️"
            title="Đi tìm kho báu"
            tag="Game 1"
            tagline="Trả lời đúng → đào ô săn 💎 né 💣 tìm 🏆"
            bullets={[
              'Bàn cờ 6×6 đầy kho báu',
              'Mỗi câu đúng được đào 1 ô',
              'Đua điểm + thời gian',
            ]}
            accent="from-amber-500/20 to-amber-700/10 border-amber-400/40"
            cta="Vào hang ⛏️"
          />
          <GameCard
            onPlay={() => navigate('/mountain')}
            emoji="🗺️"
            title="Vượt Ải Trí Tuệ"
            tag="Game 2 · MỚI"
            tagline="Điều khiển nhân vật đi trong mê cung tìm kho báu — trả lời để mở đường"
            bullets={[
              '4 kiểu câu: trắc nghiệm · điền · đúng/sai · sắp xếp',
              '3 lối đi · sai 1 câu là phải đổi tuyến',
              'Tới kho báu sớm + ít sai = điểm thưởng lớn 💎',
            ]}
            accent="from-sky-500/20 to-emerald-700/10 border-sky-400/40"
            cta="Vào mê cung 🗺️"
          />
        </div>
      </main>
    </div>
  );
}

function GameCard({
  onPlay,
  emoji,
  title,
  tag,
  tagline,
  bullets,
  accent,
  cta,
}: {
  onPlay: () => void;
  emoji: string;
  title: string;
  tag: string;
  tagline: string;
  bullets: string[];
  accent: string;
  cta: string;
}) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className={`group panel animate-pop flex flex-col gap-4 border bg-gradient-to-br p-6 text-left transition hover:-translate-y-1 hover:shadow-2xl ${accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-5xl transition group-hover:scale-110">{emoji}</span>
        <span className="rounded-full bg-black/30 px-3 py-1 text-xs font-bold text-treasure-gold">
          {tag}
        </span>
      </div>
      <div>
        <h3 className="font-display text-2xl font-extrabold text-white">{title}</h3>
        <p className="mt-1 text-sm text-white/70">{tagline}</p>
      </div>
      <ul className="space-y-1 text-sm text-white/80">
        {bullets.map((b) => (
          <li key={b} className="flex gap-2">
            <span className="text-treasure-gem">›</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <div className="btn-gold mt-2 w-full justify-center py-3 text-base">{cta}</div>
    </button>
  );
}

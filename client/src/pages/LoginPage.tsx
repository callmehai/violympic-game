import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch, ApiError } from '../api/client';
import { API, type LoginResponse } from '../api/contract';
import { useAuth } from '../store/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const isAuthed = useAuth((s) => s.isAuthed);
  const setSession = useAuth((s) => s.setSession);

  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Đã đăng nhập thì vào thẳng trang chơi
  useEffect(() => {
    if (isAuthed) navigate('/', { replace: true });
  }, [isAuthed, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const code = studentCode.trim();
    if (!code || !password) {
      setError('Vui lòng nhập mã sinh viên và mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch<LoginResponse>(API.login, {
        method: 'POST',
        auth: false,
        body: { student_code: code, password },
      });
      setSession(res.token, res.profile);
      navigate('/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 401 || err.status === 400
            ? 'Sai mã sinh viên hoặc mật khẩu.'
            : err.message || 'Đăng nhập thất bại, vui lòng thử lại.',
        );
      } else {
        setError('Không kết nối được máy chủ, vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-treasure-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Hero */}
        <div className="text-center mb-6">
          <h1 className="text-4xl font-extrabold text-treasure-gold">
            ⛏️ Đi tìm kho báu
          </h1>
          <p className="mt-2 text-treasure-gem text-lg font-semibold">Violympic 💎🏆</p>
        </div>

        {/* Form panel */}
        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="student_code" className="block text-sm font-semibold">
              Mã sinh viên (MSSV)
            </label>
            <input
              id="student_code"
              className="input w-full"
              type="text"
              autoComplete="username"
              placeholder="VD: SV001"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              disabled={loading}
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="block text-sm font-semibold">
              Mật khẩu
            </label>
            <input
              id="password"
              className="input w-full"
              type="password"
              autoComplete="current-password"
              placeholder="Mật khẩu được phát"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-lg bg-treasure-danger/20 border border-treasure-danger px-3 py-2 text-sm text-treasure-danger font-semibold animate-shake"
            >
              {error}
            </div>
          )}

          <button type="submit" className="btn btn-gold w-full" disabled={loading}>
            {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>

          <p className="text-center text-xs text-treasure-gem/80">
            Đăng nhập bằng MSSV và mật khẩu được phát cho bạn.
          </p>
        </form>

        {/* Chế độ ôn tập — trang tĩnh, không cần đăng nhập */}
        <a
          href="/ontap/"
          className="panel mt-4 flex items-center gap-3 p-4 hover:border-treasure-gold transition"
        >
          <span className="text-3xl">📚</span>
          <span className="min-w-0">
            <span className="block font-bold text-treasure-gold">Ôn tập MLN122 — 526 câu</span>
            <span className="block text-xs text-treasure-gem/80">
              Không cần đăng nhập, không đếm giờ. Bấm đáp án để xem đúng/sai.
            </span>
          </span>
          <span className="ml-auto text-treasure-gem">→</span>
        </a>

        {/* Liên kết phụ */}
        <div className="mt-5 flex items-center justify-center gap-4 text-sm">
          <Link to="/leaderboard" className="text-treasure-gold hover:underline">
            🏆 Xem bảng xếp hạng
          </Link>
          <span className="text-treasure-gem/40">•</span>
          <Link to="/admin" className="text-treasure-gem hover:underline">
            Quản trị
          </Link>
        </div>
      </div>
    </div>
  );
}

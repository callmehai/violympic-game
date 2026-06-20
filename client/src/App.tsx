import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './store/auth';
import LoginPage from './pages/LoginPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import LeaderboardPage from './pages/LeaderboardPage';
import AdminPage from './pages/AdminPage';

/** Chặn route người chơi khi chưa đăng nhập. */
function RequirePlayer({ children }: { children: React.ReactNode }) {
  const isAuthed = useAuth((s) => s.isAuthed);
  if (!isAuthed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequirePlayer>
            <LobbyPage />
          </RequirePlayer>
        }
      />
      <Route
        path="/game"
        element={
          <RequirePlayer>
            <GamePage />
          </RequirePlayer>
        }
      />
      <Route path="/leaderboard" element={<LeaderboardPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

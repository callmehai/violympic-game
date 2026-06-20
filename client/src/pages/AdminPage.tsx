import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiDownload, apiFetch, ApiError } from '../api/client';
import { API, type AdminEventState, type GameId, type LeaderboardEntry } from '../api/contract';
import { useAuth } from '../store/auth';

/** Tải blob xuống máy bằng thẻ <a> tạm. */
function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Lấy thông điệp lỗi thân thiện từ một exception bất kỳ. */
function errMsg(err: unknown, fallback = 'Đã có lỗi xảy ra, vui lòng thử lại.'): string {
  if (err instanceof ApiError) return err.message || fallback;
  return fallback;
}

// ===================== Form đăng nhập admin =====================
function AdminLogin() {
  const setSession = useAuth((s) => s.setSession);
  const [adminKey, setAdminKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const key = adminKey.trim();
    if (!key) {
      setError('Vui lòng nhập admin key.');
      return;
    }
    setLoading(true);
    try {
      const res = await apiFetch<{ token: string }>(API.adminLogin, {
        method: 'POST',
        auth: false,
        body: { admin_key: key },
      });
      setSession(res.token, {
        student_id: 0,
        student_code: 'admin',
        full_name: 'Admin',
        class_name: null,
        role: 'admin',
      });
    } catch (err) {
      setError(
        err instanceof ApiError && (err.status === 401 || err.status === 400)
          ? 'Admin key không đúng.'
          : errMsg(err, 'Đăng nhập quản trị thất bại.'),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-treasure-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-treasure-gold">
            ⛏️ Quản trị kho báu
          </h1>
          <p className="mt-2 text-treasure-gem font-semibold">Đăng nhập bằng admin key 🔑</p>
        </div>

        <form onSubmit={handleSubmit} className="panel p-6 space-y-4">
          <div className="space-y-1">
            <label htmlFor="admin_key" className="block text-sm font-semibold">
              Admin key
            </label>
            <input
              id="admin_key"
              className="input"
              type="password"
              autoComplete="off"
              placeholder="Nhập admin key"
              value={adminKey}
              onChange={(e) => setAdminKey(e.target.value)}
              disabled={loading}
              autoFocus
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
        </form>

        <div className="mt-5 flex items-center justify-center gap-4 text-sm">
          <Link to="/leaderboard" className="text-treasure-gold hover:underline">
            🏆 Xem bảng xếp hạng
          </Link>
          <span className="text-treasure-gem/40">•</span>
          <Link to="/login" className="text-treasure-gem hover:underline">
            Về đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}

// ===================== Khối thông báo nhỏ trong thẻ =====================
function Feedback({ ok, msg }: { ok: boolean; msg: string }) {
  return (
    <div
      role="status"
      className={
        ok
          ? 'rounded-lg bg-emerald-500/15 border border-emerald-500/50 px-3 py-2 text-sm text-emerald-300 font-semibold'
          : 'rounded-lg bg-treasure-danger/20 border border-treasure-danger px-3 py-2 text-sm text-treasure-danger font-semibold animate-shake'
      }
    >
      {msg}
    </div>
  );
}

type Msg = { ok: boolean; text: string } | null;

// ===================== Thẻ trạng thái sự kiện =====================
function EventCard({
  state,
  loading,
  reload,
}: {
  state: AdminEventState | null;
  loading: boolean;
  reload: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function toggle(open: boolean) {
    setBusy(true);
    setMsg(null);
    try {
      await apiFetch(open ? API.adminEventOpen : API.adminEventClose, { method: 'POST' });
      setMsg({ ok: true, text: open ? 'Đã mở sự kiện.' : 'Đã đóng sự kiện.' });
      reload();
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-treasure-gold">🗓️ Trạng thái sự kiện</h2>
        <button type="button" className="btn btn-ghost text-sm py-1.5" onClick={reload} disabled={loading}>
          {loading ? 'Đang tải…' : '↻ Làm mới'}
        </button>
      </div>

      {!state && loading && <p className="text-sm text-treasure-gem/80">Đang tải trạng thái…</p>}

      {state && (
        <>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Info label="Mã sự kiện" value={state.event_id} />
            <Info label="Ngày" value={state.event_date} />
            <Info
              label="Trạng thái"
              value={
                <span
                  className={state.open ? 'text-emerald-400 font-bold' : 'text-treasure-danger font-bold'}
                >
                  {state.open ? '● Mở' : '● Đóng'}
                </span>
              }
            />
            <Info label="Mã ngày" value={`${state.config.rows}×${state.config.cols} ô`} />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center sm:grid-cols-5">
            <Stat label="Sinh viên" value={state.counts.students} />
            <Stat label="Câu Kho báu" value={state.counts.questions} />
            <Stat label="Câu Vượt Ải" value={state.counts.mountain_questions} />
            <Stat label="Phiên" value={state.counts.sessions} />
            <Stat label="Đã xong" value={state.counts.finished} />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-gold flex-1"
              onClick={() => toggle(true)}
              disabled={busy || state.open}
            >
              Mở sự kiện
            </button>
            <button
              type="button"
              className="btn btn-wood flex-1"
              onClick={() => toggle(false)}
              disabled={busy || !state.open}
            >
              Đóng sự kiện
            </button>
          </div>

          {msg && <Feedback ok={msg.ok} msg={msg.text} />}
        </>
      )}
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-black/20 border border-white/10 px-3 py-2">
      <div className="text-xs text-treasure-gem/70">{label}</div>
      <div className="font-semibold break-words">{value}</div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-treasure-wood/40 border border-white/10 px-2 py-3">
      <div className="text-2xl font-extrabold text-treasure-gold">{value}</div>
      <div className="text-xs text-treasure-gem/80">{label}</div>
    </div>
  );
}

// ===================== Thẻ import file =====================
function ImportCard({
  title,
  icon,
  accept,
  path,
  formatResult,
  onDone,
}: {
  title: string;
  icon: string;
  accept: string;
  path: string;
  formatResult: (res: unknown) => string;
  onDone?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function handleUpload() {
    if (!file) {
      setMsg({ ok: false, text: 'Vui lòng chọn file trước.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch<unknown>(path, { method: 'POST', body: fd });
      setMsg({ ok: true, text: formatResult(res) });
      setFile(null);
      onDone?.();
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err, 'Import thất bại.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5 space-y-3">
      <h2 className="text-lg font-bold text-treasure-gold">
        {icon} {title}
      </h2>
      <input
        type="file"
        accept={accept}
        className="input cursor-pointer file:mr-3 file:rounded-lg file:border-0 file:bg-treasure-gold file:px-3 file:py-1.5 file:text-[#3a2a06] file:font-semibold"
        onChange={(e) => {
          setFile(e.target.files?.[0] ?? null);
          setMsg(null);
        }}
        disabled={busy}
      />
      <button type="button" className="btn btn-wood w-full" onClick={handleUpload} disabled={busy || !file}>
        {busy ? 'Đang tải lên…' : 'Tải lên & Import'}
      </button>
      {msg && <Feedback ok={msg.ok} msg={msg.text} />}
    </section>
  );
}

// ===================== Thẻ thêm nhanh 1 sinh viên =====================
function AddStudentCard({ onDone }: { onDone?: () => void }) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [klass, setKlass] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function add() {
    const c = code.trim();
    const n = name.trim();
    if (!c || !n) {
      setMsg({ ok: false, text: 'Nhập đủ họ tên và MSSV.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await apiFetch<{ student_code: string; full_name: string }>(
        API.adminStudentsAdd,
        { method: 'POST', body: { student_code: c, full_name: n, class_name: klass.trim() } },
      );
      setMsg({
        ok: true,
        text: `Đã thêm ${res.full_name} (${res.student_code}). Mật khẩu = MSSV.`,
      });
      setName('');
      setCode('');
      setKlass('');
      onDone?.();
    } catch (err) {
      // 409 = MSSV đã tồn tại.
      setMsg({ ok: false, text: errMsg(err, 'Thêm thất bại.') });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-3 p-5">
      <h2 className="text-lg font-bold text-treasure-gold">➕ Thêm nhanh 1 sinh viên</h2>
      <p className="text-sm text-treasure-gem/80">
        Nhập tên + MSSV. Nếu MSSV chưa có → tạo tài khoản mới (mật khẩu = MSSV); nếu đã có → báo lỗi.
      </p>
      <input
        className="input"
        placeholder="Họ và tên"
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setMsg(null);
        }}
        disabled={busy}
      />
      <input
        className="input"
        placeholder="Mã sinh viên (MSSV)"
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setMsg(null);
        }}
        onKeyDown={(e) => e.key === 'Enter' && void add()}
        disabled={busy}
      />
      <input
        className="input"
        placeholder="Lớp (không bắt buộc)"
        value={klass}
        onChange={(e) => setKlass(e.target.value)}
        disabled={busy}
      />
      <button type="button" className="btn btn-gold w-full" onClick={() => void add()} disabled={busy}>
        {busy ? 'Đang thêm…' : '➕ Thêm sinh viên'}
      </button>
      {msg && <Feedback ok={msg.ok} msg={msg.text} />}
    </section>
  );
}

// ===================== Thẻ hành động (export / bonus) =====================
function ActionCard({
  title,
  icon,
  button,
  onRun,
}: {
  title: string;
  icon: string;
  button: string;
  onRun: () => Promise<string>;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const text = await onRun();
      setMsg({ ok: true, text });
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel p-5 space-y-3">
      <h2 className="text-lg font-bold text-treasure-gold">
        {icon} {title}
      </h2>
      <button type="button" className="btn btn-gold w-full" onClick={run} disabled={busy}>
        {busy ? 'Đang xử lý…' : button}
      </button>
      {msg && <Feedback ok={msg.ok} msg={msg.text} />}
    </section>
  );
}

// ===================== Thẻ "Người đã chơi" (reset nhanh) =====================
const STATUS_VN: Record<string, string> = {
  finished: 'Đã xong',
  in_progress: 'Đang chơi',
  abandoned: 'Bỏ dở',
};

const GAME_TABS: { id: GameId; label: string }[] = [
  { id: 'treasure', label: '⛏️ Kho báu' },
  { id: 'mountain', label: '⛰️ Vượt Ải' },
];

function PlayersCard() {
  const [game, setGame] = useState<GameId>('treasure');
  const [players, setPlayers] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null); // student_code đang reset, hoặc 'ALL'
  const [msg, setMsg] = useState<Msg>(null);
  const [code, setCode] = useState('');

  const load = useCallback(async (g: GameId) => {
    setLoading(true);
    try {
      const res = await apiFetch<LeaderboardEntry[]>(`${API.adminPlayers}?game=${g}`);
      setPlayers(res);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(game);
  }, [load, game]);

  async function resetOne(sc: string) {
    setBusy(sc);
    setMsg(null);
    try {
      await apiFetch(API.adminReset, { method: 'POST', body: { student_code: sc, game } });
      setMsg({ ok: true, text: `Đã reset ${sc}. Bạn ấy đăng nhập lại để chơi mới.` });
      await load(game);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err, 'Reset thất bại.') });
    } finally {
      setBusy(null);
    }
  }

  async function resetAll() {
    if (
      !window.confirm(
        'Reset TẤT CẢ người chơi của game này?\nMọi phiên + điểm hiện tại sẽ bị xoá, cả lớp chơi lại từ đầu.',
      )
    )
      return;
    setBusy('ALL');
    setMsg(null);
    try {
      const res = await apiFetch<{ deleted: number }>(API.adminResetAll, {
        method: 'POST',
        body: { game },
      });
      setMsg({ ok: true, text: `Đã reset tất cả (${res.deleted} phiên). Mọi người chơi lại từ đầu.` });
      await load(game);
    } catch (err) {
      setMsg({ ok: false, text: errMsg(err, 'Reset thất bại.') });
    } finally {
      setBusy(null);
    }
  }

  async function resetByInput() {
    const sc = code.trim();
    if (!sc) {
      setMsg({ ok: false, text: 'Nhập mã sinh viên.' });
      return;
    }
    await resetOne(sc);
    setCode('');
  }

  return (
    <section className="panel p-5 space-y-3 md:col-span-2 border-treasure-danger/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-treasure-gold">
          ♻️ Người đã chơi ({players.length})
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost text-sm py-1.5"
            onClick={() => void load(game)}
            disabled={loading}
          >
            {loading ? 'Đang tải…' : '↻ Làm mới'}
          </button>
          <button
            type="button"
            className="btn text-sm py-1.5 bg-treasure-danger text-white hover:brightness-110"
            onClick={() => void resetAll()}
            disabled={busy === 'ALL' || players.length === 0}
          >
            {busy === 'ALL' ? 'Đang reset…' : '🗑️ Reset tất cả'}
          </button>
        </div>
      </div>

      {/* Chọn game để xem/ reset */}
      <div className="inline-flex rounded-xl bg-black/30 p-1">
        {GAME_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setGame(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
              game === t.id ? 'bg-treasure-gold text-treasure-bg' : 'text-white/70 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Danh sách người đã chơi + nút reset từng người */}
      <div className="max-h-72 divide-y divide-white/5 overflow-y-auto rounded-lg border border-white/10">
        {players.length === 0 ? (
          <div className="p-4 text-center text-sm text-white/50">Chưa có ai chơi.</div>
        ) : (
          players.map((p) => (
            <div key={p.student_code} className="flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{p.name}</div>
                <div className="text-xs text-treasure-gem/70">
                  {p.student_code} · {p.total}đ · {STATUS_VN[p.status] ?? p.status}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-ghost shrink-0 px-3 py-1 text-xs"
                onClick={() => void resetOne(p.student_code)}
                disabled={busy === p.student_code}
              >
                {busy === p.student_code ? '…' : 'Reset'}
              </button>
            </div>
          ))
        )}
      </div>

      {/* Reset nhanh theo MSSV (nếu người đó chưa có trong danh sách) */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="Reset theo MSSV (vd HE190610)"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            setMsg(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && void resetByInput()}
        />
        <button
          type="button"
          className="btn btn-wood sm:w-40"
          onClick={() => void resetByInput()}
          disabled={!!busy}
        >
          Reset MSSV
        </button>
      </div>

      {msg && <Feedback ok={msg.ok} msg={msg.text} />}
    </section>
  );
}

// ===================== Dashboard =====================
function Dashboard() {
  const logout = useAuth((s) => s.logout);
  const [state, setState] = useState<AdminEventState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<AdminEventState>(API.adminEvent);
      setState(res);
    } catch {
      // giữ state cũ; thẻ con sẽ hiện lỗi khi thao tác
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadState();
  }, [loadState]);

  return (
    <div className="min-h-screen bg-treasure-bg p-4 md:p-6">
      <div className="mx-auto max-w-5xl space-y-5">
        {/* Header */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-treasure-gold">
              ⛏️ Bảng điều khiển quản trị
            </h1>
            <p className="text-sm text-treasure-gem/80">Đi tìm kho báu · Violympic 💎🏆</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/leaderboard" className="btn btn-ghost text-sm">
              🏆 Bảng xếp hạng
            </Link>
            <button type="button" className="btn btn-wood text-sm" onClick={logout}>
              Đăng xuất
            </button>
          </div>
        </header>

        {/* Trạng thái sự kiện */}
        <EventCard state={state} loading={loading} reload={loadState} />

        {/* Lưới các thẻ thao tác */}
        <div className="grid gap-5 md:grid-cols-2">
          <ImportCard
            title="Import sinh viên"
            icon="👥"
            accept=".csv,text/csv"
            path={API.adminStudentsImport}
            formatResult={(res) => {
              const r = (res ?? {}) as { inserted?: number; updated?: number };
              return `Thành công · Thêm mới: ${r.inserted ?? 0} · Cập nhật: ${r.updated ?? 0}`;
            }}
            onDone={loadState}
          />

          <AddStudentCard onDone={loadState} />

          <ImportCard
            title="Import câu hỏi (Kho báu)"
            icon="❓"
            accept=".json,application/json"
            path={API.adminQuestionsImport}
            formatResult={(res) => {
              const r = (res ?? {}) as { inserted?: number; updated?: number; errors?: number };
              return `Thành công · Thêm mới: ${r.inserted ?? 0} · Cập nhật: ${r.updated ?? 0} · Lỗi: ${r.errors ?? 0}`;
            }}
            onDone={loadState}
          />

          <ImportCard
            title="Import câu hỏi (Vượt Ải)"
            icon="🧩"
            accept=".json,application/json"
            path={API.adminMountainImport}
            formatResult={(res) => {
              const r = (res ?? {}) as { inserted?: number; updated?: number; errors?: number };
              return `Thành công · Thêm mới: ${r.inserted ?? 0} · Cập nhật: ${r.updated ?? 0} · Lỗi: ${r.errors ?? 0}`;
            }}
            onDone={loadState}
          />

          <ActionCard
            title="Xuất danh sách access code"
            icon="🔑"
            button="Tải file CSV"
            onRun={async () => {
              const { blob, filename } = await apiDownload(API.adminStudentsExport);
              download(blob, filename);
              return `Đã tải xuống: ${filename}`;
            }}
          />

          <ActionCard
            title="Xuất kết quả Kho báu"
            icon="📊"
            button="Tải kết quả Kho báu"
            onRun={async () => {
              const { blob, filename } = await apiDownload(`${API.adminResultsExport}?game=treasure`);
              download(blob, filename);
              return `Đã tải xuống: ${filename}`;
            }}
          />

          <ActionCard
            title="Xuất kết quả Vượt Ải"
            icon="📊"
            button="Tải kết quả Vượt Ải"
            onRun={async () => {
              const { blob, filename } = await apiDownload(`${API.adminResultsExport}?game=mountain`);
              download(blob, filename);
              return `Đã tải xuống: ${filename}`;
            }}
          />

          <PlayersCard />
        </div>
      </div>
    </div>
  );
}

// ===================== Page =====================
export default function AdminPage() {
  const isAdmin = useAuth((s) => s.isAdmin);
  return isAdmin ? <Dashboard /> : <AdminLogin />;
}

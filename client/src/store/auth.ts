/**
 * auth.ts — zustand store cho phiên đăng nhập (token + profile), persist localStorage.
 */
import { create } from 'zustand';
import type { Profile } from '../api/contract';
import { clearToken, getToken, setToken } from '../api/client';

const PROFILE_KEY = 'vt_profile';

function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  profile: Profile | null;
  isAuthed: boolean;
  isAdmin: boolean;
  setSession: (token: string, profile: Profile) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => {
  const token = getToken();
  const profile = loadProfile();
  return {
    token,
    profile,
    isAuthed: !!token && !!profile,
    isAdmin: profile?.role === 'admin',
    setSession: (token, profile) => {
      setToken(token);
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      set({ token, profile, isAuthed: true, isAdmin: profile.role === 'admin' });
    },
    logout: () => {
      clearToken();
      localStorage.removeItem(PROFILE_KEY);
      set({ token: null, profile: null, isAuthed: false, isAdmin: false });
    },
  };
});

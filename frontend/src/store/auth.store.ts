// src/store/auth.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id:      number;
  name:    string;
  role:    string;
  code?:   string;
  dairyId: number;
}

interface Dairy {
  id:     number;
  name:   string;
  slug:   string;
  plan:   string;
  status: string;
}

interface AuthState {
  token:   string | null;
  user:    User | null;
  dairy:   Dairy | null;
  setAuth: (token: string, user: User, dairy?: Dairy) => void;
  logout:  () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:   null,
      user:    null,
      dairy:   null,
      setAuth: (token, user, dairy) => set({ token, user, dairy: dairy || null }),
      logout:  () => set({ token: null, user: null, dairy: null }),
    }),
    { name: 'gutoria-auth' }
  )
);

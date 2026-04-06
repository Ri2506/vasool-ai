import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import { Config } from '@/constants/config';
import { secureStorage } from '@/lib/secureStorage';

export type Role = 'owner' | 'agent';

export interface SessionUser {
  id: string;
  orgId: string;
  name: string;
  phone: string;
  role: Role;
}

interface AuthState {
  user: SessionUser | null;
  isHydrating: boolean;
  isBusy: boolean;
  pendingPhone: string | null; // phone awaiting OTP verify

  hydrate: () => Promise<void>;
  sendOwnerOtp: (phone: string) => Promise<void>;
  verifyOwnerOtp: (otp: string) => Promise<void>;
  signInAgent: (phone: string, pin: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Dev helper: bypass network auth by seeding a local session. */
  _devSetUser: (user: SessionUser) => Promise<void>;
}

const SESSION_KEY = Config.storageKeys.sessionUser;

async function persist(user: SessionUser | null) {
  if (user) {
    await secureStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    await secureStorage.removeItem(SESSION_KEY);
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isHydrating: true,
  isBusy: false,
  pendingPhone: null,

  hydrate: async () => {
    try {
      const raw = await secureStorage.getItem(SESSION_KEY);
      if (raw) {
        const user = JSON.parse(raw) as SessionUser;
        set({ user });
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[auth] hydrate failed', e);
    } finally {
      set({ isHydrating: false });
    }
  },

  sendOwnerOtp: async (phone) => {
    set({ isBusy: true });
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: `+91${phone}`,
      });
      if (error) throw error;
      set({ pendingPhone: phone });
    } finally {
      set({ isBusy: false });
    }
  },

  verifyOwnerOtp: async (otp) => {
    const phone = get().pendingPhone;
    if (!phone) throw new Error('No pending phone number');
    set({ isBusy: true });
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        phone: `+91${phone}`,
        token: otp,
        type: 'sms',
      });
      if (error) throw error;
      if (!data.user) throw new Error('No user returned from verify');

      // Bootstrap: call Edge Function that creates org + user on first login,
      // or returns existing user on subsequent logins.
      const { data: bootstrap, error: bsErr } = await supabase.functions.invoke(
        'bootstrap-owner',
        { body: { phone, name: phone } }
      );
      if (bsErr) throw bsErr;
      if (!bootstrap?.user) throw new Error('Bootstrap failed');

      const user: SessionUser = {
        id: bootstrap.user.id,
        orgId: bootstrap.user.orgId,
        name: bootstrap.user.name,
        phone: bootstrap.user.phone,
        role: bootstrap.user.role as Role,
      };

      await persist(user);
      set({ user, pendingPhone: null });
    } finally {
      set({ isBusy: false });
    }
  },

  signInAgent: async (phone, pin) => {
    set({ isBusy: true });
    try {
      // Agent auth runs through a Supabase Edge Function that verifies
      // the PIN hash and returns a session. Stub for Sprint 1 — wired up
      // in Sprint 2. Throws so the UI shows the invalid-PIN state.
      const { data, error } = await supabase.functions.invoke('agent-login', {
        body: { phone, pin },
      });
      if (error) throw error;
      if (!data?.user) throw new Error('Invalid PIN');

      const user: SessionUser = data.user;
      await persist(user);
      set({ user });
    } finally {
      set({ isBusy: false });
    }
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore — we still clear local state
    }
    await persist(null);
    set({ user: null, pendingPhone: null });
  },

  _devSetUser: async (user) => {
    await persist(user);
    set({ user });
  },
}));

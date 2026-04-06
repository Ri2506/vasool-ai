// Runtime config. Values come from env vars (.env.example for keys).
// Use EXPO_PUBLIC_ prefix so they are available in the client bundle.
export const Config = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',

  // Working days: Sundays skipped by default (PRD §4.3, §6 "Working days Mon-Sat")
  defaultWorkingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const,

  // Secure store keys
  storageKeys: {
    sessionUser: 'vasool.session.user',
    language: 'vasool.language',
    onboarded: 'vasool.onboarded',
  },
};

export function assertSupabaseConfig() {
  if (!Config.supabaseUrl || !Config.supabaseAnonKey) {
    // eslint-disable-next-line no-console
    console.warn(
      '[VasoolAI] Supabase env vars missing. Copy .env.example to .env and fill in your keys.'
    );
  }
}

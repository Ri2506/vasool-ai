import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';

import { Config, assertSupabaseConfig } from '@/constants/config';
import { secureStorage } from '@/lib/secureStorage';

assertSupabaseConfig();

export const supabase = createClient(Config.supabaseUrl, Config.supabaseAnonKey, {
  auth: {
    storage: secureStorage as any,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

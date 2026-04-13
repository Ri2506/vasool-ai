// Lightweight crash reporter.
//
// We don't pull in Sentry yet (extra ₹/MB cost on a free-tier app).
// Instead: every uncaught error / promise rejection / ErrorBoundary catch
// is appended to a ring-buffered log in SecureStore (last 50 events) and
// optionally pushed to a Supabase `crash_reports` table on next online tick.
//
// The owner can view + share the log from Settings → Diagnostics → Crash
// log, which is enough for soft-launch debugging via WhatsApp screenshots.

import { Platform } from 'react-native';

import { secureStorage } from '@/lib/secureStorage';
import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'vasool.crashlog.v1';
// SecureStore has a ~2KB soft limit per value. Keep the log small:
//   - cap to 10 events (newest wins)
//   - truncate each stack to 400 chars
//   - strip `context` if it would tip us over
const MAX_EVENTS = 10;
const STACK_LIMIT = 400;
const CONTEXT_LIMIT = 200;
const TARGET_BYTES = 1800;

export interface CrashEvent {
  ts: number;
  type: 'error' | 'rejection' | 'boundary' | 'manual';
  message: string;
  stack?: string;
  context?: string;
  platform: string;
  uploaded?: boolean;
}

let _cached: CrashEvent[] | null = null;

async function readLog(): Promise<CrashEvent[]> {
  if (_cached) return _cached;
  try {
    const raw = await secureStorage.getItem(STORAGE_KEY);
    _cached = raw ? (JSON.parse(raw) as CrashEvent[]) : [];
  } catch {
    _cached = [];
  }
  return _cached;
}

function truncateEvent(e: CrashEvent): CrashEvent {
  return {
    ...e,
    message: e.message?.slice(0, 300) ?? '',
    stack: e.stack ? e.stack.slice(0, STACK_LIMIT) : undefined,
    context: e.context ? e.context.slice(0, CONTEXT_LIMIT) : undefined,
  };
}

async function writeLog(events: CrashEvent[]): Promise<void> {
  // Always keep the in-memory cache full so the Diagnostics UI stays rich.
  _cached = events.slice(-MAX_EVENTS);

  // For SecureStore we serialise a trimmed subset that fits under 2KB.
  // Drop oldest events one by one until the payload fits.
  let trimmed = _cached.map(truncateEvent);
  let serialised = JSON.stringify(trimmed);
  while (serialised.length > TARGET_BYTES && trimmed.length > 1) {
    trimmed = trimmed.slice(1);
    serialised = JSON.stringify(trimmed);
  }

  try {
    await secureStorage.setItem(STORAGE_KEY, serialised);
  } catch {
    // SecureStore failing isn't fatal — the in-memory cache still works
    // for the rest of the session.
  }
}

/**
 * Record a crash. Safe to call from anywhere — never throws.
 */
export async function recordCrash(input: Omit<CrashEvent, 'ts' | 'platform'>): Promise<void> {
  try {
    const event: CrashEvent = {
      ...input,
      ts: Date.now(),
      platform: `${Platform.OS} ${Platform.Version}`,
    };
    const log = await readLog();
    log.push(event);
    await writeLog(log);
    // eslint-disable-next-line no-console
    console.warn(`[crash] ${event.type}: ${event.message}`);
  } catch {
    // never throw from a crash handler
  }
}

/**
 * Push unsent events to Supabase. Called on app foreground + after the
 * online manager flips to true. The crash_reports table doesn't exist
 * by default — failures here are swallowed silently (we keep the local
 * log either way, and it's still shareable from Settings).
 */
export async function flushCrashLog(): Promise<{ uploaded: number; failed: number }> {
  const log = await readLog();
  const pending = log.filter((e) => !e.uploaded);
  if (pending.length === 0) return { uploaded: 0, failed: 0 };
  let uploaded = 0;
  let failed = 0;
  for (const e of pending) {
    try {
      const { error } = await supabase.from('crash_reports').insert({
        ts: new Date(e.ts).toISOString(),
        type: e.type,
        message: e.message,
        stack: e.stack ?? null,
        context: e.context ?? null,
        platform: e.platform,
      });
      if (error) throw error;
      e.uploaded = true;
      uploaded++;
    } catch {
      failed++;
    }
  }
  await writeLog(log);
  return { uploaded, failed };
}

export async function getCrashLog(): Promise<CrashEvent[]> {
  return [...(await readLog())].reverse(); // newest first
}

export async function clearCrashLog(): Promise<void> {
  await writeLog([]);
}

/**
 * Wire the global error + unhandled-rejection hooks. Idempotent.
 * Called once from App.tsx boot.
 */
let _wired = false;
export function installCrashHandlers(): void {
  if (_wired) return;
  _wired = true;

  // RN's ErrorUtils — installs a global handler for uncaught JS errors.
  // (Web has window.onerror; both are wired below.)
  const G: any = globalThis;
  if (G.ErrorUtils?.setGlobalHandler) {
    const original = G.ErrorUtils.getGlobalHandler();
    G.ErrorUtils.setGlobalHandler((error: Error, isFatal: boolean) => {
      recordCrash({
        type: 'error',
        message: error.message,
        stack: error.stack,
        context: isFatal ? 'fatal' : 'non-fatal',
      });
      if (typeof original === 'function') original(error, isFatal);
    });
  }

  // Unhandled promise rejections — RN logs them as yellow boxes only.
  if (typeof G.process?.on === 'function') {
    G.process.on('unhandledRejection', (reason: unknown) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      recordCrash({
        type: 'rejection',
        message: err.message,
        stack: err.stack,
      });
    });
  }

  // Web — window.onerror catches sync errors before any handler.
  if (typeof window !== 'undefined') {
    window.addEventListener?.('error', (e: ErrorEvent) => {
      recordCrash({
        type: 'error',
        message: e.message,
        stack: e.error?.stack,
        context: `${e.filename}:${e.lineno}`,
      });
    });
    window.addEventListener?.('unhandledrejection', (e: PromiseRejectionEvent) => {
      const err = e.reason instanceof Error ? e.reason : new Error(String(e.reason));
      recordCrash({
        type: 'rejection',
        message: err.message,
        stack: err.stack,
      });
    });
  }
}

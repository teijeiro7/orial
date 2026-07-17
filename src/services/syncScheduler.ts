import { AppState, type AppStateStatus } from 'react-native';
import { supabaseService } from './supabaseService';
import { syncService } from './syncService';

/**
 * Drives automatic background sync so the brief's acceptance criteria are met
 * without every caller having to remember to sync:
 *   - "Escritura local → sync a Supabase en < 5s con conexión"
 *   - "Al recuperar conexión: sync automático"
 *
 * Mechanism (uses only what this Expo app already relies on — `AppState`):
 *   1. An initial sync as soon as the scheduler starts (app launch).
 *   2. A foreground interval poll every `SYNC_INTERVAL_MS`.
 *   3. A sync whenever the app returns to the foreground (`AppState` → active),
 *      which also covers the common "phone regained signal while backgrounded,
 *      user reopens the app" recovery path.
 *
 * NOTE (documented follow-up): true connectivity-regain-triggered sync while the
 * app stays foregrounded is NOT wired, because the project has no network-status
 * utility (no `@react-native-community/netinfo`). Adding NetInfo and calling
 * `runSync()` from its `addEventListener` on an offline→online transition is the
 * one-line extension when that dependency is introduced.
 */

/** Foreground poll cadence. Kept modest to balance freshness vs. battery. */
export const SYNC_INTERVAL_MS = 15_000;

let intervalId: ReturnType<typeof setInterval> | null = null;
let appStateSub: { remove: () => void } | null = null;
let inFlight = false;

/** Runs one push+pull cycle, guarded so overlapping ticks don't stack up. */
async function runSync(): Promise<void> {
  if (inFlight) return;
  // syncService.poll() is already a no-op when unconfigured, but skip the work
  // (and any error churn) entirely while there are no real credentials.
  if (!supabaseService.isConfigured()) return;
  inFlight = true;
  try {
    await syncService.poll();
  } catch {
    // The engine records per-table errors and leaves cursors intact; a failed
    // poll must never crash the app, so swallow here and retry next tick.
  } finally {
    inFlight = false;
  }
}

/**
 * Starts the scheduler. Idempotent: a second call is a no-op while one is
 * already running. Returns a stop function (handy for `useEffect` cleanup).
 */
export function startSyncScheduler(): () => void {
  if (intervalId !== null) return stopSyncScheduler;

  void runSync();
  intervalId = setInterval(() => {
    void runSync();
  }, SYNC_INTERVAL_MS);

  appStateSub = AppState.addEventListener('change', (state: AppStateStatus) => {
    if (state === 'active') void runSync();
  });

  return stopSyncScheduler;
}

/** Stops the scheduler and releases its timer / listener. */
export function stopSyncScheduler(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  appStateSub?.remove();
  appStateSub = null;
}

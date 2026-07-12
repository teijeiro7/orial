import { useEffect } from 'react';
import { AppState } from 'react-native';
import { drainNfcWaterQueue } from '../services/nfcWaterQueue';

/**
 * Builds a handler that drains the NFC water queue and, once it resolves,
 * optionally invokes a caller-supplied callback (e.g. to refetch dashboard data).
 * Failures are logged, not thrown -- draining is best-effort background work and
 * must never surface as an unhandled rejection.
 */
export function createDrainHandler(onDrained?: () => void): () => void {
  return () => {
    drainNfcWaterQueue()
      .then(() => onDrained?.())
      .catch(console.error);
  };
}

/**
 * Drains any NFC water-logging entries queued by the native Shortcuts intent
 * (LogWaterIntent.swift) into the DB, both on mount (cold start: the app was
 * fully closed and the user tapped the NFC sticker one or more times before
 * opening it fresh -- no AppState 'change' event fires for this case, since the
 * app starts already 'active') and every time the app returns to the foreground.
 */
export function useNfcWaterQueueDrain(onDrained?: () => void): void {
  useEffect(() => {
    const handler = createDrainHandler(onDrained);
    handler();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        handler();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);
}

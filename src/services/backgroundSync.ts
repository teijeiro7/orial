import * as TaskManager from 'expo-task-manager';
import * as BackgroundFetch from 'expo-background-fetch';
import { Platform } from 'react-native';
import { hermesInboxService } from './hermesInboxService';
import { widgetService } from './widgetService';

const BACKGROUND_SYNC_TASK = 'orial-background-sync';

/**
 * Background-fetch task body. Runs in a headless context (no React tree,
 * no UI) so we keep it small and defensive: each step is wrapped in its
 * own try/catch so one failure doesn't take down the others.
 */
TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
  let consumed = 0;
  let failed = 0;

  try {
    const r = await widgetService.consumeQueues();
    consumed += r.totalProcessed;
  } catch (e) {
    console.warn('[backgroundSync] consumeQueues failed', e);
  }

  try {
    const r = await hermesInboxService.pullAndProcess({ silent: true });
    consumed += r.consumed;
    failed += r.failed;
  } catch (e) {
    console.warn('[backgroundSync] inbox pull failed', e);
  }

  try {
    await widgetService.updateWidgetData();
  } catch (e) {
    console.warn('[backgroundSync] updateWidgetData failed', e);
  }

  // We always return a result so iOS / Android can re-schedule.
  // `NoData` is fine when we did nothing — the OS will try again later.
  if (failed > 0) return BackgroundFetch.BackgroundFetchResult.Failed;
  if (consumed > 0) return BackgroundFetch.BackgroundFetchResult.NewData;
  return BackgroundFetch.BackgroundFetchResult.NoData;
});

/**
 * Register the background-fetch task with the OS. Idempotent — safe to call
 * on every app launch. Returns whether the task is currently registered.
 */
export async function registerBackgroundSync(): Promise<boolean> {
  // iOS: require user permission for background fetch. Without this the OS
  // will silently never invoke the task.
  if (Platform.OS === 'ios') {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Denied ||
      status === BackgroundFetch.BackgroundFetchStatus.Restricted
    ) {
      console.warn('[backgroundSync] background fetch unavailable on this device');
      return false;
    }
  }

  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_SYNC_TASK);
  if (isRegistered) return true;

  try {
    await BackgroundFetch.registerTaskAsync(BACKGROUND_SYNC_TASK, {
      // ~15 min is the smallest interval the OS will honour reliably on both
      // iOS and Android without burning battery. The OS may stretch it.
      minimumInterval: 15 * 60,
      // We don't strictly need network connectivity (inbox can be skipped),
      // but we do want Wi-Fi preference so a sync doesn't eat cellular data
      // when the user is out.
      stopOnTerminate: false,
      startOnBoot: true,
    });
    return true;
  } catch (e) {
    console.warn('[backgroundSync] registerTaskAsync failed', e);
    return false;
  }
}

export async function unregisterBackgroundSync(): Promise<void> {
  try {
    await BackgroundFetch.unregisterTaskAsync(BACKGROUND_SYNC_TASK);
  } catch {
    // ignore
  }
}

export { BACKGROUND_SYNC_TASK };

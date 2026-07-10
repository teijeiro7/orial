import { Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { hydrationService } from './hydrationService';

const GROUP_ID = 'group.com.orial.app.widget';

interface NfcWaterQueueEntry {
  id: string;
  date: string;
  ml: number;
}

export async function writeHydrationBaseline(date: string, consumedLiters: number): Promise<void> {
  if (Platform.OS !== 'ios') return;

  await DefaultPreference.setName(GROUP_ID);
  await DefaultPreference.set('hydration_baseline', JSON.stringify({ date, consumedLiters }));
}

let inFlightDrain: Promise<{ addedMl: number }> | null = null;

export async function drainNfcWaterQueue(): Promise<{ addedMl: number }> {
  if (inFlightDrain) {
    return inFlightDrain;
  }

  inFlightDrain = (async () => {
    if (Platform.OS !== 'ios') return { addedMl: 0 };

    await DefaultPreference.setName(GROUP_ID);
    const raw = await DefaultPreference.get('hydration_nfc_queue');

    if (!raw || raw === '[]') {
      return { addedMl: 0 };
    }

    let queue: NfcWaterQueueEntry[] = JSON.parse(raw);
    let addedMl = 0;

    // Process entries one at a time, persisting the shrunken remaining queue
    // after each successful addWater call. If addWater throws partway through,
    // everything already applied is already removed from the persisted queue,
    // so a subsequent drain only reprocesses what's left.
    while (queue.length > 0) {
      const entry = queue[0];
      await hydrationService.addWater(entry.date, entry.ml / 1000, 'water');
      addedMl += entry.ml;
      queue = queue.slice(1);
      await DefaultPreference.set('hydration_nfc_queue', JSON.stringify(queue));
    }

    return { addedMl };
  })();

  try {
    return await inFlightDrain;
  } finally {
    inFlightDrain = null;
  }
}

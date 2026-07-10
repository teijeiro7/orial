import { Platform } from 'react-native';
import DefaultPreference from 'react-native-default-preference';
import { hydrationService } from './hydrationService';

const GROUP_ID = 'group.com.orial.app.widget';

interface NfcWaterQueueEntry {
  id: string;
  date: string;
  ml: number;
}

// The queue is written by native Swift code (LogWaterIntent.swift) and read back here
// as untrusted JSON crossing a real system boundary -- validate its shape before use
// instead of trusting the `as NfcWaterQueueEntry[]` cast blindly.
function isValidNfcWaterQueueEntry(entry: unknown): entry is NfcWaterQueueEntry {
  if (typeof entry !== 'object' || entry === null) return false;
  const { id, date, ml } = entry as Record<string, unknown>;
  if (typeof id !== 'string' || typeof date !== 'string') return false;
  const mlNumber = Number(ml);
  return !Number.isNaN(mlNumber) && Number.isFinite(mlNumber);
}

function parseNfcWaterQueue(raw: string): NfcWaterQueueEntry[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter((entry): entry is NfcWaterQueueEntry => {
      const isValid = isValidNfcWaterQueueEntry(entry);
      if (!isValid) {
        console.warn('Skipping malformed NFC water queue entry:', entry);
      }
      return isValid;
    })
    .map((entry) => ({ ...entry, ml: Number(entry.ml) }));
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

    let queue: NfcWaterQueueEntry[] = parseNfcWaterQueue(raw);
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

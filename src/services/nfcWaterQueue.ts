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

export async function drainNfcWaterQueue(): Promise<{ addedMl: number }> {
  if (Platform.OS !== 'ios') return { addedMl: 0 };

  await DefaultPreference.setName(GROUP_ID);
  const raw = await DefaultPreference.get('hydration_nfc_queue');

  if (!raw || raw === '[]') {
    return { addedMl: 0 };
  }

  const queue: NfcWaterQueueEntry[] = JSON.parse(raw);

  for (const entry of queue) {
    await hydrationService.addWater(entry.date, entry.ml / 1000, 'water');
  }

  await DefaultPreference.set('hydration_nfc_queue', '[]');

  const addedMl = queue.reduce((sum, entry) => sum + entry.ml, 0);
  return { addedMl };
}

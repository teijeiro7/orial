import { Platform, PermissionsAndroid } from 'react-native';
import AppleHealthKit, {
  HealthValue,
  HealthKitPermissions,
} from 'react-native-health';

const permissions: HealthKitPermissions = {
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.Weight,
    ],
    write: [
      AppleHealthKit.Constants.Permissions.Weight,
    ],
  },
};

export class HealthKitService {
  private static instance: HealthKitService;
  private isAvailable: boolean = false;

  static getInstance(): HealthKitService {
    if (!HealthKitService.instance) {
      HealthKitService.instance = new HealthKitService();
    }
    return HealthKitService.instance;
  }

  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;

    return new Promise((resolve) => {
      AppleHealthKit.initHealthKit(permissions, (err: string) => {
        if (err) {
          console.warn('[HealthKit] init error:', err);
          this.isAvailable = false;
          resolve(false);
        } else {
          this.isAvailable = true;
          resolve(true);
        }
      });
    });
  }

  async getActiveEnergyBurned(date: Date): Promise<number> {
    if (!this.isAvailable || Platform.OS !== 'ios') return 0;

    return new Promise((resolve) => {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);

      AppleHealthKit.getActiveEnergyBurned(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err: string, results: HealthValue[]) => {
          if (err) {
            console.warn('[HealthKit] getActiveEnergyBurned error:', err);
            resolve(0);
          } else {
            const total = results.reduce((sum, item) => sum + (item.value || 0), 0);
            resolve(Math.round(total));
          }
        }
      );
    });
  }

  async getWeightHistory(days: number = 30): Promise<{ date: string; weight: number }[]> {
    if (!this.isAvailable || Platform.OS !== 'ios') return [];

    return new Promise((resolve) => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - days);

      AppleHealthKit.getWeightSamples(
        { startDate: start.toISOString(), endDate: end.toISOString() },
        (err: string, results: HealthValue[]) => {
          if (err) {
            console.warn('[HealthKit] getWeightSamples error:', err);
            resolve([]);
          } else {
            const samples = results.map((item) => ({
              date: item.startDate.split('T')[0],
              weight: Math.round(item.value * 10) / 10,
            }));
            resolve(samples);
          }
        }
      );
    });
  }

  async getLatestWeight(): Promise<number | null> {
    const history = await this.getWeightHistory(7);
    if (history.length === 0) return null;
    return history[history.length - 1].weight;
  }

  async saveWeight(weightKg: number, date: Date = new Date()): Promise<void> {
    if (!this.isAvailable || Platform.OS !== 'ios') return;

    return new Promise((resolve, reject) => {
      AppleHealthKit.saveWeight(
        { value: weightKg, startDate: date.toISOString() },
        (err: string) => {
          if (err) {
            console.warn('[HealthKit] saveWeight error:', err);
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }
}

export const healthKitService = HealthKitService.getInstance();

import { useEffect, useState, useCallback } from 'react';
import { Linking } from 'react-native';
import { whoopService } from '@/src/services/whoopService';
import { pedometerService } from '@/src/services/pedometerService';
import { forgeNotificationService } from '@/src/services/forgeNotificationService';
import { db } from '@/src/services/database';
import { bodyMetrics } from '../../drizzle/schema';
import { desc } from 'drizzle-orm';
import { biometricAuthService } from '@/src/services/biometricAuthService';
import type { WhoopDaily } from '../../drizzle/schema';
import { dateString } from '@/src/utils/date';

/**
 * All data-fetching and business logic for the Forge screen: WHOOP
 * connection/metrics, step count, weight history, and the biometric lock
 * gate. Screen-only UI state (the weight-entry modal's visibility) stays in
 * the screen component.
 */
export function useForgeData() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WhoopDaily | null>(null);
  const [steps, setSteps] = useState(0);
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgeLocked, setForgeLocked] = useState(true);
  const [authenticating, setAuthenticating] = useState(false);

  const refreshAll = useCallback(async () => {
    setError(null);
    try {
      const connected = await whoopService.isConnected();
      setIsConnected(connected);

      if (connected) {
        await whoopService.syncToday();
        const todayMetrics = await whoopService.getTodayMetrics();
        setMetrics(todayMetrics);
      }

      const todaySteps = await pedometerService.getTodaySteps();
      setSteps(todaySteps);

      const weightEntries = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date)).limit(30);
      const history = weightEntries.map((e) => ({
        date: dateString(e.date),
        weight: e.weightKg || 0,
      })).reverse();
      setWeightHistory(history);
      setLatestWeight(history.length > 0 ? history[history.length - 1].weight : null);
    } catch (e) {
      console.error('[Forge] refresh failed:', e);
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkForgeLock = useCallback(async () => {
    const lockEnabled = await biometricAuthService.isForgeLockEnabled();
    if (!lockEnabled) {
      setForgeLocked(false);
      return;
    }
    setAuthenticating(true);
    const success = await biometricAuthService.authenticate('Access Forge');
    setAuthenticating(false);
    setForgeLocked(!success);
  }, []);

  useEffect(() => {
    refreshAll();
    forgeNotificationService.requestPermissions();
    checkForgeLock();
  }, [refreshAll, checkForgeLock]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const authenticate = useCallback(async () => {
    setAuthenticating(true);
    const success = await biometricAuthService.authenticate('Access Forge');
    setAuthenticating(false);
    setForgeLocked(!success);
  }, []);

  const connectWhoop = useCallback(async () => {
    try {
      const authUrl = whoopService.getAuthUrl();
      await Linking.openURL(authUrl);
    } catch {
      setError('Failed to open Whoop login');
    }
  }, []);

  const disconnectWhoop = useCallback(async () => {
    await whoopService.disconnect();
    setIsConnected(false);
    setMetrics(null);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  }, [refreshAll]);

  return {
    isConnected,
    metrics,
    steps,
    weightHistory,
    latestWeight,
    isLoading,
    isConnecting,
    refreshing,
    error,
    forgeLocked,
    authenticating,
    refreshAll,
    authenticate,
    connectWhoop,
    disconnectWhoop,
    onRefresh,
  };
}

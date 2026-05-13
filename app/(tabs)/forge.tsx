import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Flame, Heart, Footprints, Zap, Moon, Dumbbell, Link, LogIn, TrendingDown, Plus, Scale } from 'lucide-react-native';
import { format } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { WeightChart } from '../../src/components/WeightChart';
import { WeightEntryModal } from '../../src/components/WeightEntryModal';
import { whoopService } from '../../src/services/whoopService';
import { pedometerService } from '../../src/services/pedometerService';
import { forgeNotificationService } from '../../src/services/forgeNotificationService';
import { forgeNotionSync } from '../../src/services/forgeNotionSync';
import { db } from '../../src/services/database';
import { bodyMetrics } from '../../drizzle/schema';
import { desc } from 'drizzle-orm';
import { biometricAuthService } from '../../src/services/biometricAuthService';
import type { WhoopDaily } from '../../drizzle/schema';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

export default function ForgeScreen() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState<WhoopDaily | null>(null);
  const [steps, setSteps] = useState(0);
  const [weightHistory, setWeightHistory] = useState<{ date: string; weight: number }[]>([]);
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isWeightModalVisible, setIsWeightModalVisible] = useState(false);
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

      // Weight from DB
      const weightEntries = await db.select().from(bodyMetrics).orderBy(desc(bodyMetrics.date)).limit(30);
      const history = weightEntries.map((e) => ({
        date: e.date.toISOString().split('T')[0],
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

  useEffect(() => {
    refreshAll();
    
    // Request notification permissions
    forgeNotificationService.requestPermissions();
    
    // Check if Forge lock is enabled and authenticate
    checkForgeLock();
  }, [refreshAll]);

  const checkForgeLock = async () => {
    const lockEnabled = await biometricAuthService.isForgeLockEnabled();
    if (!lockEnabled) {
      setForgeLocked(false);
      return;
    }

    setAuthenticating(true);
    const success = await biometricAuthService.authenticate('Access Forge');
    setAuthenticating(false);
    setForgeLocked(!success);
  };

  const handleAuthenticate = async () => {
    setAuthenticating(true);
    const success = await biometricAuthService.authenticate('Access Forge');
    setAuthenticating(false);
    setForgeLocked(!success);
  };

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const url = event.url;
      if (url.includes('whoop/callback')) {
        const params = new URLSearchParams(url.split('?')[1]);
        const code = params.get('code');
        if (code) {
          setIsConnecting(true);
          whoopService.handleCallback(code).then(() => {
            refreshAll();
          }).catch((e) => {
            setError(e.message);
          }).finally(() => {
            setIsConnecting(false);
          });
        }
      }
    };

    Linking.addEventListener('url', handleDeepLink);
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });
  }, [refreshAll]);

  const handleConnectWhoop = async () => {
    try {
      const authUrl = whoopService.getAuthUrl();
      await Linking.openURL(authUrl);
    } catch (e) {
      setError('Failed to open Whoop login');
    }
  };

  const handleDisconnectWhoop = async () => {
    await whoopService.disconnect();
    setIsConnected(false);
    setMetrics(null);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshAll();
    setRefreshing(false);
  };

  const kjToKcal = (kj: number) => Math.round(kj / 4.184);

  if (isLoading || authenticating) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={OrialColors.violetLight} />
        </View>
      </SafeAreaView>
    );
  }

  if (forgeLocked) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.lockScreen}>
          <View style={styles.lockIcon}>
            <Flame size={48} color={OrialColors.textMuted} />
          </View>
          <Text style={OrialTypography.headingMedium}>Forge Locked</Text>
          <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted, marginTop: 8, textAlign: 'center' }]}>
            Authenticate with Face ID or Touch ID to access your body metrics
          </Text>
          <Pressable style={styles.unlockButton} onPress={handleAuthenticate}>
            <Text style={styles.unlockButtonText}>Unlock Forge</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OrialColors.violetLight} />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Flame size={28} color={OrialColors.cyan} />
            <Text style={OrialTypography.headingLarge}>Forge</Text>
          </View>
          <Text style={[OrialTypography.bodySmall, { color: OrialColors.textMuted }]}>
            {format(new Date(), 'EEEE, MMM d')}
          </Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>{error}</Text>
          </View>
        )}

        {!isConnected ? (
          <GlassCard style={styles.card}>
            <View style={styles.connectRow}>
              <View style={styles.connectInfo}>
                <Text style={OrialTypography.headingSmall}>Connect Whoop</Text>
                <Text style={[OrialTypography.bodySmall, { color: OrialColors.textSecondary, marginTop: 4 }]}>
                  Link your Whoop to see recovery, strain, sleep and calories
                </Text>
              </View>
              <Pressable
                style={[styles.connectButton, isConnecting && styles.buttonDisabled]}
                onPress={handleConnectWhoop}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Link size={18} color="#FFF" />
                    <Text style={styles.connectButtonText}>Connect</Text>
                  </>
                )}
              </Pressable>
            </View>
          </GlassCard>
        ) : (
          <View style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>Whoop connected</Text>
            <Pressable onPress={handleDisconnectWhoop} style={styles.disconnectBtn}>
              <LogIn size={12} color={OrialColors.textMuted} style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginLeft: 4 }]}>Disconnect</Text>
            </Pressable>
          </View>
        )}

        {metrics && (
          <>
            <View style={styles.metricsGrid}>
              <GlassCard style={styles.metricCard}>
                <Heart size={20} color={OrialColors.error} />
                <Text style={styles.metricValue}>
                  {metrics.recoveryScore !== null ? `${metrics.recoveryScore}%` : '--'}
                </Text>
                <Text style={styles.metricLabel}>Recovery</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <Zap size={20} color={OrialColors.warning} />
                <Text style={styles.metricValue}>
                  {metrics.strain !== null ? metrics.strain.toFixed(1) : '--'}
                </Text>
                <Text style={styles.metricLabel}>Strain</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <Flame size={20} color={OrialColors.cyan} />
                <Text style={styles.metricValue}>
                  {metrics.kilojoule !== null ? `${kjToKcal(metrics.kilojoule)}` : '--'}
                </Text>
                <Text style={styles.metricLabel}>Cal Burned</Text>
              </GlassCard>

              <GlassCard style={styles.metricCard}>
                <Footprints size={20} color={OrialColors.violetLight} />
                <Text style={styles.metricValue}>
                  {steps.toLocaleString()}
                </Text>
                <Text style={styles.metricLabel}>Steps</Text>
              </GlassCard>
            </View>

            <View style={styles.row}>
              <GlassCard style={styles.halfCardFlex}>
                <Text style={styles.subLabel}>HRV</Text>
                <Text style={styles.subValue}>
                  {metrics.hrvRmssdMilli !== null ? `${Math.round(metrics.hrvRmssdMilli)} ms` : '--'}
                </Text>
              </GlassCard>
              <View style={{ width: 8 }} />
              <GlassCard style={styles.halfCardFlex}>
                <Text style={styles.subLabel}>Resting HR</Text>
                <Text style={styles.subValue}>
                  {metrics.restingHeartRate !== null ? `${metrics.restingHeartRate} bpm` : '--'}
                </Text>
              </GlassCard>
            </View>

            {metrics.sleepDurationMilli && (
              <GlassCard style={styles.card}>
                <View style={styles.sectionHeader}>
                  <Moon size={20} color={OrialColors.violetLight} />
                  <Text style={[OrialTypography.headingSmall, { marginLeft: 8 }]}>Last Night</Text>
                </View>
                <View style={styles.sleepRow}>
                  <View style={styles.sleepStat}>
                    <Text style={styles.subValue}>
                      {Math.round(metrics.sleepDurationMilli / 3600000 * 10) / 10}h
                    </Text>
                    <Text style={styles.subLabel}>Duration</Text>
                  </View>
                  <View style={styles.sleepStat}>
                    <Text style={styles.subValue}>
                      {metrics.sleepPerformance !== null ? `${metrics.sleepPerformance}%` : '--'}
                    </Text>
                    <Text style={styles.subLabel}>Performance</Text>
                  </View>
                  <View style={styles.sleepStat}>
                    <Text style={styles.subValue}>
                      {metrics.respiratoryRate !== null ? `${metrics.respiratoryRate.toFixed(1)}` : '--'}
                    </Text>
                    <Text style={styles.subLabel}>Resp. Rate</Text>
                  </View>
                </View>
              </GlassCard>
            )}

            {/* Weight Section */}
            <GlassCard style={styles.card}>
              <View style={styles.weightHeader}>
                <View style={styles.sectionHeader}>
                  <Scale size={20} color={OrialColors.success} />
                  <Text style={[OrialTypography.headingSmall, { marginLeft: 8 }]}>Weight</Text>
                </View>
                <Pressable style={styles.addWeightBtn} onPress={() => setIsWeightModalVisible(true)}>
                  <Plus size={16} color={OrialColors.violetLight} />
                </Pressable>
              </View>

              {latestWeight ? (
                <>
                  <Text style={[OrialTypography.headingLarge, { marginTop: 8 }]}>
                    {latestWeight.toFixed(1)} kg
                  </Text>
                  {weightHistory.length > 1 && (
                    <View style={styles.weightTrend}>
                      <TrendingDown size={14} color={OrialColors.success} />
                      <Text style={[OrialTypography.caption, { color: OrialColors.success, marginLeft: 4 }]}>
                        {(weightHistory[weightHistory.length - 1].weight - weightHistory[0].weight).toFixed(1)} kg change
                      </Text>
                    </View>
                  )}
                  <WeightChart data={weightHistory} />
                </>
              ) : (
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted, marginTop: 12 }]}>
                  No weight entries yet. Tap + to add your first.
                </Text>
              )}
            </GlassCard>
          </>
        )}

        {isConnected && !metrics && (
          <GlassCard style={styles.card}>
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Dumbbell size={32} color={OrialColors.textMuted} />
              <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted, marginTop: 12, textAlign: 'center' }]}>
                Whoop data will appear here after your next sync
              </Text>
            </View>
          </GlassCard>
        )}

        {!isConnected && (
          <>
            <GlassCard style={styles.cardCentered}>
              <Heart size={40} color={OrialColors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted, marginTop: 16, textAlign: 'center' }]}>
                Connect your Whoop to unlock your full body metrics
              </Text>
            </GlassCard>

            <GlassCard style={styles.card}>
              <View style={styles.sectionHeader}>
                <Footprints size={20} color={OrialColors.violetLight} />
                <Text style={[OrialTypography.headingSmall, { marginLeft: 8 }]}>Today's Steps</Text>
              </View>
              <Text style={[OrialTypography.headingLarge, { color: OrialColors.textPrimary, marginTop: 12 }]}>
                {steps.toLocaleString()}
              </Text>
              <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginTop: 4 }]}>
                via iPhone
              </Text>
            </GlassCard>
          </>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      <WeightEntryModal
        visible={isWeightModalVisible}
        onClose={() => setIsWeightModalVisible(false)}
        onSave={refreshAll}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lockScreen: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  unlockButton: {
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 24,
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 20,
    marginTop: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorBanner: {
    backgroundColor: OrialColors.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  card: {
    marginBottom: 12,
    padding: 16,
  },
  cardCentered: {
    marginBottom: 12,
    padding: 16,
    alignItems: 'center',
    paddingVertical: 32,
  },
  connectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectInfo: {
    flex: 1,
    marginRight: 12,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  connectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: OrialColors.success,
    marginRight: 6,
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    padding: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  metricCard: {
    width: '47.5%',
    flexGrow: 1,
    maxWidth: '48%',
    padding: 14,
    alignItems: 'center',
  },
  metricValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 28,
    color: OrialColors.textPrimary,
    marginTop: 8,
  },
  metricLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 12,
    color: OrialColors.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  halfCard: {
    padding: 14,
    alignItems: 'center',
  },
  halfCardFlex: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  subLabel: {
    fontFamily: 'Inter-Medium',
    fontSize: 11,
    color: OrialColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subValue: {
    fontFamily: 'Inter-Bold',
    fontSize: 22,
    color: OrialColors.textPrimary,
    marginTop: 6,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 16,
  },
  sleepStat: {
    alignItems: 'center',
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginTop: 16,
  },
  calorieStat: {
    alignItems: 'center',
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addWeightBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  weightTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
});

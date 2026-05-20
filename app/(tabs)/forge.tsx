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
    forgeNotificationService.requestPermissions();
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
    refreshAll();
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
          <View style={styles.lockIconWrap}>
            <Flame size={40} color={OrialColors.textMuted} />
          </View>
          <Text style={styles.lockTitle}>Forge Locked</Text>
          <Text style={styles.lockBody}>
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
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Flame size={24} color={OrialColors.cyan} />
            <Text style={styles.headerTitle}>Forge</Text>
          </View>
          <Text style={styles.headerDate}>{format(new Date(), 'EEE, MMM d').toUpperCase()}</Text>
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* WHOOP connect CTA — prominent when not connected */}
        {!isConnected && (
          <View style={styles.connectCtaWrap}>
            <GlassCard style={styles.connectCta}>
              <View style={styles.connectCtaIcon}>
                <Heart size={32} color={OrialColors.textMuted} />
              </View>
              <Text style={styles.connectCtaTitle}>Connect WHOOP</Text>
              <Text style={styles.connectCtaBody}>
                Link your WHOOP to see recovery, strain, sleep and HRV in real time.
              </Text>
              <Pressable
                style={[styles.connectCtaBtn, isConnecting && { opacity: 0.5 }]}
                onPress={handleConnectWhoop}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Link size={16} color="#FFF" />
                    <Text style={styles.connectCtaBtnText}>Connect WHOOP</Text>
                  </>
                )}
              </Pressable>
            </GlassCard>
          </View>
        )}

        {/* Connected badge */}
        {isConnected && (
          <View style={styles.connectedBadge}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText}>WHOOP connected</Text>
            <Pressable onPress={handleDisconnectWhoop} style={styles.disconnectBtn}>
              <LogIn size={11} color={OrialColors.textMuted} style={{ transform: [{ scaleX: -1 }] }} />
              <Text style={styles.disconnectText}>Disconnect</Text>
            </Pressable>
          </View>
        )}

        {/* WHOOP metrics — horizontal stat strip */}
        {metrics && (
          <>
            <View style={styles.sectionLabel}>
              <Text style={styles.sectionLabelText}>BODY METRICS</Text>
            </View>
            <GlassCard style={styles.statStrip}>
              <ForgeStatItem
                icon={<Heart size={13} color={OrialColors.error} />}
                value={metrics.recoveryScore !== null ? `${metrics.recoveryScore}%` : '--'}
                label="RECOVERY"
                borderRight
              />
              <ForgeStatItem
                icon={<Zap size={13} color={OrialColors.warning} />}
                value={metrics.strain !== null ? metrics.strain.toFixed(1) : '--'}
                label="STRAIN"
                borderRight
              />
              <ForgeStatItem
                icon={<Flame size={13} color={OrialColors.cyan} />}
                value={metrics.kilojoule !== null ? `${kjToKcal(metrics.kilojoule)}` : '--'}
                label="KCAL"
                borderRight
              />
              <ForgeStatItem
                icon={<Footprints size={13} color={OrialColors.violetLight} />}
                value={steps.toLocaleString()}
                label="STEPS"
              />
            </GlassCard>

            {/* HRV + RHR row */}
            <View style={styles.subRow}>
              <GlassCard style={[styles.subCard, { marginRight: 6 }]}>
                <Text style={styles.subCardLabel}>HRV</Text>
                <Text style={styles.subCardValue}>
                  {metrics.hrvRmssdMilli !== null ? `${Math.round(metrics.hrvRmssdMilli)} ms` : '--'}
                </Text>
              </GlassCard>
              <GlassCard style={[styles.subCard, { marginLeft: 6 }]}>
                <Text style={styles.subCardLabel}>RESTING HR</Text>
                <Text style={styles.subCardValue}>
                  {metrics.restingHeartRate !== null ? `${metrics.restingHeartRate} bpm` : '--'}
                </Text>
              </GlassCard>
            </View>

            {/* Sleep */}
            {metrics.sleepDurationMilli && (
              <GlassCard style={styles.sleepCard}>
                <View style={styles.sleepHeader}>
                  <Moon size={16} color={OrialColors.violetLight} />
                  <Text style={styles.sleepTitle}>Last Night</Text>
                </View>
                <View style={styles.sleepRow}>
                  <View style={styles.sleepStat}>
                    <Text style={styles.sleepValue}>
                      {Math.round(metrics.sleepDurationMilli / 3600000 * 10) / 10}h
                    </Text>
                    <Text style={styles.sleepLabel}>DURATION</Text>
                  </View>
                  <View style={styles.sleepDivider} />
                  <View style={styles.sleepStat}>
                    <Text style={styles.sleepValue}>
                      {metrics.sleepPerformance !== null ? `${metrics.sleepPerformance}%` : '--'}
                    </Text>
                    <Text style={styles.sleepLabel}>PERFORMANCE</Text>
                  </View>
                  <View style={styles.sleepDivider} />
                  <View style={styles.sleepStat}>
                    <Text style={styles.sleepValue}>
                      {metrics.respiratoryRate !== null ? metrics.respiratoryRate.toFixed(1) : '--'}
                    </Text>
                    <Text style={styles.sleepLabel}>RESP RATE</Text>
                  </View>
                </View>
              </GlassCard>
            )}

            {/* Weight section */}
            <GlassCard style={styles.weightCard}>
              <View style={styles.weightHeader}>
                <View style={styles.weightHeaderLeft}>
                  <Scale size={16} color={OrialColors.success} />
                  <Text style={styles.weightTitle}>Weight</Text>
                </View>
                <Pressable style={styles.addWeightBtn} onPress={() => setIsWeightModalVisible(true)}>
                  <Plus size={15} color={OrialColors.violetLight} />
                </Pressable>
              </View>

              {latestWeight ? (
                <>
                  <Text style={styles.weightValue}>{latestWeight.toFixed(1)} kg</Text>
                  {weightHistory.length > 1 && (
                    <View style={styles.weightTrend}>
                      <TrendingDown size={13} color={OrialColors.success} />
                      <Text style={styles.weightTrendText}>
                        {(weightHistory[weightHistory.length - 1].weight - weightHistory[0].weight).toFixed(1)} kg change (30d)
                      </Text>
                    </View>
                  )}
                  <View style={styles.chartWrap}>
                    <WeightChart data={weightHistory} />
                  </View>
                </>
              ) : (
                <View style={styles.weightEmpty}>
                  <Text style={styles.weightEmptyText}>No entries yet. Tap + to log your weight.</Text>
                </View>
              )}
            </GlassCard>
          </>
        )}

        {/* Connected but no metrics yet */}
        {isConnected && !metrics && (
          <GlassCard style={styles.noMetricsCard}>
            <Dumbbell size={28} color={OrialColors.textMuted} />
            <Text style={styles.noMetricsText}>
              WHOOP data will appear here after your next sync
            </Text>
          </GlassCard>
        )}

        {/* Not connected — steps still available */}
        {!isConnected && (
          <GlassCard style={styles.stepsCard}>
            <View style={styles.stepsHeader}>
              <Footprints size={16} color={OrialColors.violetLight} />
              <Text style={styles.stepsTitle}>Today's Steps</Text>
            </View>
            <Text style={styles.stepsValue}>{steps.toLocaleString()}</Text>
            <Text style={styles.stepsSource}>via iPhone</Text>
          </GlassCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <WeightEntryModal
        visible={isWeightModalVisible}
        onClose={() => setIsWeightModalVisible(false)}
        onSave={refreshAll}
      />
    </SafeAreaView>
  );
}

function ForgeStatItem({
  icon, value, label, borderRight,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  borderRight?: boolean;
}) {
  return (
    <View style={[forgeStatStyles.item, borderRight && forgeStatStyles.borderRight]}>
      <View style={forgeStatStyles.iconRow}>{icon}</View>
      <Text style={forgeStatStyles.value}>{value}</Text>
      <Text style={forgeStatStyles.label}>{label}</Text>
    </View>
  );
}

const forgeStatStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  borderRight: {
    borderRightWidth: 1,
    borderRightColor: OrialColors.glassBorder,
  },
  iconRow: {
    marginBottom: 6,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: 'Inter-Bold',
  },
  label: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: OrialColors.textMuted,
    marginTop: 3,
    fontFamily: 'Inter-Medium',
  },
});

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
  lockIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-Bold',
    marginBottom: 10,
  },
  lockBody: {
    fontSize: 14,
    color: OrialColors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  unlockButton: {
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 10,
    marginTop: 28,
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
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
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: 'Inter-Bold',
  },
  headerDate: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  errorBanner: {
    backgroundColor: OrialColors.error + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: OrialColors.error + '30',
  },
  errorText: {
    color: OrialColors.error,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
  },
  // Connect CTA
  connectCtaWrap: {
    marginBottom: 16,
  },
  connectCta: {
    padding: 28,
    alignItems: 'center',
  },
  connectCtaIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectCtaTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  connectCtaBody: {
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    marginBottom: 20,
    maxWidth: 260,
  },
  connectCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  connectCtaBtnText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  connectedDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: OrialColors.success,
    marginRight: 6,
  },
  connectedText: {
    fontSize: 12,
    color: OrialColors.success,
    fontFamily: 'Inter-Medium',
  },
  disconnectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
    padding: 4,
  },
  disconnectText: {
    fontSize: 11,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
  },
  sectionLabel: {
    marginBottom: 10,
  },
  sectionLabelText: {
    fontSize: 10,
    letterSpacing: 1.4,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  // Stat strip
  statStrip: {
    padding: 0,
    flexDirection: 'row',
    marginBottom: 10,
  },
  subRow: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  subCard: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
  },
  subCardLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
    marginBottom: 6,
  },
  subCardValue: {
    fontSize: 22,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.5,
  },
  // Sleep
  sleepCard: {
    marginBottom: 10,
    padding: 16,
  },
  sleepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sleepTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  sleepRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sleepStat: {
    flex: 1,
    alignItems: 'center',
  },
  sleepDivider: {
    width: 1,
    height: 32,
    backgroundColor: OrialColors.glassBorder,
  },
  sleepValue: {
    fontSize: 22,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.5,
  },
  sleepLabel: {
    fontSize: 9,
    letterSpacing: 1.2,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
    marginTop: 4,
  },
  // Weight
  weightCard: {
    marginBottom: 10,
    padding: 16,
  },
  weightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  weightHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  weightTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  addWeightBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: OrialColors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  weightValue: {
    fontSize: 40,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -1,
    fontFamily: 'Inter-Bold',
  },
  weightTrend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
    marginBottom: 14,
  },
  weightTrendText: {
    fontSize: 12,
    color: OrialColors.success,
    fontFamily: 'Inter-Regular',
  },
  chartWrap: {
    marginTop: 8,
  },
  weightEmpty: {
    paddingVertical: 16,
  },
  weightEmptyText: {
    fontSize: 13,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
  },
  // No metrics placeholder
  noMetricsCard: {
    marginBottom: 12,
    padding: 28,
    alignItems: 'center',
    gap: 12,
  },
  noMetricsText: {
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  // Steps standalone
  stepsCard: {
    marginBottom: 12,
    padding: 16,
  },
  stepsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  stepsTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: OrialColors.textPrimary,
    fontFamily: 'Inter-SemiBold',
  },
  stepsValue: {
    fontSize: 36,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -1,
    fontFamily: 'Inter-Bold',
  },
  stepsSource: {
    fontSize: 11,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
    marginTop: 4,
  },
});

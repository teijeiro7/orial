import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, Moon, Flame } from 'lucide-react-native';
import { insightService, type WhoopDailySummary } from '@/src/services/insightService';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

function formatSleep(milli: number | null): string {
  if (!milli) return '—';
  const hours = Math.floor(milli / 3_600_000);
  const minutes = Math.round((milli % 3_600_000) / 60_000);
  return `${hours}h${minutes > 0 ? `${minutes}m` : ''}`;
}

function recoveryColor(score: number | null): string {
  if (score === null) return OrialColors.textMuted;
  if (score >= 67) return OrialColors.success;
  if (score >= 34) return OrialColors.warning;
  return OrialColors.error;
}

export function DailyDigest() {
  const [data, setData] = useState<WhoopDailySummary | null>(null);

  useEffect(() => {
    (async () => {
      const summary = await insightService.getDailyDigest();
      if (summary) setData(summary);
    })();
  }, []);

  if (!data) return null;

  return (
    <GlassCard style={styles.card} accentColor={OrialColors.violet}>
      <Text style={[OrialTypography.headingSmall, styles.heading]}>Resumen del día</Text>
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Activity size={16} color={recoveryColor(data.recovery)} />
          <Text style={styles.metricValue}>{data.recovery !== null ? `${data.recovery}%` : '—'}</Text>
          <Text style={styles.metricLabel}>Recuperación</Text>
        </View>
        <View style={styles.metric}>
          <Moon size={16} color={OrialColors.violetLight} />
          <Text style={styles.metricValue}>{formatSleep(data.sleep)}</Text>
          <Text style={styles.metricLabel}>Sueño</Text>
        </View>
        <View style={styles.metric}>
          <Flame size={16} color={OrialColors.warning} />
          <Text style={styles.metricValue}>{data.strain !== null ? data.strain.toFixed(1) : '—'}</Text>
          <Text style={styles.metricLabel}>Strain</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
  heading: {
    marginBottom: 12,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metric: {
    alignItems: 'center',
    gap: 4,
  },
  metricValue: {
    ...OrialTypography.bodyLarge,
    color: OrialColors.textPrimary,
  },
  metricLabel: {
    ...OrialTypography.caption,
    color: OrialColors.textMuted,
  },
});

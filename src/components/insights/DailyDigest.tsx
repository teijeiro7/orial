import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { eq } from 'drizzle-orm';
import { Activity, Moon, Flame } from 'lucide-react-native';
import { db } from '@/src/services/database';
import { whoopDaily } from '../../../drizzle/schema';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

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
  const [data, setData] = useState<{
    recovery: number | null;
    sleep: number | null;
    strain: number | null;
  } | null>(null);

  useEffect(() => {
    (async () => {
      const today = todayString();
      const rows = await db
        .select({
          recovery: whoopDaily.recoveryScore,
          sleep: whoopDaily.sleepDurationMilli,
          strain: whoopDaily.strain,
        })
        .from(whoopDaily)
        .where(eq(whoopDaily.date, today))
        .limit(1);
      const row = rows[0];
      if (row) {
        setData({ recovery: row.recovery, sleep: row.sleep, strain: row.strain });
      }
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

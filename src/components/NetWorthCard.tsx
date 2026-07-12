import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Lightbulb, Wallet, TrendingUp, TrendingDown } from 'lucide-react-native';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';

interface NetWorthCardProps {
  balance: number;
  /** Omit when there's no real historical net-worth data to diff against — the pill is hidden rather than showing a fake "+0.0%". */
  changePct?: number;
  currency?: string;
}

const DEFAULT_CURRENCY = 'EUR';

function formatBalance(balance: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(balance);
}

function formatChangePct(changePct: number): string {
  const sign = changePct >= 0 ? '+' : '';
  return `${sign}${changePct.toFixed(1)}%`;
}

export function NetWorthCard({ balance, changePct, currency = DEFAULT_CURRENCY }: NetWorthCardProps) {
  const hasTrend = changePct !== undefined;
  const isPositive = hasTrend && changePct >= 0;
  const changeColor = isPositive ? OrialColors.success : OrialColors.error;
  const TrendIcon = isPositive ? TrendingUp : TrendingDown;

  return (
    <View style={styles.wrap}>
      <LinearGradient
        colors={['#17102e', '#0f1428', OrialColors.deepNavy]}
        locations={[0, 0.55, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 1 }}
        style={styles.card}
      >
        <LinearGradient
          colors={[`${OrialColors.violet}61`, `${OrialColors.violet}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.75, y: 0.85 }}
          style={styles.glow}
          pointerEvents="none"
        />
        <View style={styles.brandRow}>
          <View style={styles.brandLeft}>
            <Lightbulb size={14} color={OrialColors.violetLight} />
            <Text style={styles.brand}>ORIAL</Text>
          </View>
          <Wallet size={18} color={OrialColors.textMuted} />
        </View>
        <Text style={styles.kicker}>NET WORTH</Text>
        <Text style={styles.balance} numberOfLines={1} testID="net-worth-balance">
          {formatBalance(balance, currency)}
        </Text>
        {hasTrend && (
          <View style={[styles.changePill, { backgroundColor: `${changeColor}2E` }]}>
            <TrendIcon size={13} color={changeColor} />
            <Text style={[styles.changeText, { color: changeColor }]} testID="net-worth-change">
              {formatChangePct(changePct)}
            </Text>
          </View>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 10,
  },
  card: {
    borderRadius: 26,
    padding: 22,
    paddingVertical: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  glow: {
    position: 'absolute',
    top: -40,
    left: -30,
    width: '150%',
    height: '160%',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  brand: {
    ...OrialTypography.caption,
    color: OrialColors.textSecondary,
    letterSpacing: 2.5,
    fontWeight: '700',
  },
  kicker: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: OrialColors.textMuted,
    textTransform: 'uppercase',
    fontWeight: '600',
    marginTop: 22,
    marginBottom: 6,
  },
  balance: {
    ...OrialTypography.displayLarge,
    marginBottom: 10,
  },
  changePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

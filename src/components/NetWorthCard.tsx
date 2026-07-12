import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';

interface NetWorthCardProps {
  balance: number;
  changePct: number;
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
  const isPositive = changePct >= 0;
  const changeColor = isPositive ? OrialColors.success : OrialColors.error;

  return (
    <LinearGradient
      colors={[OrialColors.surfaceElevated, OrialColors.surface]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.brand}>ORIAL</Text>
      <Text style={styles.balance} numberOfLines={1} testID="net-worth-balance">
        {formatBalance(balance, currency)}
      </Text>
      <View style={[styles.changePill, { backgroundColor: `${changeColor}2E` }]}>
        <Text style={[styles.changeText, { color: changeColor }]} testID="net-worth-change">
          {formatChangePct(changePct)}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    paddingVertical: 18,
  },
  brand: {
    ...OrialTypography.caption,
    color: OrialColors.violetLight,
    letterSpacing: 2,
    marginBottom: 12,
  },
  balance: {
    ...OrialTypography.displayLarge,
    marginBottom: 10,
  },
  changePill: {
    alignSelf: 'flex-start',
    borderRadius: 20,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
});

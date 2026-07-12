import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { AlertTriangle, TrendingUp, CreditCard, Bitcoin } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { getOnePercentRule } from '../services/financeService';
import type {
  NetWorthSummary,
  SubscriptionAlert,
  WishlistProgressItem,
} from '../services/financeService';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';

interface OnePercentRuleProps {
  netWorth: NetWorthSummary;
  subscriptionAlerts: SubscriptionAlert[];
  wishlistProgress: WishlistProgressItem[];
}

function formatCurrency(amount: number): string {
  return `EUR ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function alertColor(days: number): string {
  if (days <= 3) return OrialColors.error;
  if (days <= 7) return OrialColors.warning;
  return OrialColors.textMuted;
}

export function OnePercentRule({ netWorth, subscriptionAlerts, wishlistProgress }: OnePercentRuleProps) {
  const [purchaseInput, setPurchaseInput] = useState('');

  const purchaseCheck = useMemo(() => {
    const amount = parseFloat(purchaseInput);
    if (!purchaseInput || Number.isNaN(amount)) return null;
    return getOnePercentRule(netWorth.total, amount);
  }, [purchaseInput, netWorth.total]);

  const onePercentValue = netWorth.total * 0.01;

  return (
    <GlassCard style={styles.card}>
      {/* ── Net worth summary ─────────────────────────────────────────── */}
      <Text style={[OrialTypography.caption, styles.sectionLabel]}>NET WORTH BREAKDOWN</Text>
      <Text style={styles.netWorthAmount}>{formatCurrency(netWorth.total)}</Text>
      <View style={styles.breakdownRow}>
        <View style={styles.breakdownRowItem}>
          <CreditCard size={13} color={OrialColors.textMuted} />
          <Text style={styles.breakdownItem}>Accounts: {formatCurrency(netWorth.accounts)}</Text>
        </View>
        <View style={styles.breakdownRowItem}>
          <TrendingUp size={13} color={OrialColors.textMuted} />
          <Text style={styles.breakdownItem}>Investments: {formatCurrency(netWorth.stocks)}</Text>
        </View>
        <View style={styles.breakdownRowItem}>
          <Bitcoin size={13} color={OrialColors.textMuted} />
          <Text style={styles.breakdownItem}>Crypto: {formatCurrency(netWorth.crypto)}</Text>
        </View>
      </View>

      {/* ── Upcoming subscription alerts ──────────────────────────────── */}
      {subscriptionAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={[OrialTypography.caption, styles.sectionLabel]}>UPCOMING CHARGES</Text>
          {subscriptionAlerts.map((alert) => (
            <View key={alert.subscriptionId} style={styles.row}>
              <Text style={styles.rowLabel}>{alert.name}</Text>
              <Text style={[styles.rowValue, { color: alertColor(alert.daysUntilBilling) }]}>
                {alert.daysUntilBilling <= 0 ? 'today' : `${alert.daysUntilBilling}d`} ({formatCurrency(alert.amount)})
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── 1% rule quick check ───────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={[OrialTypography.caption, styles.sectionLabel]}>1% RULE</Text>
        <Text style={styles.helperText}>
          1% of your net worth = {formatCurrency(onePercentValue)}
        </Text>
        <TextInput
          style={styles.input}
          placeholder="How much does the thing you want cost?"
          placeholderTextColor={OrialColors.textMuted}
          keyboardType="numeric"
          value={purchaseInput}
          onChangeText={setPurchaseInput}
        />
        {purchaseCheck && (
          <View style={styles.row}>
            {purchaseCheck.isWithinBudget ? (
              <TrendingUp size={16} color={OrialColors.success} />
            ) : (
              <AlertTriangle size={16} color={OrialColors.warning} />
            )}
            <Text
              style={[
                styles.purchaseMessage,
                { color: purchaseCheck.isWithinBudget ? OrialColors.success : OrialColors.warning },
              ]}
            >
              {purchaseCheck.message}
            </Text>
          </View>
        )}
      </View>

      {/* ── Wishlist progress ──────────────────────────────────────────── */}
      {wishlistProgress.length > 0 && (
        <View style={styles.section}>
          <Text style={[OrialTypography.caption, styles.sectionLabel]}>WISHLIST</Text>
          {wishlistProgress.map((item) => (
            <View key={item.id} style={styles.row}>
              <Text style={styles.rowLabel}>{item.name}</Text>
              <Text
                style={[
                  styles.rowValue,
                  { color: item.isWithinBudget ? OrialColors.success : OrialColors.error },
                ]}
              >
                {formatCurrency(item.price)} → {item.percentage.toFixed(1)}%
              </Text>
            </View>
          ))}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginBottom: 8, padding: 16 },
  sectionLabel: {
    color: OrialColors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  netWorthAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  breakdownRow: { gap: 6, marginBottom: 4 },
  breakdownRowItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakdownItem: { ...OrialTypography.caption, color: OrialColors.textSecondary },
  section: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: OrialColors.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 8,
  },
  rowLabel: { ...OrialTypography.bodyMedium, color: OrialColors.textPrimary, flexShrink: 1 },
  rowValue: { ...OrialTypography.caption, fontWeight: '600' },
  helperText: { ...OrialTypography.caption, color: OrialColors.textSecondary, marginBottom: 10 },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    padding: 12,
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  purchaseMessage: { ...OrialTypography.caption, flexShrink: 1 },
});

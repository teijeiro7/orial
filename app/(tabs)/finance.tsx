import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  CreditCard,
  ShoppingBag,
  Tv,
  Dumbbell,
  Heart,
  AlertCircle,
  Clock,
  ChevronRight,
  Landmark,
  Bitcoin,
  TrendingUp,
  Home,
  Briefcase,
} from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { BottomSheetModal } from '@/src/components/BottomSheetModal';
import { NetWorthCard } from '@/src/components/NetWorthCard';
import { Donut } from '@/src/components/Donut';
import { SegmentedTabs } from '@/src/components/SegmentedTabs';
import { OnePercentRule } from '@/src/components/OnePercentRule';
import { financeService } from '@/src/services/financeService';
import type { NetWorthSummary, SubscriptionAlert, WishlistProgressItem } from '@/src/services/financeService';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import type { FinanceAccount, FinanceSubscription, FinanceWishlistItem } from '../../drizzle/schema';

type SubTab = 'networth' | 'subscriptions' | 'wishlist';
const SUB_TAB_KEYS: SubTab[] = ['networth', 'subscriptions', 'wishlist'];
const SUB_TAB_LABELS = ['Net Worth', 'Subs', 'Wishlist'];

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank', icon: '🏦' },
  { value: 'crypto', label: 'Crypto', icon: '₿' },
  { value: 'stocks', label: 'Stocks', icon: '📈' },
  { value: 'real_estate', label: 'Real estate', icon: '🏠' },
  { value: 'other', label: 'Other', icon: '💼' },
];

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: '#3B82F6',
  crypto: '#F59E0B',
  stocks: '#10B981',
  real_estate: '#8B5CF6',
  other: '#6B7280',
};

const ACCOUNT_TYPE_ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  crypto: Bitcoin,
  stocks: TrendingUp,
  real_estate: Home,
  other: Briefcase,
};

const SUB_CATEGORIES = ['streaming', 'software', 'fitness', 'other'];

const SUB_CATEGORY_COLORS: Record<string, string> = {
  streaming: OrialColors.categorySocial,
  software: OrialColors.categoryWork,
  fitness: OrialColors.categoryFitness,
  other: OrialColors.categoryOther,
};

const SUB_CATEGORY_ICONS: Record<string, typeof Tv> = {
  streaming: Tv,
  software: CreditCard,
  fitness: Dumbbell,
  other: ShoppingBag,
};

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('networth');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<FinanceSubscription[]>([]);
  const [wishlist, setWishlist] = useState<FinanceWishlistItem[]>([]);
  const [netWorth, setNetWorth] = useState(0);
  const [netWorthSummary, setNetWorthSummary] = useState<NetWorthSummary>({
    total: 0,
    accounts: 0,
    crypto: 0,
    stocks: 0,
  });
  const [subscriptionAlerts, setSubscriptionAlerts] = useState<SubscriptionAlert[]>([]);
  const [wishlistProgress, setWishlistProgress] = useState<WishlistProgressItem[]>([]);

  // Add modals
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showAddWish, setShowAddWish] = useState(false);

  // Account form
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('bank');
  const [accBalance, setAccBalance] = useState('');
  const [accCurrency, setAccCurrency] = useState('EUR');

  // Subscription form
  const [subName, setSubName] = useState('');
  const [subAmount, setSubAmount] = useState('');
  const [subDay, setSubDay] = useState('1');
  const [subCycle, setSubCycle] = useState('monthly');
  const [subCategory, setSubCategory] = useState('other');
  const [subAutoDeduct, setSubAutoDeduct] = useState(false);
  const [subAccountId, setSubAccountId] = useState('');

  // Wishlist form
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishUrl, setWishUrl] = useState('');

  const loadAll = useCallback(async () => {
    const [accs, subs, wish, summary, alerts, wishProgress] = await Promise.all([
      financeService.getAccounts(),
      financeService.getSubscriptions(),
      financeService.getWishlist(),
      financeService.getNetWorth(),
      financeService.getSubscriptionAlert(),
      financeService.getWishlistProgress(),
    ]);
    setAccounts(accs);
    setSubscriptions(subs);
    setWishlist(wish);
    setNetWorth(financeService.getTotalNetWorth(accs));
    setNetWorthSummary(summary);
    setSubscriptionAlerts(alerts);
    setWishlistProgress(wishProgress);
  }, []);

  useEffect(() => {
    loadAll();
    financeService.checkAlerts();
  }, []);

  // ── Account handlers ──────────────────────────────────────────────────────

  async function handleAddAccount() {
    if (!accName.trim() || !accBalance) return;
    await financeService.createAccount({
      name: accName.trim(),
      type: accType,
      balanceAmount: parseFloat(accBalance),
      currency: accCurrency,
      icon: ACCOUNT_TYPES.find((t) => t.value === accType)?.icon ?? '💳',
    });
    setAccName(''); setAccBalance(''); setAccType('bank');
    setShowAddAccount(false);
    loadAll();
  }

  async function handleDeleteAccount(id: string) {
    Alert.alert('Delete account?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await financeService.deleteAccount(id); loadAll(); },
      },
    ]);
  }

  // ── Subscription handlers ─────────────────────────────────────────────────

  async function handleAddSub() {
    if (!subName.trim() || !subAmount) return;
    await financeService.createSubscription({
      name: subName.trim(),
      amount: parseFloat(subAmount),
      billingDay: parseInt(subDay) || 1,
      billingCycle: subCycle,
      category: subCategory,
      autoDeduct: subAutoDeduct,
      accountId: subAccountId || undefined,
    });
    setSubName(''); setSubAmount(''); setSubDay('1'); setSubAccountId('');
    setShowAddSub(false);
    loadAll();
  }

  // ── Wishlist handlers ─────────────────────────────────────────────────────

  async function handleAddWish() {
    if (!wishName.trim() || !wishPrice) return;
    await financeService.createWishlistItem({
      name: wishName.trim(),
      price: parseFloat(wishPrice),
      url: wishUrl || undefined,
    });
    setWishName(''); setWishPrice(''); setWishUrl('');
    setShowAddWish(false);
    loadAll();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function formatCurrency(amount: number, currency = 'EUR') {
    return `${currency} ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  /** Short "18.2K" style value for the donut's center label. */
  function formatCompact(amount: number): string {
    if (Math.abs(amount) >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toFixed(0);
  }

  // ── Pie chart (simple bar representation) ────────────────────────────────
  const accountsByType = ACCOUNT_TYPES.map((t) => {
    const total = accounts
      .filter((a) => a.type === t.value)
      .reduce((sum, a) => sum + a.balanceAmount, 0);
    return { ...t, total, pct: netWorth > 0 ? (total / netWorth) * 100 : 0 };
  }).filter((t) => t.total > 0);

  const nextBill = [...subscriptionAlerts].sort((a, b) => a.daysUntilBilling - b.daysUntilBilling)[0];

  return (
    <SafeAreaView style={styles.container}>
      {/* Sub-tab bar */}
      <View style={styles.tabWrap}>
        <SegmentedTabs
          tabs={SUB_TAB_LABELS}
          activeIndex={SUB_TAB_KEYS.indexOf(activeTab)}
          onChange={(index) => setActiveTab(SUB_TAB_KEYS[index])}
        />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── NET WORTH ──────────────────────────────────────────── */}
        {activeTab === 'networth' && (
          <>
            {/*
              % change isn't tracked anywhere in financeService/schema (no
              historical net-worth snapshots to diff against), so changePct is
              omitted rather than passing a fake 0 — NetWorthCard hides the
              trend pill entirely when it's not given.
            */}
            <View style={styles.netWorthCardWrap}>
              <NetWorthCard balance={netWorth} />
            </View>

            {nextBill && (
              <Pressable style={styles.nextBill} onPress={() => setActiveTab('subscriptions')}>
                <View style={styles.nextBillLabel}>
                  <Clock size={16} color={OrialColors.error} />
                  <Text style={OrialTypography.caption}>
                    {nextBill.name} se cobra {nextBill.daysUntilBilling <= 0 ? 'hoy' : `en ${nextBill.daysUntilBilling}d`}
                  </Text>
                </View>
                <View style={styles.nextBillRight}>
                  <Text style={[OrialTypography.caption, styles.nextBillAmount]}>
                    {formatCurrency(nextBill.amount, nextBill.currency)}
                  </Text>
                  <ChevronRight size={16} color={OrialColors.textMuted} />
                </View>
              </Pressable>
            )}

            {/* Allocation donut, fed the same per-type percentages that drove the old bars */}
            {accountsByType.length > 0 && (
              <GlassCard style={styles.card}>
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>ALLOCATION</Text>
                <View style={styles.donutRow}>
                  <View style={styles.donutWrap}>
                    <Donut
                      size={108}
                      strokeWidth={14}
                      segments={accountsByType.map((t) => ({
                        pct: t.pct,
                        color: ACCOUNT_TYPE_COLORS[t.value],
                      }))}
                    />
                    <View style={styles.donutCenter} pointerEvents="none">
                      <Text style={styles.donutCenterValue}>{formatCompact(netWorth)}</Text>
                      <Text style={styles.donutCenterLabel}>EUR</Text>
                    </View>
                  </View>
                  <View style={styles.legend}>
                    {accountsByType.map((t) => (
                      <View key={t.value} style={styles.legendRow}>
                        <View style={[styles.legendDot, { backgroundColor: ACCOUNT_TYPE_COLORS[t.value] }]} />
                        <Text style={styles.legendLabel}>{t.label}</Text>
                        <Text style={styles.legendPct}>{t.pct.toFixed(1)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </GlassCard>
            )}

            {/* Account list */}
            <View style={styles.header}>
              <Text style={OrialTypography.headingMedium}>Accounts</Text>
              <Pressable style={styles.addButton} onPress={() => setShowAddAccount(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>
            <View style={styles.section}>
              {accounts.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>No accounts. Add one to start.</Text>
                </GlassCard>
              ) : (
                accounts.map((a) => {
                  const AccIcon = ACCOUNT_TYPE_ICONS[a.type] ?? Briefcase;
                  return (
                  <GlassCard key={a.id} style={styles.accountCard}>
                    <View style={styles.accountRow}>
                      <View style={[styles.accountIconCircle, { backgroundColor: ACCOUNT_TYPE_COLORS[a.type] + '2E' }]}>
                        <AccIcon size={17} color={ACCOUNT_TYPE_COLORS[a.type]} />
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={OrialTypography.bodyMedium}>{a.name}</Text>
                        <Text style={[OrialTypography.caption, { color: ACCOUNT_TYPE_COLORS[a.type] }]}>
                          {a.type}
                        </Text>
                      </View>
                      <View style={styles.accountRight}>
                        <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                          {formatCurrency(a.balanceAmount, a.currency)}
                        </Text>
                        <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                          {netWorth > 0 ? ((a.balanceAmount / netWorth) * 100).toFixed(1) : 0}%
                        </Text>
                      </View>
                      <Pressable onPress={() => handleDeleteAccount(a.id)} style={styles.deleteBtn}>
                        <Trash2 size={16} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  </GlassCard>
                  );
                })
              )}
            </View>

            <OnePercentRule
              netWorth={netWorthSummary}
              subscriptionAlerts={subscriptionAlerts}
              wishlistProgress={wishlistProgress}
            />
          </>
        )}

        {/* ── SUBSCRIPTIONS ──────────────────────────────────────── */}
        {activeTab === 'subscriptions' && (
          <>
            <View style={styles.header}>
              <View>
                <Text style={OrialTypography.headingMedium}>Subscriptions</Text>
                <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                  Monthly: {formatCurrency(
                    subscriptions.filter((s) => s.isActive && s.billingCycle === 'monthly')
                      .reduce((sum, s) => sum + s.amount, 0)
                  )}
                </Text>
              </View>
              <Pressable style={styles.addButton} onPress={() => setShowAddSub(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>

            {subscriptions.length === 0 ? (
              <View style={styles.section}>
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>No subscriptions tracked.</Text>
                </GlassCard>
              </View>
            ) : (
              <View style={styles.subGrid}>
                {subscriptions.map((s) => {
                  const days = financeService.daysUntilBilling(s);
                  const badgeColor =
                    days <= 0 ? OrialColors.error : days <= 7 ? OrialColors.warning : OrialColors.textMuted;
                  const badgeLabel = days <= 0 ? 'TODAY' : `${days}D`;
                  const catColor = SUB_CATEGORY_COLORS[s.category] ?? SUB_CATEGORY_COLORS.other;
                  const CatIcon = SUB_CATEGORY_ICONS[s.category] ?? SUB_CATEGORY_ICONS.other;
                  return (
                    <GlassCard key={s.id} style={styles.subTile}>
                      <View style={[styles.subTileBadge, { backgroundColor: badgeColor + '33' }]}>
                        <Text style={[styles.subTileBadgeText, { color: badgeColor }]}>
                          {badgeLabel}
                        </Text>
                      </View>
                      <View style={[styles.subTileIcon, { backgroundColor: catColor + '2E' }]}>
                        <CatIcon size={19} color={catColor} />
                      </View>
                      <Text style={OrialTypography.bodyMedium} numberOfLines={1}>{s.name}</Text>
                      <Text style={[OrialTypography.caption, styles.subTileCycle]}>
                        {s.billingCycle.charAt(0).toUpperCase() + s.billingCycle.slice(1)} · day {s.billingDay}
                      </Text>
                      <Text style={styles.subTilePrice}>{formatCurrency(s.amount, s.currency)}</Text>
                      <Pressable
                        onPress={async () => { await financeService.deleteSubscription(s.id); loadAll(); }}
                        style={styles.subTileDelete}
                      >
                        <Trash2 size={14} color={OrialColors.textMuted} />
                      </Pressable>
                    </GlassCard>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* ── WISHLIST ────────────────────────────────────────────── */}
        {activeTab === 'wishlist' && (
          <>
            <View style={styles.header}>
              <Text style={OrialTypography.headingMedium}>Wishlist</Text>
              <Pressable style={styles.addButton} onPress={() => setShowAddWish(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.section}>
              {wishlist.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>Your wishlist is empty.</Text>
                </GlassCard>
              ) : (
                wishlistProgress.map((w) => {
                  // Affordability uses the same 1%-rule (getOnePercentRule via
                  // getWishlistProgress) as the OnePercentRule widget below, so
                  // this tab and that widget never disagree on the same item.
                  const safe = w.isWithinBudget;
                  return (
                    <GlassCard key={w.id} style={styles.wishCard}>
                      <View style={styles.wishRow}>
                        <Heart
                          size={18}
                          color={w.priority === 1 ? OrialColors.error : OrialColors.textMuted}
                          fill={w.priority === 1 ? OrialColors.error : 'transparent'}
                        />
                        <View style={styles.wishInfo}>
                          <Text style={OrialTypography.bodyMedium}>{w.name}</Text>
                          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                            {formatCurrency(w.price, w.currency)}
                          </Text>
                        </View>
                        <View style={styles.wishRight}>
                          <Text
                            style={[
                              OrialTypography.caption,
                              { color: safe ? OrialColors.success : OrialColors.warning, fontWeight: '700' },
                            ]}
                          >
                            {w.percentage.toFixed(1)}% NW
                          </Text>
                          {!safe && (
                            <AlertCircle size={14} color={OrialColors.warning} />
                          )}
                        </View>
                        <Pressable
                          onPress={async () => { await financeService.deleteWishlistItem(w.id); loadAll(); }}
                          style={styles.deleteBtn}
                        >
                          <Trash2 size={16} color={OrialColors.textMuted} />
                        </Pressable>
                      </View>
                    </GlassCard>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Add Account Modal ─────────────────────────────────────────── */}
      <BottomSheetModal visible={showAddAccount} onClose={() => setShowAddAccount(false)}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Account</Text>
            <TextInput style={styles.input} placeholder="Account name" placeholderTextColor={OrialColors.textMuted} value={accName} onChangeText={setAccName} />
            <TextInput style={styles.input} placeholder="Balance" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={accBalance} onChangeText={setAccBalance} />
            <TextInput style={styles.input} placeholder="Currency (EUR)" placeholderTextColor={OrialColors.textMuted} value={accCurrency} onChangeText={setAccCurrency} autoCapitalize="characters" />
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map((t) => {
                const TypeIcon = ACCOUNT_TYPE_ICONS[t.value] ?? Briefcase;
                return (
                  <Pressable
                    key={t.value}
                    style={[styles.typeChip, accType === t.value && styles.typeChipActive]}
                    onPress={() => setAccType(t.value)}
                  >
                    <TypeIcon size={18} color={accType === t.value ? '#fff' : OrialColors.textMuted} />
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddAccount(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddAccount}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
      </BottomSheetModal>

      {/* ── Add Subscription Modal ────────────────────────────────────── */}
      <BottomSheetModal visible={showAddSub} onClose={() => setShowAddSub(false)}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Subscription</Text>
            <TextInput style={styles.input} placeholder="Service name" placeholderTextColor={OrialColors.textMuted} value={subName} onChangeText={setSubName} />
            <View style={styles.rowInputs}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Amount" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={subAmount} onChangeText={setSubAmount} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Billing day" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={subDay} onChangeText={setSubDay} />
            </View>
            <View style={styles.typeRow}>
              {['monthly', 'yearly'].map((c) => (
                <Pressable key={c} style={[styles.typeChip, subCycle === c && styles.typeChipActive]} onPress={() => setSubCycle(c)}>
                  <Text style={[OrialTypography.caption, { color: subCycle === c ? '#fff' : OrialColors.textMuted }]}>{c}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.typeRow}>
              {SUB_CATEGORIES.map((cat) => (
                <Pressable key={cat} style={[styles.typeChip, subCategory === cat && styles.typeChipActive]} onPress={() => setSubCategory(cat)}>
                  <Text style={[OrialTypography.caption, { color: subCategory === cat ? '#fff' : OrialColors.textMuted }]}>{cat}</Text>
                </Pressable>
              ))}
            </View>
            {accounts.length > 0 && (
              <View>
                <Text style={[OrialTypography.caption, { color: OrialColors.textMuted, marginBottom: 6 }]}>Linked account (for auto-deduct)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <Pressable style={[styles.typeChip, !subAccountId && styles.typeChipActive]} onPress={() => setSubAccountId('')}>
                    <Text style={[OrialTypography.caption, { color: !subAccountId ? '#fff' : OrialColors.textMuted }]}>None</Text>
                  </Pressable>
                  {accounts.map((a) => (
                    <Pressable key={a.id} style={[styles.typeChip, subAccountId === a.id && styles.typeChipActive, { marginRight: 6 }]} onPress={() => setSubAccountId(a.id)}>
                      <Text style={[OrialTypography.caption, { color: subAccountId === a.id ? '#fff' : OrialColors.textMuted }]}>{a.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddSub(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddSub}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
      </BottomSheetModal>

      {/* ── Add Wishlist Modal ─────────────────────────────────────────── */}
      <BottomSheetModal visible={showAddWish} onClose={() => setShowAddWish(false)}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>Add to Wishlist</Text>
            <TextInput style={styles.input} placeholder="Item name" placeholderTextColor={OrialColors.textMuted} value={wishName} onChangeText={setWishName} />
            <TextInput style={styles.input} placeholder="Price" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={wishPrice} onChangeText={setWishPrice} />
            <TextInput style={styles.input} placeholder="URL (optional)" placeholderTextColor={OrialColors.textMuted} value={wishUrl} onChangeText={setWishUrl} autoCapitalize="none" />
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddWish(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddWish}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
      </BottomSheetModal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  tabWrap: { paddingHorizontal: 16, marginTop: 8 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  netWorthCardWrap: { marginHorizontal: 16, marginTop: 8 },
  nextBill: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginHorizontal: 16, marginTop: 10, padding: 13,
    backgroundColor: OrialColors.surface, borderRadius: 14,
  },
  nextBillLabel: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nextBillRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nextBillAmount: { color: OrialColors.error, fontWeight: '600' },
  addButton: { padding: 8, backgroundColor: OrialColors.violet, borderRadius: 12 },
  card: { marginHorizontal: 16, marginTop: 14, marginBottom: 8 },
  sectionLabel: {
    color: OrialColors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 10,
  },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  donutWrap: { alignItems: 'center', justifyContent: 'center' },
  donutCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
  },
  donutCenterValue: { fontSize: 14, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.3 },
  donutCenterLabel: { fontSize: 8, letterSpacing: 1.2, color: OrialColors.textMuted, marginTop: 2 },
  legend: { flex: 1, gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 9, height: 9, borderRadius: 5 },
  legendLabel: { ...OrialTypography.caption, color: OrialColors.textSecondary, flex: 1 },
  legendPct: { ...OrialTypography.caption, color: OrialColors.textPrimary, fontWeight: '600' },
  section: { padding: 16, paddingTop: 0, gap: 8 },
  emptyCard: { alignItems: 'center', padding: 32 },
  emptyText: { color: OrialColors.textMuted, textAlign: 'center' },
  accountCard: { padding: 14 },
  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  accountIconCircle: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  accountInfo: { flex: 1 },
  accountRight: { alignItems: 'flex-end' },
  deleteBtn: { padding: 4 },
  subGrid: {
    flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between',
    paddingHorizontal: 16, gap: 10,
  },
  subTile: { width: '47%', padding: 16, marginBottom: 0 },
  subTileBadge: {
    position: 'absolute', top: 14, right: 14,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
  },
  subTileBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
  subTileIcon: {
    width: 42, height: 42, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 14,
  },
  subTileCycle: { color: OrialColors.textMuted, marginTop: 1 },
  subTilePrice: {
    fontSize: 21, fontWeight: '700', letterSpacing: -0.5,
    color: OrialColors.textPrimary, marginTop: 10,
  },
  subTileDelete: { position: 'absolute', bottom: 14, right: 14, padding: 2 },
  wishCard: { padding: 14 },
  wishRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wishInfo: { flex: 1 },
  wishRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 10, padding: 12,
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    marginBottom: 12,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  rowInputs: { flexDirection: 'row', gap: 10 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, backgroundColor: OrialColors.surface,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  typeChipActive: { backgroundColor: OrialColors.violet, borderColor: OrialColors.violet },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: OrialColors.violet, borderRadius: 10 },
});

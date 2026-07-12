import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  Check,
  Star,
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Heart,
  AlertCircle,
  Package,
} from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { NetWorthCard } from '../../src/components/NetWorthCard';
import { Donut } from '../../src/components/Donut';
import { SegmentedTabs } from '../../src/components/SegmentedTabs';
import { OnePercentRule } from '../../src/components/OnePercentRule';
import { financeService } from '../../src/services/financeService';
import type { NetWorthSummary, SubscriptionAlert, WishlistProgressItem } from '../../src/services/financeService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { FinanceAccount, FinanceSubscription, FinanceOrder, FinanceWishlistItem } from '../../drizzle/schema';

// The mockup collapses the 4-tab bar (Net Worth / Subscriptions / Orders /
// Wishlist) into 3 (Net Worth / Subs / Wishlist). Orders isn't dropped —
// all of its data and actions (add/delete/mark delivered) move into the
// Subs tab as a nested "Orders" sub-section, right below the subscriptions
// list, so nothing that existed before is lost.
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

const SUB_CATEGORIES = ['streaming', 'software', 'fitness', 'other'];

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('networth');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<FinanceSubscription[]>([]);
  const [orders, setOrders] = useState<FinanceOrder[]>([]);
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
  const [showAddOrder, setShowAddOrder] = useState(false);
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

  // Order form
  const [orderName, setOrderName] = useState('');
  const [orderAmount, setOrderAmount] = useState('');
  const [orderAccountId, setOrderAccountId] = useState('');
  const [orderDelivery, setOrderDelivery] = useState('');

  // Wishlist form
  const [wishName, setWishName] = useState('');
  const [wishPrice, setWishPrice] = useState('');
  const [wishUrl, setWishUrl] = useState('');

  const loadAll = useCallback(async () => {
    const [accs, subs, ords, wish, summary, alerts, wishProgress] = await Promise.all([
      financeService.getAccounts(),
      financeService.getSubscriptions(),
      financeService.getOrders(),
      financeService.getWishlist(),
      financeService.getNetWorth(),
      financeService.getSubscriptionAlert(),
      financeService.getWishlistProgress(),
    ]);
    setAccounts(accs);
    setSubscriptions(subs);
    setOrders(ords);
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

  // ── Order handlers ────────────────────────────────────────────────────────

  async function handleAddOrder() {
    if (!orderName.trim() || !orderAmount) return;
    await financeService.createOrder({
      name: orderName.trim(),
      amount: parseFloat(orderAmount),
      accountId: orderAccountId || undefined,
      estimatedDeliveryDate: orderDelivery || undefined,
    });
    setOrderName(''); setOrderAmount(''); setOrderAccountId(''); setOrderDelivery('');
    setShowAddOrder(false);
    loadAll();
  }

  async function handleMarkDelivered(id: string) {
    await financeService.markDelivered(id);
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

  function subAlertColor(days: number): string {
    if (days <= 3) return OrialColors.error;
    if (days <= 7) return OrialColors.warning;
    return OrialColors.textMuted;
  }

  // ── Pie chart (simple bar representation) ────────────────────────────────
  const accountsByType = ACCOUNT_TYPES.map((t) => {
    const total = accounts
      .filter((a) => a.type === t.value)
      .reduce((sum, a) => sum + a.balanceAmount, 0);
    return { ...t, total, pct: netWorth > 0 ? (total / netWorth) * 100 : 0 };
  }).filter((t) => t.total > 0);

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
              historical net-worth snapshots to diff against), so it can't be
              derived without fabricating a number. Passing 0 rather than
              inventing a trend — flagged as a concern in the report.
            */}
            <View style={styles.netWorthCardWrap}>
              <NetWorthCard balance={netWorth} changePct={0} />
            </View>

            {/* Allocation donut, fed the same per-type percentages that drove the old bars */}
            {accountsByType.length > 0 && (
              <GlassCard style={styles.card}>
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>ALLOCATION</Text>
                <View style={styles.donutRow}>
                  <View style={styles.donutWrap}>
                    <Donut
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
                        <Text style={styles.legendLabel}>{t.icon} {t.label}</Text>
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
                accounts.map((a) => (
                  <GlassCard key={a.id} style={styles.accountCard}>
                    <View style={styles.accountRow}>
                      <Text style={{ fontSize: 24 }}>{a.icon}</Text>
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
                ))
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

            <View style={styles.section}>
              {subscriptions.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>No subscriptions tracked.</Text>
                </GlassCard>
              ) : (
                subscriptions.map((s) => {
                  const days = financeService.daysUntilBilling(s);
                  const alertColor = subAlertColor(days);
                  return (
                    <GlassCard
                      key={s.id}
                      style={[styles.subCard, days <= 3 && styles.subCardAlert]}
                    >
                      <View style={styles.subRow}>
                        <View style={styles.subInfo}>
                          <Text style={OrialTypography.bodyMedium}>{s.name}</Text>
                          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                            {s.billingCycle} · day {s.billingDay} · {s.category}
                          </Text>
                        </View>
                        <View style={styles.subRight}>
                          <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                            {formatCurrency(s.amount, s.currency)}
                          </Text>
                          <Text style={[OrialTypography.caption, { color: alertColor }]}>
                            {days <= 0 ? 'Due today' : `${days}d`}
                          </Text>
                        </View>
                        <Pressable
                          onPress={async () => { await financeService.deleteSubscription(s.id); loadAll(); }}
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

            {/*
              Orders folded in here: the mockup's 3-tab bar has no separate
              Orders tab, so its full functionality (add/delete/mark
              delivered) is relocated as a sub-section of Subs rather than
              dropped.
            */}
            <View style={styles.header}>
              <Text style={OrialTypography.headingMedium}>Orders</Text>
              <Pressable style={styles.addButton} onPress={() => setShowAddOrder(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.section}>
              {orders.length === 0 ? (
                <GlassCard style={styles.emptyCard}>
                  <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>No orders tracked.</Text>
                </GlassCard>
              ) : (
                orders.map((o) => {
                  const daysLeft = o.estimatedDeliveryDate
                    ? Math.ceil((new Date(o.estimatedDeliveryDate).getTime() - Date.now()) / 86400000)
                    : null;
                  return (
                    <GlassCard key={o.id} style={styles.orderCard}>
                      <View style={styles.orderRow}>
                        <Package size={20} color={o.status === 'delivered' ? OrialColors.success : OrialColors.textMuted} />
                        <View style={styles.orderInfo}>
                          <Text style={OrialTypography.bodyMedium}>{o.name}</Text>
                          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                            {o.orderDate}
                            {daysLeft !== null && o.status !== 'delivered'
                              ? daysLeft >= 0 ? ` · arrives in ${daysLeft}d` : ' · past est. delivery'
                              : ''}
                          </Text>
                        </View>
                        <View style={styles.orderRight}>
                          <Text style={OrialTypography.caption}>
                            {formatCurrency(o.amount, o.currency)}
                          </Text>
                          {o.status !== 'delivered' && (
                            <Pressable
                              style={styles.deliveredBtn}
                              onPress={() => handleMarkDelivered(o.id)}
                            >
                              <Check size={12} color={OrialColors.textPrimary} />
                            </Pressable>
                          )}
                        </View>
                        <Pressable
                          onPress={async () => { await financeService.deleteOrder(o.id); loadAll(); }}
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
      <Modal visible={showAddAccount} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Account</Text>
            <TextInput style={styles.input} placeholder="Account name" placeholderTextColor={OrialColors.textMuted} value={accName} onChangeText={setAccName} />
            <TextInput style={styles.input} placeholder="Balance" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={accBalance} onChangeText={setAccBalance} />
            <TextInput style={styles.input} placeholder="Currency (EUR)" placeholderTextColor={OrialColors.textMuted} value={accCurrency} onChangeText={setAccCurrency} autoCapitalize="characters" />
            <View style={styles.typeRow}>
              {ACCOUNT_TYPES.map((t) => (
                <Pressable
                  key={t.value}
                  style={[styles.typeChip, accType === t.value && styles.typeChipActive]}
                  onPress={() => setAccType(t.value)}
                >
                  <Text style={styles.typeChipText}>{t.icon}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddAccount(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddAccount}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Add Subscription Modal ────────────────────────────────────── */}
      <Modal visible={showAddSub} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
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
                      <Text style={[OrialTypography.caption, { color: subAccountId === a.id ? '#fff' : OrialColors.textMuted }]}>{a.icon} {a.name}</Text>
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
          </GlassCard>
        </View>
      </Modal>

      {/* ── Add Order Modal ────────────────────────────────────────────── */}
      <Modal visible={showAddOrder} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>New Order</Text>
            <TextInput style={styles.input} placeholder="Item name" placeholderTextColor={OrialColors.textMuted} value={orderName} onChangeText={setOrderName} />
            <TextInput style={styles.input} placeholder="Amount paid" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={orderAmount} onChangeText={setOrderAmount} />
            <TextInput style={styles.input} placeholder="Est. delivery (YYYY-MM-DD)" placeholderTextColor={OrialColors.textMuted} value={orderDelivery} onChangeText={setOrderDelivery} />
            {accounts.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                <Pressable style={[styles.typeChip, !orderAccountId && styles.typeChipActive]} onPress={() => setOrderAccountId('')}>
                  <Text style={[OrialTypography.caption, { color: !orderAccountId ? '#fff' : OrialColors.textMuted }]}>No account</Text>
                </Pressable>
                {accounts.map((a) => (
                  <Pressable key={a.id} style={[styles.typeChip, orderAccountId === a.id && styles.typeChipActive, { marginRight: 6 }]} onPress={() => setOrderAccountId(a.id)}>
                    <Text style={[OrialTypography.caption, { color: orderAccountId === a.id ? '#fff' : OrialColors.textMuted }]}>{a.icon} {a.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAddOrder(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleAddOrder}>
                <Text style={OrialTypography.bodyMedium}>Add</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      {/* ── Add Wishlist Modal ─────────────────────────────────────────── */}
      <Modal visible={showAddWish} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
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
          </GlassCard>
        </View>
      </Modal>
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
  addButton: { padding: 8, backgroundColor: OrialColors.violet, borderRadius: 12 },
  card: { marginHorizontal: 16, marginBottom: 8 },
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
  accountInfo: { flex: 1 },
  accountRight: { alignItems: 'flex-end' },
  deleteBtn: { padding: 4 },
  subCard: { padding: 14 },
  subCardAlert: { borderColor: OrialColors.error + '60', borderWidth: 1 },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  subInfo: { flex: 1 },
  subRight: { alignItems: 'flex-end' },
  orderCard: { padding: 14 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  orderInfo: { flex: 1 },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  deliveredBtn: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: OrialColors.success,
    justifyContent: 'center', alignItems: 'center',
  },
  wishCard: { padding: 14 },
  wishRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  wishInfo: { flex: 1 },
  wishRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { margin: 16, padding: 20 },
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
  typeChipText: { fontSize: 18 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: OrialColors.violet, borderRadius: 10 },
});

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
import { financeService } from '../../src/services/financeService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import type { FinanceAccount, FinanceSubscription, FinanceOrder, FinanceWishlistItem } from '../../drizzle/schema';

type SubTab = 'networth' | 'subscriptions' | 'orders' | 'wishlist';

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
    const [accs, subs, ords, wish] = await Promise.all([
      financeService.getAccounts(),
      financeService.getSubscriptions(),
      financeService.getOrders(),
      financeService.getWishlist(),
    ]);
    setAccounts(accs);
    setSubscriptions(subs);
    setOrders(ords);
    setWishlist(wish);
    setNetWorth(financeService.getTotalNetWorth(accs));
  }, []);

  useEffect(() => {
    loadAll();
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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabScroll}
        contentContainerStyle={styles.tabContainer}
      >
        {(['networth', 'subscriptions', 'orders', 'wishlist'] as SubTab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, activeTab === t && styles.tabActive]}
            onPress={() => setActiveTab(t)}
          >
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>
              {t === 'networth' ? 'Net Worth' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* ── NET WORTH ──────────────────────────────────────────── */}
        {activeTab === 'networth' && (
          <>
            <View style={styles.header}>
              <View>
                <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>Total Net Worth</Text>
                <Text style={styles.netWorthAmount}>{formatCurrency(netWorth)}</Text>
              </View>
              <Pressable style={styles.addButton} onPress={() => setShowAddAccount(true)}>
                <Plus size={20} color={OrialColors.textPrimary} />
              </Pressable>
            </View>

            {/* Horizontal bar chart by type */}
            {accountsByType.length > 0 && (
              <GlassCard style={styles.card}>
                <Text style={[OrialTypography.caption, styles.sectionLabel]}>ALLOCATION</Text>
                {accountsByType.map((t) => (
                  <View key={t.value} style={styles.barRow}>
                    <Text style={styles.barLabel}>{t.icon} {t.label}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            width: `${t.pct}%` as any,
                            backgroundColor: ACCOUNT_TYPE_COLORS[t.value],
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.barPct}>{t.pct.toFixed(1)}%</Text>
                  </View>
                ))}
              </GlassCard>
            )}

            {/* Account list */}
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
          </>
        )}

        {/* ── ORDERS ─────────────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <>
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
                wishlist.map((w) => {
                  const pct = financeService.wishlistPercentage(w.price, netWorth);
                  const safe = pct < 5;
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
                            {pct}% NW
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
  tabScroll: { maxHeight: 52, marginTop: 8 },
  tabContainer: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  tab: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 20, backgroundColor: OrialColors.surface,
    borderWidth: 1, borderColor: OrialColors.glassBorder,
  },
  tabActive: { backgroundColor: OrialColors.violet, borderColor: OrialColors.violet },
  tabText: { ...OrialTypography.caption, color: OrialColors.textMuted },
  tabTextActive: { color: OrialColors.textPrimary, fontWeight: '600' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
  },
  netWorthAmount: {
    fontSize: 28, fontWeight: '700',
    color: OrialColors.textPrimary, letterSpacing: -0.5,
  },
  addButton: { padding: 8, backgroundColor: OrialColors.violet, borderRadius: 12 },
  card: { marginHorizontal: 16, marginBottom: 8 },
  sectionLabel: {
    color: OrialColors.textMuted, textTransform: 'uppercase',
    letterSpacing: 1, marginBottom: 10,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  barLabel: { ...OrialTypography.caption, color: OrialColors.textSecondary, width: 80 },
  barTrack: {
    flex: 1, height: 6, backgroundColor: OrialColors.surface,
    borderRadius: 3, overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  barPct: { ...OrialTypography.caption, color: OrialColors.textMuted, width: 40, textAlign: 'right' },
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

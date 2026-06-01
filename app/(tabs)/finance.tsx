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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Plus,
  Trash2,
  CreditCard,
  Zap,
  Landmark,
  Bitcoin,
  BarChart2,
  Home,
  Briefcase,
  Receipt,
  UtensilsCrossed,
  Car,
  Gamepad2,
  HeartPulse,
  ShoppingCart,
  Building2,
  Banknote,
  Laptop,
  TrendingUp,
  Gift,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react-native';
import { financeService } from '../../src/services/financeService';
import { OrialColors } from '../../src/utils/colors';
import type {
  FinanceAccount,
  FinanceSubscription,
  FinanceExpense,
  FinanceIncome,
} from '../../drizzle/schema';

type SubTab = 'networth' | 'subscriptions' | 'expenses' | 'income';

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Banco', Icon: Landmark },
  { value: 'crypto', label: 'Crypto', Icon: Bitcoin },
  { value: 'stocks', label: 'Bolsa', Icon: BarChart2 },
  { value: 'real_estate', label: 'Inmuebles', Icon: Home },
  { value: 'other', label: 'Otros', Icon: Briefcase },
] as const;

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  bank: '#3B82F6',
  crypto: '#F59E0B',
  stocks: '#10B981',
  real_estate: '#8B5CF6',
  other: '#6B7280',
};

const ACCOUNT_ICONS: Record<string, any> = {
  bank: Landmark, crypto: Bitcoin, stocks: BarChart2, real_estate: Home, other: Briefcase,
};

const EXPENSE_CATS = [
  { value: 'comida',      label: 'Comida',      Icon: UtensilsCrossed, color: '#F59E0B' },
  { value: 'transporte',  label: 'Transporte',  Icon: Car,             color: '#3B82F6' },
  { value: 'ocio',        label: 'Ocio',        Icon: Gamepad2,        color: '#8B5CF6' },
  { value: 'salud',       label: 'Salud',       Icon: HeartPulse,      color: '#10B981' },
  { value: 'compras',     label: 'Compras',     Icon: ShoppingCart,    color: '#06B6D4' },
  { value: 'hogar',       label: 'Hogar',       Icon: Building2,       color: '#F97316' },
  { value: 'other',       label: 'Otros',       Icon: Receipt,         color: '#6B7280' },
] as const;

const INCOME_CATS = [
  { value: 'salario',     label: 'Salario',     Icon: Banknote,        color: '#10B981' },
  { value: 'freelance',   label: 'Freelance',   Icon: Laptop,          color: '#06B6D4' },
  { value: 'inversiones', label: 'Inversiones', Icon: TrendingUp,      color: '#8B5CF6' },
  { value: 'regalo',      label: 'Regalo',      Icon: Gift,            color: '#F59E0B' },
  { value: 'other',       label: 'Otros',       Icon: ArrowUpRight,    color: '#6B7280' },
] as const;

const TAB_LABELS: Record<SubTab, string> = {
  networth: 'Patrimonio',
  subscriptions: 'Suscripciones',
  expenses: 'Gastos',
  income: 'Ingresos',
};

const SUB_CATEGORIES = ['streaming', 'software', 'fitness', 'other'];

function getCurrentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getMonthLabel(month: string) {
  const [y, m] = month.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1, 1);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

export default function FinanceScreen() {
  const [activeTab, setActiveTab] = useState<SubTab>('expenses');
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [subscriptions, setSubscriptions] = useState<FinanceSubscription[]>([]);
  const [expenses, setExpenses] = useState<FinanceExpense[]>([]);
  const [income, setIncome] = useState<FinanceIncome[]>([]);
  const [netWorth, setNetWorth] = useState(0);
  const [month, setMonth] = useState(getCurrentMonth());

  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddIncome, setShowAddIncome] = useState(false);

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
  const [subAutoDeduct] = useState(false);
  const [subAccountId, setSubAccountId] = useState('');

  // Expense form
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCat, setExpCat] = useState('comida');
  const [expAccountId, setExpAccountId] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);

  // Income form
  const [incDesc, setIncDesc] = useState('');
  const [incAmount, setIncAmount] = useState('');
  const [incCat, setIncCat] = useState('salario');
  const [incAccountId, setIncAccountId] = useState('');
  const [incDate, setIncDate] = useState(new Date().toISOString().split('T')[0]);

  const loadAll = useCallback(async () => {
    const [accs, subs, exps, inc] = await Promise.all([
      financeService.getAccounts(),
      financeService.getSubscriptions(),
      financeService.getExpenses(month),
      financeService.getIncome(month),
    ]);
    setAccounts(accs);
    setSubscriptions(subs);
    setExpenses(exps);
    setIncome(inc);
    setNetWorth(financeService.getTotalNetWorth(accs));
  }, [month]);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleAddAccount() {
    if (!accName.trim() || !accBalance) return;
    await financeService.createAccount({
      name: accName.trim(), type: accType,
      balanceAmount: parseFloat(accBalance), currency: accCurrency, icon: accType,
    });
    setAccName(''); setAccBalance(''); setAccType('bank');
    setShowAddAccount(false); loadAll();
  }

  async function handleDeleteAccount(id: string) {
    Alert.alert('Eliminar cuenta', 'Esta acción no se puede deshacer.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => { await financeService.deleteAccount(id); loadAll(); } },
    ]);
  }

  async function handleAddSub() {
    if (!subName.trim() || !subAmount) return;
    await financeService.createSubscription({
      name: subName.trim(), amount: parseFloat(subAmount),
      billingDay: parseInt(subDay) || 1, billingCycle: subCycle,
      category: subCategory, autoDeduct: subAutoDeduct,
      accountId: subAccountId || undefined,
    });
    setSubName(''); setSubAmount(''); setSubDay('1'); setSubAccountId('');
    setShowAddSub(false); loadAll();
  }

  async function handleAddExpense() {
    if (!expDesc.trim() || !expAmount) return;
    await financeService.createExpense({
      description: expDesc.trim(), amount: parseFloat(expAmount),
      category: expCat, date: expDate,
      accountId: expAccountId || undefined,
    });
    setExpDesc(''); setExpAmount(''); setExpCat('comida'); setExpAccountId('');
    setExpDate(new Date().toISOString().split('T')[0]);
    setShowAddExpense(false); loadAll();
  }

  async function handleAddIncome() {
    if (!incDesc.trim() || !incAmount) return;
    await financeService.createIncome({
      description: incDesc.trim(), amount: parseFloat(incAmount),
      category: incCat, date: incDate,
      accountId: incAccountId || undefined,
    });
    setIncDesc(''); setIncAmount(''); setIncCat('salario'); setIncAccountId('');
    setIncDate(new Date().toISOString().split('T')[0]);
    setShowAddIncome(false); loadAll();
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  function fmt(amount: number, currency = 'EUR') {
    return `${currency} ${amount.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  const accountsByType = ACCOUNT_TYPES.map((t) => {
    const total = accounts.filter((a) => a.type === t.value).reduce((sum, a) => sum + a.balanceAmount, 0);
    return { ...t, total, pct: netWorth > 0 ? (total / netWorth) * 100 : 0 };
  }).filter((t) => t.total > 0);

  const monthlyBurn = subscriptions
    .filter((s) => s.isActive && s.billingCycle === 'monthly')
    .reduce((sum, s) => sum + s.amount, 0);

  const yearlyTotal = subscriptions
    .filter((s) => s.isActive)
    .reduce((sum, s) => sum + (s.billingCycle === 'monthly' ? s.amount * 12 : s.amount), 0);

  const sortedSubs = [...subscriptions].sort(
    (a, b) => financeService.daysUntilBilling(a) - financeService.daysUntilBilling(b)
  );

  const totalExpenses = financeService.getMonthlyExpenseTotal(expenses);
  const expByCat = financeService.getExpensesByCategory(expenses);

  const totalIncome = income.reduce((s, i) => s + i.amount, 0);
  const incByCat = financeService.getIncomeByCategory(income);

  const balance = totalIncome - totalExpenses;

  // Month navigation
  function shiftMonth(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMonth(d.toISOString().slice(0, 7));
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Tabs */}
      <ScrollView
        horizontal showsHorizontalScrollIndicator={false}
        style={s.tabScroll} contentContainerStyle={s.tabContainer}
      >
        {(['expenses', 'income', 'subscriptions', 'networth'] as SubTab[]).map((t) => (
          <Pressable key={t} style={[s.tab, activeTab === t && s.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[s.tabText, activeTab === t && s.tabTextActive]}>{TAB_LABELS[t]}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        {/* ── GASTOS ──────────────────────────────────────────────────── */}
        {activeTab === 'expenses' && (
          <>
            <MonthNav month={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />

            <View style={s.hero}>
              <Text style={s.heroLabel}>GASTOS DEL MES</Text>
              <Text style={[s.heroAmount, { color: totalExpenses > 0 ? OrialColors.error : OrialColors.textPrimary }]}>
                {fmt(totalExpenses)}
              </Text>
              {totalIncome > 0 && (
                <View style={s.balanceRow}>
                  <ArrowUpRight size={11} color={balance >= 0 ? OrialColors.success : OrialColors.error} />
                  <Text style={[s.balanceText, { color: balance >= 0 ? OrialColors.success : OrialColors.error }]}>
                    {balance >= 0 ? '+' : ''}{fmt(balance)}
                    <Text style={s.balanceSuffix}> balance del mes</Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={s.rule} />

            {/* Category breakdown */}
            {Object.keys(expByCat).length > 0 && (
              <View style={s.catBreakdown}>
                <Text style={s.metaLabel}>POR CATEGORÍA</Text>
                {EXPENSE_CATS.filter((c) => expByCat[c.value] > 0)
                  .sort((a, b) => expByCat[b.value] - expByCat[a.value])
                  .map((c) => {
                    const amt = expByCat[c.value] ?? 0;
                    const pct = totalExpenses > 0 ? (amt / totalExpenses) * 100 : 0;
                    return (
                      <View key={c.value} style={s.catRow}>
                        <View style={[s.catDot, { backgroundColor: c.color + '30' }]}>
                          <c.Icon size={11} color={c.color} />
                        </View>
                        <Text style={s.catLabel}>{c.label}</Text>
                        <View style={s.catBarWrap}>
                          <View style={[s.catBar, { width: `${pct}%` as any, backgroundColor: c.color }]} />
                        </View>
                        <Text style={s.catAmt}>{fmt(amt)}</Text>
                      </View>
                    );
                  })}
              </View>
            )}

            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.metaLabel}>REGISTROS · {expenses.length}</Text>
                <Pressable style={s.addBtn} onPress={() => setShowAddExpense(true)}>
                  <Plus size={15} color={OrialColors.textPrimary} />
                </Pressable>
              </View>

              {expenses.length === 0 ? (
                <EmptyState
                  Icon={Receipt}
                  title="Sin gastos este mes"
                  hint="Registra tus compras y pagos para ver en qué gastas el dinero."
                />
              ) : (
                expenses.map((e) => {
                  const cat = EXPENSE_CATS.find((c) => c.value === e.category) ?? EXPENSE_CATS[6];
                  return (
                    <View key={e.id} style={s.txRow}>
                      <View style={[s.txIcon, { backgroundColor: cat.color + '18' }]}>
                        <cat.Icon size={14} color={cat.color} />
                      </View>
                      <View style={s.txInfo}>
                        <Text style={s.txDesc}>{e.description}</Text>
                        <Text style={s.txDate}>{e.date} · {cat.label}</Text>
                      </View>
                      <Text style={[s.txAmount, { color: OrialColors.error }]}>−{fmt(e.amount, e.currency)}</Text>
                      <Pressable onPress={async () => { await financeService.deleteExpense(e.id); loadAll(); }} style={s.deleteBtn}>
                        <Trash2 size={14} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── INGRESOS ────────────────────────────────────────────────── */}
        {activeTab === 'income' && (
          <>
            <MonthNav month={month} onPrev={() => shiftMonth(-1)} onNext={() => shiftMonth(1)} />

            <View style={s.hero}>
              <Text style={s.heroLabel}>INGRESOS DEL MES</Text>
              <Text style={[s.heroAmount, { color: totalIncome > 0 ? OrialColors.success : OrialColors.textPrimary }]}>
                {fmt(totalIncome)}
              </Text>
              {totalExpenses > 0 && (
                <View style={s.balanceRow}>
                  <ArrowDownLeft size={11} color={OrialColors.textMuted} />
                  <Text style={s.balanceSuffix2}>
                    {fmt(totalExpenses)} en gastos este mes
                  </Text>
                </View>
              )}
            </View>

            <View style={s.rule} />

            {Object.keys(incByCat).length > 0 && (
              <View style={s.catBreakdown}>
                <Text style={s.metaLabel}>POR CATEGORÍA</Text>
                {INCOME_CATS.filter((c) => incByCat[c.value] > 0)
                  .sort((a, b) => incByCat[b.value] - incByCat[a.value])
                  .map((c) => {
                    const amt = incByCat[c.value] ?? 0;
                    const pct = totalIncome > 0 ? (amt / totalIncome) * 100 : 0;
                    return (
                      <View key={c.value} style={s.catRow}>
                        <View style={[s.catDot, { backgroundColor: c.color + '30' }]}>
                          <c.Icon size={11} color={c.color} />
                        </View>
                        <Text style={s.catLabel}>{c.label}</Text>
                        <View style={s.catBarWrap}>
                          <View style={[s.catBar, { width: `${pct}%` as any, backgroundColor: c.color }]} />
                        </View>
                        <Text style={s.catAmt}>{fmt(amt)}</Text>
                      </View>
                    );
                  })}
              </View>
            )}

            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.metaLabel}>REGISTROS · {income.length}</Text>
                <Pressable style={s.addBtn} onPress={() => setShowAddIncome(true)}>
                  <Plus size={15} color={OrialColors.textPrimary} />
                </Pressable>
              </View>

              {income.length === 0 ? (
                <EmptyState
                  Icon={Banknote}
                  title="Sin ingresos este mes"
                  hint="Registra tu salario, pagos de clientes u otros ingresos."
                />
              ) : (
                income.map((e) => {
                  const cat = INCOME_CATS.find((c) => c.value === e.category) ?? INCOME_CATS[4];
                  return (
                    <View key={e.id} style={s.txRow}>
                      <View style={[s.txIcon, { backgroundColor: cat.color + '18' }]}>
                        <cat.Icon size={14} color={cat.color} />
                      </View>
                      <View style={s.txInfo}>
                        <Text style={s.txDesc}>{e.description}</Text>
                        <Text style={s.txDate}>{e.date} · {cat.label}</Text>
                      </View>
                      <Text style={[s.txAmount, { color: OrialColors.success }]}>+{fmt(e.amount, e.currency)}</Text>
                      <Pressable onPress={async () => { await financeService.deleteIncome(e.id); loadAll(); }} style={s.deleteBtn}>
                        <Trash2 size={14} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── SUSCRIPCIONES ───────────────────────────────────────────── */}
        {activeTab === 'subscriptions' && (
          <>
            <View style={s.hero}>
              <Text style={s.heroLabel}>GASTO MENSUAL</Text>
              <Text style={s.heroAmount}>{fmt(monthlyBurn)}</Text>
              <Text style={s.heroSub}>{fmt(yearlyTotal)} al año</Text>
            </View>

            <View style={s.rule} />

            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.metaLabel}>ACTIVAS · {subscriptions.length}</Text>
                <Pressable style={s.addBtn} onPress={() => setShowAddSub(true)}>
                  <Plus size={15} color={OrialColors.textPrimary} />
                </Pressable>
              </View>

              {subscriptions.length === 0 ? (
                <EmptyState
                  Icon={Zap}
                  title="Sin suscripciones"
                  hint="Registra Netflix, Spotify o cualquier servicio y controla cuánto gastas al mes."
                />
              ) : (
                sortedSubs.map((sub) => {
                  const days = financeService.daysUntilBilling(sub);
                  const urgentColor = days <= 3 ? OrialColors.error : days <= 7 ? OrialColors.warning : null;
                  return (
                    <View key={sub.id} style={[s.subCard, urgentColor && { backgroundColor: urgentColor + '0D' }]}>
                      <View style={s.subMain}>
                        <Text style={s.subName}>{sub.name}</Text>
                        <View style={s.subMeta}>
                          <View style={s.catPill}><Text style={s.catPillText}>{sub.category}</Text></View>
                          <Text style={s.subCycleText}>{sub.billingCycle === 'monthly' ? '/mes' : '/año'}</Text>
                        </View>
                      </View>
                      <View style={s.subRight}>
                        <Text style={s.subAmount}>{fmt(sub.amount, sub.currency)}</Text>
                        <View style={[s.daysChip, { backgroundColor: (urgentColor ?? OrialColors.textMuted) + '1A' }]}>
                          <Text style={[s.daysChipText, { color: urgentColor ?? OrialColors.textMuted }]}>
                            {days <= 0 ? 'hoy' : `${days}d`}
                          </Text>
                        </View>
                      </View>
                      <Pressable onPress={async () => { await financeService.deleteSubscription(sub.id); loadAll(); }} style={s.deleteBtn}>
                        <Trash2 size={14} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}

        {/* ── PATRIMONIO ──────────────────────────────────────────────── */}
        {activeTab === 'networth' && (
          <>
            <View style={s.hero}>
              <Text style={s.heroLabel}>PATRIMONIO NETO</Text>
              <Text style={s.heroAmount}>{fmt(netWorth)}</Text>
              {monthlyBurn > 0 && (
                <View style={s.balanceRow}>
                  <Zap size={11} color={OrialColors.warning} />
                  <Text style={[s.balanceText, { color: OrialColors.warning }]}>
                    {fmt(monthlyBurn)}<Text style={s.balanceSuffix}> · gasto mensual</Text>
                  </Text>
                </View>
              )}
            </View>

            <View style={s.rule} />

            {accountsByType.length > 0 && (
              <View style={s.allocationWrap}>
                <Text style={s.metaLabel}>DISTRIBUCIÓN</Text>
                <View style={s.segBar}>
                  {accountsByType.map((t, i) => (
                    <View key={t.value} style={{
                      flex: t.pct, height: 5,
                      backgroundColor: ACCOUNT_TYPE_COLORS[t.value],
                      marginRight: i < accountsByType.length - 1 ? 2 : 0,
                    }} />
                  ))}
                </View>
                <View style={s.legend}>
                  {accountsByType.map((t) => (
                    <View key={t.value} style={s.legendItem}>
                      <View style={[s.legendDot, { backgroundColor: ACCOUNT_TYPE_COLORS[t.value] }]} />
                      <Text style={s.legendLabel}>{t.label}</Text>
                      <Text style={s.legendPct}>{t.pct.toFixed(0)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            <View style={s.section}>
              <View style={s.sectionHead}>
                <Text style={s.metaLabel}>CUENTAS · {accounts.length}</Text>
                <Pressable style={s.addBtn} onPress={() => setShowAddAccount(true)}>
                  <Plus size={15} color={OrialColors.textPrimary} />
                </Pressable>
              </View>

              {accounts.length === 0 ? (
                <EmptyState
                  Icon={CreditCard}
                  title="Sin cuentas"
                  hint="Añade tu banco, crypto o inversiones para calcular tu patrimonio neto."
                />
              ) : (
                accounts.map((a) => {
                  const accent = ACCOUNT_TYPE_COLORS[a.type] ?? OrialColors.textMuted;
                  const pct = netWorth > 0 ? ((a.balanceAmount / netWorth) * 100).toFixed(1) : '0';
                  const AccIcon = ACCOUNT_ICONS[a.type] ?? Briefcase;
                  const typeDef = ACCOUNT_TYPES.find((t) => t.value === a.type);
                  return (
                    <View key={a.id} style={s.accountRow}>
                      <View style={[s.accountIconWrap, { backgroundColor: accent + '18' }]}>
                        <AccIcon size={15} color={accent} />
                      </View>
                      <View style={s.accountInfo}>
                        <Text style={s.accountName}>{a.name}</Text>
                        <Text style={[s.accountType, { color: accent }]}>{typeDef?.label ?? a.type}</Text>
                      </View>
                      <View style={s.accountRight}>
                        <Text style={s.accountBalance}>{fmt(a.balanceAmount, a.currency)}</Text>
                        <Text style={s.accountPct}>{pct}%</Text>
                      </View>
                      <Pressable onPress={() => handleDeleteAccount(a.id)} style={s.deleteBtn}>
                        <Trash2 size={14} color={OrialColors.textMuted} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* ── Add Account Modal ──────────────────────────────────────────── */}
      <Modal visible={showAddAccount} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Nueva cuenta</Text>
              <TextInput style={s.input} placeholder="Nombre de la cuenta" placeholderTextColor={OrialColors.textMuted} value={accName} onChangeText={setAccName} />
              <TextInput style={s.input} placeholder="Saldo actual" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={accBalance} onChangeText={setAccBalance} />
              <TextInput style={s.input} placeholder="Divisa (EUR)" placeholderTextColor={OrialColors.textMuted} value={accCurrency} onChangeText={setAccCurrency} autoCapitalize="characters" />
              <Text style={s.fieldLabel}>TIPO</Text>
              <View style={s.chipRow}>
                {ACCOUNT_TYPES.map((t) => {
                  const Icon = t.Icon;
                  const accent = ACCOUNT_TYPE_COLORS[t.value];
                  const active = accType === t.value;
                  return (
                    <Pressable key={t.value} style={[s.chip, active && { backgroundColor: accent + '25', borderColor: accent + '70' }]} onPress={() => setAccType(t.value)}>
                      <Icon size={13} color={active ? accent : OrialColors.textMuted} />
                      <Text style={[s.chipText, { color: active ? accent : OrialColors.textMuted }]}>{t.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <ModalActions onCancel={() => setShowAddAccount(false)} onSave={handleAddAccount} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Subscription Modal ────────────────────────────────────── */}
      <Modal visible={showAddSub} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Nueva suscripción</Text>
              <TextInput style={s.input} placeholder="Nombre del servicio" placeholderTextColor={OrialColors.textMuted} value={subName} onChangeText={setSubName} autoFocus />
              <View style={s.rowInputs}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Importe" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={subAmount} onChangeText={setSubAmount} />
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Día cobro" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={subDay} onChangeText={setSubDay} />
              </View>
              <Text style={s.fieldLabel}>CICLO</Text>
              <View style={s.chipRow}>
                {['monthly', 'yearly'].map((c) => (
                  <Pressable key={c} style={[s.chip, subCycle === c && s.chipActive]} onPress={() => setSubCycle(c)}>
                    <Text style={[s.chipText, { color: subCycle === c ? OrialColors.textPrimary : OrialColors.textMuted }]}>{c === 'monthly' ? 'Mensual' : 'Anual'}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={s.fieldLabel}>CATEGORÍA</Text>
              <View style={s.chipRow}>
                {SUB_CATEGORIES.map((cat) => (
                  <Pressable key={cat} style={[s.chip, subCategory === cat && s.chipActive]} onPress={() => setSubCategory(cat)}>
                    <Text style={[s.chipText, { color: subCategory === cat ? OrialColors.textPrimary : OrialColors.textMuted }]}>{cat}</Text>
                  </Pressable>
                ))}
              </View>
              {accounts.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>CUENTA</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable style={[s.chip, !subAccountId && s.chipActive]} onPress={() => setSubAccountId('')}>
                        <Text style={[s.chipText, { color: !subAccountId ? OrialColors.textPrimary : OrialColors.textMuted }]}>Ninguna</Text>
                      </Pressable>
                      {accounts.map((a) => (
                        <Pressable key={a.id} style={[s.chip, subAccountId === a.id && s.chipActive]} onPress={() => setSubAccountId(a.id)}>
                          <Text style={[s.chipText, { color: subAccountId === a.id ? OrialColors.textPrimary : OrialColors.textMuted }]}>{a.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
              <ModalActions onCancel={() => setShowAddSub(false)} onSave={handleAddSub} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Expense Modal ──────────────────────────────────────────── */}
      <Modal visible={showAddExpense} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Nuevo gasto</Text>
              <TextInput style={s.input} placeholder="Descripción" placeholderTextColor={OrialColors.textMuted} value={expDesc} onChangeText={setExpDesc} autoFocus />
              <View style={s.rowInputs}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Importe" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={expAmount} onChangeText={setExpAmount} />
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Fecha" placeholderTextColor={OrialColors.textMuted} value={expDate} onChangeText={setExpDate} />
              </View>
              <Text style={s.fieldLabel}>CATEGORÍA</Text>
              <View style={s.chipRow}>
                {EXPENSE_CATS.map((c) => (
                  <Pressable key={c.value} style={[s.chip, expCat === c.value && { backgroundColor: c.color + '25', borderColor: c.color + '70' }]} onPress={() => setExpCat(c.value)}>
                    <c.Icon size={12} color={expCat === c.value ? c.color : OrialColors.textMuted} />
                    <Text style={[s.chipText, { color: expCat === c.value ? c.color : OrialColors.textMuted }]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              {accounts.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>CUENTA</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable style={[s.chip, !expAccountId && s.chipActive]} onPress={() => setExpAccountId('')}>
                        <Text style={[s.chipText, { color: !expAccountId ? OrialColors.textPrimary : OrialColors.textMuted }]}>Sin cuenta</Text>
                      </Pressable>
                      {accounts.map((a) => (
                        <Pressable key={a.id} style={[s.chip, expAccountId === a.id && s.chipActive]} onPress={() => setExpAccountId(a.id)}>
                          <Text style={[s.chipText, { color: expAccountId === a.id ? OrialColors.textPrimary : OrialColors.textMuted }]}>{a.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
              <ModalActions onCancel={() => setShowAddExpense(false)} onSave={handleAddExpense} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Add Income Modal ───────────────────────────────────────────── */}
      <Modal visible={showAddIncome} transparent animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={s.modalOverlay}>
            <View style={s.modalCard}>
              <Text style={s.modalTitle}>Nuevo ingreso</Text>
              <TextInput style={s.input} placeholder="Descripción" placeholderTextColor={OrialColors.textMuted} value={incDesc} onChangeText={setIncDesc} autoFocus />
              <View style={s.rowInputs}>
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Importe" placeholderTextColor={OrialColors.textMuted} keyboardType="numeric" value={incAmount} onChangeText={setIncAmount} />
                <TextInput style={[s.input, { flex: 1 }]} placeholder="Fecha" placeholderTextColor={OrialColors.textMuted} value={incDate} onChangeText={setIncDate} />
              </View>
              <Text style={s.fieldLabel}>CATEGORÍA</Text>
              <View style={s.chipRow}>
                {INCOME_CATS.map((c) => (
                  <Pressable key={c.value} style={[s.chip, incCat === c.value && { backgroundColor: c.color + '25', borderColor: c.color + '70' }]} onPress={() => setIncCat(c.value)}>
                    <c.Icon size={12} color={incCat === c.value ? c.color : OrialColors.textMuted} />
                    <Text style={[s.chipText, { color: incCat === c.value ? c.color : OrialColors.textMuted }]}>{c.label}</Text>
                  </Pressable>
                ))}
              </View>
              {accounts.length > 0 && (
                <>
                  <Text style={s.fieldLabel}>CUENTA (acreditar)</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      <Pressable style={[s.chip, !incAccountId && s.chipActive]} onPress={() => setIncAccountId('')}>
                        <Text style={[s.chipText, { color: !incAccountId ? OrialColors.textPrimary : OrialColors.textMuted }]}>Sin cuenta</Text>
                      </Pressable>
                      {accounts.map((a) => (
                        <Pressable key={a.id} style={[s.chip, incAccountId === a.id && s.chipActive]} onPress={() => setIncAccountId(a.id)}>
                          <Text style={[s.chipText, { color: incAccountId === a.id ? OrialColors.textPrimary : OrialColors.textMuted }]}>{a.name}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </ScrollView>
                </>
              )}
              <ModalActions onCancel={() => setShowAddIncome(false)} onSave={handleAddIncome} saveLabel="Añadir" />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MonthNav({ month, onPrev, onNext }: { month: string; onPrev: () => void; onNext: () => void }) {
  const isCurrentMonth = month === getCurrentMonth();
  return (
    <View style={s.monthNav}>
      <Pressable style={s.monthArrow} onPress={onPrev}>
        <Text style={s.monthArrowText}>‹</Text>
      </Pressable>
      <Text style={s.monthLabel}>{getMonthLabel(month).toUpperCase()}</Text>
      <Pressable style={[s.monthArrow, isCurrentMonth && { opacity: 0.3 }]} onPress={onNext} disabled={isCurrentMonth}>
        <Text style={s.monthArrowText}>›</Text>
      </Pressable>
    </View>
  );
}

function EmptyState({ Icon, title, hint }: { Icon: any; title: string; hint: string }) {
  return (
    <View style={s.empty}>
      <Icon size={26} color={OrialColors.textMuted} />
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyHint}>{hint}</Text>
    </View>
  );
}

function ModalActions({ onCancel, onSave, saveLabel = 'Añadir' }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  return (
    <View style={s.modalActions}>
      <Pressable style={s.cancelBtn} onPress={onCancel}>
        <Text style={s.cancelText}>Cancelar</Text>
      </Pressable>
      <Pressable style={s.saveBtn} onPress={onSave}>
        <Text style={s.saveText}>{saveLabel}</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },

  tabScroll: { maxHeight: 50, marginTop: 8 },
  tabContainer: { paddingHorizontal: 16, gap: 4, alignItems: 'center' },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  tabActive: { backgroundColor: OrialColors.surface, borderWidth: 1, borderColor: OrialColors.borderStrong },
  tabText: { fontSize: 13, fontWeight: '500', color: OrialColors.textMuted, letterSpacing: 0.1 },
  tabTextActive: { color: OrialColors.textPrimary, fontWeight: '600' },

  hero: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 20 },
  heroLabel: { fontSize: 10, fontWeight: '600', color: OrialColors.textMuted, letterSpacing: 1.6, marginBottom: 8 },
  heroAmount: { fontSize: 42, fontWeight: '800', color: OrialColors.textPrimary, letterSpacing: -1.5, lineHeight: 50, fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 14, color: OrialColors.textMuted, marginTop: 5, fontVariant: ['tabular-nums'] },
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  balanceText: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  balanceSuffix: { fontWeight: '400', color: OrialColors.textMuted },
  balanceSuffix2: { fontSize: 13, color: OrialColors.textMuted, fontVariant: ['tabular-nums'] },

  rule: { height: 1, backgroundColor: OrialColors.border, marginHorizontal: 20 },

  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  monthArrow: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  monthArrowText: { fontSize: 22, color: OrialColors.textSecondary, lineHeight: 26 },
  monthLabel: { fontSize: 11, fontWeight: '600', color: OrialColors.textSecondary, letterSpacing: 1.2 },

  catBreakdown: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4, gap: 10 },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catDot: { width: 26, height: 26, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  catLabel: { fontSize: 13, color: OrialColors.textSecondary, width: 80 },
  catBarWrap: { flex: 1, height: 4, backgroundColor: OrialColors.border, borderRadius: 2, overflow: 'hidden' },
  catBar: { height: '100%', borderRadius: 2 },
  catAmt: { fontSize: 12, color: OrialColors.textSecondary, fontVariant: ['tabular-nums'], textAlign: 'right', minWidth: 80 },

  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  metaLabel: { fontSize: 10, fontWeight: '600', color: OrialColors.textMuted, letterSpacing: 1.5 },
  addBtn: { width: 28, height: 28, borderRadius: 8, backgroundColor: OrialColors.violet, justifyContent: 'center', alignItems: 'center' },

  txRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: OrialColors.border },
  txIcon: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: 15, fontWeight: '500', color: OrialColors.textPrimary, marginBottom: 2 },
  txDate: { fontSize: 11, color: OrialColors.textMuted },
  txAmount: { fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: -0.3 },

  subCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 14, borderRadius: 10, backgroundColor: OrialColors.surface, marginBottom: 6, gap: 10, borderWidth: 1, borderColor: OrialColors.border },
  subMain: { flex: 1 },
  subName: { fontSize: 15, fontWeight: '500', color: OrialColors.textPrimary, marginBottom: 5 },
  subMeta: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  catPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 4, backgroundColor: OrialColors.surfaceElevated },
  catPillText: { fontSize: 9, fontWeight: '700', color: OrialColors.textMuted, letterSpacing: 0.6, textTransform: 'uppercase' },
  subCycleText: { fontSize: 11, color: OrialColors.textMuted },
  subRight: { alignItems: 'flex-end', gap: 5 },
  subAmount: { fontSize: 15, fontWeight: '700', color: OrialColors.textPrimary, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  daysChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 5 },
  daysChipText: { fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 0.2 },

  allocationWrap: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 4 },
  segBar: { height: 5, flexDirection: 'row', borderRadius: 3, overflow: 'hidden', marginTop: 10, marginBottom: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 5, height: 5, borderRadius: 3 },
  legendLabel: { fontSize: 11, color: OrialColors.textSecondary },
  legendPct: { fontSize: 11, color: OrialColors.textMuted, fontVariant: ['tabular-nums'] },

  accountRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: OrialColors.border },
  accountIconWrap: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '500', color: OrialColors.textPrimary, marginBottom: 2 },
  accountType: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  accountRight: { alignItems: 'flex-end' },
  accountBalance: { fontSize: 15, fontWeight: '700', color: OrialColors.textPrimary, fontVariant: ['tabular-nums'], letterSpacing: -0.4 },
  accountPct: { fontSize: 11, color: OrialColors.textMuted, fontVariant: ['tabular-nums'], marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: 44, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: OrialColors.textSecondary },
  emptyHint: { fontSize: 13, color: OrialColors.textMuted, textAlign: 'center', maxWidth: 260, lineHeight: 20 },

  deleteBtn: { padding: 6 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.65)' },
  modalCard: { margin: 12, padding: 22, backgroundColor: OrialColors.surfaceElevated, borderRadius: 18, borderWidth: 1, borderColor: OrialColors.borderStrong },
  modalTitle: { fontSize: 19, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.4, marginBottom: 18 },
  input: { backgroundColor: OrialColors.surface, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 13, fontSize: 15, color: OrialColors.textPrimary, marginBottom: 10, borderWidth: 1, borderColor: OrialColors.border },
  rowInputs: { flexDirection: 'row', gap: 10 },
  fieldLabel: { fontSize: 10, fontWeight: '600', color: OrialColors.textMuted, letterSpacing: 1.2, marginBottom: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, backgroundColor: OrialColors.surface, borderWidth: 1, borderColor: OrialColors.border, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chipActive: { backgroundColor: OrialColors.violet + '22', borderColor: OrialColors.violet + '60' },
  chipText: { fontSize: 13, fontWeight: '500' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 6 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 11 },
  cancelText: { fontSize: 15, color: OrialColors.textMuted, fontWeight: '500' },
  saveBtn: { paddingHorizontal: 26, paddingVertical: 11, backgroundColor: OrialColors.violet, borderRadius: 10 },
  saveText: { fontSize: 15, fontWeight: '600', color: OrialColors.textPrimary },
});

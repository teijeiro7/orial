import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, Modal, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Moon } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { AreaChart } from '@/src/components/AreaChart';
import { Chip } from '@/src/components/Chip';
import { caffeineService, QUICK_SOURCES } from '@/src/services/caffeineService';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { formatHM } from '@/src/utils/time';
import type { CaffeineLog } from '../../drizzle/schema';
import type { ActiveCaffeine, SleepInterferenceCheck } from '@/src/services/caffeineService';

const SOURCE_EMOJI: Record<string, string> = {
  manual: '✏️',
  coffee: '☕',
  energy_drink: '⚡',
  supplement: '💊',
  tea: '🫖',
};

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_HEIGHT = 100;
// Screen margin (16px x2) + GlassCard padding (16px x2), minus the chart's 4px bleed on each side.
const CHART_WIDTH = SCREEN_WIDTH - 56;

const SOURCE_OPTIONS = [
  { value: 'coffee', label: 'Café' },
  { value: 'tea', label: 'Té' },
  { value: 'energy_drink', label: 'Bebida energética' },
  { value: 'supplement', label: 'Suplemento' },
  { value: 'manual', label: 'Otro' },
];

export default function CaffeineScreen() {
  const [logs, setLogs] = useState<CaffeineLog[]>([]);
  const [active, setActive] = useState<ActiveCaffeine | null>(null);
  const [sleepCheck, setSleepCheck] = useState<SleepInterferenceCheck | null>(null);
  const [bedtime, setBedtime] = useState<Date>(caffeineService.getDefaultBedtime());
  const [chartData, setChartData] = useState<number[]>([]);

  const [showAdd, setShowAdd] = useState(false);
  const [customSource, setCustomSource] = useState('manual');
  const [customMg, setCustomMg] = useState('');

  const loadAll = useCallback(async () => {
    const bt = caffeineService.getDefaultBedtime();
    setBedtime(bt);
    const [todayLogs, activeCaffeine, interference, , dailyChart] = await Promise.all([
      caffeineService.getTodayLogs(),
      caffeineService.getActiveCaffeine(),
      caffeineService.willInterfereWithSleep(bt),
      caffeineService.evaluateDailyCheckInReminder(),
      caffeineService.getDailyChart(),
    ]);
    setLogs(todayLogs);
    setActive(activeCaffeine);
    setSleepCheck(interference);
    setChartData(dailyChart.timeline.map((point) => point.mg));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleQuickAdd(source: string, mg: number) {
    await caffeineService.logCaffeine(source, mg);
    loadAll();
  }

  async function handleCustomAdd() {
    const mg = parseInt(customMg, 10);
    if (!mg || mg <= 0) return;
    await caffeineService.logCaffeine(customSource, mg);
    setCustomMg('');
    setShowAdd(false);
    loadAll();
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>☕ Cafeína</Text>
          <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>Hoy</Text>
        </View>

        <GlassCard style={styles.statusCard}>
          <View style={styles.statusRow}>
            <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>NIVEL ACTUAL</Text>
            <Text style={styles.levelValue}>{Math.round(active?.currentLevel ?? 0)}mg</Text>
          </View>

          {chartData.length > 0 && (
            <View style={styles.chartWrap}>
              <AreaChart data={chartData} width={CHART_WIDTH} height={CHART_HEIGHT} color={OrialColors.cyan} />
            </View>
          )}

          {active?.peakAt && active.peakMg != null && (
            <Text style={[OrialTypography.bodySmall, styles.statusLine]}>
              Pico: {formatHM(active.peakAt)} ({Math.round(active.peakMg)}mg)
            </Text>
          )}

          {active?.estimatedClearAt && (
            <Text style={[OrialTypography.bodySmall, styles.statusLine]}>
              Eliminación estimada: {formatHM(active.estimatedClearAt)}
            </Text>
          )}

          {sleepCheck && (
            <View style={styles.sleepRow}>
              <Moon size={14} color={sleepCheck.interfere ? OrialColors.warning : OrialColors.success} />
              <Text
                style={[
                  OrialTypography.bodySmall,
                  { color: sleepCheck.interfere ? OrialColors.warning : OrialColors.success },
                ]}
              >
                {' '}¿Interfiere? {sleepCheck.interfere ? 'SÍ' : 'NO'} (a las {formatHM(bedtime)})
              </Text>
            </View>
          )}
        </GlassCard>

        <View style={styles.section}>
          <Text style={[OrialTypography.caption, styles.sectionLabel]}>TIMELINE HOY</Text>
          {logs.length === 0 ? (
            <GlassCard style={styles.emptyCard}>
              <Text style={[OrialTypography.bodyMedium, styles.emptyText]}>
                Aún no has registrado cafeína hoy.
              </Text>
            </GlassCard>
          ) : (
            logs
              .slice()
              .reverse()
              .map((log) => (
                <GlassCard key={log.id} style={styles.logCard}>
                  <View style={styles.logRow}>
                    <Text style={styles.logEmoji}>{SOURCE_EMOJI[log.source] ?? '☕'}</Text>
                    <View style={styles.logInfo}>
                      <Text style={OrialTypography.bodyMedium}>
                        {SOURCE_OPTIONS.find((o) => o.value === log.source)?.label ?? log.source}
                      </Text>
                      <Text style={[OrialTypography.caption, { color: OrialColors.textMuted }]}>
                        {formatHM(log.timestamp)}
                      </Text>
                    </View>
                    <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textPrimary }]}>
                      {log.caffeineMg}mg
                    </Text>
                  </View>
                </GlassCard>
              ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[OrialTypography.caption, styles.sectionLabel]}>FUENTES RÁPIDAS</Text>
          <View style={styles.quickRow}>
            {QUICK_SOURCES.map((q) => (
              <Chip
                key={q.key}
                label={`${q.emoji} ${q.label}`}
                onPress={() => handleQuickAdd(q.source, q.mg)}
              />
            ))}
            <Chip label="✏️ Personalizado" onPress={() => setShowAdd(true)} />
          </View>
        </View>
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => setShowAdd(true)}>
        <Plus size={22} color={OrialColors.textPrimary} />
      </Pressable>

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <GlassCard style={styles.modalCard}>
            <Text style={[OrialTypography.headingSmall, { marginBottom: 16 }]}>Añadir cafeína</Text>
            <TextInput
              style={styles.input}
              placeholder="Cantidad (mg)"
              placeholderTextColor={OrialColors.textMuted}
              keyboardType="numeric"
              value={customMg}
              onChangeText={setCustomMg}
            />
            <View style={styles.typeRow}>
              {SOURCE_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.typeChip, customSource === opt.value && styles.typeChipActive]}
                  onPress={() => setCustomSource(opt.value)}
                >
                  <Text
                    style={[
                      OrialTypography.caption,
                      { color: customSource === opt.value ? '#fff' : OrialColors.textMuted },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={[OrialTypography.bodyMedium, { color: OrialColors.textMuted }]}>Cancelar</Text>
              </Pressable>
              <Pressable style={styles.saveBtn} onPress={handleCustomAdd}>
                <Text style={OrialTypography.bodyMedium}>Añadir</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  statusCard: { marginHorizontal: 16, marginBottom: 8 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  levelValue: { fontSize: 26, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.5 },
  chartWrap: { marginHorizontal: -4, marginVertical: 8 },
  statusLine: { color: OrialColors.textSecondary, marginBottom: 4 },
  sleepRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  section: { padding: 16, paddingTop: 8, gap: 8 },
  sectionLabel: { color: OrialColors.textMuted, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
  emptyCard: { alignItems: 'center', padding: 24 },
  emptyText: { color: OrialColors.textMuted, textAlign: 'center' },
  logCard: { padding: 12 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logEmoji: { fontSize: 20 },
  logInfo: { flex: 1 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  modalCard: { margin: 16, padding: 20 },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
    padding: 12,
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  typeChipActive: { backgroundColor: OrialColors.violet, borderColor: OrialColors.violet },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 4 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 10 },
  saveBtn: { paddingHorizontal: 24, paddingVertical: 10, backgroundColor: OrialColors.violet, borderRadius: 10 },
});

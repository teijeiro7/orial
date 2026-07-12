import { View, Text, StyleSheet, ScrollView, Animated, RefreshControl, ViewStyle, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { format } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { Ring } from '../../src/components/Ring';
import { ProgressBar } from '../../src/components/ProgressBar';
import { OrialColors } from '../../src/utils/colors';
import { nutritionService } from '../../src/services/nutritionService';
import { agentService } from '../../src/services/openclawService';
import type { NutritionLog } from '../../drizzle/schema';

const GOALS = { calories: 2100, protein: 160, carbs: 220, fat: 70 };

function SkeletonBlock({ width, height, style }: { width: any; height: number; style?: ViewStyle }) {
  const opacity = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.6, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [opacity]);
  return (
    <Animated.View style={[{ width, height, backgroundColor: OrialColors.surfaceElevated, borderRadius: 6, opacity }, style]} />
  );
}

export default function MacrosScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionLog | null>(null);

  const fetchMacros = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const data = await nutritionService.getTodayNutrition();
    setNutrition(data);
    if (isRefresh) setRefreshing(false);
    else setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMacros(); }, [fetchMacros]));

  /** Call the Hermes agent to populate today's macros into the local DB */
  const handleFetchFromAgent = useCallback(async () => {
    setFetching(true);
    try {
      const configured = await agentService.isConfigured();
      if (!configured) {
        setFetching(false);
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      const existing = await nutritionService.getTodayNutrition();

      const response = await agentService.chat([
        {
          role: 'system',
          content: `Eres un asistente nutricional.
IMPORTANTE: Ejecuta EXACTAMENTE este comando y devuelve su salida sin modificarla:

python3 -c "import sqlite3,json,os;from datetime import datetime;today=datetime.now().strftime('%Y-%m-%d');db=os.path.expanduser('~/.hermes/data/nutrition.db');c=sqlite3.connect(db);c.row_factory=sqlite3.Row;r=c.execute('SELECT * FROM meals WHERE date=?',(today,));m=r.fetchall();c.close();tc=sum((x['calories']or 0)for x in m);tp=sum((x['protein']or 0)for x in m);tcarb=sum((x['carbs']or 0)for x in m);tf=sum((x['fat']or 0)for x in m);ml=[{'name':x['meal_type'],'calories':x['calories'],'protein':x['protein'],'carbs':x['carbs'],'fat':x['fat'],'sodium':0}for x in m];d={'date':today,'totalCalories':tc,'proteinG':round(tp,1),'carbsG':round(tcarb,1),'fatG':round(tf,1),'sodiumMg':0,'meals':ml};print('###ORIAL_NUTRITION###');print(json.dumps(d,indent=2));print('###END_ORIAL###')"

Devuelve la salida del comando TAL CUAL. No añadas nada más.`,
        },
        { role: 'user', content: `Dame mis macros de hoy` },
      ]);

      const saved = await nutritionService.processOpenclawMessage(response);
      if (!saved) {
        // Fallback: try to extract JSON directly
        const jsonMatch = response.match(/\{[\s\S]*"totalCalories"[\s\S]*\}/);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            await nutritionService.importFromOpenclaw({
              date: today,
              totalCalories: parsed.totalCalories || 0,
              proteinG: parsed.proteinG || 0,
              carbsG: parsed.carbsG || 0,
              fatG: parsed.fatG || 0,
              sodiumMg: parsed.sodiumMg || 0,
              meals: parsed.meals || [],
            });
          } catch {}
        }
      }
      await fetchMacros();
    } catch {
      // silently fail — user can retry
    } finally {
      setFetching(false);
    }
  }, [fetchMacros]);

  const pct = (val: number | null | undefined, goal: number) =>
    goal > 0 ? Math.min((val ?? 0) / goal, 1) : 0;

  const calPct = pct(nutrition?.totalCalories, GOALS.calories);
  const remaining = GOALS.calories - (nutrition?.totalCalories ?? 0);
  const calColor = calPct >= 1 ? OrialColors.success : calPct >= 0.8 ? OrialColors.warning : OrialColors.cyan;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchMacros(true)} tintColor={OrialColors.violetLight} />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Macros</Text>
            <Text style={styles.headerDate}>{format(new Date(), 'EEE, MMM d').toUpperCase()}</Text>
          </View>
          <Pressable
            style={styles.cameraBtn}
            onPress={() => router.push('/screens/MealCameraScreen')}
            testID="analyze-meal-button"
          >
            <Text style={styles.cameraBtnText}>📸 Analizar Comida</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.skeletonContainer}>
            <GlassCard style={styles.calorieCard}>
              <View style={styles.calorieRow}>
                <View>
                  <SkeletonBlock width={90} height={32} style={{ borderRadius: 6, marginBottom: 6 }} />
                  <SkeletonBlock width={50} height={8} style={{ borderRadius: 4 }} />
                </View>
                <SkeletonBlock width={70} height={44} style={{ borderRadius: 12 }} />
              </View>
              <SkeletonBlock width="100%" height={4} style={{ borderRadius: 2, marginTop: 12 }} />
            </GlassCard>
            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={macroRingStyles.item}>
                    <SkeletonBlock width={72} height={72} style={{ borderRadius: 36, marginBottom: 8 }} />
                    <SkeletonBlock width={36} height={10} style={{ marginBottom: 8 }} />
                    <SkeletonBlock width={40} height={8} />
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        ) : !nutrition ? (
          <>
            <GlassCard style={styles.calorieCard}>
              <View style={styles.calorieRow}>
                <View>
                  <Text style={[styles.calorieValue, { color: OrialColors.textMuted }]}>0</Text>
                  <Text style={styles.calorieValueLabel}>KCAL HOY</Text>
                </View>
                <View style={styles.calorieGoalBox}>
                  <Text style={styles.calorieGoalLabel}>GOAL</Text>
                  <Text style={styles.calorieGoalValue}>{GOALS.calories}</Text>
                  <Text style={styles.calorieGoalSub}>{GOALS.calories} left</Text>
                </View>
              </View>
              <ProgressBar pct={0} color={OrialColors.textMuted} />
            </GlassCard>

            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing logged yet</Text>
              <Text style={styles.emptyBody}>
                Tell Hermes what you ate — it will parse meals and log your macros automatically.
              </Text>
              <Pressable
                style={[styles.fetchBtn, fetching && { opacity: 0.6 }]}
                onPress={handleFetchFromAgent}
                disabled={fetching}
              >
                {fetching ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.fetchBtnText}>Fetch from Hermes</Text>
                )}
              </Pressable>
              <View style={styles.emptyHint}>
                <Text style={styles.emptyHintText}>Or type "Breakfast: 3 eggs, toast with butter, OJ"</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                <MacroRingItem label="PROTEIN" value={0} goal={GOALS.protein} unit="g" color={OrialColors.error} />
                <View style={styles.macroStripDivider} />
                <MacroRingItem label="CARBS" value={0} goal={GOALS.carbs} unit="g" color={OrialColors.cyan} />
                <View style={styles.macroStripDivider} />
                <MacroRingItem label="FAT" value={0} goal={GOALS.fat} unit="g" color={OrialColors.violetLight} />
              </View>
            </GlassCard>
          </>
        ) : (
          <>
            <GlassCard style={styles.calorieCard}>
              <View style={styles.calorieRow}>
                <View>
                  <Text style={[styles.calorieValue, { color: calColor }]}>{nutrition.totalCalories ?? 0}</Text>
                  <Text style={styles.calorieValueLabel}>KCAL HOY</Text>
                </View>
                <View style={styles.calorieGoalBox}>
                  <Text style={styles.calorieGoalLabel}>GOAL</Text>
                  <Text style={styles.calorieGoalValue}>{GOALS.calories}</Text>
                  <Text style={[styles.calorieGoalSub, remaining < 0 && { color: OrialColors.error }]}>
                    {remaining >= 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
                  </Text>
                </View>
              </View>
              <ProgressBar pct={calPct * 100} color={calColor} />
            </GlassCard>

            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                <MacroRingItem label="PROTEIN" value={nutrition.proteinG ?? 0} goal={GOALS.protein} unit="g" color={OrialColors.error} />
                <View style={styles.macroStripDivider} />
                <MacroRingItem label="CARBS" value={nutrition.carbsG ?? 0} goal={GOALS.carbs} unit="g" color={OrialColors.cyan} />
                <View style={styles.macroStripDivider} />
                <MacroRingItem label="FAT" value={nutrition.fatG ?? 0} goal={GOALS.fat} unit="g" color={OrialColors.violetLight} />
              </View>
            </GlassCard>

            {nutrition.sodiumMg ? (
              <GlassCard style={styles.microCard}>
                <View style={styles.microRow}>
                  <View>
                    <Text style={styles.microLabel}>SODIUM</Text>
                    <Text style={[styles.microValue, { color: OrialColors.warning }]}>{nutrition.sodiumMg} mg</Text>
                  </View>
                  <Text style={styles.microNote}>+{(nutrition.sodiumMg / 2300).toFixed(2)} L extra water recommended</Text>
                </View>
              </GlassCard>
            ) : null}

            {nutrition.fiberG ? (
              <GlassCard style={styles.microCard}>
                <Text style={styles.microLabel}>FIBER</Text>
                <Text style={[styles.microValue, { color: OrialColors.success }]}>{nutrition.fiberG} g</Text>
              </GlassCard>
            ) : null}

            <Pressable style={styles.fetchBtnData} onPress={handleFetchFromAgent} disabled={fetching}>
              {fetching ? (
                <ActivityIndicator size="small" color={OrialColors.violetLight} />
              ) : (
                <Text style={styles.fetchBtnDataText}>Fetch from Hermes</Text>
              )}
            </Pressable>
          </>
        )}

        <Text style={styles.disclaimer}>Pull to refresh · data from Hermes sessions</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroRingItem({ label, value, goal, unit, color }: { label: string; value: number; goal: number; unit: string; color: string }) {
  const p = goal > 0 ? Math.min(value / goal, 1) : 0;
  const statusColor = p >= 1 ? OrialColors.success : p >= 0.85 ? OrialColors.warning : color;
  return (
    <View style={macroRingStyles.item}>
      <Ring pct={p * 100} size={72} strokeWidth={7} color={statusColor} trackColor={OrialColors.surfaceElevated}>
        <Text style={[macroRingStyles.value, { color: statusColor }]}>{value}</Text>
        <Text style={macroRingStyles.unit}>{unit}</Text>
      </Ring>
      <Text style={macroRingStyles.label}>{label}</Text>
      <Text style={macroRingStyles.goal}>/ {goal}{unit}</Text>
    </View>
  );
}

const macroRingStyles = StyleSheet.create({
  item: { flex: 1, alignItems: 'center', paddingVertical: 18, paddingHorizontal: 8 },
  value: { fontSize: 16, fontWeight: '700', letterSpacing: -0.3, fontFamily: 'Inter-Bold' },
  unit: { fontSize: 8, color: OrialColors.textMuted, fontFamily: 'Inter-Regular', marginTop: -2 },
  label: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, fontFamily: 'Inter-Medium', marginTop: 10 },
  goal: { fontSize: 10, color: OrialColors.textMuted, fontFamily: 'Inter-Regular', marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingRight: 20,
  },
  header: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 },
  cameraBtn: {
    backgroundColor: OrialColors.surfaceElevated,
    borderWidth: 1,
    borderColor: OrialColors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cameraBtnText: { color: OrialColors.violetLight, fontSize: 12, fontFamily: 'Inter-Medium' },
  headerTitle: { fontSize: 28, fontWeight: '700', color: OrialColors.textPrimary, letterSpacing: -0.8, fontFamily: 'Inter-Bold' },
  headerDate: { fontSize: 10, letterSpacing: 1.6, color: OrialColors.textMuted, marginTop: 4, fontFamily: 'Inter-Medium' },
  skeletonContainer: { gap: 10 },
  calorieCard: { marginHorizontal: 16, marginBottom: 10, padding: 20 },
  calorieRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 },
  calorieValue: { fontSize: 36, fontWeight: '700', letterSpacing: -1, lineHeight: 38, fontFamily: 'Inter-Bold' },
  calorieValueLabel: { fontSize: 9, letterSpacing: 1.2, color: OrialColors.textMuted, marginTop: 3, fontFamily: 'Inter-Medium' },
  calorieGoalBox: { alignItems: 'flex-end', paddingHorizontal: 14, paddingVertical: 10, backgroundColor: OrialColors.surfaceElevated, borderRadius: 12, borderWidth: 1, borderColor: OrialColors.border },
  calorieGoalLabel: { fontSize: 8, letterSpacing: 1.2, color: OrialColors.textMuted, fontFamily: 'Inter-Medium' },
  calorieGoalValue: { fontSize: 20, fontWeight: '700', color: OrialColors.textSecondary, fontFamily: 'Inter-Bold', letterSpacing: -0.5 },
  calorieGoalSub: { fontSize: 10, color: OrialColors.textMuted, fontFamily: 'Inter-Regular', marginTop: 2 },
  macroStripCard: { marginHorizontal: 16, marginBottom: 10, padding: 0 },
  macroStrip: { flexDirection: 'row', alignItems: 'stretch' },
  macroStripDivider: { width: 1, backgroundColor: OrialColors.border, marginVertical: 16 },
  emptyCard: { marginHorizontal: 16, marginBottom: 10, padding: 22, alignItems: 'center' },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: OrialColors.textSecondary, fontFamily: 'Inter-SemiBold', marginBottom: 8 },
  emptyBody: { fontSize: 13, color: OrialColors.textMuted, textAlign: 'center', lineHeight: 20, fontFamily: 'Inter-Regular' },
  emptyHint: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 14, backgroundColor: OrialColors.surfaceElevated, borderRadius: 10, borderWidth: 1, borderColor: OrialColors.borderStrong },
  emptyHintText: { fontSize: 11, color: OrialColors.cyan, fontFamily: 'Inter-Regular', fontStyle: 'italic' },
  fetchBtn: {
    marginTop: 16,
    backgroundColor: OrialColors.violet,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    width: '100%',
  },
  fetchBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  microCard: { marginHorizontal: 16, marginBottom: 10, padding: 16 },
  microRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  microLabel: { fontSize: 9, letterSpacing: 1.4, color: OrialColors.textMuted, marginBottom: 5, fontFamily: 'Inter-Medium' },
  microValue: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8, fontFamily: 'Inter-Bold' },
  microNote: { fontSize: 11, color: OrialColors.textMuted, fontFamily: 'Inter-Regular', maxWidth: '50%', textAlign: 'right', lineHeight: 16 },
  disclaimer: { textAlign: 'center', color: OrialColors.textMuted, fontSize: 11, fontFamily: 'Inter-Regular', marginBottom: 32, marginTop: 12, letterSpacing: 0.3 },
  fetchBtnData: { marginHorizontal: 16, marginTop: 4, marginBottom: 8, paddingVertical: 12, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: OrialColors.border, backgroundColor: OrialColors.surface },
  fetchBtnDataText: { fontSize: 13, color: OrialColors.violetLight, fontFamily: 'Inter-Medium' },
});

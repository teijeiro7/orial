import { View, Text, StyleSheet, ScrollView, Pressable, Animated, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useRef, useEffect } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { nutritionService } from '../../src/services/nutritionService';
import type { NutritionLog } from '../../drizzle/schema';

const GOALS = { calories: 2100, protein: 160, carbs: 220, fat: 70 };

function SkeletonBlock({ width, height, style }: { width: number | string; height: number; style?: object }) {
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
    <Animated.View
      style={[{ width, height, backgroundColor: OrialColors.surfaceElevated, borderRadius: 6, opacity }, style]}
    />
  );
}

export default function MacrosScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchMacros(true)}
            tintColor={OrialColors.violetLight}
          />
        }
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Macros</Text>
          <Text style={styles.headerDate}>{format(new Date(), 'EEE, MMM d').toUpperCase()}</Text>
        </View>

        {loading ? (
          <View style={styles.skeletonContainer}>
            <GlassCard style={styles.calorieCard}>
              <SkeletonBlock width={100} height={56} style={{ marginBottom: 10 }} />
              <SkeletonBlock width={60} height={10} style={{ marginBottom: 14 }} />
              <SkeletonBlock width="100%" height={3} />
            </GlassCard>
            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                {[1, 2, 3].map(i => (
                  <View key={i} style={styles.macroStripItem}>
                    <SkeletonBlock width={36} height={10} style={{ marginBottom: 10 }} />
                    <SkeletonBlock width={50} height={30} style={{ marginBottom: 6 }} />
                    <SkeletonBlock width={28} height={8} style={{ marginBottom: 10 }} />
                    <SkeletonBlock width="70%" height={3} />
                  </View>
                ))}
              </View>
            </GlassCard>
          </View>
        ) : !nutrition ? (
          <>
            <GlassCard style={styles.calorieCard}>
              <View style={styles.calorieHeroRow}>
                <View>
                  <Text style={[styles.calorieHero, { color: OrialColors.textMuted }]}>0</Text>
                  <Text style={styles.calorieSubLabel}>KCAL LOGGED</Text>
                </View>
                <View style={styles.calorieGoalBox}>
                  <Text style={styles.calorieGoalLabel}>GOAL</Text>
                  <Text style={styles.calorieGoalValue}>{GOALS.calories}</Text>
                  <Text style={styles.calorieGoalSub}>{GOALS.calories} left</Text>
                </View>
              </View>
              <View style={styles.calorieTrack}>
                <View style={[styles.calorieFill, { width: '0%' }]} />
              </View>
            </GlassCard>

            <GlassCard style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>Nothing logged yet</Text>
              <Text style={styles.emptyBody}>
                Tell Hermes what you ate — it will parse meals and log your macros automatically.
              </Text>
              <View style={styles.emptyHint}>
                <Text style={styles.emptyHintText}>"Breakfast: 3 eggs, toast with butter, OJ"</Text>
              </View>
            </GlassCard>

            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                <MacroStripItem label="PROTEIN" value={0} goal={GOALS.protein} unit="g" color={OrialColors.error} />
                <View style={styles.macroStripDivider} />
                <MacroStripItem label="CARBS" value={0} goal={GOALS.carbs} unit="g" color={OrialColors.cyan} />
                <View style={styles.macroStripDivider} />
                <MacroStripItem label="FAT" value={0} goal={GOALS.fat} unit="g" color={OrialColors.violetLight} />
              </View>
            </GlassCard>
          </>
        ) : (
          <>
            <GlassCard style={styles.calorieCard}>
              <View style={styles.calorieHeroRow}>
                <View>
                  <Text style={[styles.calorieHero, { color: calColor }]}>{nutrition.totalCalories ?? 0}</Text>
                  <Text style={styles.calorieSubLabel}>KCAL LOGGED</Text>
                </View>
                <View style={styles.calorieGoalBox}>
                  <Text style={styles.calorieGoalLabel}>GOAL</Text>
                  <Text style={styles.calorieGoalValue}>{GOALS.calories}</Text>
                  <Text style={[styles.calorieGoalSub, remaining < 0 && { color: OrialColors.error }]}>
                    {remaining >= 0 ? `${remaining} left` : `${Math.abs(remaining)} over`}
                  </Text>
                </View>
              </View>
              <View style={styles.calorieTrack}>
                <View style={[styles.calorieFill, { width: `${(calPct * 100).toFixed(0)}%`, backgroundColor: calColor }]} />
              </View>
            </GlassCard>

            <GlassCard style={styles.macroStripCard}>
              <View style={styles.macroStrip}>
                <MacroStripItem label="PROTEIN" value={nutrition.proteinG ?? 0} goal={GOALS.protein} unit="g" color={OrialColors.error} />
                <View style={styles.macroStripDivider} />
                <MacroStripItem label="CARBS" value={nutrition.carbsG ?? 0} goal={GOALS.carbs} unit="g" color={OrialColors.cyan} />
                <View style={styles.macroStripDivider} />
                <MacroStripItem label="FAT" value={nutrition.fatG ?? 0} goal={GOALS.fat} unit="g" color={OrialColors.violetLight} />
              </View>
            </GlassCard>

            {nutrition.sodiumMg ? (
              <GlassCard style={styles.microCard}>
                <View style={styles.microRow}>
                  <View>
                    <Text style={styles.microLabel}>SODIUM</Text>
                    <Text style={[styles.microValue, { color: OrialColors.warning }]}>{nutrition.sodiumMg} mg</Text>
                  </View>
                  <Text style={styles.microNote}>
                    +{(nutrition.sodiumMg / 2300).toFixed(2)} L extra water recommended
                  </Text>
                </View>
              </GlassCard>
            ) : null}

            {nutrition.fiberG ? (
              <GlassCard style={styles.microCard}>
                <Text style={styles.microLabel}>FIBER</Text>
                <Text style={[styles.microValue, { color: OrialColors.success }]}>{nutrition.fiberG} g</Text>
              </GlassCard>
            ) : null}
          </>
        )}

        <Text style={styles.disclaimer}>Pull to refresh · data from Hermes sessions</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroStripItem({
  label, value, goal, unit, color
}: {
  label: string; value: number; goal: number; unit: string; color: string;
}) {
  const p = goal > 0 ? Math.min(value / goal, 1) : 0;
  const statusColor = p >= 1 ? OrialColors.success : p >= 0.85 ? OrialColors.warning : color;
  return (
    <View style={macroStripStyles.item}>
      <Text style={macroStripStyles.label}>{label}</Text>
      <Text style={[macroStripStyles.value, { color: statusColor }]}>{value}</Text>
      <Text style={macroStripStyles.goal}>/ {goal}{unit}</Text>
      <View style={macroStripStyles.track}>
        <View style={[macroStripStyles.fill, { width: `${(p * 100).toFixed(0)}%`, backgroundColor: statusColor }]} />
      </View>
    </View>
  );
}

const macroStripStyles = StyleSheet.create({
  item: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
    marginBottom: 8,
  },
  value: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
    fontFamily: 'Inter-Bold',
  },
  goal: {
    fontSize: 11,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
    marginTop: 3,
    marginBottom: 12,
  },
  track: {
    width: '75%',
    height: 3,
    backgroundColor: OrialColors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.8,
    fontFamily: 'Inter-Bold',
  },
  headerDate: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: OrialColors.textMuted,
    marginTop: 4,
    fontFamily: 'Inter-Medium',
  },
  skeletonContainer: {
    gap: 10,
  },
  calorieCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 20,
  },
  calorieHeroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 12,
  },
  calorieHero: {
    fontSize: 58,
    fontWeight: '700',
    letterSpacing: -2.5,
    lineHeight: 62,
    fontFamily: 'Inter-Bold',
  },
  calorieSubLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: OrialColors.textMuted,
    marginTop: 2,
    fontFamily: 'Inter-Medium',
  },
  calorieGoalBox: {
    alignItems: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: OrialColors.surfaceElevated,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OrialColors.border,
  },
  calorieGoalLabel: {
    fontSize: 8,
    letterSpacing: 1.2,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Medium',
  },
  calorieGoalValue: {
    fontSize: 20,
    fontWeight: '700',
    color: OrialColors.textSecondary,
    fontFamily: 'Inter-Bold',
    letterSpacing: -0.5,
  },
  calorieGoalSub: {
    fontSize: 10,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
    marginTop: 2,
  },
  calorieTrack: {
    height: 3,
    backgroundColor: OrialColors.surfaceElevated,
    borderRadius: 2,
    overflow: 'hidden',
  },
  calorieFill: {
    height: '100%',
    borderRadius: 2,
    backgroundColor: OrialColors.cyan,
  },
  macroStripCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 0,
  },
  macroStrip: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  macroStripDivider: {
    width: 1,
    backgroundColor: OrialColors.border,
    marginVertical: 16,
  },
  macroStripItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: OrialColors.textSecondary,
    fontFamily: 'Inter-SemiBold',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  emptyHint: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: OrialColors.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OrialColors.borderStrong,
  },
  emptyHintText: {
    fontSize: 11,
    color: OrialColors.cyan,
    fontFamily: 'Inter-Regular',
    fontStyle: 'italic',
  },
  microCard: {
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
  },
  microRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  microLabel: {
    fontSize: 9,
    letterSpacing: 1.4,
    color: OrialColors.textMuted,
    marginBottom: 5,
    fontFamily: 'Inter-Medium',
  },
  microValue: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.8,
    fontFamily: 'Inter-Bold',
  },
  microNote: {
    fontSize: 11,
    color: OrialColors.textMuted,
    fontFamily: 'Inter-Regular',
    maxWidth: '50%',
    textAlign: 'right',
    lineHeight: 16,
  },
  disclaimer: {
    textAlign: 'center',
    color: OrialColors.textMuted,
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    marginBottom: 32,
    marginTop: 12,
    letterSpacing: 0.3,
  },
});

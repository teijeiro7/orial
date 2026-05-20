import { View, Text, StyleSheet, ScrollView, Pressable, RefreshControl, ActivityIndicator, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { Apple, Beef, Wheat, Droplets, Send, RefreshCw } from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { nutritionService } from '../../src/services/nutritionService';
import { agentService } from '../../src/services/openclawService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

interface Macros {
  totalCalories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sodiumMg: number | null;
}

const GOALS = { calories: 2100, protein: 160, carbs: 220, fat: 70 };

export default function MacrosScreen() {
  const [macros, setMacros] = useState<Macros | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMealInput, setShowMealInput] = useState(false);
  const [mealText, setMealText] = useState('');
  const [logging, setLogging] = useState(false);

  const loadFromDb = useCallback(async () => {
    try {
      const data = await nutritionService.getTodayNutrition();
      if (data) {
        setMacros({
          totalCalories: data.totalCalories || 0,
          proteinG: data.proteinG || 0,
          carbsG: data.carbsG || 0,
          fatG: data.fatG || 0,
          sodiumMg: data.sodiumMg || null,
        });
      } else {
        setMacros(null);
      }
    } catch {
      setMacros(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadFromDb();
    }, [loadFromDb])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadFromDb();
  };

  const handleLogMeal = async () => {
    if (!mealText.trim()) return;
    setLogging(true);
    try {
      const configured = await agentService.isConfigured();
      if (!configured) {
        Alert.alert('JARVIS not configured', 'Set up JARVIS in Settings first.');
        setLogging(false);
        return;
      }

      const response = await agentService.chat([
        {
          role: 'system',
          content: `You are a nutrition logger. The user will describe what they ate. Parse the meal and add it to their nutrition logs for today (${new Date().toISOString().split('T')[0]}).

IMPORTANT: You have access to the nutrition database at ~/.hermes/data/nutrition.db. Query it to see today's existing logs, then add this new meal.

Respond with a brief confirmation of what was logged and the updated macro totals. Keep it under 3 sentences.`,
        },
        { role: 'user', content: mealText.trim() },
      ]);

      setShowMealInput(false);
      setMealText('');
      // Reload from local DB after agent logs
      setTimeout(() => loadFromDb(), 500);
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Failed to log meal');
    } finally {
      setLogging(false);
    }
  };

  const pct = (current: number, goal: number) => (goal > 0 ? Math.min(current / goal, 1) : 0);

  const hasData = macros && macros.totalCalories > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={OrialColors.violetLight} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={OrialTypography.caption}>{format(new Date(), 'EEE, MMM d').toUpperCase()}</Text>
            <Text style={OrialTypography.headingMedium}>Macros</Text>
          </View>
          <Pressable onPress={handleRefresh} style={styles.refreshBtn}>
            <RefreshCw size={18} color={OrialColors.textMuted} />
          </Pressable>
        </View>

        {/* Calories */}
        <GlassCard style={styles.caloriesCard}>
          <View style={styles.caloriesRow}>
            <View>
              <Text style={styles.caloriesValue}>{macros?.totalCalories ?? 0}</Text>
              <Text style={styles.caloriesLabel}>KCAL LOGGED</Text>
            </View>
            <View style={styles.goalBox}>
              <Text style={styles.goalLabel}>GOAL</Text>
              <Text style={styles.goalValue}>{GOALS.calories}</Text>
              <Text style={styles.goalRemaining}>{Math.max(GOALS.calories - (macros?.totalCalories ?? 0), 0)} left</Text>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.caloriesProgress,
                { width: `${(pct(macros?.totalCalories ?? 0, GOALS.calories) * 100).toFixed(0)}%` },
              ]}
            />
          </View>
        </GlassCard>

        {/* Meal Input / Log Prompt */}
        {showMealInput ? (
          <GlassCard style={styles.inputCard}>
            <TextInput
              style={styles.mealInput}
              placeholder='e.g. "Breakfast: 3 eggs, toast with butter, OJ"'
              placeholderTextColor={OrialColors.textMuted}
              value={mealText}
              onChangeText={setMealText}
              multiline
              autoFocus
            />
            <View style={styles.inputActions}>
              <Pressable onPress={() => { setShowMealInput(false); setMealText(''); }} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleLogMeal} disabled={logging || !mealText.trim()} style={[styles.logBtn, (!mealText.trim() || logging) && { opacity: 0.5 }]}>
                {logging ? (
                  <ActivityIndicator size="small" color={OrialColors.textPrimary} />
                ) : (
                  <>
                    <Send size={16} color={OrialColors.textPrimary} />
                    <Text style={styles.logBtnText}>Log via JARVIS</Text>
                  </>
                )}
              </Pressable>
            </View>
          </GlassCard>
        ) : (
          <GlassCard style={styles.promptCard}>
            {hasData ? (
              <Text style={styles.promptText}>Tap below to log another meal</Text>
            ) : (
              <>
                <Text style={styles.promptTitle}>Nothing logged yet</Text>
                <Text style={styles.promptSubtitle}>
                  Tell JARVIS what you ate — it will parse meals and log your macros automatically.
                </Text>
              </>
            )}
            <Pressable onPress={() => setShowMealInput(true)} style={styles.logMealBtn}>
              <Text style={styles.logMealBtnText}>
                {hasData ? 'Log another meal' : '"Breakfast: 3 eggs, toast with butter, OJ"'}
              </Text>
            </Pressable>
          </GlassCard>
        )}

        {/* Macro Breakdown */}
        <GlassCard style={styles.macroCard}>
          <View style={styles.macroGrid}>
            <MacroItem label="PROTEIN" value={macros?.proteinG ?? 0} goal={GOALS.protein} color={OrialColors.error} />
            <MacroItem label="CARBS" value={macros?.carbsG ?? 0} goal={GOALS.carbs} color={OrialColors.cyan} />
            <MacroItem label="FAT" value={macros?.fatG ?? 0} goal={GOALS.fat} color={OrialColors.violetLight} />
          </View>
        </GlassCard>

        {!loading && macros?.sodiumMg && (
          <Text style={styles.sodiumNote}>Sodium: {macros.sodiumMg}mg</Text>
        )}

        <Text style={styles.disclaimer}>Pull to refresh · data from local database</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function MacroItem({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const p = goal > 0 ? Math.min(value / goal, 1) : 0;
  return (
    <View style={styles.macroItem}>
      <Text style={styles.macroLabel}>{label}</Text>
      <Text style={[styles.macroValue, { color }]}>{value}</Text>
      <Text style={styles.macroGoal}>/ {goal}g</Text>
      <View style={styles.macroProgressTrack}>
        <View style={[styles.macroProgressFill, { width: `${(p * 100).toFixed(0)}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OrialColors.deepNavy },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
  },
  // Calories card
  caloriesCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  caloriesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  caloriesValue: {
    fontSize: 36,
    fontWeight: '700',
    color: OrialColors.textPrimary,
  },
  caloriesLabel: {
    fontSize: 12,
    color: OrialColors.textMuted,
    letterSpacing: 1,
    marginTop: 2,
  },
  goalBox: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    minWidth: 90,
  },
  goalLabel: {
    fontSize: 10,
    color: OrialColors.textMuted,
    letterSpacing: 1,
  },
  goalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: OrialColors.textPrimary,
  },
  goalRemaining: {
    fontSize: 11,
    color: OrialColors.textMuted,
    marginTop: 2,
  },
  progressTrack: {
    height: 6,
    backgroundColor: OrialColors.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  caloriesProgress: {
    height: '100%',
    backgroundColor: OrialColors.warning,
    borderRadius: 3,
  },
  // Prompt / meal input
  promptCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 20,
    alignItems: 'center',
  },
  promptTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: OrialColors.textPrimary,
    marginBottom: 8,
  },
  promptSubtitle: {
    fontSize: 13,
    color: OrialColors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  promptText: {
    fontSize: 13,
    color: OrialColors.textSecondary,
    marginBottom: 16,
  },
  logMealBtn: {
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    width: '100%',
  },
  logMealBtnText: {
    color: OrialColors.cyan,
    fontSize: 14,
  },
  inputCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  mealInput: {
    color: OrialColors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  inputActions: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'flex-end',
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  cancelText: {
    color: OrialColors.textMuted,
    fontSize: 14,
  },
  logBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  logBtnText: {
    color: OrialColors.textPrimary,
    fontWeight: '600',
    fontSize: 14,
  },
  // Macro breakdown
  macroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  macroItem: {
    flex: 1,
    alignItems: 'center',
  },
  macroLabel: {
    fontSize: 10,
    color: OrialColors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  macroGoal: {
    fontSize: 12,
    color: OrialColors.textMuted,
    marginBottom: 8,
  },
  macroProgressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: OrialColors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  macroProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Misc
  sodiumNote: {
    textAlign: 'center',
    fontSize: 12,
    color: OrialColors.warning,
    marginBottom: 8,
  },
  disclaimer: {
    textAlign: 'center',
    fontSize: 11,
    color: OrialColors.textMuted,
    marginBottom: 32,
  },
});

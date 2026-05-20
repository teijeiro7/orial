import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Apple, Beef, Wheat, Droplets, RefreshCw, AlertCircle } from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { agentService } from '../../src/services/openclawService';

interface MacroData {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  goals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

const DEFAULT_GOALS = {
  calories: 2100,
  protein: 160,
  carbs: 220,
  fat: 70,
};

export default function MacrosScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [macros, setMacros] = useState<MacroData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMacros = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const configured = await agentService.isConfigured();
      if (!configured) {
        setError('JARVIS not configured. Go to Settings to set it up.');
        return;
      }

      const today = new Date().toISOString().split('T')[0];

      const response = await agentService.chat([
        {
          role: 'system',
          content: `You are a nutrition tracker. Return today's nutrition macros as valid JSON only, no other text.
Today's date: ${today}

Query the user's meal database and return:

{
  "calories": <total_calories>,
  "protein": <total_protein_g>,
  "carbs": <total_carbs_g>,
  "fat": <total_fat_g>,
  "goals": {
    "calories": 2100,
    "protein": 160,
    "carbs": 220,
    "fat": 70
  }
}

If no meals are logged today, return the goals with 0 values. Use EXACT keys as shown.`,
        },
        { role: 'user', content: 'Get my nutrition macros for today' },
      ]);

      // Try to parse JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        setMacros({
          calories: parsed.calories ?? 0,
          protein: parsed.protein ?? 0,
          carbs: parsed.carbs ?? 0,
          fat: parsed.fat ?? 0,
          goals: parsed.goals ?? DEFAULT_GOALS,
        });
      } else {
        // Fallback: use default empty state
        setMacros({ calories: 0, protein: 0, carbs: 0, fat: 0, goals: DEFAULT_GOALS });
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch macros');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchMacros();
    }, [fetchMacros])
  );

  const progress = (current: number, goal: number) =>
    goal > 0 ? Math.min(current / goal, 1) : 0;

  if (loading && !macros) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={OrialColors.violetLight} />
          <Text style={[OrialTypography.bodyMedium, styles.loadingText]}>
            Fetching macros from JARVIS...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={styles.centered}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchMacros(true)}
              tintColor={OrialColors.violetLight}
            />
          }
        >
          <AlertCircle size={48} color={OrialColors.warning} />
          <Text style={[OrialTypography.bodyMedium, styles.errorText]}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={() => fetchMacros()}>
            <RefreshCw size={16} color={OrialColors.textPrimary} />
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const p = macros ? progress(macros.calories, macros.goals.calories) : 0;
  const pp = macros ? progress(macros.protein, macros.goals.protein) : 0;
  const pc = macros ? progress(macros.carbs, macros.goals.carbs) : 0;
  const pf = macros ? progress(macros.fat, macros.goals.fat) : 0;

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
          <Text style={OrialTypography.headingMedium}>Today's Macros</Text>
          <Pressable onPress={() => fetchMacros()} style={styles.refreshBtn}>
            <RefreshCw size={18} color={OrialColors.textMuted} />
          </Pressable>
        </View>

        {/* Calories */}
        <GlassCard style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={[styles.macroIcon, { backgroundColor: OrialColors.warning + '20' }]}>
              <Apple size={20} color={OrialColors.warning} />
            </View>
            <View style={styles.macroInfo}>
              <Text style={OrialTypography.headingMedium}>
                {macros?.calories ?? 0} / {macros?.goals.calories ?? 2100}
              </Text>
              <Text style={OrialTypography.caption}>Calories</Text>
            </View>
            <Text style={[OrialTypography.headingSmall, {
              color: p >= 1 ? OrialColors.success : p >= 0.85 ? OrialColors.warning : OrialColors.textMuted
            }]}>
              {(p * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(p * 100).toFixed(0)}%`, backgroundColor: p >= 1 ? OrialColors.success : OrialColors.warning }]} />
          </View>
        </GlassCard>

        {/* Protein */}
        <GlassCard style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={[styles.macroIcon, { backgroundColor: OrialColors.error + '20' }]}>
              <Beef size={20} color={OrialColors.error} />
            </View>
            <View style={styles.macroInfo}>
              <Text style={OrialTypography.headingMedium}>
                {macros?.protein ?? 0}g / {macros?.goals.protein ?? 160}g
              </Text>
              <Text style={OrialTypography.caption}>Protein</Text>
            </View>
            <Text style={[OrialTypography.headingSmall, {
              color: pp >= 1 ? OrialColors.success : pp >= 0.85 ? OrialColors.warning : OrialColors.textMuted
            }]}>
              {(pp * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(pp * 100).toFixed(0)}%`, backgroundColor: pp >= 1 ? OrialColors.success : OrialColors.error }]} />
          </View>
        </GlassCard>

        {/* Carbs */}
        <GlassCard style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={[styles.macroIcon, { backgroundColor: OrialColors.cyan + '20' }]}>
              <Wheat size={20} color={OrialColors.cyan} />
            </View>
            <View style={styles.macroInfo}>
              <Text style={OrialTypography.headingMedium}>
                {macros?.carbs ?? 0}g / {macros?.goals.carbs ?? 220}g
              </Text>
              <Text style={OrialTypography.caption}>Carbs</Text>
            </View>
            <Text style={[OrialTypography.headingSmall, {
              color: pc >= 1 ? OrialColors.success : pc >= 0.85 ? OrialColors.warning : OrialColors.textMuted
            }]}>
              {(pc * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(pc * 100).toFixed(0)}%`, backgroundColor: pc >= 1 ? OrialColors.success : OrialColors.cyan }]} />
          </View>
        </GlassCard>

        {/* Fat */}
        <GlassCard style={styles.macroCard}>
          <View style={styles.macroHeader}>
            <View style={[styles.macroIcon, { backgroundColor: OrialColors.violetLight + '20' }]}>
              <Droplets size={20} color={OrialColors.violetLight} />
            </View>
            <View style={styles.macroInfo}>
              <Text style={OrialTypography.headingMedium}>
                {macros?.fat ?? 0}g / {macros?.goals.fat ?? 70}g
              </Text>
              <Text style={OrialTypography.caption}>Fat</Text>
            </View>
            <Text style={[OrialTypography.headingSmall, {
              color: pf >= 1 ? OrialColors.success : pf >= 0.85 ? OrialColors.warning : OrialColors.textMuted
            }]}>
              {(pf * 100).toFixed(0)}%
            </Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(pf * 100).toFixed(0)}%`, backgroundColor: pf >= 1 ? OrialColors.success : OrialColors.violetLight }]} />
          </View>
        </GlassCard>

        <Text style={[OrialTypography.caption, styles.disclaimer]}>
          Data pulled from JARVIS. Pull down to refresh.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: OrialColors.textMuted,
    marginTop: 16,
  },
  errorText: {
    color: OrialColors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  retryText: {
    color: OrialColors.textPrimary,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  refreshBtn: {
    padding: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 10,
  },
  macroCard: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
  },
  macroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  macroIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroInfo: {
    flex: 1,
  },
  progressTrack: {
    height: 8,
    backgroundColor: OrialColors.surface,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  disclaimer: {
    textAlign: 'center',
    color: OrialColors.textMuted,
    marginBottom: 32,
  },
});

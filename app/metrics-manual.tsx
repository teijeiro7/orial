import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useEffect } from 'react';
import { Scale, Footprints, Dumbbell, Utensils, Save } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { manualMetricsService } from '@/src/services/manualMetricsService';
import { weightPredictionService } from '@/src/services/weightPredictionService';
import { todayDateString } from '@/src/utils/date';
import type { ManualMetric } from '@/drizzle/schema';

export default function ManualMetricsScreen() {
  const [metrics, setMetrics] = useState<Partial<ManualMetric>>({
    stepsWalk: undefined,
    stepsConscious: undefined,
    workoutMinutes: undefined,
    workoutCalories: undefined,
    caloriesIn: undefined,
    sodiumMg: undefined,
    carbsG: undefined,
    proteinG: undefined,
    fatG: undefined,
    fiberG: undefined,
    bowelMovement: undefined,
    bowelVolume: undefined,
    sleepQuality: undefined,
    stressLevel: undefined,
    notes: undefined,
  });

  const loadTodayMetrics = async () => {
    const today = await manualMetricsService.getTodayMetrics();
    if (today) {
      setMetrics(today);
    }
  };

  useEffect(() => {
    loadTodayMetrics();
  }, []);

  const handleSave = async () => {
    const today = todayDateString();
    
    const updateData: Partial<Omit<ManualMetric, 'date' | 'updatedAt'>> = {};
    
    if (metrics.stepsWalk !== undefined) updateData.stepsWalk = metrics.stepsWalk ? parseInt(String(metrics.stepsWalk)) : null;
    if (metrics.stepsConscious !== undefined) updateData.stepsConscious = metrics.stepsConscious ? parseInt(String(metrics.stepsConscious)) : null;
    if (metrics.workoutMinutes !== undefined) updateData.workoutMinutes = metrics.workoutMinutes ? parseInt(String(metrics.workoutMinutes)) : null;
    if (metrics.workoutCalories !== undefined) updateData.workoutCalories = metrics.workoutCalories ? parseInt(String(metrics.workoutCalories)) : null;
    if (metrics.caloriesIn !== undefined) updateData.caloriesIn = metrics.caloriesIn ? parseInt(String(metrics.caloriesIn)) : null;
    if (metrics.sodiumMg !== undefined) updateData.sodiumMg = metrics.sodiumMg ? parseInt(String(metrics.sodiumMg)) : null;
    if (metrics.carbsG !== undefined) updateData.carbsG = metrics.carbsG ? parseInt(String(metrics.carbsG)) : null;
    if (metrics.proteinG !== undefined) updateData.proteinG = metrics.proteinG ? parseInt(String(metrics.proteinG)) : null;
    if (metrics.fatG !== undefined) updateData.fatG = metrics.fatG ? parseInt(String(metrics.fatG)) : null;
    if (metrics.fiberG !== undefined) updateData.fiberG = metrics.fiberG ? parseInt(String(metrics.fiberG)) : null;
    if (metrics.bowelMovement !== undefined) updateData.bowelMovement = metrics.bowelMovement ? true : false;
    if (metrics.bowelVolume !== undefined) updateData.bowelVolume = metrics.bowelVolume ? String(metrics.bowelVolume) : null;
    if (metrics.sleepQuality !== undefined) updateData.sleepQuality = metrics.sleepQuality ? parseInt(String(metrics.sleepQuality)) : null;
    if (metrics.stressLevel !== undefined) updateData.stressLevel = metrics.stressLevel ? parseInt(String(metrics.stressLevel)) : null;
    if (metrics.notes !== undefined) updateData.notes = metrics.notes ? String(metrics.notes) : null;

    await manualMetricsService.updateMetrics(today, updateData);
    await weightPredictionService.generatePrediction(today);
  };

  const renderInput = (
    label: string,
    key: keyof ManualMetric,
    icon: React.ReactNode,
    keyboardType: 'numeric' | 'default' = 'numeric',
    placeholder?: string
  ) => (
    <View style={styles.inputGroup}>
      <View style={styles.inputLabel}>
        {icon}
        <Text style={[OrialTypography.bodyMedium, styles.labelText]}>{label}</Text>
      </View>
      <TextInput
        style={styles.input}
        value={metrics[key] !== null && metrics[key] !== undefined ? String(metrics[key]) : ''}
        onChangeText={(text) => setMetrics({ ...metrics, [key]: text })}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        placeholderTextColor={OrialColors.textMuted}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Daily Metrics</Text>
          <Text style={OrialTypography.caption}>Track activity, nutrition, and wellness</Text>
        </View>

        <GlassCard style={styles.formCard}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Activity</Text>
          
          {renderInput(
            'Steps Walk',
            'stepsWalk',
            <Footprints size={18} color={OrialColors.warning} />,
            'numeric',
            'Daily walking steps'
          )}

          {renderInput(
            'Steps Conscious',
            'stepsConscious',
            <Footprints size={18} color={OrialColors.cyan} />,
            'numeric',
            'Conscious movement steps'
          )}

          {renderInput(
            'Workout (min)',
            'workoutMinutes',
            <Dumbbell size={18} color={OrialColors.error} />,
            'numeric',
            'Exercise duration'
          )}

          {renderInput(
            'Workout Calories',
            'workoutCalories',
            <Dumbbell size={18} color={OrialColors.categoryFitness} />,
            'numeric',
            'Calories burned in workout'
          )}

          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Nutrition</Text>

          {renderInput(
            'Calories In',
            'caloriesIn',
            <Utensils size={18} color={OrialColors.categoryHealth} />,
            'numeric',
            'Total calories consumed'
          )}

          {renderInput(
            'Protein (g)',
            'proteinG',
            <Utensils size={18} color={OrialColors.violetLight} />,
            'numeric',
            'Total protein'
          )}

          {renderInput(
            'Carbs (g)',
            'carbsG',
            <Utensils size={18} color={OrialColors.categoryLearn} />,
            'numeric',
            'Total carbs'
          )}

          {renderInput(
            'Fat (g)',
            'fatG',
            <Utensils size={18} color={OrialColors.categoryMind} />,
            'numeric',
            'Total fat'
          )}

          {renderInput(
            'Sodium (mg)',
            'sodiumMg',
            <Utensils size={18} color={OrialColors.categorySocial} />,
            'numeric',
            'Daily sodium intake'
          )}

          {renderInput(
            'Fiber (g)',
            'fiberG',
            <Utensils size={18} color={OrialColors.success} />,
            'numeric',
            'Total fiber'
          )}

          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Wellness</Text>

          {renderInput(
            'Sleep Quality (1-10)',
            'sleepQuality',
            <Scale size={18} color={OrialColors.violetLight} />,
            'numeric',
            'Rate your sleep quality'
          )}

          {renderInput(
            'Stress Level (1-10)',
            'stressLevel',
            <Scale size={18} color={OrialColors.error} />,
            'numeric',
            'Rate your stress level'
          )}

          {renderInput(
            'Bowel Volume',
            'bowelVolume',
            <Scale size={18} color={OrialColors.textMuted} />,
            'default',
            'Description of bowel movement'
          )}

          <View style={styles.inputGroup}>
            <Text style={[OrialTypography.bodyMedium, styles.labelText]}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={metrics.notes || ''}
              onChangeText={(text) => setMetrics({ ...metrics, notes: text })}
              placeholder="Any notes for today..."
              placeholderTextColor={OrialColors.textMuted}
              multiline
            />
          </View>
        </GlassCard>

        <Pressable style={styles.saveButton} onPress={handleSave}>
          <Save size={20} color={OrialColors.textPrimary} />
          <Text style={styles.saveButtonText}>Save Metrics</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    padding: 20,
    paddingBottom: 8,
  },
  formCard: {
    margin: 16,
    padding: 16,
  },
  sectionTitle: {
    marginTop: 16,
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  labelText: {
    color: OrialColors.textSecondary,
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 14,
    color: OrialColors.textPrimary,
    fontSize: 16,
  },
  notesInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: OrialColors.success,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  saveButtonText: {
    color: OrialColors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});

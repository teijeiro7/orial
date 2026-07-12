import React from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import {
  ChevronDown,
  ChevronRight,
  Check,
  RefreshCw,
  PartyPopper,
} from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { ProgressBar } from './ProgressBar';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';
import type { GymExercise, GymSet } from '../../drizzle/schema';
import type { ProgressionResult } from '../services/gymCoachService';

export type GymSetRowProps = {
  exercise: GymExercise;
  sets: GymSet[];
  isExpanded: boolean;
  isSessionActive: boolean;
  repsValue: string;
  weightValue: string;
  /** When present, renders the "auto-increase" celebration banner. */
  progression?: ProgressionResult | null;
  onToggle: () => void;
  onChangeReps: (value: string) => void;
  onChangeWeight: (value: string) => void;
  onLogSet: () => void;
  onSwap: () => void;
};

/**
 * One exercise inside a gym session: header, logged-sets table, set logger,
 * a swap action (when the exercise belongs to a swap group) and, when the
 * coach has bumped the weight, an auto-increase banner.
 */
export function GymSetRow({
  exercise,
  sets,
  isExpanded,
  isSessionActive,
  repsValue,
  weightValue,
  progression,
  onToggle,
  onChangeReps,
  onChangeWeight,
  onLogSet,
  onSwap,
}: GymSetRowProps) {
  const allSetsDone = sets.length >= exercise.targetSets;
  const canSwap = !!exercise.swapGroup;
  const statusColor =
    sets.length === 0
      ? OrialColors.borderStrong
      : allSetsDone
        ? OrialColors.success
        : OrialColors.violetLight;
  const progressPct = exercise.targetSets > 0 ? (sets.length / exercise.targetSets) * 100 : 0;

  return (
    <GlassCard style={styles.card}>
      <Pressable style={styles.header} onPress={onToggle}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <View style={styles.info}>
          <Text style={OrialTypography.bodyMedium}>{exercise.name}</Text>
          <View style={styles.progressTrack}>
            <ProgressBar pct={progressPct} color={statusColor} />
          </View>
          <Text style={[OrialTypography.caption, styles.muted]}>
            {sets.length}/{exercise.targetSets} sets · {exercise.targetRepsMin}-{exercise.targetRepsMax} reps
          </Text>
        </View>
        {isExpanded ? (
          <ChevronDown size={18} color={OrialColors.textMuted} />
        ) : (
          <ChevronRight size={18} color={OrialColors.textMuted} />
        )}
      </Pressable>

      {isExpanded && (
        <View style={styles.body}>
          {/* Logged sets table */}
          {sets.length > 0 && (
            <View style={styles.table}>
              <View style={[styles.tableRow, styles.tableHead]}>
                <Text style={[OrialTypography.caption, styles.colSerie, styles.muted]}>Serie</Text>
                <Text style={[OrialTypography.caption, styles.colCell, styles.muted]}>Reps</Text>
                <Text style={[OrialTypography.caption, styles.colCell, styles.muted]}>Peso</Text>
                <Text style={[OrialTypography.caption, styles.colCheck, styles.muted]}>✓</Text>
              </View>
              {sets.map((s) => (
                <View key={s.id} style={styles.tableRow}>
                  <Text style={[OrialTypography.caption, styles.colSerie]}>{s.setNumber}</Text>
                  <Text style={[OrialTypography.caption, styles.colCell]}>{s.reps}</Text>
                  <Text style={[OrialTypography.caption, styles.colCell]}>{s.weightKg}</Text>
                  <Text style={[styles.colCheck]}>✅</Text>
                </View>
              ))}
            </View>
          )}

          {/* Set logger */}
          {isSessionActive && !allSetsDone && (
            <View style={styles.logRow}>
              <TextInput
                style={[styles.miniInput, { flex: 1 }]}
                placeholder="Reps"
                placeholderTextColor={OrialColors.textMuted}
                keyboardType="numeric"
                value={repsValue}
                onChangeText={onChangeReps}
              />
              <TextInput
                style={[styles.miniInput, { flex: 1 }]}
                placeholder={`${exercise.currentWeightKg} kg`}
                placeholderTextColor={OrialColors.textMuted}
                keyboardType="numeric"
                value={weightValue}
                onChangeText={onChangeWeight}
              />
              <Pressable style={styles.logBtn} onPress={onLogSet}>
                <Check size={16} color={OrialColors.textPrimary} />
              </Pressable>
            </View>
          )}

          {isSessionActive && allSetsDone && (
            <Text style={[OrialTypography.caption, { color: OrialColors.success, marginTop: 8 }]}>
              All sets complete
            </Text>
          )}

          {/* Swap action */}
          {canSwap && (
            <Pressable style={styles.swapBtn} onPress={onSwap}>
              <RefreshCw size={14} color={OrialColors.cyan} />
              <Text style={[OrialTypography.caption, { color: OrialColors.cyan }]}>Swap</Text>
            </Pressable>
          )}

          {/* Auto-increase banner */}
          {progression && (
            <View style={styles.progressBanner}>
              <PartyPopper size={16} color={OrialColors.warning} />
              <View style={{ flex: 1 }}>
                <Text style={[OrialTypography.caption, { color: OrialColors.warning }]}>
                  ¡Subida automática!
                </Text>
                <Text style={[OrialTypography.caption, styles.muted]}>{progression.reason}</Text>
              </View>
            </View>
          )}
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 0, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  info: { flex: 1 },
  muted: { color: OrialColors.textMuted },
  statusDot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  progressTrack: { marginTop: 6, marginBottom: 4 },
  body: { paddingHorizontal: 14, paddingBottom: 14 },
  table: { marginBottom: 10, borderRadius: 8, overflow: 'hidden' },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tableHead: { borderBottomWidth: 1, borderBottomColor: OrialColors.glassBorder },
  colSerie: { width: 48, textAlign: 'center', color: OrialColors.textPrimary },
  colCell: { flex: 1, textAlign: 'center', color: OrialColors.textPrimary },
  colCheck: { width: 32, textAlign: 'center', fontSize: 12 },
  logRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  miniInput: {
    backgroundColor: OrialColors.surface,
    borderRadius: 8,
    padding: 8,
    ...OrialTypography.caption,
    color: OrialColors.textPrimary,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  logBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  swapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OrialColors.cyan + '55',
  },
  progressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    padding: 10,
    borderRadius: 10,
    backgroundColor: OrialColors.warning + '18',
    borderWidth: 1,
    borderColor: OrialColors.warning + '40',
  },
});

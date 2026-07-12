import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Calendar, SkipForward, Check } from 'lucide-react-native';
import { useState } from 'react';
import { CalendarSettingsScreen } from '../../settings/calendar';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface CalendarStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function CalendarStep({ onNext, onSkip }: CalendarStepProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isConfigured, setIsConfigured] = useState(false);

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Calendar size={32} color={OrialColors.categorySocial} />
          </View>
          
          <Text style={OrialTypography.headingMedium}>Calendar</Text>
          <Text style={[OrialTypography.bodyMedium, styles.description]}>
            Sync reminders to your device calendar for better time management.
          </Text>
        </View>

        <GlassCard style={styles.featuresCard}>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Recurring calendar events</Text>
          </View>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Works with any calendar app</Text>
          </View>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Automatic event creation</Text>
          </View>
        </GlassCard>

        <View style={styles.actions}>
          <Pressable 
            style={styles.primaryButton} 
            onPress={() => setShowSettings(true)}
          >
            <Text style={[OrialTypography.button, styles.primaryButtonText]}>
              {isConfigured ? 'Manage Calendar' : 'Allow Calendar Access'}
            </Text>
            <ArrowRight size={20} color={OrialColors.textPrimary} />
          </Pressable>
          
          <Pressable style={styles.secondaryButton} onPress={onNext}>
            <Text style={[OrialTypography.button, styles.secondaryButtonText]}>Continue</Text>
          </Pressable>
          
          <Pressable style={styles.skipButton} onPress={onSkip}>
            <SkipForward size={16} color={OrialColors.textMuted} />
            <Text style={[OrialTypography.caption, styles.skipText]}>Skip for now</Text>
          </Pressable>
        </View>
      </View>

      <CalendarSettingsScreen
        visible={showSettings}
        onClose={() => {
          setShowSettings(false);
          setIsConfigured(true);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: OrialColors.categorySocial + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    marginTop: 8,
  },
  featuresCard: {
    padding: 20,
    marginBottom: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  actions: {
    gap: 12,
    marginTop: 'auto',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: OrialColors.textPrimary,
  },
  secondaryButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: OrialColors.textSecondary,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  skipText: {
    color: OrialColors.textMuted,
  },
});

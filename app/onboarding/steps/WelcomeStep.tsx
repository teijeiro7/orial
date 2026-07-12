import { View, Text, StyleSheet, Pressable, TextInput, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowRight, SkipForward, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Sparkles size={64} color={OrialColors.violetLight} />
        </View>
        
        <Text style={[OrialTypography.displayLarge, styles.title]}>Orial</Text>
        <Text style={[OrialTypography.headingSmall, styles.subtitle]}>
          Your AI-Powered Wellness Companion
        </Text>
        
        <Text style={[OrialTypography.bodyMedium, styles.description]}>
          Get AI suggestions, track your progress, and sync everything to Notion.
        </Text>
      </View>

      <View style={styles.actions}>
        <Pressable style={styles.primaryButton} onPress={onNext}>
          <Text style={[OrialTypography.button, styles.primaryButtonText]}>Get Started</Text>
          <ArrowRight size={20} color={OrialColors.textPrimary} />
        </Pressable>
        
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={[OrialTypography.caption, styles.skipText]}>Set up later</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: OrialColors.violet + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: OrialColors.violetLight,
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    maxWidth: 280,
  },
  actions: {
    gap: 16,
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
  skipButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  skipText: {
    color: OrialColors.textMuted,
  },
});

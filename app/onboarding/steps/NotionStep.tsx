import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { ArrowRight, Database, SkipForward, Check } from 'lucide-react-native';
import { useState } from 'react';
import { NotionSettingsScreen } from '../../settings/notion';
import { notionService } from '../../../src/services/notionService';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface NotionStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function NotionStep({ onNext, onSkip }: NotionStepProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  async function checkConnection() {
    const creds = await notionService.loadCredentials();
    setIsConnected(!!creds);
  }

  return (
    <>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Database size={32} color={OrialColors.categoryWork} />
          </View>
          
          <Text style={OrialTypography.headingMedium}>Notion Sync</Text>
          <Text style={[OrialTypography.bodyMedium, styles.description]}>
            Sync your data with Notion for advanced tracking and analysis.
          </Text>
        </View>

        <GlassCard style={styles.featuresCard}>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Auto-create workspace databases</Text>
          </View>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Bidirectional sync</Text>
          </View>
          <View style={styles.feature}>
            <Check size={16} color={OrialColors.success} />
            <Text style={OrialTypography.bodySmall}>Offline-first, syncs when online</Text>
          </View>
        </GlassCard>

        {isConnected && (
          <GlassCard style={styles.successCard}>
            <View style={styles.successRow}>
              <Check size={20} color={OrialColors.success} />
              <Text style={[OrialTypography.bodyMedium, { color: OrialColors.success }]}>
                Connected to Notion!
              </Text>
            </View>
          </GlassCard>
        )}

        <View style={styles.actions}>
          <Pressable 
            style={styles.primaryButton} 
            onPress={() => setShowSettings(true)}
          >
            <Text style={[OrialTypography.button, styles.primaryButtonText]}>
              {isConnected ? 'Manage Connection' : 'Connect Notion'}
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

      <NotionSettingsScreen
        visible={showSettings}
        onClose={() => {
          setShowSettings(false);
          checkConnection();
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
    backgroundColor: OrialColors.categoryWork + '20',
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
  successCard: {
    marginBottom: 16,
    backgroundColor: OrialColors.success + '10',
    borderColor: OrialColors.success + '30',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

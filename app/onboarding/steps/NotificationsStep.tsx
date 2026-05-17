import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ArrowRight, Bell, SkipForward, Check } from 'lucide-react-native';
import { useState, useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface NotificationsStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function NotificationsStep({ onNext, onSkip }: NotificationsStepProps) {
  const [permissionStatus, setPermissionStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  useEffect(() => {
    checkPermissions();
  }, []);

  async function checkPermissions() {
    const { status } = await Notifications.getPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'unknown');
  }

  async function requestPermissions() {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermissionStatus(status === 'granted' ? 'granted' : 'denied');
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Bell size={32} color={OrialColors.warning} />
        </View>
        
        <Text style={OrialTypography.headingMedium}>Stay on Track</Text>
        <Text style={[OrialTypography.bodyMedium, styles.description]}>
          Get gentle reminders to complete your habits and maintain your streaks.
        </Text>
      </View>

      <GlassCard style={styles.featuresCard}>
        <View style={styles.feature}>
          <Check size={16} color={OrialColors.success} />
          <Text style={OrialTypography.bodySmall}>Customizable reminder times</Text>
        </View>
        <View style={styles.feature}>
          <Check size={16} color={OrialColors.success} />
          <Text style={OrialTypography.bodySmall}>Streak celebration notifications</Text>
        </View>
        <View style={styles.feature}>
          <Check size={16} color={OrialColors.success} />
          <Text style={OrialTypography.bodySmall}>Smart timing based on habit schedule</Text>
        </View>
      </GlassCard>

      {permissionStatus === 'granted' && (
        <GlassCard style={styles.successCard}>
          <View style={styles.successRow}>
            <Check size={20} color={OrialColors.success} />
            <Text style={[OrialTypography.bodyMedium, { color: OrialColors.success }]}>
              Notifications enabled!
            </Text>
          </View>
        </GlassCard>
      )}

      {permissionStatus === 'denied' && (
        <GlassCard style={styles.warningCard}>
          <Text style={[OrialTypography.bodySmall, { color: OrialColors.warning }]}>
            Notifications are blocked. Please enable them in your device settings to receive habit reminders.
          </Text>
        </GlassCard>
      )}

      <View style={styles.actions}>
        {permissionStatus !== 'granted' && (
          <Pressable 
            style={styles.primaryButton} 
            onPress={requestPermissions}
          >
            <Text style={[OrialTypography.button, styles.primaryButtonText]}>
              {permissionStatus === 'denied' ? 'Retry Permissions' : 'Enable Notifications'}
            </Text>
            <ArrowRight size={20} color={OrialColors.textPrimary} />
          </Pressable>
        )}
        
        <Pressable 
          style={permissionStatus === 'granted' ? styles.primaryButton : styles.secondaryButton} 
          onPress={onNext}
        >
          <Text style={[
            OrialTypography.button, 
            permissionStatus === 'granted' ? styles.primaryButtonText : styles.secondaryButtonText
          ]}>
            Continue
          </Text>
        </Pressable>
        
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <SkipForward size={16} color={OrialColors.textMuted} />
          <Text style={[OrialTypography.caption, styles.skipText]}>Skip for now</Text>
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
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: OrialColors.warning + '20',
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
  warningCard: {
    marginBottom: 16,
    backgroundColor: OrialColors.warning + '10',
    borderColor: OrialColors.warning + '30',
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
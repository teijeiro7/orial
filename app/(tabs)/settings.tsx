import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { GlassCard } from '../../src/components/GlassCard';
import { SectionLabel } from '../../src/components/SectionLabel';
import { NotionSettingsScreen } from '../settings/notion';
import { CalendarSettingsScreen } from '../settings/calendar';
import { JarvisSettingsScreen } from '../settings/jarvis';
import { useAppStore } from '../../src/stores/appStore';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { ChevronRight, RotateCcw, User, LogOut } from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import { useState } from 'react';

export default function SettingsScreen() {
  const router = useRouter();
  const { setOnboardingCompleted } = useAppStore();
  const { user, logout } = useAuth();
  const [isNotionVisible, setIsNotionVisible] = useState(false);
  const [isCalendarVisible, setIsCalendarVisible] = useState(false);
  const [isJarvisVisible, setIsJarvisVisible] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  async function handleLogout() {
    await logout();
    router.replace('/login');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Settings</Text>
        </View>

        {user && (
          <Pressable style={styles.profileCard} onPress={() => router.push('/profile')}>
            <View style={styles.profileAvatar}>
              {user.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={OrialTypography.bodyLarge}>{user.displayName || 'User'}</Text>
              <Text style={[OrialTypography.bodySmall, { color: OrialColors.textMuted }]}>{user.email}</Text>
            </View>
            <ChevronRight size={20} color={OrialColors.textMuted} />
          </Pressable>
        )}
        
        <GlassCard style={[styles.card, styles.cardNoPadding]}>
          <View style={[styles.settingItem, styles.settingItemLast]}>
            <Text style={OrialTypography.bodyMedium}>Notifications</Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: OrialColors.surface, true: OrialColors.violet }}
              thumbColor={OrialColors.textPrimary}
            />
          </View>
        </GlassCard>

        <View style={styles.section}>
          <SectionLabel label="Integrations" />
          <GlassCard style={styles.cardNoPadding}>
            <SettingItem title="Notion Sync" onPress={() => setIsNotionVisible(true)} />
            <SettingItem title="Calendar" onPress={() => setIsCalendarVisible(true)} />
            <SettingItem title="JARVIS / OpenClaw" onPress={() => setIsJarvisVisible(true)} />
            <SettingItem title="Appearance" isLast />
          </GlassCard>
        </View>

        <View style={styles.section}>
          <SectionLabel label="Getting Started" />
          <GlassCard style={styles.cardNoPadding}>
            <Pressable
              style={[styles.settingItem, styles.settingItemLast]}
              onPress={() => {
                setOnboardingCompleted(false);
                router.replace('/onboarding');
              }}
            >
              <View style={styles.settingItemContent}>
                <RotateCcw size={20} color={OrialColors.textSecondary} />
                <Text style={[OrialTypography.bodyMedium, styles.settingItemText]}>
                  Replay Onboarding
                </Text>
              </View>
              <ChevronRight size={20} color={OrialColors.textMuted} />
            </Pressable>
          </GlassCard>
        </View>

        {user && (
          <View style={styles.section}>
            <GlassCard style={styles.cardNoPadding}>
              <Pressable
                style={[styles.settingItem, styles.settingItemLast]}
                onPress={() => {
                  Alert.alert(
                    'Sign Out',
                    'Are you sure you want to sign out?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Sign Out', style: 'destructive', onPress: handleLogout }
                    ]
                  );
                }}
              >
                <View style={styles.settingItemContent}>
                  <LogOut size={20} color="#EF4444" />
                  <Text style={[OrialTypography.bodyMedium, styles.logoutText]}>
                    Sign Out
                  </Text>
                </View>
              </Pressable>
            </GlassCard>
          </View>
        )}
      </ScrollView>

      <NotionSettingsScreen
        visible={isNotionVisible}
        onClose={() => setIsNotionVisible(false)}
      />

      <CalendarSettingsScreen
        visible={isCalendarVisible}
        onClose={() => setIsCalendarVisible(false)}
      />

      <JarvisSettingsScreen
        visible={isJarvisVisible}
        onClose={() => setIsJarvisVisible(false)}
      />
    </SafeAreaView>
  );
}

function SettingItem({
  title,
  onPress,
  isLast,
}: {
  title: string;
  onPress?: () => void;
  isLast?: boolean;
}) {
  return (
    <Pressable style={[styles.settingItem, isLast && styles.settingItemLast]} onPress={onPress}>
      <Text style={OrialTypography.bodyMedium}>{title}</Text>
      <ChevronRight size={20} color={OrialColors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: OrialColors.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    gap: 16,
  },
  profileAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarText: {
    ...OrialTypography.bodyLarge,
    color: OrialColors.textPrimary,
    fontWeight: '700',
  },
  profileInfo: {
    flex: 1,
  },
  card: {
    marginBottom: 16,
  },
  cardNoPadding: {
    padding: 0,
  },
  section: {
    marginTop: 24,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  settingItemLast: {
    borderBottomWidth: 0,
  },
  settingItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  settingItemText: {
    marginLeft: 4,
  },
  logoutText: {
    color: '#EF4444',
  },
});

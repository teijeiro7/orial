import { View, Text, StyleSheet, Image, Pressable, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, LogOut, Mail, Shield, Calendar, Edit3 } from 'lucide-react-native';
import { useAuth } from '@/src/context/AuthContext';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, isLoading } = useAuth();

  async function handleLogout() {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={OrialColors.violetLight} />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <Text style={styles.errorText}>User not found</Text>
        <Pressable style={styles.loginButton} onPress={() => router.replace('/login')}>
          <Text style={styles.loginButtonText}>Go to Login</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color={OrialColors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.profileHeader}>
        <View style={styles.avatarContainer}>
          {user.photoURL ? (
            <Image source={{ uri: user.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {user.displayName?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        
        <Text style={styles.name}>{user.displayName || 'User'}</Text>
        <Text style={styles.email}>{user.email || 'No email'}</Text>
      </View>

      <View style={styles.infoSection}>
        <View style={styles.infoItem}>
          <Mail size={20} color={OrialColors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue}>{user.email || 'Not provided'}</Text>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Shield size={20} color={OrialColors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Account Status</Text>
            <View style={styles.statusContainer}>
              <View style={[styles.statusDot, user.emailVerified ? styles.statusVerified : styles.statusUnverified]} />
              <Text style={styles.infoValue}>
                {user.emailVerified ? 'Verified' : 'Unverified'}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.infoItem}>
          <Calendar size={20} color={OrialColors.textMuted} />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>Member Since</Text>
            <Text style={styles.infoValue}>{user.createdAt.toLocaleDateString()}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsSection}>
        <Pressable style={styles.actionButton} onPress={handleLogout}>
          <LogOut size={20} color="#EF4444" />
          <Text style={[styles.actionButtonText, styles.logoutText]}>Sign Out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    ...OrialTypography.headingMedium,
    color: OrialColors.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    ...OrialTypography.headingLarge,
    color: OrialColors.textPrimary,
    fontSize: 40,
  },
  name: {
    ...OrialTypography.headingMedium,
    color: OrialColors.textPrimary,
    marginBottom: 4,
  },
  email: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textSecondary,
  },
  infoSection: {
    paddingHorizontal: 24,
    gap: 16,
    marginTop: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    backgroundColor: OrialColors.surface,
    padding: 16,
    borderRadius: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    ...OrialTypography.bodySmall,
    color: OrialColors.textMuted,
    marginBottom: 4,
  },
  infoValue: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusVerified: {
    backgroundColor: '#10B981',
  },
  statusUnverified: {
    backgroundColor: '#F59E0B',
  },
  actionsSection: {
    paddingHorizontal: 24,
    marginTop: 32,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: OrialColors.surface,
    padding: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
  },
  logoutText: {
    color: '#EF4444',
  },
  errorText: {
    ...OrialTypography.bodyLarge,
    color: OrialColors.textSecondary,
    marginBottom: 16,
  },
  loginButton: {
    backgroundColor: OrialColors.violet,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  loginButtonText: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textPrimary,
    fontWeight: '600',
  },
});

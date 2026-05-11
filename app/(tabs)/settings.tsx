import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { ChevronRight } from 'lucide-react-native';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={OrialTypography.headingMedium}>Settings</Text>
      </View>
      
      <GlassCard style={styles.card}>
        <SettingItem title="Notion Sync" />
        <SettingItem title="Calendar" />
        <SettingItem title="Notifications" />
        <SettingItem title="Appearance" />
      </GlassCard>
    </SafeAreaView>
  );
}

function SettingItem({ title }: { title: string }) {
  return (
    <Pressable style={styles.settingItem}>
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
  card: {
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
});

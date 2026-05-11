import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '../../src/components/GlassCard';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

export default function CalendarScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={OrialTypography.headingMedium}>Calendar</Text>
      </View>
      
      <GlassCard style={styles.card}>
        <Text style={OrialTypography.bodyMedium}>Calendar View - Coming Soon</Text>
      </GlassCard>
    </SafeAreaView>
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
});

import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Droplets, Plus, Minus } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';
import { hydrationService } from '@/src/services/hydrationService';

const BEVERAGES = [
  { id: 'water', label: 'Water', factor: 1.0 },
  { id: 'soda_zero', label: 'Zero Soda', factor: 0.7 },
  { id: 'tea', label: 'Tea', factor: 0.95 },
  { id: 'coffee', label: 'Coffee', factor: 0.9 },
  { id: 'other', label: 'Other', factor: 0.8 },
] as const;

export default function HydrationScreen() {
  const [amount, setAmount] = useState(250);
  const [selectedBeverage, setSelectedBeverage] = useState('water');
  const [customAmount, setCustomAmount] = useState('');

  const handleAdd = async () => {
    const today = new Date().toISOString().split('T')[0];
    const liters = amount / 1000;
    await hydrationService.addWater(today, liters, selectedBeverage as any);
  };

  const adjustAmount = (delta: number) => {
    setAmount(Math.max(50, Math.min(2000, amount + delta)));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={OrialTypography.headingLarge}>Hydration</Text>
          <Text style={OrialTypography.caption}>Track your daily water intake</Text>
        </View>

        <GlassCard style={styles.amountCard}>
          <View style={styles.amountDisplay}>
            <Pressable onPress={() => adjustAmount(-50)} style={styles.adjustButton}>
              <Minus size={24} color={OrialColors.cyan} />
            </Pressable>
            <View style={styles.amountValue}>
              <Text style={OrialTypography.headingLarge}>{amount}</Text>
              <Text style={OrialTypography.caption}>ml</Text>
            </View>
            <Pressable onPress={() => adjustAmount(50)} style={styles.adjustButton}>
              <Plus size={24} color={OrialColors.cyan} />
            </Pressable>
          </View>
        </GlassCard>

        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Beverage Type</Text>
          <View style={styles.beverageGrid}>
            {BEVERAGES.map((bev) => (
              <Pressable
                key={bev.id}
                style={[
                  styles.beverageButton,
                  selectedBeverage === bev.id && styles.beverageSelected,
                ]}
                onPress={() => setSelectedBeverage(bev.id)}
              >
                <Text
                  style={[
                    styles.beverageText,
                    selectedBeverage === bev.id && styles.beverageTextSelected,
                  ]}
                >
                  {bev.label}
                </Text>
                <Text style={styles.factorText}>{(bev.factor * 100).toFixed(0)}% effective</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[OrialTypography.headingSmall, styles.sectionTitle]}>Custom Amount</Text>
          <TextInput
            style={styles.input}
            value={customAmount}
            onChangeText={setCustomAmount}
            placeholder="Enter amount in ml"
            placeholderTextColor={OrialColors.textMuted}
            keyboardType="numeric"
          />
          {customAmount && (
            <Pressable
              style={styles.customButton}
              onPress={() => {
                const ml = parseInt(customAmount);
                if (!isNaN(ml)) {
                  setAmount(ml);
                  setCustomAmount('');
                }
              }}
            >
              <Text style={styles.customButtonText}>Set {customAmount}ml</Text>
            </Pressable>
          )}
        </View>

        <Pressable style={styles.addButton} onPress={handleAdd}>
          <Droplets size={20} color={OrialColors.deepNavy} />
          <Text style={styles.addButtonText}>Add {amount}ml</Text>
        </Pressable>
      </ScrollView>
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
  amountCard: {
    margin: 16,
    padding: 24,
    alignItems: 'center',
  },
  amountDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  adjustButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OrialColors.cyan + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  amountValue: {
    alignItems: 'center',
    minWidth: 100,
  },
  section: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    marginBottom: 12,
  },
  beverageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  beverageButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    alignItems: 'center',
    minWidth: 100,
  },
  beverageSelected: {
    backgroundColor: OrialColors.cyan + '30',
    borderWidth: 1,
    borderColor: OrialColors.cyan,
  },
  beverageText: {
    color: OrialColors.textSecondary,
    fontWeight: '600',
  },
  beverageTextSelected: {
    color: OrialColors.cyan,
  },
  factorText: {
    color: OrialColors.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 16,
    color: OrialColors.textPrimary,
    fontSize: 16,
  },
  customButton: {
    backgroundColor: OrialColors.violet + '30',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  customButtonText: {
    color: OrialColors.violetLight,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: OrialColors.cyan,
    margin: 16,
    padding: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  addButtonText: {
    color: OrialColors.deepNavy,
    fontSize: 16,
    fontWeight: '700',
  },
});

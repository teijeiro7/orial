import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming 
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';
import type { Habit } from '../../drizzle/schema';

interface HabitGridCardProps {
  habit: Habit;
  isCompleted: boolean;
  onToggle: () => void;
  onLongPress?: () => void;
}

export function HabitGridCard({ habit, isCompleted, onToggle, onLongPress }: HabitGridCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withSequence(
      withTiming(0.95, { duration: 100 }),
      withSpring(1, { damping: 15, stiffness: 300 })
    );
    onToggle();
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'health': return OrialColors.categoryHealth;
      case 'mind': return OrialColors.categoryMind;
      case 'work': return OrialColors.categoryWork;
      case 'social': return OrialColors.categorySocial;
      case 'fitness': return OrialColors.categoryFitness;
      case 'learning': return OrialColors.categoryLearn;
      default: return OrialColors.categoryOther;
    }
  };

  const ringColor = getCategoryColor(habit.category);

  return (
    <Pressable 
      onPress={handlePress}
      onLongPress={onLongPress}
      delayLongPress={500}
    >
      <Animated.View style={[styles.container, animatedStyle]}>
        <View style={[styles.ring, { 
          borderColor: isCompleted ? ringColor : OrialColors.glassBorder,
          backgroundColor: isCompleted ? `${ringColor}20` : 'transparent'
        }]}>
          <Text style={styles.emoji}>{habit.emoji}</Text>
          {isCompleted && (
            <View style={[styles.checkmark, { backgroundColor: ringColor }]} >
              <Text style={styles.checkmarkText}>✓</Text>
            </View>
          )}
        </View>
        <Text style={OrialTypography.caption} numberOfLines={1}>
          {habit.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 8,
  },
  ring: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: {
    fontSize: 32,
  },
  checkmark: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

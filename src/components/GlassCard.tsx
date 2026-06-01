import React from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { BlurView } from 'expo-blur';
import { OrialColors } from '../utils/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accentColor?: string;
  intensity?: number;
  variant?: 'flat' | 'glass';
}

export function GlassCard({ children, style, accentColor, intensity = 20, variant = 'flat' }: GlassCardProps) {
  if (variant === 'glass') {
    return (
      <View style={[styles.container, style]}>
        <BlurView intensity={intensity} style={styles.blur} tint="dark">
          <View style={[styles.glassContent, accentColor && { borderColor: accentColor }]}>
            {children}
          </View>
        </BlurView>
      </View>
    );
  }

  return (
    <View style={[styles.flatCard, style, accentColor && { borderColor: accentColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  blur: {
    borderRadius: 16,
  },
  glassContent: {
    backgroundColor: OrialColors.glassWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    padding: 16,
  },
  flatCard: {
    borderRadius: 16,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.border,
    padding: 16,
  },
});

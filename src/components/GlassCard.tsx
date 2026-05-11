import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { OrialColors } from '../utils/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  accentColor?: string;
  intensity?: number;
}

export function GlassCard({ children, style, accentColor, intensity = 20 }: GlassCardProps) {
  return (
    <View style={[styles.container, style]}>
      <BlurView intensity={intensity} style={styles.blur} tint="dark">
        <View 
          style={[
            styles.content,
            accentColor && { borderColor: accentColor },
          ]}
        >
          {children}
        </View>
      </BlurView>
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
  content: {
    backgroundColor: OrialColors.glassWhite,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    padding: 16,
  },
});

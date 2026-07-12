import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { OrialTypography } from '../utils/typography';

interface ScreenHeaderProps {
  title?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
}

export function ScreenHeader({ title, left, right }: ScreenHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.slot}>{left}</View>
      {title && (
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      )}
      <View style={styles.slot}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slot: {
    minHeight: 36,
    justifyContent: 'center',
  },
  title: {
    ...OrialTypography.headingMedium,
    flex: 1,
    textAlign: 'center',
  },
});

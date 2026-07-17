import React from 'react';
import { View, Pressable, Text, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface SegmentedTabsProps {
  tabs: string[];
  activeIndex: number;
  onChange: (index: number) => void;
}

export function SegmentedTabs({ tabs, activeIndex, onChange }: SegmentedTabsProps) {
  return (
    <View style={styles.container}>
      {tabs.map((tab, index) => {
        const isActive = index === activeIndex;
        return (
          <Pressable
            key={tab}
            onPress={() => onChange(index)}
            style={[styles.tab, isActive && styles.tabActive]}
          >
            <Text style={[styles.label, isActive && styles.labelActive]}>{tab}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: OrialColors.violet,
  },
  label: {
    fontSize: 15,
    color: OrialColors.textMuted,
  },
  labelActive: {
    color: OrialColors.textPrimary,
    fontWeight: '600',
  },
});

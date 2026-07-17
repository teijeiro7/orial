import React from 'react';
import { View, StyleSheet } from 'react-native';
import { StatTile } from './StatTile';

interface StatTileData {
  icon: React.ReactNode;
  value: string;
  label: string;
  color: string;
}

interface StatTileGridProps {
  tiles: StatTileData[];
}

export function StatTileGrid({ tiles }: StatTileGridProps) {
  return (
    <View style={styles.grid}>
      {tiles.map((tile, index) => (
        <View key={index} style={styles.tileWrapper}>
          <StatTile icon={tile.icon} value={tile.value} label={tile.label} color={tile.color} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tileWrapper: {
    width: '48%',
  },
});

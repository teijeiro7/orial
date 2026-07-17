import React from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface HeaderIconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  showBadge?: boolean;
}

export function HeaderIconButton({ icon, onPress, showBadge = false }: HeaderIconButtonProps) {
  return (
    <Pressable onPress={onPress} style={styles.button}>
      {icon}
      {showBadge && <View style={styles.badgeDot} testID="badge-dot" />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 7,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: OrialColors.error,
    borderWidth: 1.5,
    borderColor: OrialColors.deepNavy,
  },
});

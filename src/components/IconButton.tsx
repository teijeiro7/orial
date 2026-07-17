import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { OrialColors } from '../utils/colors';

interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'default' | 'add';
}

export function IconButton({ icon, onPress, variant = 'default' }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, variant === 'add' && styles.buttonAdd]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonAdd: {
    backgroundColor: OrialColors.violet,
  },
});

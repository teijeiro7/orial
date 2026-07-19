import React from 'react';
import { Modal, StyleSheet, KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';
import { GlassCard } from './GlassCard';

interface BottomSheetModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  cardStyle?: StyleProp<ViewStyle>;
}

/**
 * Bottom-sheet modal wrapping GlassCard + KeyboardAvoidingView, so forms with
 * TextInput don't get covered by the keyboard. Replaces the
 * `<Modal transparent><View modalOverlay><GlassCard modalCard>` pattern that
 * used to be duplicated (without keyboard handling) across gym/finance/caffeine.
 */
export function BottomSheetModal({ visible, onClose, children, cardStyle }: BottomSheetModalProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <GlassCard style={[styles.card, cardStyle]}>{children}</GlassCard>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { margin: 16, padding: 20 },
});

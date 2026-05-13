import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { X, Save } from 'lucide-react-native';
import { GlassCard } from './GlassCard';
import { OrialColors } from '../utils/colors';
import { OrialTypography } from '../utils/typography';
import { db } from '../services/database';
import { bodyMetrics } from '../../drizzle/schema';
import { generateUUID } from '../utils/uuid';
import { forgeNotionSync } from '../services/forgeNotionSync';

interface WeightEntryModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function WeightEntryModal({ visible, onClose, onSave }: WeightEntryModalProps) {
  const [weight, setWeight] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const weightNum = parseFloat(weight);
    if (isNaN(weightNum) || weightNum <= 0) return;

    setSaving(true);
    try {
      const newEntry = {
        id: generateUUID(),
        date: new Date(),
        weightKg: weightNum,
        notes: notes.trim() || null,
        createdAt: new Date(),
      };

      await db.insert(bodyMetrics).values(newEntry);

      // Sync to Notion
      await forgeNotionSync.syncWeightEntry(newEntry);

      setWeight('');
      setNotes('');
      onSave();
      onClose();
    } catch (e) {
      console.error('[WeightEntryModal] save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Log Weight</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.content}>
          <GlassCard style={styles.inputCard}>
            <Text style={[OrialTypography.caption, styles.label]}>WEIGHT (KG)</Text>
            <TextInput
              style={styles.input}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g., 78.5"
              placeholderTextColor={OrialColors.textMuted}
              keyboardType="decimal-pad"
              maxLength={6}
            />
          </GlassCard>

          <GlassCard style={styles.inputCard}>
            <Text style={[OrialTypography.caption, styles.label]}>NOTES (OPTIONAL)</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="How are you feeling today?"
              placeholderTextColor={OrialColors.textMuted}
              multiline
              numberOfLines={3}
            />
          </GlassCard>

          <Pressable
            style={[styles.saveButton, (!weight || saving) && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!weight || saving}
          >
            <Save size={18} color="#FFF" />
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Entry'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  inputCard: {
    marginBottom: 16,
    padding: 16,
  },
  label: {
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 16,
    color: OrialColors.textPrimary,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
    fontSize: 16,
    fontFamily: 'Inter-Regular',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OrialColors.violet,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
    marginTop: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
});

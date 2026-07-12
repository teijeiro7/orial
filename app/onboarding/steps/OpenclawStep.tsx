import { View, Text, StyleSheet, Pressable, TextInput, Alert } from 'react-native';
import { ArrowRight, Check, SkipForward, AlertTriangle, Zap } from 'lucide-react-native';
import { useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { OrialColors } from '../../../src/utils/colors';
import { OrialTypography } from '../../../src/utils/typography';
import { GlassCard } from '../../../src/components/GlassCard';

interface OpenclawStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export function OpenclawStep({ onNext, onSkip }: OpenclawStepProps) {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  async function testConnection() {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Please enter the API URL');
      return;
    }

    setIsTesting(true);
    setConnectionStatus('idle');

    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (response.ok) {
        setConnectionStatus('success');
        // Save credentials
        await SecureStore.setItemAsync('openclaw_api_url', apiUrl);
        await SecureStore.setItemAsync('openclaw_api_key', apiKey);
      } else {
        setConnectionStatus('error');
      }
    } catch (error) {
      setConnectionStatus('error');
    } finally {
      setIsTesting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Zap size={32} color={OrialColors.cyan} />
        </View>
        <Text style={OrialTypography.headingMedium}>Openclaw AI</Text>
        <Text style={[OrialTypography.bodyMedium, styles.description]}>
          Connect your self-hosted AI agent for personalized suggestions.
        </Text>
      </View>

      <GlassCard style={styles.formCard}>
        <View style={styles.inputGroup}>
          <Text style={[OrialTypography.caption, styles.label]}>API URL</Text>
          <TextInput
            style={styles.input}
            value={apiUrl}
            onChangeText={(text) => {
              setApiUrl(text);
              setConnectionStatus('idle');
            }}
            placeholder="https://your-agent.com/api"
            placeholderTextColor={OrialColors.textMuted}
            autoCapitalize="none"
            keyboardType="url"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[OrialTypography.caption, styles.label]}>API Key</Text>
          <TextInput
            style={styles.input}
            value={apiKey}
            onChangeText={(text) => {
              setApiKey(text);
              setConnectionStatus('idle');
            }}
            placeholder="sk-..."
            placeholderTextColor={OrialColors.textMuted}
            secureTextEntry
          />
        </View>

        <Pressable 
          style={[
            styles.testButton,
            connectionStatus === 'success' && styles.testButtonSuccess,
            connectionStatus === 'error' && styles.testButtonError,
          ]}
          onPress={testConnection}
          disabled={isTesting}
        >
          {connectionStatus === 'success' ? (
            <>
              <Check size={18} color={OrialColors.success} />
              <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>Connected</Text>
            </>
          ) : connectionStatus === 'error' ? (
            <>
              <AlertTriangle size={18} color={OrialColors.error} />
              <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>Failed</Text>
            </>
          ) : (
            <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>
              {isTesting ? 'Testing...' : 'Test Connection'}
            </Text>
          )}
        </Pressable>
      </GlassCard>

      <View style={styles.actions}>
        <Pressable 
          style={styles.primaryButton} 
          onPress={onNext}
        >
          <Text style={[OrialTypography.button, styles.primaryButtonText]}>Continue</Text>
          <ArrowRight size={20} color={OrialColors.textPrimary} />
        </Pressable>
        
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <SkipForward size={16} color={OrialColors.textMuted} />
          <Text style={[OrialTypography.caption, styles.skipText]}>Skip for now</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: OrialColors.cyan + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  description: {
    textAlign: 'center',
    marginTop: 8,
  },
  formCard: {
    padding: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: OrialColors.surface,
    borderRadius: 12,
    padding: 14,
    color: OrialColors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: OrialColors.surface,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  testButtonSuccess: {
    borderColor: OrialColors.success,
    backgroundColor: OrialColors.success + '10',
  },
  testButtonError: {
    borderColor: OrialColors.error,
    backgroundColor: OrialColors.error + '10',
  },
  actions: {
    gap: 16,
    marginTop: 'auto',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: OrialColors.textPrimary,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  skipText: {
    color: OrialColors.textMuted,
  },
});

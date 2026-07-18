import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, AlertTriangle, Zap } from 'lucide-react-native';
import * as SecureStore from 'expo-secure-store';
import { GlassCard } from '@/src/components/GlassCard';
import { agentService } from '@/src/services/openclawService';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

interface JarvisSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function JarvisSettingsScreen({ visible, onClose }: JarvisSettingsScreenProps) {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) loadConfig();
  }, [visible]);

  async function loadConfig() {
    setLoading(true);
    const config = await agentService.getConfig();
    if (config) {
      setApiUrl(config.apiUrl);
      setApiKey(config.apiKey);
    }
    setLoading(false);
  }

  async function testAndSave() {
    if (!apiUrl.trim()) {
      Alert.alert('Error', 'Enter the API URL');
      return;
    }
    setTesting(true);
    setStatus('idle');

    const normalizedUrl = apiUrl.trim().replace(/\/$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(`${normalizedUrl}/health`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        await agentService.saveConfig(normalizedUrl, apiKey.trim());
        setStatus('success');
      } else {
        setStatus('error');
      }
    } catch (e) {
      console.warn('[JarvisSettings] Health check failed:', e);
      setStatus('error');
    } finally {
      setTesting(false);
    }
  }

  async function disconnect() {
    Alert.alert('Disconnect JARVIS', 'Remove Hermes credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await agentService.clearConfig();
          setApiUrl('');
          setApiKey('');
          setStatus('idle');
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Zap size={20} color={OrialColors.cyan} />
          </View>
          <Text style={OrialTypography.headingMedium}>JARVIS / Hermes Agent</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={OrialColors.textMuted} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={OrialColors.violetLight} style={{ marginTop: 40 }} />
        ) : (
          <View style={styles.content}>
            <GlassCard style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={[OrialTypography.caption, styles.label]}>API URL</Text>
                <TextInput
                  style={styles.input}
                  value={apiUrl}
                  onChangeText={(t) => { setApiUrl(t); setStatus('idle'); }}
                  placeholder="https://xxx.trycloudflare.com"
                  placeholderTextColor={OrialColors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[OrialTypography.caption, styles.label]}>API Key (Bearer token)</Text>
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={(t) => { setApiKey(t); setStatus('idle'); }}
                  placeholder="sk-... or your gateway token"
                  placeholderTextColor={OrialColors.textMuted}
                  secureTextEntry
                />
              </View>

              <Pressable
                style={[
                  styles.testBtn,
                  status === 'success' && styles.testBtnSuccess,
                  status === 'error' && styles.testBtnError,
                ]}
                onPress={testAndSave}
                disabled={testing}
              >
                {testing ? (
                  <ActivityIndicator size="small" color={OrialColors.textPrimary} />
                ) : status === 'success' ? (
                  <>
                    <Check size={18} color={OrialColors.success} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>Saved & Connected</Text>
                  </>
                ) : status === 'error' ? (
                  <>
                    <AlertTriangle size={18} color={OrialColors.error} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>Connection failed</Text>
                  </>
                ) : (
                  <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>
                    Test & Save
                  </Text>
                )}
              </Pressable>
            </GlassCard>

            {apiUrl.length > 0 && (
              <Pressable style={styles.disconnectBtn} onPress={disconnect}>
                <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>Disconnect</Text>
              </Pressable>
            )}

            <GlassCard style={styles.hintCard}>
              <Text style={[OrialTypography.caption, styles.hint]}>
                Run on your VPS:{'\n'}
                <Text style={styles.code}>cloudflared tunnel --url http://localhost:8642</Text>
                {'\n\n'}Then paste the URL above. Use a named tunnel for a permanent URL.{'\n\n'}
                Need to expose Hermes API Server (port 8642). Your Hermes API key is set in <Text style={styles.code}>.env</Text> as API_SERVER_KEY.
              </Text>
            </GlassCard>
          </View>
        )}
      </SafeAreaView>
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
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OrialColors.cyan + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    marginLeft: 'auto',
    padding: 4,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
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
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: OrialColors.violet,
  },
  testBtnSuccess: {
    backgroundColor: OrialColors.success + '15',
    borderWidth: 1,
    borderColor: OrialColors.success,
  },
  testBtnError: {
    backgroundColor: OrialColors.error + '15',
    borderWidth: 1,
    borderColor: OrialColors.error,
  },
  disconnectBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  hintCard: {
    padding: 16,
  },
  hint: {
    lineHeight: 20,
  },
  code: {
    fontFamily: 'Courier',
    color: OrialColors.cyan,
    fontSize: 12,
  },
});

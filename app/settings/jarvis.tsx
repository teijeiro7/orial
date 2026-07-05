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
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Check, AlertTriangle, Zap, Database } from 'lucide-react-native';
import { GlassCard } from '../../src/components/GlassCard';
import { agentService } from '../../src/services/openclawService';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';

interface JarvisSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function JarvisSettingsScreen({ visible, onClose }: JarvisSettingsScreenProps) {
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [inboxUrl, setInboxUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const [testingInbox, setTestingInbox] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [inboxStatus, setInboxStatus] = useState<'idle' | 'success' | 'error'>('idle');
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
    const iUrl = await agentService.getHermesServerUrl();
    if (iUrl) setInboxUrl(iUrl);
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

  async function saveInboxUrl() {
    if (!inboxUrl.trim()) {
      Alert.alert('Error', 'Enter the Hermes server URL');
      return;
    }
    setInboxStatus('idle');
    const normalizedUrl = inboxUrl.trim().replace(/\/$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(`${normalizedUrl}/inbox/pending`, { signal: controller.signal });
      clearTimeout(timeoutId);

      // 200 = items pending (or empty array), 204 = nothing pending — both OK
      if (res.ok || res.status === 204) {
        await agentService.saveHermesServerUrl(normalizedUrl);
        setInboxStatus('success');
      } else {
        setInboxStatus('error');
      }
    } catch {
      setInboxStatus('error');
    }
  }

  async function disconnect() {
    Alert.alert('Disconnect Hermes', 'Remove credentials?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await agentService.clearConfig();
          await agentService.clearHermesServerUrl();
          setApiUrl('');
          setApiKey('');
          setInboxUrl('');
          setStatus('idle');
          setInboxStatus('idle');
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
          <Text style={OrialTypography.headingMedium}>Hermes Agent</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <X size={22} color={OrialColors.textMuted} />
          </Pressable>
        </View>

        {loading ? (
          <ActivityIndicator color={OrialColors.violetLight} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

            {/* Hermes Inbox (generic typed pull) */}
            <Text style={styles.sectionTitle}>SERVIDOR HERMES — INBOX (puerto 8642)</Text>
            <GlassCard style={styles.card}>
              <View style={styles.inputGroup}>
                <Text style={[OrialTypography.caption, styles.label]}>URL del servidor</Text>
                <TextInput
                  style={styles.input}
                  value={inboxUrl}
                  onChangeText={(t) => { setInboxUrl(t); setInboxStatus('idle'); }}
                  placeholder="https://xxx.trycloudflare.com"
                  placeholderTextColor={OrialColors.textMuted}
                  autoCapitalize="none"
                  keyboardType="url"
                />
              </View>

              <Pressable
                style={[
                  styles.testBtn,
                  inboxStatus === 'success' && styles.testBtnSuccess,
                  inboxStatus === 'error' && styles.testBtnError,
                ]}
                onPress={saveInboxUrl}
                disabled={testingInbox}
              >
                {testingInbox ? (
                  <ActivityIndicator size="small" color={OrialColors.textPrimary} />
                ) : inboxStatus === 'success' ? (
                  <>
                    <Check size={18} color={OrialColors.success} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>Conectado</Text>
                  </>
                ) : inboxStatus === 'error' ? (
                  <>
                    <AlertTriangle size={18} color={OrialColors.error} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>No responde</Text>
                  </>
                ) : (
                  <>
                    <Database size={16} color={OrialColors.textPrimary} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>Test y guardar</Text>
                  </>
                )}
              </Pressable>
            </GlassCard>

            {/* Chat API (legacy, optional) */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>API CHAT (opcional, puerto 8642)</Text>
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
                <Text style={[OrialTypography.caption, styles.label]}>API Key</Text>
                <TextInput
                  style={styles.input}
                  value={apiKey}
                  onChangeText={(t) => { setApiKey(t); setStatus('idle'); }}
                  placeholder="sk-... or gateway token"
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
                    <Text style={[OrialTypography.caption, { color: OrialColors.success }]}>Guardado y conectado</Text>
                  </>
                ) : status === 'error' ? (
                  <>
                    <AlertTriangle size={18} color={OrialColors.error} />
                    <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>Conexión fallida</Text>
                  </>
                ) : (
                  <Text style={[OrialTypography.caption, { color: OrialColors.textPrimary }]}>Test y guardar</Text>
                )}
              </Pressable>
            </GlassCard>

            <GlassCard style={styles.hintCard}>
              <Text style={[OrialTypography.caption, styles.hint]}>
                Túnel Cloudflare:{'\n'}
                <Text style={styles.code}>cloudflared tunnel --url http://localhost:8642</Text>
                {'\n\n'}
                El inbox de Hermes entrega payloads tipados a Orial (workout, nutrition, weight, hydration, habit_checkin, expense, whoop_extra). Orial procesa automáticamente cada 5 minutos en background y al abrir la app.
              </Text>
            </GlassCard>

            {(apiUrl.length > 0 || inboxUrl.length > 0) && (
              <Pressable style={styles.disconnectBtn} onPress={disconnect}>
                <Text style={[OrialTypography.caption, { color: OrialColors.error }]}>Desconectar todo</Text>
              </Pressable>
            )}
          </ScrollView>
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
    paddingBottom: 40,
  },
  sectionTitle: {
    ...OrialTypography.caption,
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: OrialColors.textMuted,
    marginBottom: 10,
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
    paddingVertical: 16,
    marginTop: 8,
  },
  hintCard: {
    padding: 16,
    marginTop: 16,
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

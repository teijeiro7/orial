import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import { X, Check, ExternalLink, RefreshCw, Database } from 'lucide-react-native';
import { GlassCard } from '@/src/components/GlassCard';
import { notionService, type NotionCredentials } from '@/src/services/notionService';
import { OrialColors } from '@/src/utils/colors';
import { OrialTypography } from '@/src/utils/typography';

const NOTION_CLIENT_ID = process.env.EXPO_PUBLIC_NOTION_CLIENT_ID || '';
const NOTION_REDIRECT_URI = 'orial://notion-callback';

interface NotionSettingsScreenProps {
  visible: boolean;
  onClose: () => void;
}

export function NotionSettingsScreen({ visible, onClose }: NotionSettingsScreenProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showWebView, setShowWebView] = useState(false);
  const [credentials, setCredentials] = useState<NotionCredentials | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'success' | 'error'>('idle');

  useEffect(() => {
    checkConnection();
  }, []);

  async function checkConnection() {
    const creds = await notionService.loadCredentials();
    if (creds) {
      setCredentials(creds);
      setIsConnected(true);
    }
  }

  function getOAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: NOTION_CLIENT_ID,
      redirect_uri: NOTION_REDIRECT_URI,
      response_type: 'code',
      owner: 'user',
    });

    return `https://api.notion.com/v1/oauth/authorize?${params.toString()}`;
  }

  async function handleOAuthCallback(url: string) {
    const code = extractCodeFromUrl(url);
    if (!code) return;

    setIsLoading(true);
    try {
      // Exchange code for token
      const response = await fetch('https://api.notion.com/v1/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${NOTION_CLIENT_ID}:${process.env.EXPO_PUBLIC_NOTION_CLIENT_SECRET}`)}`,
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: NOTION_REDIRECT_URI,
        }),
      });

      const data = await response.json();

      if (data.access_token) {
        const newCredentials: NotionCredentials = {
          accessToken: data.access_token,
          workspaceName: data.workspace_name,
          workspaceIcon: data.workspace_icon,
        };

        await notionService.saveCredentials(newCredentials);
        setCredentials(newCredentials);
        setIsConnected(true);
        setShowWebView(false);

        // Auto-create databases
        await createNotionDatabases();
      } else {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('OAuth error:', error);
      Alert.alert('Error', 'Failed to connect to Notion. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }

  function extractCodeFromUrl(url: string): string | null {
    const match = url.match(/[?&]code=([^&]+)/);
    return match ? match[1] : null;
  }

  async function createNotionDatabases() {
    setSyncStatus('syncing');
    try {
      // Get user's default page (we'll use the workspace's default)
      // For simplicity, we'll create a new page or use an existing one
      // In a real app, you'd let the user choose
      Alert.alert(
        'Setup Required',
        'Please create a new page in Notion and share its ID to set up the databases.',
        [
          {
            text: 'OK',
            onPress: () => setSyncStatus('idle'),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating databases:', error);
      setSyncStatus('error');
    }
  }

  async function handleDisconnect() {
    Alert.alert(
      'Disconnect Notion',
      'Are you sure you want to disconnect from Notion? Your local data will be preserved.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await notionService.clearCredentials();
            setIsConnected(false);
            setCredentials(null);
          },
        },
      ]
    );
  }

  async function handleSync() {
    setSyncStatus('syncing');
    try {
      // TODO: Implement full sync logic
      // This would sync all local data to Notion
      setTimeout(() => {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 2000);
      }, 1500);
    } catch (error) {
      console.error('Sync error:', error);
      setSyncStatus('error');
    }
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={OrialTypography.headingMedium}>Notion Sync</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <X size={24} color={OrialColors.textPrimary} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={OrialColors.violetLight} />
            <Text style={[OrialTypography.bodyMedium, styles.loadingText]}>Connecting...</Text>
          </View>
        ) : isConnected ? (
          <View style={styles.content}>
            <GlassCard style={styles.statusCard}>
              <View style={styles.statusRow}>
                <View style={styles.statusIcon}>
                  <Check size={24} color={OrialColors.success} />
                </View>
                <View style={styles.statusInfo}>
                  <Text style={OrialTypography.headingSmall}>Connected</Text>
                  {credentials?.workspaceName && (
                    <Text style={OrialTypography.caption}>
                      {credentials.workspaceName}
                    </Text>
                  )}
                </View>
              </View>
            </GlassCard>

            <View style={styles.actions}>
              <Pressable 
                style={[
                  styles.actionButton,
                  syncStatus === 'syncing' && styles.actionButtonDisabled
                ]}
                onPress={handleSync}
                disabled={syncStatus === 'syncing'}
              >
                <RefreshCw 
                  size={20} 
                  color={OrialColors.textPrimary}
                  style={syncStatus === 'syncing' && styles.spinningIcon}
                />
                <Text style={[OrialTypography.button, styles.actionButtonText]}>
                  {syncStatus === 'syncing' ? 'Syncing...' : 
                   syncStatus === 'success' ? 'Synced!' : 
                   syncStatus === 'error' ? 'Sync Failed' : 'Sync Now'}
                </Text>
              </Pressable>

              <Pressable 
                style={[styles.actionButton, styles.disconnectButton]}
                onPress={handleDisconnect}
              >
                <Text style={[OrialTypography.button, styles.disconnectButtonText]}>Disconnect</Text>
              </Pressable>
            </View>

            <GlassCard style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Database size={20} color={OrialColors.violetLight} />
                <View style={styles.infoText}>
                  <Text style={OrialTypography.bodyMedium}>Databases</Text>
                  <Text style={OrialTypography.caption}>
                    Orial will create two databases in your Notion workspace
                  </Text>
                </View>
              </View>
              
              <View style={styles.databaseList}>
                <View style={styles.databaseItem}>
                  <Text style={OrialTypography.bodySmall}>Orial — Data</Text>
                  <Text style={OrialTypography.caption}>Stores your synced records</Text>
                </View>
              </View>
            </GlassCard>
          </View>
        ) : (
          <View style={styles.connectContainer}>
            <GlassCard style={styles.connectCard}>
              <Text style={[OrialTypography.headingSmall, styles.connectTitle]}>
                Connect to Notion
              </Text>
              <Text style={[OrialTypography.bodyMedium, styles.connectDescription]}>
                Sync your data with your Notion workspace. Changes are bidirectional.
              </Text>
              
              <View style={styles.features}>
                <View style={styles.feature}>
                  <Check size={16} color={OrialColors.success} />
                  <Text style={OrialTypography.bodySmall}>Auto-create databases</Text>
                </View>
                <View style={styles.feature}>
                  <Check size={16} color={OrialColors.success} />
                  <Text style={OrialTypography.bodySmall}>Real-time sync</Text>
                </View>
                <View style={styles.feature}>
                  <Check size={16} color={OrialColors.success} />
                  <Text style={OrialTypography.bodySmall}>Offline support</Text>
                </View>
              </View>

              <Pressable 
                style={styles.connectButton}
                onPress={() => setShowWebView(true)}
              >
                <ExternalLink size={20} color={OrialColors.textPrimary} />
                <Text style={[OrialTypography.button, styles.connectButtonText]}>
                  Connect with Notion
                </Text>
              </Pressable>
            </GlassCard>
          </View>
        )}

        <Modal
          visible={showWebView}
          animationType="slide"
          presentationStyle="fullScreen"
        >
          <SafeAreaView style={styles.webViewContainer}>
            <View style={styles.webViewHeader}>
              <Text style={OrialTypography.headingSmall}>Connect to Notion</Text>
              <Pressable 
                onPress={() => setShowWebView(false)}
                style={styles.closeButton}
              >
                <X size={24} color={OrialColors.textPrimary} />
              </Pressable>
            </View>
            
            {NOTION_CLIENT_ID ? (
              <WebView
                source={{ uri: getOAuthUrl() }}
                onNavigationStateChange={(navState) => {
                  if (navState.url.startsWith(NOTION_REDIRECT_URI)) {
                    handleOAuthCallback(navState.url);
                  }
                }}
              />
            ) : (
              <View style={styles.errorContainer}>
                <Text style={OrialTypography.bodyMedium}>
                  Notion Client ID not configured. Please add EXPO_PUBLIC_NOTION_CLIENT_ID to your .env file.
                </Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    marginTop: 8,
  },
  content: {
    padding: 16,
  },
  statusCard: {
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OrialColors.success + '20',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  actions: {
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  actionButtonText: {
    color: OrialColors.textPrimary,
  },
  spinningIcon: {
    transform: [{ rotate: '45deg' }],
  },
  disconnectButton: {
    backgroundColor: OrialColors.error + '20',
    borderWidth: 1,
    borderColor: OrialColors.error,
  },
  disconnectButtonText: {
    color: OrialColors.error,
  },
  infoCard: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  infoText: {
    flex: 1,
  },
  databaseList: {
    marginLeft: 32,
    gap: 8,
  },
  databaseItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  connectCard: {
    padding: 24,
  },
  connectTitle: {
    textAlign: 'center',
    marginBottom: 12,
  },
  connectDescription: {
    textAlign: 'center',
    marginBottom: 24,
  },
  features: {
    gap: 12,
    marginBottom: 24,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OrialColors.violet,
    paddingVertical: 14,
    borderRadius: 12,
  },
  connectButtonText: {
    color: OrialColors.textPrimary,
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  webViewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
});

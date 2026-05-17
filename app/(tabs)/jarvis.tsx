import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Send, Zap, AlertCircle } from 'lucide-react-native';
import { OrialColors } from '../../src/utils/colors';
import { OrialTypography } from '../../src/utils/typography';
import { openClawService, type ChatMessage } from '../../src/services/openclawService';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

export default function JarvisScreen() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    openClawService.isConfigured().then(setConfigured);
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setSending(true);

    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    const assistantId = (Date.now() + 1).toString();
    const assistantMsg: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    scrollToBottom();

    const history: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: 'user', content: text },
    ];

    try {
      await openClawService.chat(history, (delta) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: m.content + delta }
              : m
          )
        );
        scrollToBottom();
      });
    } catch (e: any) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `Error: ${e?.message ?? 'Connection failed'}`, streaming: false }
            : m
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m
        )
      );
      setSending(false);
      scrollToBottom();
    }
  }, [input, sending, messages, scrollToBottom]);

  function renderMessage({ item }: { item: DisplayMessage }) {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
        {!isUser && (
          <View style={styles.avatar}>
            <Zap size={14} color={OrialColors.cyan} />
          </View>
        )}
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>
            {item.content}
            {item.streaming && <Text style={styles.cursor}> ▌</Text>}
          </Text>
        </View>
      </View>
    );
  }

  if (configured === null) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator color={OrialColors.violetLight} style={{ flex: 1 }} />
      </SafeAreaView>
    );
  }

  if (!configured) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.emptyState}>
          <AlertCircle size={48} color={OrialColors.textMuted} />
          <Text style={[OrialTypography.headingSmall, styles.emptyTitle]}>JARVIS not connected</Text>
          <Text style={[OrialTypography.bodyMedium, styles.emptyBody]}>
            Set up your OpenClaw API URL and key in onboarding or Settings to use JARVIS.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <Zap size={20} color={OrialColors.cyan} />
        </View>
        <Text style={OrialTypography.headingMedium}>JARVIS</Text>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={scrollToBottom}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={[OrialTypography.bodyMedium, { textAlign: 'center' }]}>
                Ask JARVIS anything about your habits, health, or tasks.
              </Text>
            </View>
          }
        />

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message JARVIS..."
            placeholderTextColor={OrialColors.textMuted}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
            returnKeyType="send"
            blurOnSubmit={false}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={send}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={OrialColors.textPrimary} />
            ) : (
              <Send size={20} color={OrialColors.textPrimary} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OrialColors.deepNavy,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  messageList: {
    padding: 16,
    gap: 12,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: OrialColors.cyan + '20',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: OrialColors.violet,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: OrialColors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  bubbleText: {
    ...OrialTypography.bodyMedium,
    color: OrialColors.textSecondary,
    lineHeight: 22,
  },
  bubbleTextUser: {
    color: OrialColors.textPrimary,
  },
  cursor: {
    color: OrialColors.cyan,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: OrialColors.glassBorder,
  },
  input: {
    flex: 1,
    backgroundColor: OrialColors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: OrialColors.textPrimary,
    fontSize: 15,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
    maxHeight: 120,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: OrialColors.surface,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    color: OrialColors.textMuted,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 40,
  },
});

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
import { agentService, type ChatMessage } from '../../src/services/openclawService';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  streaming?: boolean;
}

const SUGGESTED_PROMPTS = [
  'Log breakfast: 3 eggs, toast, black coffee',
  'How was my recovery this week?',
  'What should I eat to hit my protein goal?',
];

export default function JarvisScreen() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      const ok = await agentService.isConfigured();
      if (mounted) setConfigured(ok);
    };
    check();
    const interval = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
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
      await agentService.chat(history, (delta) => {
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
            <Zap size={13} color={OrialColors.cyan} />
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
        <View style={styles.header}>
          <View style={styles.headerIconWrap}>
            <Zap size={18} color={OrialColors.cyan} />
          </View>
          <Text style={styles.headerTitle}>Hermes</Text>
        </View>
        <View style={styles.errorState}>
          <AlertCircle size={40} color={OrialColors.textMuted} />
          <Text style={styles.errorStateTitle}>Not connected</Text>
          <Text style={styles.errorStateBody}>
            Set up your Hermes Agent API URL and key in Settings to start chatting.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerIconWrap}>
          <Zap size={18} color={OrialColors.cyan} />
        </View>
        <Text style={styles.headerTitle}>Hermes</Text>
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
              <Text style={styles.emptyChatTitle}>How can I help?</Text>
              <Text style={styles.emptyChatSub}>Log food, check metrics, or ask anything about your health.</Text>
              <View style={styles.promptChips}>
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <Pressable
                    key={prompt}
                    style={styles.promptChip}
                    onPress={() => send(prompt)}
                  >
                    <Text style={styles.promptChipText}>{prompt}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          }
        />

        {/* Input bar */}
        <View style={[styles.inputRow, inputFocused && styles.inputRowFocused]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message Hermes..."
            placeholderTextColor={OrialColors.textMuted}
            multiline
            maxLength={2000}
            onSubmitEditing={() => send()}
            returnKeyType="send"
            blurOnSubmit={false}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
          />
          <Pressable
            style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
            onPress={() => send()}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color={OrialColors.textPrimary} />
            ) : (
              <Send size={18} color={OrialColors.textPrimary} />
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: OrialColors.glassBorder,
  },
  headerIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 6,
    backgroundColor: OrialColors.cyan + '18',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OrialColors.cyan + '30',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.3,
    fontFamily: 'Inter-Bold',
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 10,
  },
  messageRowUser: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: OrialColors.cyan + '18',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    borderWidth: 1,
    borderColor: OrialColors.cyan + '30',
  },
  bubble: {
    maxWidth: '78%',
    borderRadius: 12,
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
    fontSize: 15,
    color: OrialColors.textSecondary,
    lineHeight: 23,
    fontFamily: 'Inter-Regular',
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
    paddingTop: 10,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: OrialColors.glassBorder,
  },
  inputRowFocused: {
    borderTopColor: OrialColors.cyan + '60',
  },
  input: {
    flex: 1,
    backgroundColor: OrialColors.surface,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: OrialColors.textPrimary,
    fontSize: 15,
    borderWidth: 1.5,
    borderColor: OrialColors.glassBorder,
    maxHeight: 120,
    fontFamily: 'Inter-Regular',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: OrialColors.violet,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: OrialColors.surface,
  },
  // Empty chat state
  emptyChat: {
    flex: 1,
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyChatTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: OrialColors.textPrimary,
    letterSpacing: -0.5,
    fontFamily: 'Inter-Bold',
    marginBottom: 8,
  },
  emptyChatSub: {
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    marginBottom: 28,
  },
  promptChips: {
    width: '100%',
    gap: 8,
  },
  promptChip: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: OrialColors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OrialColors.glassBorder,
  },
  promptChipText: {
    fontSize: 13,
    color: OrialColors.textSecondary,
    fontFamily: 'Inter-Regular',
    lineHeight: 20,
  },
  // Error / not configured state
  errorState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 14,
  },
  errorStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: OrialColors.textSecondary,
    fontFamily: 'Inter-SemiBold',
  },
  errorStateBody: {
    fontSize: 13,
    color: OrialColors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
});

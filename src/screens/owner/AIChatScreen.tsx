import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import { askLocalRag } from '@/lib/localRag';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const SUGGESTIONS = [
  'Who is overdue today?',
  'Show my monthly profit',
  'Generate collection list',
  'Interest projections',
];

export function AIChatScreen() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.orgId ?? '';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `Vanakkam ${user?.name ?? ''}! I've finished syncing your records for this morning. How can I help you manage your books?`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async (text?: string) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    const userMsg: Message = { id: String(Date.now()), role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const result = await askLocalRag(q, orgId);
      const botMsg: Message = { id: String(Date.now() + 1), role: 'assistant', text: result.text };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e: any) {
      const errMsg: Message = { id: String(Date.now() + 1), role: 'assistant', text: 'Sorry, something went wrong. Please try again.' };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, orgId]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === 'user';
    return (
      <View style={[styles.msgRow, isUser ? styles.msgUser : styles.msgBot]}>
        {/* Avatar */}
        {!isUser ? (
          <View style={styles.botAvatar}>
            <MaterialCommunityIcons name="robot" size={16} color={EL.primary} />
          </View>
        ) : null}

        <View style={[styles.msgBubble, isUser ? styles.msgBubbleUser : styles.msgBubbleBot]}>
          <Text style={styles.msgSender}>{isUser ? 'You' : 'Ledger AI'}</Text>
          <Text style={[styles.msgText, isUser && { color: EL.white }]}>
            {item.text}
          </Text>
        </View>

        {isUser ? (
          <View style={styles.userAvatar}>
            <MaterialCommunityIcons name="account" size={16} color={EL.white} />
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* AI Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.aiIcon}>
            <MaterialCommunityIcons name="robot" size={28} color={EL.white} />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Assistant</Text>
            <View style={styles.onlineRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.onlineText}>Always Ready</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Chat messages */}
      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContainer}
        ListHeaderComponent={
          <View style={styles.dateMarker}>
            <Text style={styles.dateMarkerText}>TODAY</Text>
          </View>
        }
      />

      {/* Typing indicator */}
      {loading ? (
        <View style={styles.typingRow}>
          <View style={styles.botAvatar}>
            <MaterialCommunityIcons name="robot" size={16} color={EL.primary} />
          </View>
          <View style={styles.typingBubble}>
            <View style={[styles.typingDot, { opacity: 0.2 }]} />
            <View style={[styles.typingDot, { opacity: 0.4 }]} />
            <View style={[styles.typingDot, { opacity: 0.6 }]} />
          </View>
          <Text style={styles.typingText}>Querying your data...</Text>
        </View>
      ) : null}

      {/* Input Section */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputSection}>
          {/* Suggested questions */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionsRow}
          >
            {SUGGESTIONS.map((q) => (
              <Pressable
                key={q}
                style={styles.suggestionChip}
                onPress={() => handleSend(q)}
              >
                <Text style={styles.suggestionText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {/* Text input */}
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Ask anything about your ledger..."
              placeholderTextColor={EL.outlineVariant}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
            <Pressable
              onPress={() => handleSend()}
              style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
            >
              <MaterialCommunityIcons name="send" size={20} color={EL.white} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(188,202,192,0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.float,
  },
  headerTitle: {
    ...Type.displaySm,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EL.primary,
  },
  onlineText: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.primary,
  },

  // Chat
  chatContainer: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.xxl,
    gap: Space.xl,
  },
  dateMarker: {
    alignSelf: 'center',
    backgroundColor: EL.surfaceLow,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
    marginBottom: Space.md,
  },
  dateMarkerText: {
    fontSize: 12,
    fontWeight: '600',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Message rows
  msgRow: {
    flexDirection: 'row',
    gap: Space.md,
    maxWidth: '85%',
  },
  msgUser: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse',
  },
  msgBot: {
    alignSelf: 'flex-start',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatar: {
    width: 32,
    height: 32,
    borderRadius: Radii.sm,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  msgBubble: {
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
    flex: 1,
  },
  msgBubbleUser: {
    backgroundColor: EL.primary,
  },
  msgBubbleBot: {
    backgroundColor: EL.surfaceCard,
  },
  msgSender: {
    fontSize: 12,
    fontWeight: '500',
    opacity: 0.6,
    color: EL.onSurface,
    marginBottom: Space.xs,
  },
  msgText: {
    ...Type.bodyMd,
    color: EL.onSurface,
    lineHeight: 22,
  },

  // Typing
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Space.sm,
    paddingHorizontal: Space.xl,
    paddingBottom: Space.sm,
  },
  typingBubble: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    borderBottomLeftRadius: 0,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    ...Shadows.card,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EL.primary,
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
    color: EL.primary,
    fontStyle: 'italic',
    marginLeft: Space.xs,
  },

  // Input section
  inputSection: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.sm,
    paddingBottom: Space.lg,
    backgroundColor: 'rgba(250,252,251,0.9)',
  },
  suggestionsRow: {
    gap: Space.md,
    paddingBottom: Space.lg,
  },
  suggestionChip: {
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(188,202,192,0.3)',
    ...Shadows.card,
  },
  suggestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.secondary,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.sm,
    ...Shadows.float,
  },
  input: {
    flex: 1,
    paddingHorizontal: Space.md,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
  },
  sendBtn: {
    width: Touch.min,
    height: Touch.min,
    borderRadius: Radii.md,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

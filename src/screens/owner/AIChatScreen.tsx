import React, { useCallback, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ELCard } from '@/components/common/ELCard';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
import { useAuthStore } from '@/store/authStore';
import { askLocalRag } from '@/lib/localRag';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function AIChatScreen() {
  const user = useAuthStore((s) => s.user);
  const orgId = user?.orgId ?? '';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `Hello ${user?.name ?? ''}! I'm your VasoolAI assistant. Ask me anything about your business.\n\nTry:\n\u2022 "What's my profit this month?"\n\u2022 "How much can I lend?"\n\u2022 "Who is overdue?"\n\u2022 "About Murugan" (borrower lookup)\n\u2022 "Expenses this month"`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput('');
    const userMsg: Message = { id: String(Date.now()), role: 'user', text: q };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    const result = await askLocalRag(q, orgId);
    const botMsg: Message = { id: String(Date.now() + 1), role: 'assistant', text: result.text };
    setMessages((prev) => [...prev, botMsg]);
    setLoading(false);
  }, [input, loading, orgId]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View style={[styles.msgRow, item.role === 'user' ? styles.msgUser : styles.msgBot]}>
      <View style={[styles.msgBubble, item.role === 'user' ? styles.msgBubbleUser : styles.msgBubbleBot]}>
        <Text style={[styles.msgText, item.role === 'user' && { color: EL.white }]}>
          {item.text}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="robot-outline" size={22} color={EL.primary} />
        <Text style={styles.headerTitle}>AI Assistant</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: Space.md, paddingBottom: 20 }}
      />

      {loading ? (
        <Text style={styles.thinking}>Querying your data...</Text>
      ) : null}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your business..."
            placeholderTextColor={EL.onSurfaceMuted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable onPress={handleSend} style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}>
            <MaterialCommunityIcons name="send" size={20} color={EL.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    gap: Space.sm,
  },
  headerTitle: { ...Type.titleLg, fontWeight: '700' },
  msgRow: { marginBottom: Space.sm },
  msgUser: { alignItems: 'flex-end' },
  msgBot: { alignItems: 'flex-start' },
  msgBubble: {
    maxWidth: '85%',
    borderRadius: Radii.lg,
    padding: Space.lg,
    ...Shadows.card,
  },
  msgBubbleUser: { backgroundColor: EL.primary },
  msgBubbleBot: { backgroundColor: EL.surfaceCard },
  msgText: { ...Type.bodyMd, color: EL.onSurface },
  thinking: { ...Type.labelSm, color: EL.onSurfaceMuted, textAlign: 'center', paddingVertical: Space.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Space.md,
    backgroundColor: EL.surfaceCard,
    ...Shadows.float,
  },
  input: {
    flex: 1,
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.pill,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    ...Type.bodyMd,
    color: EL.onSurface,
  },
  sendBtn: {
    width: Touch.min,
    height: Touch.min,
    borderRadius: Radii.pill,
    backgroundColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.sm,
  },
});

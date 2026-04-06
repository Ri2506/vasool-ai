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

import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
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
      text: `Hello ${user?.name ?? ''}! I'm your VasoolAI assistant. Ask me anything about your business.\n\nTry:\n• "What's my profit this month?"\n• "How much can I lend?"\n• "Who is overdue?"\n• "About Murugan" (borrower lookup)\n• "Expenses this month"`,
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

    // Local RAG: turns question into SQL, queries local SQLite, formats answer
    const result = await askLocalRag(q, orgId);

    const botMsg: Message = {
      id: String(Date.now() + 1),
      role: 'assistant',
      text: result.text,
    };

    setMessages((prev) => [...prev, botMsg]);
    setLoading(false);
  }, [input, loading, orgId]);

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.msgRow,
        item.role === 'user' ? styles.msgUser : styles.msgBot,
      ]}
    >
      <Card
        style={[
          styles.msgCard,
          item.role === 'user' ? styles.msgCardUser : undefined,
        ]}
      >
        <Text style={[styles.msgText, item.role === 'user' && { color: Colors.white }]}>
          {item.text}
        </Text>
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="robot" size={24} color={Colors.primary} />
        <Text style={styles.title}>  AI Assistant</Text>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(m) => m.id}
        renderItem={renderMessage}
        contentContainerStyle={{ padding: Spacing.md, paddingBottom: 20 }}
      />

      {loading ? (
        <Text style={styles.thinking}>Querying your data...</Text>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your business..."
            placeholderTextColor={Colors.textMuted}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <Pressable
            onPress={handleSend}
            style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.7 }]}
          >
            <MaterialCommunityIcons name="send" size={22} color={Colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { ...Typography.title, color: Colors.text, fontSize: 18 },
  msgRow: { marginBottom: Spacing.sm },
  msgUser: { alignItems: 'flex-end' },
  msgBot: { alignItems: 'flex-start' },
  msgCard: { maxWidth: '85%', marginHorizontal: 0 },
  msgCardUser: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  msgText: { ...Typography.body, color: Colors.text },
  thinking: { ...Typography.caption, color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.sm },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.white,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.bg,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    minHeight: TouchTarget.min,
    ...Typography.body,
    color: Colors.text,
  },
  sendBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.pill,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
});

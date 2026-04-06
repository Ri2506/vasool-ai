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
import { useSmartCards } from '@/hooks/useSmartCards';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

// The AI assistant uses Claude Sonnet via a Supabase Edge Function.
// For now, it handles common questions locally (rule-based) as a fast
// fallback. The Claude API integration requires ANTHROPIC_API_KEY
// in the Edge Function env — wired up when the key is available.

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function AIChatScreen() {
  const user = useAuthStore((s) => s.user);
  const { data: smart } = useSmartCards();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      text: `Hello ${user?.name ?? ''}! I'm your VasoolAI assistant. Ask me anything about your business.\n\nTry:\n• "What's my profit this month?"\n• "How much can I lend?"\n• "Who is overdue?"\n• "What's my collection forecast?"`,
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

    // Rule-based local answers (instant, no API call, zero cost)
    const answer = answerLocally(q, smart);

    const botMsg: Message = {
      id: String(Date.now() + 1),
      role: 'assistant',
      text: answer,
    };

    // Simulate a brief "thinking" delay for natural feel
    await new Promise((r) => setTimeout(r, 500));
    setMessages((prev) => [...prev, botMsg]);
    setLoading(false);
  }, [input, loading, smart]);

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
        <Text style={styles.thinking}>Thinking...</Text>
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

/**
 * Rule-based local answering. Handles common business questions instantly
 * using data from useSmartCards. No API call, no latency, no cost.
 * Falls through to a "sorry" response for unrecognized queries —
 * these would be sent to Claude Sonnet API in the Business tier.
 */
function answerLocally(
  query: string,
  smart: ReturnType<typeof useSmartCards>['data']
): string {
  const q = query.toLowerCase();

  if (q.includes('profit')) {
    const p = smart?.monthProfit ?? 0;
    return `Your profit this month is ${formatRupees(p)}.\n\nBreakdown:\n• Collected: ${formatRupees(smart?.monthCollected ?? 0)}\n• Lent: ${formatRupees(smart?.monthLent ?? 0)}\n• Expenses: ${formatRupees(smart?.monthExpenses ?? 0)}`;
  }

  if (q.includes('lend') || q.includes('available') || q.includes('cash')) {
    return `You can lend up to ${formatRupees(smart?.availableToLend ?? 0)} today.\n\nThis is calculated from your total capital invested plus all collections minus loans disbursed and expenses.`;
  }

  if (q.includes('forecast') || q.includes('next week') || q.includes('expected')) {
    return `Next week expected collections: ${formatRupees(smart?.nextWeekForecast ?? 0)}.\n\nBased on active EMIs × 6 working days.`;
  }

  if (q.includes('overdue') || q.includes('default') || q.includes('miss')) {
    return `Check the Overdue dashboard on the Home screen — it shows all borrowers with missed payments sorted by days overdue.\n\nTap the red "Overdue" button on the home screen.`;
  }

  if (q.includes('invest') || q.includes('capital')) {
    return `Total capital invested: ${formatRupees(smart?.totalInvested ?? 0)}.\n\nYou can add investments from Settings → Capital invested → View investments.`;
  }

  if (q.includes('collect') || q.includes('today')) {
    return `Check the Home screen for today's collection list. Use Batch collect for rapid-fire collection of all due borrowers.`;
  }

  if (q.includes('expense')) {
    return `This month's expenses: ${formatRupees(smart?.monthExpenses ?? 0)}.\n\nAdd expenses from the Expenses tab or view the breakdown in Reports.`;
  }

  if (q.includes('hello') || q.includes('hi') || q.includes('hey')) {
    return `Hello! How can I help you with your business today?`;
  }

  return `I can help with questions about:\n• Profit & loss\n• Available cash to lend\n• Collection forecasts\n• Overdue borrowers\n• Investments & expenses\n\nTry asking "What's my profit this month?" or "How much can I lend?"`;
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

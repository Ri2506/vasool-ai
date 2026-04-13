// AgentEODScreen — agent submits today's cash handover to the owner.
//
// Flow:
//   1. Auto-tally card shows "Collected ₹X · Expenses ₹Y · Net ₹Z"
//      (read-only — sourced from collections + expenses tables)
//   2. Cash input — agent enters how much physical cash they're giving owner
//   3. Variance preview updates live: handed_over - net_expected
//   4. Optional notes (for honest variance: "petrol from collection ₹50")
//   5. Submit button calls submitHandover, navigates back to Summary
//
// After submission, the row shows "Awaiting owner confirmation" until
// the owner confirms cash received on their phone.

import React, { useState } from 'react';
import {
  Alert,
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
import { useNavigation } from '@react-navigation/native';

import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import {
  useAgentTallyToday,
  useSubmitHandover,
  useTodayHandover,
} from '@/hooks/useHandovers';
import { formatRupees } from '@/utils/format';

export function AgentEODScreen() {
  const navigation = useNavigation();
  const { data: handover } = useTodayHandover();
  const { data: tally } = useAgentTallyToday();
  const submit = useSubmitHandover();

  // Pre-fill cash with the auto-computed net so the common case (honest
  // agent with exact cash) is one tap.
  const expectedNet = tally ? tally.collected - tally.expenses : 0;
  const [cashStr, setCashStr] = useState('');
  const [notes, setNotes] = useState('');

  const cashNum = Number(cashStr) || 0;
  const variance = cashNum - expectedNet;
  const hasNegativeVariance = cashNum > 0 && variance < 0;
  const isSubmitted = handover?.status === 'submitted' || handover?.status === 'confirmed' || handover?.status === 'disputed';

  const handleSubmit = async () => {
    if (!handover) return;
    if (cashNum <= 0) {
      Alert.alert('Enter cash amount', 'How much cash are you handing over?');
      return;
    }
    if (hasNegativeVariance && !notes.trim()) {
      Alert.alert(
        'Add a note',
        `You're handing over ${formatRupees(Math.abs(variance))} less than collected. Please add a note explaining why (e.g., "petrol from collection ₹50").`,
      );
      return;
    }
    try {
      await submit.mutateAsync({
        id: handover.id,
        cashHandedOver: cashNum,
        notes: notes.trim() || undefined,
      });
      Alert.alert('EOD submitted', 'The owner has been notified to confirm cash received.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Failed to submit');
    }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
            </Pressable>
            <Text style={styles.title}>End of Day</Text>
          </View>

          {/* Auto-tally card */}
          <View style={[styles.card, Shadows.card]}>
            <Text style={styles.cardLabel}>TODAY'S TALLY</Text>
            <View style={styles.tallyRow}>
              <Text style={styles.tallyText}>Collected ({tally?.collectionCount ?? 0})</Text>
              <Text style={[styles.tallyValue, { color: EL.primary }]}>
                {formatRupees(tally?.collected ?? 0)}
              </Text>
            </View>
            <View style={styles.tallyRow}>
              <Text style={styles.tallyText}>Expenses</Text>
              <Text style={[styles.tallyValue, { color: EL.tertiary }]}>
                − {formatRupees(tally?.expenses ?? 0)}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.tallyRow}>
              <Text style={[styles.tallyText, { fontWeight: '700', color: EL.onSurface }]}>
                Net cash to hand over
              </Text>
              <Text style={[styles.tallyValue, { fontSize: 18, color: EL.onSurface }]}>
                {formatRupees(expectedNet)}
              </Text>
            </View>
          </View>

          {/* Already submitted state */}
          {isSubmitted ? (
            <View style={[styles.card, Shadows.card]}>
              <View style={styles.statusRow}>
                <MaterialCommunityIcons
                  name={handover?.status === 'confirmed' ? 'check-decagram' : handover?.status === 'disputed' ? 'alert-circle' : 'clock-outline'}
                  size={22}
                  color={
                    handover?.status === 'confirmed' ? EL.primary :
                    handover?.status === 'disputed' ? EL.tertiary : EL.warn
                  }
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.statusTitle}>
                    {handover?.status === 'confirmed' ? 'Confirmed by owner' :
                     handover?.status === 'disputed' ? 'Disputed by owner' :
                     'Awaiting owner confirmation'}
                  </Text>
                  <Text style={styles.statusSub}>
                    Handed over: {formatRupees(handover?.cash_handed_over ?? 0)}
                    {handover?.cash_received != null
                      ? ` · Received: ${formatRupees(handover.cash_received)}`
                      : ''}
                  </Text>
                </View>
              </View>
              {handover?.notes ? (
                <View style={styles.notePreview}>
                  <MaterialCommunityIcons name="note-text-outline" size={14} color={EL.onSurfaceMuted} />
                  <Text style={styles.notePreviewText}>{handover.notes}</Text>
                </View>
              ) : null}
            </View>
          ) : (
            <>
              {/* Cash input */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardLabel}>CASH BEING HANDED OVER</Text>
                <View style={styles.cashWrap}>
                  <Text style={styles.rupee}>₹</Text>
                  <TextInput
                    value={cashStr}
                    onChangeText={setCashStr}
                    keyboardType="numeric"
                    placeholder={String(expectedNet)}
                    placeholderTextColor={EL.onSurfaceMuted}
                    style={styles.cashInput}
                  />
                  <Pressable
                    onPress={() => setCashStr(String(expectedNet))}
                    style={styles.useTallyBtn}
                  >
                    <Text style={styles.useTallyText}>Use ₹{expectedNet}</Text>
                  </Pressable>
                </View>

                {/* Variance preview */}
                {cashNum > 0 ? (
                  <View
                    style={[
                      styles.varianceRow,
                      variance < 0 && styles.varianceNegative,
                      variance > 0 && styles.variancePositive,
                      variance === 0 && styles.varianceZero,
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={
                        variance < 0
                          ? 'arrow-down-bold-circle'
                          : variance > 0
                          ? 'arrow-up-bold-circle'
                          : 'check-circle'
                      }
                      size={18}
                      color={variance < 0 ? EL.tertiary : variance > 0 ? EL.warn : EL.primary}
                    />
                    <Text
                      style={[
                        styles.varianceText,
                        variance < 0 && { color: EL.tertiary },
                        variance > 0 && { color: EL.warn },
                        variance === 0 && { color: EL.primary },
                      ]}
                    >
                      {variance === 0
                        ? 'Matches tally exactly'
                        : variance < 0
                        ? `${formatRupees(Math.abs(variance))} short — please explain`
                        : `${formatRupees(variance)} extra`}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Notes */}
              <View style={[styles.card, Shadows.card]}>
                <Text style={styles.cardLabel}>NOTES (OPTIONAL)</Text>
                <TextInput
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g. petrol ₹50 from collection, borrower X partial"
                  placeholderTextColor={EL.onSurfaceMuted}
                  multiline
                  numberOfLines={3}
                  style={styles.notesInput}
                />
              </View>

              <GradientButton
                title={submit.isPending ? 'Submitting...' : 'Submit EOD'}
                onPress={handleSubmit}
                disabled={submit.isPending || cashNum <= 0}
                loading={submit.isPending}
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Space.lg,
    gap: Space.lg,
    paddingBottom: Space.xxxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },

  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.sm,
  },
  cardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: EL.onSurfaceMuted,
    letterSpacing: 0.8,
    marginBottom: Space.xs,
  },
  tallyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  tallyText: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  tallyValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    height: 1,
    backgroundColor: EL.surfaceLow,
    marginVertical: Space.xs,
  },

  cashWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    paddingHorizontal: Space.md,
  },
  rupee: {
    fontSize: 24,
    color: EL.primary,
    fontWeight: '600',
    marginRight: Space.sm,
  },
  cashInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: EL.onSurface,
    paddingVertical: Space.md,
  },
  useTallyBtn: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.sm,
    borderRadius: Radii.pill,
    backgroundColor: EL.primaryFixed,
  },
  useTallyText: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.onPrimaryFixed,
  },

  varianceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    paddingVertical: Space.sm,
    paddingHorizontal: Space.md,
    borderRadius: Radii.md,
    marginTop: Space.sm,
  },
  varianceNegative: { backgroundColor: 'rgba(155,62,59,0.08)' },
  variancePositive: { backgroundColor: 'rgba(217,119,6,0.08)' },
  varianceZero: { backgroundColor: 'rgba(0,105,72,0.08)' },
  varianceText: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },

  notesInput: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.md,
    fontSize: 14,
    color: EL.onSurface,
    minHeight: 80,
    textAlignVertical: 'top',
  },

  // Already-submitted state
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurface,
  },
  statusSub: {
    fontSize: 12,
    color: EL.onSurfaceMuted,
    marginTop: 2,
  },
  notePreview: {
    flexDirection: 'row',
    gap: Space.sm,
    paddingTop: Space.sm,
    borderTopWidth: 1,
    borderTopColor: EL.surfaceLow,
  },
  notePreviewText: {
    flex: 1,
    fontSize: 12,
    color: EL.onSurfaceSec,
    fontStyle: 'italic',
  },
});

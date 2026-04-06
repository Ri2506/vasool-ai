import React, { useEffect, useState } from 'react';
import {
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Badge } from '@/components/common/Badge';
import { Button } from '@/components/common/Button';
import { NumberPad } from '@/components/common/NumberPad';
import { QuickAmountChips } from '@/components/common/QuickAmountChips';
import { VoiceButton } from '@/components/common/VoiceButton';
import { Colors } from '@/constants/colors';
import { Spacing, Typography } from '@/constants/typography';
import { useRecordCollection } from '@/hooks/useCollections';
import { useGps } from '@/hooks/useGps';
import { useVoice } from '@/hooks/useVoice';
import { formatRupees } from '@/utils/format';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'Collect'>;

export function CollectScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const { item } = route.params;
  const recordMut = useRecordCollection();
  const { getLocation } = useGps();

  const voice = useVoice();

  const [amount, setAmount] = useState(String(item.expected_amount));
  const [showAdvance, setShowAdvance] = useState(false);
  const [advancePeriods, setAdvancePeriods] = useState(0);

  // When voice recognizes an amount, fill it in
  useEffect(() => {
    if (voice.lastResult?.amount) {
      setAmount(String(voice.lastResult.amount));
    }
  }, [voice.lastResult]);
  const [collected, setCollected] = useState(false);

  const handleCollect = async () => {
    const numAmount = Number(amount);
    if (numAmount <= 0) return;
    try {
      const gps = await getLocation();
      await recordMut.mutateAsync({
        loanId: item.loan_id,
        planEntryId: item.plan_entry_id,
        amount: numAmount,
        expectedAmount: item.expected_amount,
        isAdvance: advancePeriods > 0,
        advancePeriods,
        gpsLat: gps?.lat,
        gpsLng: gps?.lng,
      });
      setCollected(true);
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  if (collected) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: Colors.primaryLight }]}>
        <View style={styles.successContainer}>
          <Text style={styles.checkmark}>✓</Text>
          <Text style={styles.successAmount}>{formatRupees(Number(amount))}</Text>
          <Text style={styles.successName}>{item.borrower_name}</Text>
          <Text style={styles.successSub}>Collection recorded</Text>
          <Button
            title="Done"
            onPress={() => navigation.goBack()}
            style={{ marginTop: Spacing.xl, minWidth: 200 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Borrower header */}
        <View style={styles.header}>
          <Avatar name={item.borrower_name} size={56} />
          <View style={styles.headerText}>
            <Text style={styles.name}>{item.borrower_name}</Text>
            {item.borrower_phone ? (
              <Text style={styles.sub}>{item.borrower_phone}</Text>
            ) : null}
            <Text style={styles.sub}>
              EMI {formatRupees(item.expected_amount)} • #{item.installment_number}
            </Text>
          </View>
          {item.line_name ? (
            <Badge label={item.line_name} variant="info" />
          ) : null}
        </View>

        {/* Quick amount chips — Layer 1 */}
        <QuickAmountChips
          emiAmount={item.expected_amount}
          selected={Number(amount)}
          onSelect={(v) => setAmount(String(v))}
        />

        {/* Voice input — Layer 3 */}
        <VoiceButton
          isListening={voice.isListening}
          onPress={voice.isListening ? voice.stopListening : voice.startListening}
          lastText={voice.lastResult?.text}
        />

        {/* Number pad — Layer 2 */}
        <NumberPad
          value={amount}
          onChange={setAmount}
          onConfirm={handleCollect}
          confirmLabel={t('loan.amount')}
          disabled={recordMut.isPending}
        />

        {/* Advance toggle */}
        {!showAdvance ? (
          <Button
            title="Advance payment"
            variant="secondary"
            onPress={() => setShowAdvance(true)}
            style={{ marginTop: Spacing.lg, marginHorizontal: Spacing.md }}
          />
        ) : (
          <View style={styles.advanceWrap}>
            <Text style={styles.advanceLabel}>Pay for how many periods?</Text>
            <View style={styles.advanceChips}>
              {[2, 3, 5, 7, 10].map((n) => (
                <Button
                  key={n}
                  title={`${n}×`}
                  variant={advancePeriods === n ? 'primary' : 'secondary'}
                  onPress={() => {
                    setAdvancePeriods(n);
                    setAmount(String(item.expected_amount * n));
                  }}
                  style={styles.advanceChip}
                />
              ))}
            </View>
            <Text style={styles.advanceTotal}>
              Total: {formatRupees(item.expected_amount * (advancePeriods || 1))}
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  headerText: { flex: 1, marginLeft: Spacing.md },
  name: { ...Typography.title, color: Colors.text, fontSize: 18 },
  sub: { ...Typography.caption, color: Colors.textSec, marginTop: 2 },

  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  checkmark: {
    fontSize: 72,
    color: Colors.primary,
    marginBottom: Spacing.md,
  },
  successAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  successName: { ...Typography.title, color: Colors.text, marginTop: Spacing.sm },
  successSub: { ...Typography.body, color: Colors.textSec, marginTop: 4 },

  advanceWrap: { padding: Spacing.xl },
  advanceLabel: { ...Typography.body, color: Colors.textSec, marginBottom: Spacing.md },
  advanceChips: { flexDirection: 'row', flexWrap: 'wrap' },
  advanceChip: { marginRight: Spacing.sm, marginBottom: Spacing.sm, minWidth: 60 },
  advanceTotal: { ...Typography.title, color: Colors.text, marginTop: Spacing.md },
});

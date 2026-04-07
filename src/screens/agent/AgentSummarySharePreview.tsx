import React from 'react';
import { SafeAreaView, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Space, Type } from '@/theme/emeraldLedger';
import { useTodaySummary } from '@/hooks/useCollections';
import { useAuthStore } from '@/store/authStore';
import { formatRupees } from '@/utils/format';

/**
 * Agent Summary Share Preview — shows a styled preview of the daily summary
 * card that will be shared to the owner via WhatsApp.
 * Matches stitch/agent_summary_share_preview design.
 */
export function AgentSummarySharePreview() {
  const user = useAuthStore((s) => s.user);
  const { data: summary } = useTodaySummary();
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });

  const collected = summary?.totalCollected ?? 0;
  const expected = collected + (summary?.totalExpected ?? 0);
  const done = summary?.collectionCount ?? 0;
  const total = done + (summary?.dueCount ?? 0);
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const handleShare = async () => {
    const text = [
      `📊 VasoolAI Daily Summary`,
      `Agent: ${user?.name ?? ''}`,
      `Date: ${today}`,
      ``,
      `✅ Collected: ${formatRupees(collected)}`,
      `👥 Visited: ${done} of ${total} (${pct}%)`,
      ``,
      `— Sent from VasoolAI`,
    ].join('\n');

    await Share.share({ message: text, title: 'Daily Summary' });
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={Type.displaySm}>Share Preview</Text>
        <Text style={[Type.bodySm, { marginBottom: Space.xl }]}>This is what will be shared to the owner</Text>

        {/* Preview card */}
        <ELCard style={styles.previewCard}>
          <View style={styles.previewHeader}>
            <MaterialCommunityIcons name="chart-bar" size={20} color={EL.primary} />
            <Text style={[Type.labelLg, { color: EL.primary, marginLeft: Space.sm }]}>VasoolAI Daily Summary</Text>
          </View>

          <Text style={[Type.bodySm, { marginTop: Space.sm }]}>{today}</Text>
          <Text style={[Type.titleMd, { marginTop: Space.xs }]}>Agent: {user?.name ?? ''}</Text>

          <View style={styles.divider} />

          <Text style={[Type.labelMd, { marginBottom: Space.sm }]}>COLLECTION</Text>
          <Text style={styles.bigAmount}>{formatRupees(collected)}</Text>
          <ProgressBar progress={total > 0 ? done / total : 0} label={`${done}/${total} borrowers (${pct}%)`} />

          <View style={styles.divider} />

          <View style={styles.statRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{done}</Text>
              <Text style={Type.labelSm}>Visited</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{total - done}</Text>
              <Text style={Type.labelSm}>Remaining</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{pct}%</Text>
              <Text style={Type.labelSm}>Complete</Text>
            </View>
          </View>
        </ELCard>

        <GradientButton
          title="Share to Owner"
          onPress={handleShare}
          icon={<MaterialCommunityIcons name="share" size={18} color={EL.white} />}
          style={{ marginTop: Space.xl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.xl, paddingBottom: Space.xxxl },
  previewCard: { borderWidth: 1, borderColor: EL.outline, borderStyle: 'dashed' },
  previewHeader: { flexDirection: 'row', alignItems: 'center' },
  divider: { height: 1, backgroundColor: EL.surfaceLow, marginVertical: Space.lg },
  bigAmount: { ...Type.displayLg, color: EL.primary, marginBottom: Space.md },
  statRow: { flexDirection: 'row' },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { ...Type.displaySm, color: EL.onSurface },
});

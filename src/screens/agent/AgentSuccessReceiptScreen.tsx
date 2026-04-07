import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GradientButton } from '@/components/common/GradientButton';
import { ProgressBar } from '@/components/common/ProgressBar';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { formatRupees } from '@/utils/format';
import type { SuccessReceiptParams } from '@/navigation/types';

type Props = {
  route: { params: SuccessReceiptParams };
  navigation: { goBack: () => void };
};

export function AgentSuccessReceiptScreen({ route, navigation }: Props) {
  const {
    borrowerName,
    amount,
    loanRemaining,
    daysPaid,
    totalDays,
    agentName,
    timestamp,
  } = route.params;

  const progress = totalDays > 0 ? daysPaid / totalDays : 0;
  const dateStr = new Date(timestamp).toLocaleDateString('en-IN', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = new Date(timestamp).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleShare = async () => {
    await Share.share({
      message: `Payment Receipt\n\nBorrower: ${borrowerName}\nAmount: ${formatRupees(amount)}\nDate: ${dateStr} \u2022 ${timeStr}\nRemaining: ${formatRupees(loanRemaining)}\nProgress: Day ${daysPaid}/${totalDays}\n\n\u2014 VasoolAI`,
    });
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Success icon + header */}
        <View style={styles.successHeader}>
          <View style={styles.checkCircle}>
            <MaterialCommunityIcons name="check" size={64} color={EL.primary} />
          </View>
          <Text style={styles.successTitle}>Payment Recorded!</Text>
          <Text style={styles.successSub}>
            {formatRupees(amount)}{' '}
            <Text style={{ fontWeight: '400', opacity: 0.7 }}>from</Text>{' '}
            {borrowerName}
          </Text>
        </View>

        {/* Digital Receipt Card */}
        <View style={styles.receiptWrap}>
          {/* Punch-card holes */}
          <View style={[styles.punchHole, styles.punchLeft]} />
          <View style={[styles.punchHole, styles.punchRight]} />

          <View style={styles.receiptCard}>
            {/* Receipt header */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>VasoolAI</Text>
              <Text style={styles.receiptTag}>PAYMENT RECEIPT</Text>
            </View>

            {/* Dashed separator */}
            <View style={styles.dashedLine} />

            {/* Transaction details */}
            <View style={styles.detailsSection}>
              <ReceiptRow label="Borrower" value={borrowerName} />
              <ReceiptRow label="Amount Received" value={formatRupees(amount)} highlight />
              <ReceiptRow label="Date & Time" value={`${dateStr} \u2022 ${timeStr}`} />
              {agentName ? <ReceiptRow label="Agent Name" value={agentName} /> : null}
            </View>

            {/* Dashed separator */}
            <View style={styles.dashedLine} />

            {/* Loan progress */}
            <View style={styles.loanSection}>
              <View style={styles.loanRow}>
                <Text style={styles.loanLabel}>LOAN REMAINING</Text>
                <Text style={styles.loanValue}>{formatRupees(loanRemaining)}</Text>
              </View>
              <View style={styles.loanRow}>
                <Text style={styles.loanLabel}>PROGRESS</Text>
                <Text style={styles.loanProgressText}>
                  Day {daysPaid} of {totalDays}
                </Text>
              </View>
              <View style={{ marginTop: Space.sm }}>
                <ProgressBar progress={progress} />
              </View>
            </View>

            {/* Footer */}
            <View style={styles.receiptFooter}>
              <Text style={styles.footerText}>Powered by VasoolAI</Text>
            </View>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actions}>
          <GradientButton
            title="Share via WhatsApp"
            onPress={handleShare}
            icon={<MaterialCommunityIcons name="share-variant" size={18} color={EL.white} />}
          />
          <GradientButton
            title="Done"
            variant="secondary"
            onPress={() => navigation.goBack()}
            style={{ marginTop: Space.sm }}
          />
        </View>

        {/* Footer status */}
        <View style={styles.statusFooter}>
          <View style={styles.statusItem}>
            <MaterialCommunityIcons name="map-marker" size={12} color={EL.primary} />
            <Text style={styles.statusText}>GPS Captured</Text>
          </View>
          <Text style={styles.statusDot}>{'\u2022'}</Text>
          <Text style={styles.statusText}>Will sync when online</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={receiptRowStyles.row}>
      <Text style={receiptRowStyles.label}>{label}</Text>
      <Text style={[receiptRowStyles.value, highlight && { color: EL.primary, fontSize: 18, fontWeight: '700' }]}>
        {value}
      </Text>
    </View>
  );
}

const receiptRowStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Space.md,
  },
  label: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 11,
  },
  value: {
    ...Type.bodyMd,
    fontWeight: '600',
  },
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
    alignItems: 'center',
  },

  // Success header
  successHeader: {
    alignItems: 'center',
    marginTop: Space.xxxl,
    marginBottom: Space.xxxl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xl,
  },
  successTitle: {
    ...Type.displaySm,
    color: EL.primary,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  successSub: {
    ...Type.titleLg,
    color: EL.onSurfaceSec,
    fontWeight: '700',
    marginTop: Space.xs,
  },

  // Receipt card
  receiptWrap: {
    width: '100%',
    position: 'relative',
  },
  punchHole: {
    position: 'absolute',
    width: 16,
    height: 32,
    backgroundColor: EL.surface,
    top: '50%',
    marginTop: -16,
    zIndex: 10,
  },
  punchLeft: {
    left: -8,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
  },
  punchRight: {
    right: -8,
    borderTopLeftRadius: 16,
    borderBottomLeftRadius: 16,
  },
  receiptCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xxl,
    ...Shadows.float,
  },
  receiptHeader: {
    alignItems: 'center',
    paddingBottom: Space.xl,
  },
  receiptBrand: {
    ...Type.titleLg,
    color: EL.primary,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  receiptTag: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: Space.xs,
    fontSize: 10,
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: EL.outline,
    borderStyle: 'dashed',
    marginVertical: Space.xl,
  },
  detailsSection: {},

  // Loan section
  loanSection: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    padding: Space.lg,
  },
  loanRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Space.sm,
  },
  loanLabel: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    fontWeight: '700',
    textTransform: 'uppercase',
    fontSize: 10,
  },
  loanValue: {
    ...Type.labelLg,
    color: EL.danger,
    fontWeight: '700',
  },
  loanProgressText: {
    ...Type.bodySm,
    color: EL.onSurfaceSec,
    fontWeight: '500',
  },

  // Footer
  receiptFooter: {
    alignItems: 'center',
    marginTop: Space.xxl,
  },
  footerText: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    fontStyle: 'italic',
    fontSize: 10,
  },

  // Actions
  actions: {
    width: '100%',
    marginTop: Space.xxxl,
  },

  // Status footer
  statusFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Space.xxxl,
    gap: Space.sm,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  statusText: {
    ...Type.labelSm,
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 10,
  },
  statusDot: {
    color: EL.onSurfaceMuted,
    fontSize: 8,
  },
});

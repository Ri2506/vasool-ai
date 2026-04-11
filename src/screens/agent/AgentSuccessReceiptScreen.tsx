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
import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
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
  const progressPct = Math.round(progress * 100);
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
    try {
      await Share.share({
        message: `Payment Receipt\n\nBorrower: ${borrowerName}\nAmount: ${formatRupees(amount)}\nDate: ${dateStr} \u2022 ${timeStr}\nRemaining: ${formatRupees(loanRemaining)}\nProgress: Day ${daysPaid}/${totalDays}\n\n\u2014 VasoolAI`,
      });
    } catch {}
  };

  return (
    <SafeAreaView style={Common.screen}>
      {/* Close button */}
      <Pressable style={styles.closeBtn} onPress={() => navigation.goBack()}>
        <MaterialCommunityIcons name="close" size={24} color={EL.onSurface} />
      </Pressable>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Success Icon + Header */}
        <View style={styles.successSection}>
          <View style={styles.checkCircle}>
            <MaterialCommunityIcons name="check-circle" size={72} color={EL.primary} />
          </View>
          <Text style={styles.successTitle}>Payment Recorded!</Text>
          <Text style={styles.successSub}>
            {formatRupees(amount)}{' '}
            <Text style={styles.successFrom}>from</Text>{' '}
            {borrowerName}
          </Text>
        </View>

        {/* Digital Receipt Card */}
        <View style={styles.receiptWrap}>
          {/* Punch-card decorative holes */}
          <View style={[styles.punchHole, styles.punchLeft]} />
          <View style={[styles.punchHole, styles.punchRight]} />

          <View style={styles.receiptCard}>
            {/* Receipt header */}
            <View style={styles.receiptHeader}>
              <Text style={styles.receiptBrand}>Pristine Capital</Text>
              <Text style={styles.receiptTag}>PAYMENT RECEIPT</Text>
            </View>

            {/* Dashed separator */}
            <View style={styles.dashedLine} />

            {/* Transaction details */}
            <View style={styles.detailsSection}>
              <ReceiptRow label="Borrower" value={borrowerName} />
              <ReceiptRow label="Amount Received" value={formatRupees(amount)} highlight />
              <ReceiptRow label="Date & Time" value={`${dateStr} \u2022 ${timeStr}`} />
              {agentName ? (
                <ReceiptRow label="Agent Name" value={agentName ?? 'Owner'} />
              ) : null}
            </View>

            {/* Dashed separator */}
            <View style={styles.dashedLine} />

            {/* Loan Progress Section */}
            <View style={styles.loanBox}>
              <View style={styles.loanRow}>
                <Text style={styles.loanLabel}>LOAN REMAINING</Text>
                <Text style={styles.loanValue}>{formatRupees(loanRemaining)}</Text>
              </View>
              <View style={styles.loanRow}>
                <Text style={styles.loanLabel}>PROGRESS</Text>
                <Text style={styles.loanProgressText}>Day {daysPaid} of {totalDays}</Text>
              </View>
              {/* Progress bar */}
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progressPct}%` as any }]} />
              </View>
            </View>

            {/* Barcode decoration + footer */}
            <View style={styles.receiptFooter}>
              <View style={styles.barcodeDecor}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <View
                    key={i}
                    style={[
                      styles.barcodeLine,
                      { width: i % 3 === 0 ? 3 : 1.5, opacity: 0.3 },
                    ]}
                  />
                ))}
              </View>
              <Text style={styles.footerText}>Powered by VasoolAI</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.95, transform: [{ scale: 0.98 }] }]}
            onPress={handleShare}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={EL.white} />
            <Text style={styles.shareBtnText}>Share Receipt</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.9 }]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.doneBtnText}>Done</Text>
          </Pressable>
        </View>

        {/* Sync Status Footer */}
        <View style={styles.statusFooter}>
          <View style={styles.statusRow}>
            <MaterialCommunityIcons name="map-marker" size={12} color={EL.primary} />
            <Text style={styles.statusText}>GPS Captured {'\u2022'} Will sync when online</Text>
          </View>
          <View style={styles.dotsRow}>
            <View style={styles.statusDot} />
            <View style={styles.statusDot} />
            <View style={styles.statusDot} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReceiptRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <View style={receiptRowStyles.row}>
      <Text style={receiptRowStyles.label}>{label}</Text>
      <Text style={[receiptRowStyles.value, highlight && receiptRowStyles.highlight]}>
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
    marginBottom: Space.lg,
  },
  label: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  value: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '600',
    color: EL.onSurface,
  },
  highlight: {
    fontSize: 18,
    fontWeight: '700',
    color: EL.primary,
  },
});

const styles = StyleSheet.create({
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.lg,
    marginTop: Space.sm,
  },
  content: {
    paddingHorizontal: Space.xl,
    paddingBottom: Space.xxxl,
    alignItems: 'center',
  },

  // Success Section
  successSection: {
    alignItems: 'center',
    marginTop: Space.xxxl,
    marginBottom: Space.xxxl,
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(0, 105, 72, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xl,
  },
  successTitle: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: -0.3,
    marginBottom: Space.xs,
  },
  successSub: {
    fontFamily: Fonts.body,
    fontSize: 20,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },
  successFrom: {
    fontWeight: '400',
    opacity: 0.7,
  },

  // Receipt Card
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
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '800',
    color: EL.primary,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  receiptTag: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    letterSpacing: 3,
    textTransform: 'uppercase',
    marginTop: Space.xs,
  },
  dashedLine: {
    borderBottomWidth: 1,
    borderBottomColor: EL.outlineVariant,
    borderStyle: 'dashed',
    marginVertical: Space.xl,
  },
  detailsSection: {},

  // Loan section
  loanBox: {
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
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '700',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
  },
  loanValue: {
    fontFamily: Fonts.body,
    fontSize: 14,
    fontWeight: '700',
    color: EL.tertiary,
  },
  loanProgressText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  progressTrack: {
    height: 6,
    backgroundColor: EL.surfaceHighest,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: Space.md,
  },
  progressFill: {
    height: '100%',
    backgroundColor: EL.primary,
    borderRadius: 3,
  },

  // Receipt footer
  receiptFooter: {
    alignItems: 'center',
    marginTop: Space.xxl,
    paddingTop: Space.xl,
  },
  barcodeDecor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    height: 32,
    marginBottom: Space.lg,
    opacity: 0.3,
  },
  barcodeLine: {
    height: 32,
    backgroundColor: EL.onSurface,
    borderRadius: 1,
  },
  footerText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    fontStyle: 'italic',
  },

  // Action Buttons
  actions: {
    width: '100%',
    marginTop: Space.xxxl,
    gap: Space.md,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    gap: Space.md,
    shadowColor: 'rgba(0, 105, 72, 0.2)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 4,
  },
  shareBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.white,
  },
  doneBtn: {
    height: 56,
    backgroundColor: EL.surfaceHighest,
    borderRadius: Radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },

  // Status Footer
  statusFooter: {
    alignItems: 'center',
    marginTop: Space.xxxl,
    paddingTop: Space.xl,
    gap: Space.sm,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.xs,
  },
  statusText: {
    fontFamily: Fonts.body,
    fontSize: 10,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: Space.lg,
  },
  statusDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.primary,
    opacity: 0.2,
  },
});

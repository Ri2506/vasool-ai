import React, { useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import type { OwnerStackParamList } from '@/navigation/types';
import {
  getDailySummaries,
  getLineSummary,
  getOutstandingReport,
} from '@/db/repos/reports';
import { useAuthStore } from '@/store/authStore';
import { formatDateShort, formatRupees } from '@/utils/format';
import { generateReportHtml, sharePdf } from '@/utils/pdfExport';

type Tab = 'daily' | 'lines' | 'outstanding';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

const REPORT_CARDS = [
  { key: 'daily', icon: 'calendar-today' as const, label: 'Daily Summary', sub: "Today's collections & pending", bgColor: 'primaryFixed' as const, iconColor: 'primary' as const },
  { key: 'patti', icon: 'table-large' as const, label: 'Patti Note', sub: 'Tabular collection register', bgColor: 'secondaryContainer' as const, iconColor: 'secondary' as const },
  { key: 'outstanding', icon: 'format-list-bulleted' as const, label: 'Outstanding', sub: 'Borrower-wise balance due', bgColor: 'primaryFixed' as const, iconColor: 'primary' as const },
  { key: 'expenses', icon: 'wallet-outline' as const, label: 'Expenses', sub: 'By category & date', bgColor: 'secondaryContainer' as const, iconColor: 'secondary' as const },
  { key: 'investment', icon: 'trending-up' as const, label: 'Investment', sub: 'Capital tracking', bgColor: 'primaryFixed' as const, iconColor: 'primary' as const },
  { key: 'nippu', icon: 'alert-outline' as const, label: 'Nippu Report', sub: 'Overdue borrowers', bgColor: 'tertiaryFixed' as const, iconColor: 'tertiary' as const },
];

export function ReportsScreen() {
  useTranslation();
  const navigation = useNavigation<Nav>();
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const [tab, setTab] = useState<Tab>('daily');

  const { data: daily } = useQuery({
    queryKey: ['report', 'daily', orgId],
    enabled: !!orgId,
    queryFn: () => getDailySummaries(orgId!),
  });
  const { data: lines } = useQuery({
    queryKey: ['report', 'lines', orgId],
    enabled: !!orgId,
    queryFn: () => getLineSummary(orgId!),
  });
  const { data: outstanding } = useQuery({
    queryKey: ['report', 'outstanding', orgId],
    enabled: !!orgId,
    queryFn: () => getOutstandingReport(orgId!),
  });

  const handleSharePdf = async () => {
    let html = '';
    if (tab === 'daily' && daily) {
      html = generateReportHtml('Daily Summary', ['Date', 'Collected', 'Expenses', 'Net'],
        daily.map((r) => [formatDateShort(new Date(r.date)), formatRupees(r.total_collected), formatRupees(r.total_expenses), formatRupees(r.total_collected - r.total_expenses)]));
    } else if (tab === 'lines' && lines) {
      html = generateReportHtml('Line Summary', ['Line', 'Borrowers', 'Due', 'Collected'],
        lines.map((r) => [r.line_name, String(r.borrower_count), formatRupees(r.total_due), formatRupees(r.total_collected)]));
    } else if (tab === 'outstanding' && outstanding) {
      html = generateReportHtml('Outstanding Report', ['Borrower', 'Principal', 'Paid', 'Status'],
        outstanding.map((r) => [r.borrower_name, formatRupees(r.principal), formatRupees(r.total_paid), r.status]));
    }
    if (html) await sharePdf(html, `VasoolAI-${tab}-report`);
  };

  const handleCardPress = (key: string) => {
    switch (key) {
      case 'daily': navigation.navigate('DailySummary'); break;
      case 'patti': navigation.navigate('PattiNote'); break;
      case 'outstanding': navigation.navigate('OutstandingReport'); break;
      case 'expenses': navigation.navigate('Expenses'); break;
      case 'investment': navigation.navigate('Investments'); break;
      case 'nippu': navigation.navigate('NippuReport'); break;
    }
  };

  // Summary values
  const totalCollected = daily?.reduce((s, r) => s + r.total_collected, 0) ?? 0;
  const totalProfit = daily?.reduce((s, r) => s + (r.total_collected - r.total_expenses), 0) ?? 0;

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Monthly Summary Banner */}
        <View style={styles.summaryBanner}>
          {/* Decorative blurred circle */}
          <View style={styles.decorCircle} />

          <View style={styles.bannerTopRow}>
            <View>
              <View style={styles.reportReadyPill}>
                <Text style={styles.reportReadyText}>Report Ready</Text>
              </View>
              <Text style={styles.bannerTitle}>Monthly Summary</Text>
            </View>
            <Pressable
              onPress={() => navigation.navigate('MonthlySummary')}
              style={styles.viewBtn}
            >
              <Text style={styles.viewBtnText}>View</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={EL.white} />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>PROFIT</Text>
              <Text style={styles.statValue}>{formatRupees(totalProfit)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statLabel}>COLLECTED</Text>
              <Text style={styles.statValue}>{formatRupees(totalCollected)}</Text>
            </View>
          </View>
        </View>

        {/* Reports Grid Section */}
        <View style={styles.gridSection}>
          <Text style={styles.sectionHeader}>DETAILED ANALYTICS</Text>
          <View style={styles.reportGrid}>
            {REPORT_CARDS.map((card) => {
              const bgColors = {
                primaryFixed: 'rgba(133, 248, 196, 0.3)',
                secondaryContainer: EL.secondaryContainer,
                tertiaryFixed: EL.tertiaryFixed,
              };
              const iconColors = {
                primary: EL.primary,
                secondary: EL.secondary,
                tertiary: EL.tertiary,
              };
              return (
                <Pressable
                  key={card.key}
                  style={styles.reportCard}
                  onPress={() => handleCardPress(card.key)}
                >
                  <View style={[styles.reportCardIcon, { backgroundColor: bgColors[card.bgColor] }]}>
                    <MaterialCommunityIcons
                      name={card.icon as any}
                      size={22}
                      color={iconColors[card.iconColor]}
                    />
                  </View>
                  <View>
                    <Text style={styles.reportCardTitle}>{card.label}</Text>
                    <Text style={styles.reportCardSub}>{card.sub}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Bilingual Insight Section */}
        <View style={styles.insightSection}>
          <View style={styles.insightContent}>
            <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={EL.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.insightTitle}>System Insight / {'\u0B89\u0BA4\u0BB5\u0BBF\u0B95\u0BCD\u0B95\u0BC1\u0BB1\u0BBF\u0BAA\u0BCD\u0BAA\u0BC1'}</Text>
              <Text style={styles.insightBody}>
                Track your daily 'Vasool' progress in the Patti Note section for real-time updates.
                {'\n'}{'\u0B89\u0B99\u0BCD\u0B95\u0BB3\u0BBF\u0BA9\u0BCD'} {'\u0BA4\u0BBF\u0BA9\u0B9A\u0BB0\u0BBF'} {'\u0BB5\u0B9A\u0BC2\u0BB2\u0BCD'} {'\u0BA8\u0BBF\u0BB2\u0BB5\u0BB0\u0BA4\u0BCD\u0BA4\u0BC8'} {'\u0BAA\u0B9F\u0BCD\u0B9F\u0BBF'} {'\u0BA8\u0BCB\u0B9F\u0BCD\u0B9F\u0BBF\u0BB2\u0BCD'} {'\u0B9A\u0BB0\u0BBF\u0BAA\u0BBE\u0BB0\u0BCD\u0B95\u0BCD\u0B95\u0BB5\u0BC1\u0BAE\u0BCD'}.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.lg,
    paddingBottom: 100,
  },

  // Monthly Summary Banner
  summaryBanner: {
    backgroundColor: EL.surface,
    borderRadius: Radii.xxl,
    padding: Space.xxl,
    position: 'relative',
    overflow: 'hidden',
    ...Shadows.card,
  },
  decorCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(133, 248, 196, 0.3)',
  },
  bannerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    zIndex: 1,
  },
  reportReadyPill: {
    backgroundColor: 'rgba(133, 248, 196, 0.4)',
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
    alignSelf: 'flex-start',
  },
  reportReadyText: {
    fontFamily: Fonts.headline,
    fontSize: 11,
    fontWeight: '600',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontFamily: Fonts.headline,
    fontSize: 24,
    fontWeight: '700',
    color: EL.onSurface,
    marginTop: Space.sm,
  },
  viewBtn: {
    backgroundColor: EL.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
    borderRadius: Radii.md,
    gap: Space.sm,
    ...Shadows.card,
  },
  viewBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '600',
    color: EL.white,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: Space.lg,
    marginTop: Space.lg,
    zIndex: 1,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    padding: Space.lg,
    borderRadius: Radii.lg,
  },
  statLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  statValue: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '800',
    color: EL.primary,
    marginTop: Space.xs,
  },

  // Reports Grid
  gridSection: {
    marginTop: Space.xxl,
  },
  sectionHeader: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(19, 30, 25, 0.6)',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    paddingLeft: 2,
    marginBottom: Space.lg,
  },
  reportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Space.lg,
  },
  reportCard: {
    width: '47%',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    gap: Space.md,
    ...Shadows.card,
  },
  reportCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reportCardTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  reportCardSub: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: EL.onSurfaceMuted,
    lineHeight: 16,
    marginTop: 2,
  },

  // Insight Section
  insightSection: {
    marginTop: Space.xxl,
    backgroundColor: 'rgba(222, 235, 227, 0.3)',
    borderRadius: Radii.lg,
    padding: Space.lg,
    borderLeftWidth: 4,
    borderLeftColor: EL.primary,
  },
  insightContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  insightTitle: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurface,
  },
  insightBody: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: EL.onSurfaceSec,
    lineHeight: 18,
    marginTop: Space.xs,
  },
});

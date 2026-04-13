import React, { useState } from 'react';
import { Alert, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { OwnerStackParamList } from '@/navigation/types';
import { useQuery } from '@tanstack/react-query';

import { EL, Common, Radii, Shadows, Space, Fonts } from '@/theme/emeraldLedger';
import { setLanguage, type Language } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { exportBorrowers, exportCollections, exportExpenses, shareCsv } from '@/utils/exportData';
import { listAgents } from '@/db/repos/agents';
import type { UserRow } from '@/db/types';
import i18n from '@/i18n';

type Nav = NativeStackNavigationProp<OwnerStackParamList>;

const AGENT_COLORS: { bg: string; fg: string }[] = [
  { bg: EL.primaryFixed, fg: EL.primary },
  { bg: EL.secondaryFixed, fg: EL.secondary },
  { bg: EL.tertiaryFixed, fg: EL.tertiary },
];

export function SettingsScreen() {
  useTranslation();
  const navigation = useNavigation<Nav>();
  const signOut = useAuthStore((s) => s.signOut);
  const user = useAuthStore((s) => s.user);
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const currentLng = (i18n.language as Language) ?? 'en';

  const { data: agents } = useQuery({
    queryKey: ['agents', orgId],
    enabled: !!orgId,
    queryFn: () => listAgents(orgId!),
  });

  // Editable business settings
  const [businessName, setBusinessName] = useState(user?.name ? `${user.name}'s Finance` : 'VasoolAI Business');
  const [workingDays, setWorkingDays] = useState('Mon-Sat');
  const [editField, setEditField] = useState<'name' | 'days' | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleExport = async (type: 'borrowers' | 'collections' | 'expenses') => {
    if (!orgId) return;
    const fns = { borrowers: exportBorrowers, collections: exportCollections, expenses: exportExpenses };
    const csv = await fns[type](orgId);
    if (!csv) return;
    await shareCsv(csv, `vasoolai-${type}.csv`);
  };

  const handleLang = async (lng: Language) => {
    await setLanguage(lng);
  };

  return (
    <SafeAreaView style={Common.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ── BUSINESS ── */}
        <Text style={styles.sectionLabel}>BUSINESS</Text>
        <View style={styles.settingsGroup}>
          <SettingsItem
            topLabel="Business name"
            value={businessName}
            trailing={<MaterialCommunityIcons name="pencil-outline" size={16} color={EL.outlineVariant} />}
            onPress={() => { setEditField('name'); setEditValue(businessName); }}
          />
          <View style={styles.separator} />
          <SettingsItem
            topLabel="Working days"
            value={workingDays}
            trailing={<MaterialCommunityIcons name="pencil-outline" size={16} color={EL.outlineVariant} />}
            onPress={() => { setEditField('days'); setEditValue(workingDays); }}
          />
          <View style={styles.separator} />
          <SettingsItem
            topLabel="Language"
            value={currentLng === 'en' ? 'English / \u0BA4\u0BAE\u0BBF\u0BB4\u0BCD' : '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD / English'}
            trailing={
              <Switch
                value={currentLng === 'ta'}
                onValueChange={() => handleLang(currentLng === 'en' ? 'ta' : 'en')}
                trackColor={{ false: EL.surfaceHighest, true: EL.primary }}
                thumbColor={EL.white}
              />
            }
          />
        </View>

        {/* ── AGENTS ── */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionLabel}>AGENTS</Text>
          <Pressable onPress={() => navigation.navigate('AgentManagement')}>
            <Text style={styles.addAgentText}>+ Add Agent</Text>
          </Pressable>
        </View>
        <View style={styles.settingsGroup}>
          {agents && agents.length > 0 ? (
            agents.map((agent: UserRow, i: number) => {
              const color = AGENT_COLORS[i % AGENT_COLORS.length];
              return (
                <AgentRow
                  key={agent.id}
                  name={agent.name}
                  phone={agent.phone ?? ''}
                  initial={(agent.name[0] ?? 'A').toUpperCase()}
                  bgColor={color.bg}
                  textColor={color.fg}
                />
              );
            })
          ) : (
            <View style={{ padding: Space.lg }}>
              <Text style={{ fontSize: 13, color: EL.onSurfaceMuted }}>No agents yet. Tap + Add Agent.</Text>
            </View>
          )}
        </View>

        {/* ── TOOLS HUB — single hero entry ──
            All operational tools (handovers, loan requests, lines, reports,
            etc.) live in their own dedicated ToolsHub screen with badges
            and categorization. Kept out of Settings so this screen stays
            focused on user/org/preferences. */}
        <Pressable
          style={styles.toolsHero}
          onPress={() => navigation.navigate('ToolsHub')}
        >
          <View style={styles.toolsHeroIcon}>
            <MaterialCommunityIcons name="apps" size={26} color={EL.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.toolsHeroTitle}>Tools</Text>
            <Text style={styles.toolsHeroSub}>
              Fraud, handovers, loans, reports, agents, and more
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
        </Pressable>

        {/* ── DATA ── */}
        <Text style={styles.sectionLabel}>DATA</Text>
        <View style={styles.exportRow}>
          <Pressable style={styles.exportBtn} onPress={() => handleExport('collections')}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={EL.primary} />
            <Text style={styles.exportBtnText}>Excel Export</Text>
          </Pressable>
          <Pressable style={styles.exportBtn} onPress={() => handleExport('expenses')}>
            <MaterialCommunityIcons name="file-pdf-box" size={22} color={EL.tertiary} />
            <Text style={styles.exportBtnText}>PDF Export</Text>
          </Pressable>
        </View>
        <View style={styles.syncRow}>
          <MaterialCommunityIcons name="sync" size={20} color={EL.primary} />
          <Text style={styles.syncText}>Ready to sync</Text>
        </View>

        {/* ── SUBSCRIPTION ── */}
        <Text style={styles.sectionLabel}>SUBSCRIPTION</Text>
        <View style={styles.subscriptionCard}>
          <View style={styles.subHeaderRow}>
            <View>
              <Text style={styles.subPlanLabel}>CURRENT PLAN</Text>
              <Text style={styles.subPlanName}>Pro Plan</Text>
            </View>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>ACTIVE</Text>
            </View>
          </View>
          <Text style={styles.subPrice}>
            {'\u20B9'}499<Text style={styles.subPriceUnit}>/month</Text>
          </Text>
          <View style={{ gap: Space.md, marginTop: Space.xl }}>
            <Pressable
              style={styles.changePlanBtn}
              onPress={() => navigation.navigate('Subscription')}
            >
              <Text style={styles.changePlanText}>Change Plan</Text>
            </Pressable>
            <Pressable style={styles.billingBtn} onPress={() => Alert.alert('Billing History', 'Coming soon')}>
              <Text style={styles.billingBtnText}>Billing History</Text>
            </Pressable>
          </View>
        </View>

        {/* ── ABOUT ── */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.settingsGroup}>
          <SettingsItem
            value="App Version"
            trailing={<Text style={styles.versionText}>v2.4.0</Text>}
          />
          <View style={styles.separator} />
          <SettingsItem
            value="Help & Support"
            trailing={<MaterialCommunityIcons name="chevron-right" size={16} color={EL.outlineVariant} />}
            onPress={() => Alert.alert('Help & Support', 'Contact us at support@vasoolai.com')}
          />
          <View style={styles.separator} />
          <SettingsItem
            value="Privacy Policy"
            trailing={<MaterialCommunityIcons name="chevron-right" size={16} color={EL.outlineVariant} />}
            onPress={() => Alert.alert('Privacy Policy', 'Visit vasoolai.com/privacy')}
          />
        </View>

        {/* Logout */}
        <Pressable style={styles.logoutBtn} onPress={signOut}>
          <MaterialCommunityIcons name="logout" size={20} color={EL.tertiary} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>

      {/* Edit field modal */}
      <Modal visible={editField !== null} transparent animationType="fade" onRequestClose={() => setEditField(null)}>
        <Pressable style={styles.editBackdrop} onPress={() => setEditField(null)}>
          <View style={styles.editSheet}>
            <Text style={styles.editTitle}>
              {editField === 'name' ? 'Business Name' : 'Working Days'}
            </Text>
            <TextInput
              style={styles.editInput}
              value={editValue}
              onChangeText={setEditValue}
              autoFocus
              placeholder={editField === 'name' ? 'Enter business name' : 'e.g. Mon-Sat'}
              placeholderTextColor={EL.outlineVariant}
            />
            <View style={styles.editBtnRow}>
              <Pressable style={styles.editCancelBtn} onPress={() => setEditField(null)}>
                <Text style={styles.editCancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                style={styles.editSaveBtn}
                onPress={() => {
                  if (editField === 'name') setBusinessName(editValue.trim() || businessName);
                  else setWorkingDays(editValue.trim() || workingDays);
                  setEditField(null);
                }}
              >
                <Text style={styles.editSaveText}>Save</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function SettingsItem({ topLabel, value, trailing, onPress }: {
  topLabel?: string;
  value: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.settingsItem} onPress={onPress}>
      <View style={{ flex: 1 }}>
        {topLabel ? <Text style={styles.itemTopLabel}>{topLabel}</Text> : null}
        <Text style={styles.itemValue}>{value}</Text>
      </View>
      {trailing}
    </Pressable>
  );
}

function AgentRow({ name, phone, initial, bgColor, textColor }: {
  name: string;
  phone: string;
  initial: string;
  bgColor: string;
  textColor: string;
}) {
  return (
    <View style={styles.agentRow}>
      <View style={[styles.agentAvatar, { backgroundColor: bgColor }]}>
        <Text style={[styles.agentInitial, { color: textColor }]}>{initial}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.agentName}>{name}</Text>
        <Text style={styles.agentPhone}>{phone}</Text>
      </View>
      <View style={styles.onlineDot}>
        <View style={styles.onlineDotInner} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xxl,
    paddingBottom: 100,
    paddingTop: Space.sm,
  },

  // Section labels
  sectionLabel: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(61, 74, 66, 0.6)',
    letterSpacing: 2,
    marginTop: Space.xxl,
    marginBottom: Space.lg,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: Space.xxl,
    marginBottom: Space.lg,
  },
  addAgentText: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Tools hero — gradient-filled card linking to ToolsHub
  toolsHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    backgroundColor: EL.primary,
    padding: Space.lg,
    borderRadius: Radii.lg,
    marginTop: Space.xxl,
    ...Shadows.float,
  },
  toolsHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  toolsHeroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: EL.white,
  },
  toolsHeroSub: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },

  // Settings group (white card)
  settingsGroup: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xs,
    ...Shadows.card,
  },
  settingsItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Space.lg,
    borderRadius: Radii.md,
  },
  separator: {
    height: 1,
    backgroundColor: EL.surfaceMid,
    marginHorizontal: Space.lg,
  },
  itemTopLabel: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  itemValue: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '600',
    color: EL.onSurface,
  },

  // Toggle
  toggleTrack: {
    width: 48,
    height: 24,
    borderRadius: 12,
    backgroundColor: EL.primaryContainer,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  toggleThumb: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: EL.white,
    alignSelf: 'flex-end',
  },
  toggleThumbActive: {
    alignSelf: 'flex-start',
  },

  // Agent rows
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.lg,
    padding: Space.lg,
    borderRadius: Radii.md,
  },
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  agentInitial: {
    fontFamily: Fonts.headline,
    fontSize: 16,
    fontWeight: '700',
  },
  agentName: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '600',
    color: EL.onSurface,
  },
  agentPhone: {
    fontFamily: Fonts.body,
    fontSize: 12,
    color: EL.onSurfaceSec,
  },
  onlineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(133, 248, 196, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: EL.primary,
  },

  // Export buttons
  exportRow: {
    flexDirection: 'row',
    gap: Space.md,
  },
  exportBtn: {
    flex: 1,
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    ...Shadows.card,
  },
  exportBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 12,
    fontWeight: '700',
    color: EL.onSurface,
  },

  // Sync row
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
    backgroundColor: 'rgba(133, 248, 196, 0.2)',
    borderRadius: Radii.lg,
    marginTop: Space.md,
  },
  syncText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '500',
    color: EL.onPrimaryFixed,
  },

  // Subscription
  subscriptionCard: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  subHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Space.xl,
  },
  subPlanLabel: {
    fontFamily: Fonts.body,
    fontSize: 11,
    fontWeight: '500',
    color: EL.onSurfaceSec,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  subPlanName: {
    fontFamily: Fonts.headline,
    fontSize: 20,
    fontWeight: '800',
    color: EL.onSurface,
  },
  activeBadge: {
    backgroundColor: EL.primaryContainer,
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radii.pill,
  },
  activeBadgeText: {
    fontFamily: Fonts.headline,
    fontSize: 10,
    fontWeight: '800',
    color: '#f5fff7',
  },
  subPrice: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.primary,
  },
  subPriceUnit: {
    fontSize: 14,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  changePlanBtn: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    alignItems: 'center',
    ...Shadows.card,
  },
  changePlanText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: EL.white,
  },
  billingBtn: {
    borderRadius: Radii.md,
    paddingVertical: Space.md,
    alignItems: 'center',
  },
  billingBtnText: {
    fontFamily: Fonts.headline,
    fontSize: 14,
    fontWeight: '700',
    color: EL.primary,
  },

  // Version
  versionText: {
    fontFamily: Fonts.body,
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(61, 74, 66, 0.4)',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    padding: Space.lg,
    marginTop: Space.xl,
    borderRadius: Radii.lg,
  },
  logoutText: {
    fontFamily: Fonts.headline,
    fontSize: 15,
    fontWeight: '700',
    color: EL.tertiary,
  },

  // Edit modal
  editBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    paddingHorizontal: Space.xxl,
  },
  editSheet: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.xxl,
    padding: Space.xxl,
  },
  editTitle: {
    fontFamily: Fonts.headline,
    fontSize: 18,
    fontWeight: '700',
    color: EL.onSurface,
    marginBottom: Space.lg,
  },
  editInput: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    fontSize: 16,
    fontWeight: '600',
    color: EL.onSurface,
    minHeight: 48,
  },
  editBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Space.md,
    marginTop: Space.xl,
  },
  editCancelBtn: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
  },
  editCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.onSurfaceSec,
  },
  editSaveBtn: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.md,
    borderRadius: Radii.md,
    backgroundColor: EL.primary,
  },
  editSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: EL.white,
  },
});

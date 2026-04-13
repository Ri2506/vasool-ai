// OrgSwitcherScreen — list every org the signed-in phone belongs to and
// let the user flip the active org. Same phone can be owner of one org
// and agent for another (e.g., a thandal owner who also helps a relative
// run their line).

import React from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';
import { useMyOrgs } from '@/hooks/useOrgs';
import { useAuthStore } from '@/store/authStore';

export function OrgSwitcherScreen() {
  const navigation = useNavigation();
  const qc = useQueryClient();
  const { data: orgs } = useMyOrgs();
  const currentOrgId = useAuthStore((s) => s.user?.orgId ?? null);
  const switchOrg = useAuthStore((s) => s.switchOrg);

  const handleSwitch = async (m: NonNullable<typeof orgs>[number]) => {
    if (m.org_id === currentOrgId) return;
    await switchOrg({
      id: m.user_id,
      orgId: m.org_id,
      name: m.org_name,
      phone: useAuthStore.getState().user?.phone ?? '',
      role: m.role,
    });
    // Wipe React Query caches — every org-scoped query needs to re-fetch
    qc.clear();
    navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Tabs' }] }));
  };

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={EL.onSurface} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Switch organisation</Text>
          <Text style={styles.sub}>
            {orgs?.length ?? 0} membership{(orgs?.length ?? 0) === 1 ? '' : 's'}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.md, paddingBottom: 80 }}>
        {orgs && orgs.length > 0 ? (
          orgs.map((m) => {
            const isCurrent = m.org_id === currentOrgId;
            return (
              <Pressable
                key={m.user_id}
                onPress={() => handleSwitch(m)}
                style={[styles.card, isCurrent && styles.cardActive, Shadows.card]}
              >
                <Avatar name={m.org_name} size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardName}>{m.org_name}</Text>
                  <View style={styles.metaRow}>
                    <View style={[styles.roleChip, m.role === 'owner' && styles.roleChipOwner]}>
                      <Text style={[styles.roleText, m.role === 'owner' && { color: EL.white }]}>
                        {m.role.toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.metaText}>
                      {m.borrower_count} borrower{m.borrower_count === 1 ? '' : 's'}
                    </Text>
                    {!m.is_active ? (
                      <Text style={[styles.metaText, { color: EL.tertiary }]}>· Inactive</Text>
                    ) : null}
                  </View>
                </View>
                {isCurrent ? (
                  <View style={styles.currentPill}>
                    <MaterialCommunityIcons name="check" size={14} color={EL.white} />
                    <Text style={styles.currentText}>Active</Text>
                  </View>
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={EL.onSurfaceMuted} />
                )}
              </Pressable>
            );
          })
        ) : (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="account-multiple-outline" size={36} color={EL.outline} />
            <Text style={styles.emptyTitle}>Just one organisation</Text>
            <Text style={styles.emptySub}>
              When you join another lender's team or start a second line of business,
              they'll appear here.
            </Text>
          </View>
        )}

        {/* Helper card */}
        <View style={[styles.infoCard, Shadows.card]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={EL.onSurfaceSec} />
          <Text style={styles.infoText}>
            Switching wipes the on-screen cache and reloads every screen with the
            new organisation's data. Your local SQLite still holds all orgs side
            by side.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Space.md, padding: Space.lg },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  title: { ...Type.titleLg, fontWeight: '800' },
  sub: { fontSize: 12, color: EL.onSurfaceMuted, fontWeight: '600', marginTop: 2 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.lg,
    borderRadius: Radii.lg,
    backgroundColor: EL.surfaceCard,
  },
  cardActive: { backgroundColor: 'rgba(0,105,72,0.06)' },
  cardName: { fontSize: 15, fontWeight: '800', color: EL.onSurface },
  metaRow: {
    flexDirection: 'row', alignItems: 'center', gap: Space.sm, marginTop: 4,
  },
  roleChip: {
    paddingHorizontal: Space.sm, paddingVertical: 2,
    borderRadius: Radii.pill,
    backgroundColor: EL.surfaceLow,
  },
  roleChipOwner: { backgroundColor: EL.primary },
  roleText: { fontSize: 9, fontWeight: '800', color: EL.onSurfaceSec, letterSpacing: 0.5 },
  metaText: { fontSize: 11, color: EL.onSurfaceMuted, fontWeight: '600' },
  currentPill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: Space.sm, paddingVertical: 4,
    borderRadius: Radii.pill,
    backgroundColor: EL.primary,
  },
  currentText: { fontSize: 10, fontWeight: '800', color: EL.white, letterSpacing: 0.5 },

  empty: { alignItems: 'center', padding: Space.xxxl, gap: Space.sm },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: EL.onSurface, marginTop: Space.md },
  emptySub: { fontSize: 12, color: EL.onSurfaceMuted, textAlign: 'center', paddingHorizontal: Space.lg },

  infoCard: {
    flexDirection: 'row', gap: Space.sm,
    backgroundColor: EL.surfaceCard,
    padding: Space.md,
    borderRadius: Radii.lg,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, fontSize: 12, color: EL.onSurfaceSec, lineHeight: 17 },
});

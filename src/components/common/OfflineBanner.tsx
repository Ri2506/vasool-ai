import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

import { Space, Type } from '@/theme/emeraldLedger';
import { useAppStore } from '@/store/appStore';
import { syncSilent } from '@/db/sync';

export function OfflineBanner() {
  const { t } = useTranslation();
  const isOnline = useAppStore((s) => s.isOnline);
  const setOnline = useAppStore((s) => s.setOnline);
  const wasOffline = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = Boolean(state.isConnected && state.isInternetReachable !== false);
      setOnline(online);
      if (online && wasOffline.current) {
        syncSilent();
      }
      wasOffline.current = !online;
    });
    return unsubscribe;
  }, [setOnline]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isOnline) syncSilent();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOnline]);

  if (isOnline) return null;

  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="cloud-off-outline" size={16} color="#92400e" />
      <Text style={styles.text}>{t('common.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fef3c7',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
    height: 40,
    paddingHorizontal: Space.lg,
  },
  text: {
    ...Type.labelMd,
    color: '#92400e',
    fontWeight: '600',
    textAlign: 'center',
  },
});

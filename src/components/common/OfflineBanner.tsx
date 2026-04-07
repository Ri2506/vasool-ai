import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

import { EL, Space, Type } from '@/theme/emeraldLedger';
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
      <Text style={styles.text}>{t('common.offline')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: EL.warnContainer,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.sm,
  },
  text: {
    ...Type.labelMd,
    color: EL.warn,
    fontWeight: '600',
    textAlign: 'center',
  },
});

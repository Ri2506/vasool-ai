import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from 'react-i18next';

import { Colors } from '@/constants/colors';
import { Typography } from '@/constants/typography';
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
      // Sync when coming back online
      if (online && wasOffline.current) {
        syncSilent();
      }
      wasOffline.current = !online;
    });
    return unsubscribe;
  }, [setOnline]);

  // Periodic sync every 5 minutes when online
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
    backgroundColor: Colors.warnLight,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.warn,
  },
  text: {
    ...Typography.caption,
    color: Colors.warn,
    fontWeight: '600',
    textAlign: 'center',
  },
});

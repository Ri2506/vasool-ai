import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
  ViewStyle,
  Platform,
} from 'react-native';

import { EL, Glass, Radii, Shadows, Space } from '@/theme/emeraldLedger';

interface Props {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Glassmorphic bottom sheet overlay.
 * Uses Modal for proper z-indexing and backdrop.
 */
export function BottomSheet({ visible, onClose, children, style }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View />
      </Pressable>
      <View style={[styles.sheet, style]}>
        <View style={styles.handle} />
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  sheet: {
    backgroundColor: EL.surfaceCard,
    borderTopLeftRadius: Radii.xxl,
    borderTopRightRadius: Radii.xxl,
    paddingHorizontal: Space.xxl,
    paddingBottom: Space.xxxl,
    paddingTop: Space.md,
    ...Shadows.float,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
      : {}),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: EL.outlineVariant,
    alignSelf: 'center',
    marginBottom: Space.xl,
  },
});

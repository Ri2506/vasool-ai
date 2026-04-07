import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { EL, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';

interface Props {
  isListening: boolean;
  onPress: () => void;
  lastText?: string | null;
}

export function VoiceButton({ isListening, onPress, lastText }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          isListening && styles.buttonActive,
          pressed && { opacity: 0.8 },
        ]}
      >
        <MaterialCommunityIcons
          name={isListening ? 'microphone' : 'microphone-outline'}
          size={28}
          color={isListening ? EL.white : EL.primary}
        />
      </Pressable>
      {lastText ? (
        <Text style={styles.transcript} numberOfLines={1}>
          &ldquo;{lastText}&rdquo;
        </Text>
      ) : (
        <Text style={styles.hint}>
          {isListening ? 'Listening...' : 'Tap to speak amount'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Space.lg,
    marginBottom: Space.sm,
  },
  button: {
    width: Touch.min,
    height: Touch.min,
    borderRadius: Radii.pill,
    borderWidth: 2,
    borderColor: EL.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: EL.surfaceCard,
  },
  buttonActive: {
    backgroundColor: EL.primary,
    borderColor: EL.primary,
  },
  hint: {
    ...Type.bodySm,
    marginLeft: Space.md,
    color: EL.onSurfaceMuted,
  },
  transcript: {
    ...Type.bodySm,
    marginLeft: Space.md,
    color: EL.onSurface,
    fontStyle: 'italic',
    flex: 1,
  },
});

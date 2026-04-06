import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { Colors } from '@/constants/colors';
import { Radius, TouchTarget } from '@/constants/typography';

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
          color={isListening ? Colors.white : Colors.primary}
        />
      </Pressable>
      {lastText ? (
        <Text style={styles.transcript} numberOfLines={1}>
          "{lastText}"
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
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  button: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
  },
  buttonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  hint: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.textMuted,
  },
  transcript: {
    marginLeft: 12,
    fontSize: 13,
    color: Colors.text,
    fontStyle: 'italic',
    flex: 1,
  },
});

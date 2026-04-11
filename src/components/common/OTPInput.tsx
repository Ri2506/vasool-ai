import React, { useRef } from 'react';
import {
  NativeSyntheticEvent,
  StyleSheet,
  TextInput,
  TextInputKeyPressEventData,
  View,
  ViewStyle,
} from 'react-native';

import { EL, Radii, Space, Type } from '@/theme/emeraldLedger';

interface Props {
  length?: number;
  value: string;
  onChange: (code: string) => void;
  style?: ViewStyle;
}

/**
 * Row of individual digit boxes with auto-advance.
 * Reusable for OTP verification and PIN entry.
 */
export function OTPInput({ length = 6, value, onChange, style }: Props) {
  const inputs = useRef<(TextInput | null)[]>([]);
  const digits = value.padEnd(length, '').split('').slice(0, length);

  const handleChange = (text: string, index: number) => {
    const char = text.replace(/[^0-9]/g, '').slice(-1);
    const arr = digits.slice();
    arr[index] = char;
    const newCode = arr.join('');
    onChange(newCode);

    if (char && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
    index: number,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {digits.map((digit, i) => (
        <TextInput
          key={i}
          ref={(ref) => {
            inputs.current[i] = ref;
          }}
          style={[styles.box, digit ? styles.boxFilled : null]}
          value={digit}
          onChangeText={(text) => handleChange(text, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={1}
          selectTextOnFocus
          textContentType="oneTimeCode"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Space.md,
  },
  box: {
    width: 48,
    height: 56,
    borderRadius: Radii.md,
    backgroundColor: EL.surfaceCard,
    textAlign: 'center',
    ...Type.displaySm,
    color: EL.onSurface,
    fontWeight: '700',
  },
  boxFilled: {
    backgroundColor: EL.surfaceLow,
    borderWidth: 2,
    borderColor: EL.primary,
  },
});

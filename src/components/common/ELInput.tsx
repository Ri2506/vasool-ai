import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';

import { EL, Radii, Space, Type } from '@/theme/emeraldLedger';

interface Props extends Omit<TextInputProps, 'style'> {
  label: string;
  labelTamil?: string;
  required?: boolean;
  error?: string;
  prefix?: React.ReactNode;
  style?: ViewStyle;
  inputStyle?: TextInputProps['style'];
}

/**
 * Styled text input with bilingual label support.
 * Emerald Ledger form field — surfaceCard bg, focus ring, no heavy borders.
 */
export function ELInput({
  label,
  labelTamil,
  required,
  error,
  prefix,
  style,
  inputStyle,
  ...inputProps
}: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>
          {label}
          {labelTamil ? (
            <Text style={styles.labelTamil}> ({labelTamil})</Text>
          ) : null}
        </Text>
        {required && <Text style={styles.required}>REQUIRED</Text>}
      </View>

      <View
        style={[
          styles.inputContainer,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      >
        {prefix && <View style={styles.prefix}>{prefix}</View>}
        <TextInput
          placeholderTextColor={EL.outlineVariant}
          style={[styles.input, inputStyle]}
          onFocus={(e) => {
            setFocused(true);
            inputProps.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            inputProps.onBlur?.(e);
          }}
          {...inputProps}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Space.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginLeft: 2,
  },
  label: {
    ...Type.labelMd,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  labelTamil: {
    ...Type.labelSm,
    textTransform: 'none',
    letterSpacing: 0,
  },
  required: {
    ...Type.labelSm,
    fontSize: 9,
    color: EL.tertiary,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.md,
    minHeight: 56,
    overflow: 'hidden',
  },
  inputFocused: {
    borderWidth: 2,
    borderColor: EL.primary,
  },
  inputError: {
    borderWidth: 2,
    borderColor: EL.tertiary,
  },
  prefix: {
    backgroundColor: EL.surfaceHigh,
    paddingHorizontal: Space.lg,
    justifyContent: 'center',
    alignSelf: 'stretch',
  },
  input: {
    flex: 1,
    ...Type.bodyLg,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.md,
    color: EL.onSurface,
  },
  error: {
    ...Type.labelSm,
    color: EL.tertiary,
    marginLeft: 2,
  },
});

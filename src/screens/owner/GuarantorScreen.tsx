import React, { useState } from 'react';
import {
  Alert, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Space, Touch, Type, Shadows } from '@/theme/emeraldLedger';
import { createGuarantor } from '@/db/repos/guarantors';
import { useAuthStore } from '@/store/authStore';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { OwnerStackParamList } from '@/navigation/types';

interface Props {
  loanId: string;
  onDone: () => void;
}

type NavProps = NativeStackScreenProps<OwnerStackParamList, 'Guarantor'>;

export function GuarantorScreen(props: Props | NavProps) {
  // Support both direct props (embedded) and navigation route params
  const isNav = 'route' in props;
  const loanId = isNav ? props.route.params.loanId : props.loanId;
  const onDone = isNav ? () => props.navigation.goBack() : props.onDone;
  const orgId = useAuthStore((s) => s.user?.orgId ?? null);
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [relationship, setRelationship] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const createMut = useMutation({
    mutationFn: () => createGuarantor({
      orgId: orgId!, loanId, name, phone, address, relationship, photoUrl: photoUri,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guarantors', loanId] }); onDone(); },
    onError: (e: any) => { Alert.alert('Error', e?.message ?? 'Failed to save guarantor'); },
  });

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch { Alert.alert('Camera not available'); }
  };

  return (
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Handle bar */}
        <View style={styles.handle} />

        {/* Header */}
        <View style={styles.headerRow}>
          <Text style={styles.title}>Guarantor Details</Text>
          <Pressable onPress={onDone}>
            <MaterialCommunityIcons name="close" size={24} color={EL.outline} />
          </Pressable>
        </View>

        {/* Photo Section */}
        <Pressable style={styles.photoSection} onPress={handleTakePhoto}>
          <View style={styles.photoCircle}>
            {photoUri ? (
              <Avatar name={name || '?'} size={128} photoUri={photoUri} />
            ) : (
              <MaterialCommunityIcons name="camera" size={40} color={EL.primary} />
            )}
          </View>
          <View style={styles.addPhotoBadge}>
            <MaterialCommunityIcons name="plus" size={18} color={EL.white} />
          </View>
          <Text style={styles.addPhotoLabel}>ADD PHOTO</Text>
        </Pressable>

        {/* Form Fields */}
        <View style={styles.formSection}>
          <Field
            icon="account"
            label="GUARANTOR NAME"
            value={name}
            onChange={setName}
            placeholder="Full legal name"
          />
          <Field
            icon="phone"
            label="PHONE NUMBER"
            value={phone}
            onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            placeholder="Mobile number"
            prefix="+91"
            keyboard="number-pad"
          />
          <Field
            icon="map-marker"
            label="ADDRESS"
            value={address}
            onChange={setAddress}
            placeholder="Residential address"
            multiline
          />
          <Field
            icon="account-group"
            label="RELATIONSHIP"
            value={relationship}
            onChange={setRelationship}
            placeholder="Family"
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Fixed bottom save */}
      <View style={styles.bottomBar}>
        <GradientButton
          title="Save Guarantor"
          onPress={() => {
            if (!name.trim()) { Alert.alert('Name required', 'Please enter the guarantor name.'); return; }
            createMut.mutate();
          }}
          loading={createMut.isPending}
          icon={<MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />}
        />
      </View>
    </SafeAreaView>
  );
}

function Field({ icon, label, value, onChange, placeholder, prefix, keyboard, multiline }: {
  icon: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; keyboard?: 'number-pad'; multiline?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.inputRow, multiline && { alignItems: 'flex-start' }]}>
        <MaterialCommunityIcons
          name={icon as any}
          size={20}
          color={'rgba(0,105,72,0.4)'}
          style={multiline ? { marginTop: Space.lg } : undefined}
        />
        {prefix ? (
          <View style={styles.prefixBox}>
            <Text style={styles.prefixText}>{prefix}</Text>
          </View>
        ) : null}
        <TextInput
          style={[styles.input, multiline && { minHeight: 60, textAlignVertical: 'top', paddingTop: Space.md }]}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={EL.outlineVariant}
          keyboardType={keyboard}
          multiline={multiline}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Space.xxl,
    paddingTop: Space.lg,
    paddingBottom: 120,
  },

  handle: {
    width: 48,
    height: 6,
    backgroundColor: 'rgba(188,202,192,0.3)',
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: Space.xl,
  },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.xxl,
  },
  title: {
    ...Type.displaySm,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  // Photo
  photoSection: {
    alignItems: 'center',
    marginBottom: Space.xxl,
  },
  photoCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: EL.surfaceHighest,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 4,
    borderColor: EL.surfaceCard,
  },
  addPhotoBadge: {
    position: 'absolute',
    bottom: 28,
    right: '35%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: EL.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: EL.surfaceCard,
  },
  addPhotoLabel: {
    marginTop: Space.lg,
    fontSize: 12,
    fontWeight: '700',
    color: EL.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },

  // Form
  formSection: {
    gap: Space.xl,
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: EL.outline,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginLeft: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: Radii.md,
    paddingHorizontal: Space.lg,
    paddingVertical: Space.xs,
    gap: Space.md,
  },
  prefixBox: {
    borderRightWidth: 1,
    borderRightColor: 'rgba(188,202,192,0.3)',
    paddingRight: Space.md,
    marginRight: Space.xs,
  },
  prefixText: {
    ...Type.bodyMd,
    color: EL.onSurface,
    fontWeight: '500',
  },
  input: {
    flex: 1,
    ...Type.bodyMd,
    color: EL.onSurface,
    fontWeight: '500',
    minHeight: Touch.min,
  },

  // Bottom
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Space.xxl,
    paddingVertical: Space.xl,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(228, 241, 232, 0.6)',
  },
});

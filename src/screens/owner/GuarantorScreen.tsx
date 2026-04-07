import React, { useState } from 'react';
import {
  Alert, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Space, Touch, Type } from '@/theme/emeraldLedger';
import { createGuarantor } from '@/db/repos/guarantors';
import { useAuthStore } from '@/store/authStore';

interface Props {
  loanId: string;
  onDone: () => void;
}

export function GuarantorScreen({ loanId, onDone }: Props) {
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
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={Type.displaySm}>Guarantor Details</Text>

        {/* Photo */}
        <Pressable style={styles.photoSection} onPress={handleTakePhoto}>
          <Avatar name={name || '?'} size={80} photoUri={photoUri} />
          <View style={styles.addPhotoBtn}>
            <MaterialCommunityIcons name="camera-plus" size={20} color={EL.primary} />
          </View>
          <Text style={styles.addPhotoText}>ADD PHOTO</Text>
        </Pressable>

        <Field icon="account" label="GUARANTOR NAME" value={name} onChange={setName} placeholder="Full legal name" />
        <Field icon="phone" label="PHONE NUMBER" value={phone} onChange={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))} placeholder="Mobile number" prefix="+91" keyboard="number-pad" />
        <Field icon="map-marker" label="ADDRESS" value={address} onChange={setAddress} placeholder="Residential address" />
        <Field icon="account-group" label="RELATIONSHIP" value={relationship} onChange={setRelationship} placeholder="e.g., Brother, Friend" />

        <GradientButton
          title="Save Guarantor"
          onPress={() => createMut.mutate()}
          loading={createMut.isPending}
          style={{ marginTop: Space.xxl }}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ icon, label, value, onChange, placeholder, prefix, keyboard }: {
  icon: string; label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; prefix?: string; keyboard?: 'number-pad';
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={Type.labelMd}>{label}</Text>
      <View style={styles.inputRow}>
        <MaterialCommunityIcons name={icon as any} size={18} color={EL.onSurfaceMuted} />
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={EL.onSurfaceMuted}
          keyboardType={keyboard}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: Space.xl, paddingBottom: Space.xxxl },
  photoSection: { alignItems: 'center', marginVertical: Space.xxl },
  addPhotoBtn: {
    position: 'absolute', bottom: 20, right: '38%',
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: EL.surfaceLow, alignItems: 'center', justifyContent: 'center',
  },
  addPhotoText: { ...Type.labelSm, color: EL.primary, marginTop: Space.sm },
  fieldWrap: { marginTop: Space.xl },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: EL.surfaceLow, borderRadius: Radii.sm,
    paddingHorizontal: Space.lg, minHeight: Touch.min, marginTop: Space.xs,
  },
  prefix: { ...Type.bodyMd, color: EL.onSurfaceSec, marginLeft: Space.sm },
  input: { flex: 1, ...Type.bodyMd, color: EL.onSurface, marginLeft: Space.sm },
});

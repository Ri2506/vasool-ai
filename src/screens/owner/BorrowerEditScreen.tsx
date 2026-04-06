import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';
import {
  useBorrower,
  useCreateBorrower,
  useUpdateBorrower,
  useDeleteBorrower,
} from '@/hooks/useBorrowers';
import type { OwnerStackParamList } from '@/navigation/types';

type Props = NativeStackScreenProps<OwnerStackParamList, 'BorrowerEdit'>;

export function BorrowerEditScreen({ route, navigation }: Props) {
  const { t } = useTranslation();
  const id = route.params?.id;
  const isEditing = !!id;

  const { data: existing } = useBorrower(id);
  const createMut = useCreateBorrower();
  const updateMut = useUpdateBorrower();
  const deleteMut = useDeleteBorrower();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  const handleTakePhoto = async () => {
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.5 });
      if (!result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch { Alert.alert('Camera not available'); }
  };

  const handlePickContact = async () => {
    try {
      const Contacts = await import('expo-contacts');
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Contacts permission needed'); return; }
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers], pageSize: 1 });
      if (data.length > 0) {
        const c = data[0];
        setName([c.firstName, c.lastName].filter(Boolean).join(' '));
        if (c.phoneNumbers?.[0]?.number) setPhone(c.phoneNumbers[0].number.replace(/\D/g, '').slice(-10));
      }
    } catch { Alert.alert('Contacts not available'); }
  };

  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setPhone(existing.phone ?? '');
      setAddress(existing.address ?? '');
      setNotes(existing.notes ?? '');
    }
  }, [existing]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t('borrowers.name_required'));
      return;
    }
    try {
      if (isEditing && id) {
        await updateMut.mutateAsync({ id, name, phone, address, notes });
      } else {
        await createMut.mutateAsync({ name, phone, address, notes });
      }
      navigation.goBack();
    } catch (e: any) {
      Alert.alert(t('common.error_generic'), e?.message ?? '');
    }
  };

  const handleDelete = () => {
    if (!id) return;
    // Using Alert for confirmation; on web it becomes a simple confirm dialog.
    Alert.alert(t('borrowers.delete'), t('borrowers.delete_confirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('borrowers.delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteMut.mutateAsync(id);
          navigation.goBack();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>
            {isEditing ? t('borrowers.edit') : t('borrowers.add')}
          </Text>

          {/* Photo + Camera */}
          <View style={styles.photoRow}>
            <Avatar name={name || '?'} size={64} photoUri={photoUri} />
            <Pressable style={styles.photoBtn} onPress={handleTakePhoto}>
              <MaterialCommunityIcons name="camera" size={20} color={Colors.primary} />
              <Text style={styles.photoBtnText}>{t('common.take_photo')}</Text>
            </Pressable>
          </View>

          {/* Name + Contacts import */}
          <View style={styles.nameRow}>
            <View style={{ flex: 1 }}>
              <Field label={t('borrowers.name')} value={name} onChangeText={setName} />
            </View>
            <Pressable style={styles.contactsBtn} onPress={handlePickContact}>
              <MaterialCommunityIcons name="contacts" size={24} color={Colors.primary} />
            </Pressable>
          </View>

          <Field
            label={t('borrowers.phone')}
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
            keyboardType="number-pad"
          />
          <Field
            label={t('borrowers.address')}
            value={address}
            onChangeText={setAddress}
            multiline
          />
          <Field
            label={t('borrowers.notes')}
            value={notes}
            onChangeText={setNotes}
            multiline
          />

          <Button
            title={t('common.save')}
            onPress={handleSave}
            loading={createMut.isPending || updateMut.isPending}
            style={{ marginTop: Spacing.lg }}
          />

          {isEditing ? (
            <Button
              title={t('borrowers.delete')}
              variant="danger"
              onPress={handleDelete}
              style={{ marginTop: Spacing.md }}
              loading={deleteMut.isPending}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface FieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: 'default' | 'number-pad';
  multiline?: boolean;
}

function Field({ label, value, onChangeText, keyboardType, multiline }: FieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.input, multiline && styles.multiline]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={Colors.textMuted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { padding: Spacing.xl, paddingBottom: Spacing.xxl },
  title: {
    ...Typography.display,
    color: Colors.text,
    marginBottom: Spacing.lg,
  },
  fieldWrap: { marginBottom: Spacing.md },
  fieldLabel: {
    ...Typography.caption,
    color: Colors.textSec,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.button,
    paddingHorizontal: Spacing.md,
    minHeight: TouchTarget.min,
    ...Typography.body,
    color: Colors.text,
  },
  multiline: { minHeight: 80, paddingTop: Spacing.md, textAlignVertical: 'top' },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: Spacing.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    minHeight: TouchTarget.min,
  },
  photoBtnText: {
    ...Typography.caption,
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 6,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  contactsBtn: {
    width: TouchTarget.min,
    height: TouchTarget.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
    marginBottom: Spacing.md,
  },
});

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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { Avatar } from '@/components/common/Avatar';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Touch, Type } from '@/theme/emeraldLedger';
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
    <SafeAreaView style={Common.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content}>
          {/* Header */}
          <Text style={styles.screenTitle}>
            {isEditing ? t('borrowers.edit') : 'New Borrower'}
          </Text>

          {/* Photo Section */}
          <View style={styles.photoSection}>
            <Pressable onPress={handleTakePhoto} style={styles.photoWrap}>
              {photoUri || (isEditing && existing?.photo_url) ? (
                <Avatar name={name || '?'} size={80} photoUri={photoUri ?? existing?.photo_url} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <MaterialCommunityIcons name="camera" size={32} color={EL.outline} />
                </View>
              )}
            </Pressable>
            <Pressable onPress={handleTakePhoto}>
              <Text style={styles.photoLabel}>Take Photo</Text>
            </Pressable>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* Name */}
            <View style={styles.fieldWrap}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Borrower name ({'\u0B95\u0B9F\u0BA9\u0BCD\u0B95\u0BBE\u0BB0\u0BB0\u0BCD \u0BAA\u0BC6\u0BAF\u0BB0\u0BCD'})
                </Text>
                <Text style={styles.requiredTag}>REQUIRED</Text>
              </View>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter full name"
                  placeholderTextColor={'rgba(109,122,114,0.5)'}
                />
                <Pressable style={styles.contactBtn} onPress={handlePickContact}>
                  <MaterialCommunityIcons name="card-account-details-outline" size={22} color={EL.primaryContainer} />
                </Pressable>
              </View>
            </View>

            {/* Phone */}
            <View style={styles.fieldWrap}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>
                  Phone number ({'\u0BA4\u0BCA\u0BB2\u0BC8\u0BAA\u0BC7\u0B9A\u0BBF'})
                </Text>
              </View>
              <View style={styles.phoneRow}>
                <View style={styles.phonePrefix}>
                  <Text style={styles.phonePrefixText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.phoneInput]}
                  value={phone}
                  onChangeText={(v) => setPhone(v.replace(/\D/g, '').slice(0, 10))}
                  keyboardType="number-pad"
                  placeholder="98765 43210"
                  placeholderTextColor={'rgba(109,122,114,0.5)'}
                />
              </View>
            </View>

            {/* Address */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Address (optional)</Text>
              <TextInput
                style={[styles.input, styles.multiline]}
                value={address}
                onChangeText={setAddress}
                multiline
                placeholder="Area, Street, Town"
                placeholderTextColor={'rgba(109,122,114,0.5)'}
              />
            </View>

            {/* Notes */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>Notes (optional)</Text>
              <TextInput
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Any reference info..."
                placeholderTextColor={'rgba(109,122,114,0.5)'}
              />
            </View>
          </View>

          {/* Info Card */}
          <View style={styles.infoCard}>
            <MaterialCommunityIcons name="information-outline" size={18} color={EL.primaryContainer} style={{ marginTop: 1 }} />
            <Text style={styles.infoText}>
              Add the borrower's phone number to send automated WhatsApp reminders
              ({'\u0BA4\u0BBE\u0BA9\u0BBF\u0BAF\u0B99\u0BCD\u0B95\u0BBF \u0BB5\u0BBE\u0B9F\u0BCD\u0B9A\u0BCD\u0B85\u0BAA\u0BCD \u0BA8\u0BBF\u0BA9\u0BC8\u0BB5\u0BC2\u0B9F\u0BCD\u0B9F\u0BB2\u0BCD\u0B95\u0BB3\u0BCD'}).
            </Text>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Fixed Bottom Action */}
        <View style={styles.bottomBar}>
          <GradientButton
            title={isEditing ? t('common.save') : 'Add Borrower'}
            onPress={handleSave}
            loading={createMut.isPending || updateMut.isPending}
            icon={<MaterialCommunityIcons name="check-circle" size={20} color={EL.white} />}
          />
          {isEditing ? (
            <GradientButton
              title={t('borrowers.delete')}
              variant="danger"
              onPress={handleDelete}
              loading={deleteMut.isPending}
              style={{ marginTop: Space.sm }}
            />
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Space.xl,
    paddingTop: Space.xxl,
  },
  screenTitle: {
    ...Type.displaySm,
    fontWeight: '700',
    fontSize: 20,
    marginBottom: Space.lg,
  },

  // Photo
  photoSection: {
    alignItems: 'center',
    marginBottom: Space.xxxl,
  },
  photoWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
  },
  photoPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: EL.outlineVariant,
    borderStyle: 'dashed',
    backgroundColor: EL.surfaceCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: EL.primary,
    marginTop: Space.md,
  },

  // Form
  formSection: {
    gap: Space.xl,
  },
  fieldWrap: {},
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  requiredTag: {
    fontSize: 11,
    fontWeight: '700',
    color: EL.primaryContainer,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    backgroundColor: EL.surfaceCard,
    borderRadius: 10,
    paddingHorizontal: Space.lg,
    minHeight: Touch.min,
    fontSize: 16,
    color: EL.onSurface,
    borderWidth: 1,
    borderColor: EL.outlineVariant,
  },
  multiline: {
    minHeight: 72,
    paddingTop: Space.lg,
    textAlignVertical: 'top',
  },
  contactBtn: {
    width: Touch.min,
    height: Touch.min,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Space.sm,
  },
  phoneRow: {
    flexDirection: 'row',
    backgroundColor: EL.surfaceCard,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: EL.outlineVariant,
  },
  phonePrefix: {
    height: Touch.min,
    paddingHorizontal: Space.lg,
    justifyContent: 'center',
    backgroundColor: EL.surfaceLow,
    borderRightWidth: 1,
    borderRightColor: EL.outlineVariant,
  },
  phonePrefixText: {
    fontSize: 16,
    fontWeight: '500',
    color: EL.onSurfaceSec,
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
  },

  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
    marginTop: Space.xxxl,
    padding: Space.lg,
    backgroundColor: 'rgba(133,248,196,0.2)',
    borderRadius: Radii.lg,
    borderLeftWidth: 4,
    borderLeftColor: EL.primaryContainer,
  },
  infoText: {
    fontSize: 13,
    color: EL.secondary,
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
  },

  // Bottom bar
  bottomBar: {
    paddingHorizontal: Space.xl,
    paddingVertical: Space.lg,
    paddingBottom: Space.xxxl,
    backgroundColor: 'rgba(240,253,244,0.9)',
  },
});

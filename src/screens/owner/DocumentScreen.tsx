import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { ELCard } from '@/components/common/ELCard';
import { GradientButton } from '@/components/common/GradientButton';
import { EL, Common, Radii, Shadows, Space, Type } from '@/theme/emeraldLedger';

interface Document {
  id: string;
  label: string;
  uri: string | null;
  timestamp: number | null;
}

interface Props {
  borrowerId: string;
}

export function DocumentScreen({ borrowerId }: Props) {
  const [documents, setDocuments] = useState<Document[]>([
    { id: 'id_photo', label: 'Borrower ID (Aadhaar / PAN)', uri: null, timestamp: null },
    { id: 'guarantor_photo', label: 'Guarantor photo', uri: null, timestamp: null },
    { id: 'agreement', label: 'Loan agreement', uri: null, timestamp: null },
  ]);

  const handleCapture = async (docId: string) => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, uri: reader.result as string, timestamp: Date.now() } : d));
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Camera permission needed'); return; }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, base64: true });
      if (!result.canceled && result.assets[0]) {
        setDocuments((prev) => prev.map((d) => d.id === docId ? { ...d, uri: result.assets[0].uri, timestamp: Date.now() } : d));
      }
    } catch { Alert.alert('Camera not available'); }
  };

  const renderDoc = ({ item }: { item: Document }) => (
    <ELCard style={styles.docCard}>
      <Text style={styles.docLabel}>{item.label}</Text>
      {item.uri ? (
        <View>
          <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
          <Text style={styles.timestamp}>
            Captured {new Date(item.timestamp!).toLocaleDateString('en-IN')}
          </Text>
        </View>
      ) : (
        <Pressable style={styles.captureBtn} onPress={() => handleCapture(item.id)}>
          <MaterialCommunityIcons name="camera-plus" size={32} color={EL.primary} />
          <Text style={styles.captureText}>Tap to capture</Text>
        </Pressable>
      )}
      {item.uri ? (
        <GradientButton title="Retake" variant="secondary" onPress={() => handleCapture(item.id)} style={{ marginTop: Space.sm }} />
      ) : null}
    </ELCard>
  );

  return (
    <SafeAreaView style={Common.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.sub}>Borrower ID, guarantor, agreements</Text>
      </View>
      <FlatList data={documents} keyExtractor={(d) => d.id} renderItem={renderDoc} contentContainerStyle={{ padding: Space.xl }} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { padding: Space.xl, paddingBottom: Space.md },
  title: { ...Type.displaySm },
  sub: { ...Type.bodySm, color: EL.onSurfaceSec },
  docCard: { marginBottom: Space.lg },
  docLabel: { ...Type.titleMd, marginBottom: Space.md },
  image: { width: '100%', height: 200, borderRadius: Radii.md },
  timestamp: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.sm },
  captureBtn: {
    height: 120,
    borderRadius: Radii.md,
    borderWidth: 2,
    borderColor: EL.outline,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { ...Type.labelSm, color: EL.onSurfaceMuted, marginTop: Space.sm },
});

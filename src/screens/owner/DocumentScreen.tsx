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

import { Button } from '@/components/common/Button';
import { Card } from '@/components/common/Card';
import { Colors } from '@/constants/colors';
import { Radius, Spacing, TouchTarget, Typography } from '@/constants/typography';

/**
 * Document/photo viewer for a borrower. Stores photos locally as base64
 * in SQLite (Sprint 1 approach). Sprint 3+ will move to Supabase Storage
 * for full-resolution photos with URL references.
 *
 * Supported: borrower ID photo, guarantor photo, loan agreement photo.
 */

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
      // Web: file input
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          setDocuments((prev) =>
            prev.map((d) =>
              d.id === docId
                ? { ...d, uri: reader.result as string, timestamp: Date.now() }
                : d
            )
          );
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    // Native: use expo-image-picker (lazy import to avoid web crash)
    try {
      const ImagePicker = await import('expo-image-picker');
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Camera permission needed');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        quality: 0.7,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === docId
              ? { ...d, uri: asset.uri, timestamp: Date.now() }
              : d
          )
        );
      }
    } catch {
      Alert.alert('Camera not available');
    }
  };

  const renderDoc = ({ item }: { item: Document }) => (
    <Card style={styles.docCard}>
      <Text style={styles.docLabel}>{item.label}</Text>
      {item.uri ? (
        <View style={styles.imageWrap}>
          <Image source={{ uri: item.uri }} style={styles.image} resizeMode="cover" />
          <Text style={styles.timestamp}>
            Captured {new Date(item.timestamp!).toLocaleDateString('en-IN')}
          </Text>
        </View>
      ) : (
        <Pressable style={styles.captureBtn} onPress={() => handleCapture(item.id)}>
          <MaterialCommunityIcons name="camera-plus" size={32} color={Colors.primary} />
          <Text style={styles.captureText}>Tap to capture</Text>
        </Pressable>
      )}
      {item.uri ? (
        <Button
          title="Retake"
          variant="secondary"
          onPress={() => handleCapture(item.id)}
          style={{ marginTop: Spacing.sm }}
        />
      ) : null}
    </Card>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>Documents</Text>
        <Text style={styles.sub}>Borrower ID, guarantor, agreements</Text>
      </View>
      <FlatList
        data={documents}
        keyExtractor={(d) => d.id}
        renderItem={renderDoc}
        contentContainerStyle={{ padding: Spacing.xl }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: Spacing.xl, paddingBottom: Spacing.md },
  title: { ...Typography.display, color: Colors.text },
  sub: { ...Typography.caption, color: Colors.textSec },
  docCard: { marginBottom: Spacing.lg },
  docLabel: { ...Typography.title, color: Colors.text, marginBottom: Spacing.md },
  imageWrap: { borderRadius: Radius.button, overflow: 'hidden' },
  image: { width: '100%', height: 200, borderRadius: Radius.button },
  timestamp: { ...Typography.caption, color: Colors.textSec, marginTop: Spacing.sm },
  captureBtn: {
    height: 120,
    borderRadius: Radius.button,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureText: { ...Typography.caption, color: Colors.textMuted, marginTop: Spacing.sm },
});

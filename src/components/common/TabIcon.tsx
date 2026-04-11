import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';

// Map tab names to MaterialCommunityIcons glyph names.
// Full icon list: https://oblador.github.io/react-native-vector-icons/
const ICON_MAP: Record<string, keyof typeof MaterialCommunityIcons.glyphMap> = {
  home: 'view-grid',
  borrowers: 'account-multiple',
  reports: 'file-document-outline',
  settings: 'cog-outline',
  collect: 'wallet-outline',
  expenses: 'receipt',
  summary: 'clipboard-text-outline',
  lines: 'map-marker-path',
};

interface Props {
  name: string;
  color: string;
  size?: number;
}

export function TabIcon({ name, color, size = 24 }: Props) {
  const iconName = ICON_MAP[name] ?? 'circle';
  return <MaterialCommunityIcons name={iconName} size={size} color={color} />;
}

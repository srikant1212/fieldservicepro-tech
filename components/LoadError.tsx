import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Shown when a list could not be loaded, instead of an empty screen
export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <TouchableOpacity onPress={onRetry} activeOpacity={0.7} style={{ alignItems: 'center', justifyContent: 'center', padding: 32, marginTop: 40 }}>
      <Ionicons name="cloud-offline-outline" size={48} color="#94A3B8" />
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B', marginTop: 12 }}>Something went wrong.</Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: '#0066FF', marginTop: 6 }}>Tap to retry.</Text>
    </TouchableOpacity>
  );
}

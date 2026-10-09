import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Shown when a single record (job, quote, invoice, customer) could not be loaded
export function NotFound({ title, onRetry, onBack }: { title: string; onRetry: () => void; onBack: () => void }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F8FAFC' }}>
      <Ionicons name="cloud-offline-outline" size={48} color="#94A3B8" />
      <Text style={{ fontSize: 18, fontWeight: '700', color: '#1E293B', marginTop: 12, textAlign: 'center' }}>{title}</Text>
      <Text style={{ fontSize: 14, color: '#64748B', marginTop: 6, textAlign: 'center' }}>It may have been removed, or the connection dropped.</Text>
      <TouchableOpacity onPress={onRetry} style={{ backgroundColor: '#0066FF', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 24, alignSelf: 'stretch', alignItems: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Retry</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={onBack} style={{ borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#fff', paddingVertical: 14, paddingHorizontal: 32, marginTop: 10, alignSelf: 'stretch', alignItems: 'center' }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: '#1E293B' }}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

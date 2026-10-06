import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { registerForPushNotifications, unregisterPushNotifications } from '../lib/notifications';

const COLORS = { primary: '#0066FF', dark: '#1E293B', gray: '#64748B', border: '#E2E8F0', background: '#F8FAFC', success: '#10B981' };

export default function NotificationSettings() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    const { data } = await supabase.from('profiles')
      .select('push_notifications')
      .eq('id', user?.id)
      .single();
    if (data) setPushEnabled(data.push_notifications !== false);
    setLoading(false);
  };

  const handleTogglePush = async (val: boolean) => {
    if (!user?.id) return;
    setPushEnabled(val);
    setSaving(true);
    const { error } = await supabase.from('profiles').update({ push_notifications: val }).eq('id', user.id);
    if (error) {
      setSaving(false);
      setPushEnabled(!val);
      Alert.alert('Error', 'Failed to save notification settings. Please try again.');
      return;
    }
    // Make the switch real: register this device when on, remove its push token when off
    if (val) {
      const token = await registerForPushNotifications(user.id).catch(() => null);
      if (!token) Alert.alert('Notifications are blocked', 'Allow notifications for this app in your phone settings to receive alerts.');
    } else {
      await unregisterPushNotifications(user.id);
    }
    setSaving(false);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        {saving ? <ActivityIndicator color={COLORS.primary} size="small" /> : <View style={{ width: 32 }} />}
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Push Notifications</Text>
              <Text style={styles.rowSub}>Receive alerts for new jobs and updates</Text>
            </View>
            <Switch
              value={pushEnabled}
              onValueChange={handleTogglePush}
              trackColor={{ false: '#E2E8F0', true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
        <Text style={styles.hint}>You will receive notifications for: new job assignments, job status updates, and messages from your manager.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: '#1E293B' },
  rowSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  hint: { fontSize: 13, color: '#94A3B8', lineHeight: 20 },
});

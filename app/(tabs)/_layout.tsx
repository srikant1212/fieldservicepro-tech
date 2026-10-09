import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { supabase } from '../../lib/supabase';
import { toast } from '../../lib/toast';

export default function TabLayout() {
  // Keep the tab bar clear of the home indicator / Android gesture bar on every device
  const bottom = Math.max(useSafeAreaInsets().bottom, 8);
  // Unread count for the Notifications tab badge: refreshed on sign-in and whenever the app comes back to the front
  const userId = useAuthStore(s => s.user?.id);
  const { unread, refreshUnread, noteIncoming } = useNotificationStore();
  useEffect(() => {
    refreshUnread(userId);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refreshUnread(userId); });
    return () => sub.remove();
  }, [userId]);
  const lastBanner = useRef({ key: '', at: 0 });
  // Live inbox: a new row for this technician (e.g. a job assigned to them) updates the badge and
  // shows a banner straight away, without waiting for the app to be reopened
  useEffect(() => {
    if (!userId) return;
    const channel = supabase.channel(`inbox-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        const n: any = payload.new;
        refreshUnread(userId);
        noteIncoming();
        // One assignment can write two inbox rows (database and server): one banner is enough
        const key = `${n?.type}:${n?.reference_id}`;
        const now = Date.now();
        if (n?.reference_id && lastBanner.current.key === key && now - lastBanner.current.at < 10000) return;
        lastBanner.current = { key, at: now };
        toast.info(n?.title || 'New notification', n?.message || undefined);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: '#0066FF',
      tabBarInactiveTintColor: '#94A3B8',
      tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', height: 60 + bottom, paddingBottom: bottom },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'My Jobs', tabBarIcon: ({ color, size }) => <Ionicons name="briefcase-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="schedule" options={{ title: 'Schedule', tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="notifications" options={{ title: 'Notifications', tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined, tabBarIcon: ({ color, size }) => <Ionicons name="notifications-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}

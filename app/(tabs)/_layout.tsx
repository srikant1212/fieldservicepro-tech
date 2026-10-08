import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';

export default function TabLayout() {
  // Keep the tab bar clear of the home indicator / Android gesture bar on every device
  const bottom = Math.max(useSafeAreaInsets().bottom, 8);
  // Unread count for the Notifications tab badge: refreshed on sign-in and whenever the app comes back to the front
  const userId = useAuthStore(s => s.user?.id);
  const { unread, refreshUnread } = useNotificationStore();
  useEffect(() => {
    refreshUnread(userId);
    const sub = AppState.addEventListener('change', state => { if (state === 'active') refreshUnread(userId); });
    return () => sub.remove();
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

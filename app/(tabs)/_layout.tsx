import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  // Keep the tab bar clear of the home indicator / Android gesture bar on every device
  const bottom = Math.max(useSafeAreaInsets().bottom, 8);
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
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubbles-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="earnings" options={{ title: 'Earnings', tabBarIcon: ({ color, size }) => <Ionicons name="cash-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} /> }} />
      <Tabs.Screen name="map" options={{ href: null }} />
    </Tabs>
  );
}

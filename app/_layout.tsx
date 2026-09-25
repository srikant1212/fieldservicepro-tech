import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { Stack } from 'expo-router';
import { useAuthStore } from '../stores/authStore';
import { useRouter, useSegments } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

function AuthGuard() {
  const { user, loading, initialize } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => { initialize(); }, []);

  useEffect(() => {
    if (user?.id) {
      // Register push token
      import('../lib/notifications').then(({ registerForPushNotifications }) => {
        registerForPushNotifications(user.id).catch(() => {});
      });
    }
  }, [user?.id]);

  useEffect(() => {
    if (loading) return;
    const inAuth = segments[0] === '(auth)';
    if (!user && !inAuth) router.replace('/(auth)/login');
    else if (user && inAuth) router.replace('/(tabs)/dashboard');
  }, [user, loading, segments]);

  if (loading) return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0066FF' }}>
      <ActivityIndicator color="#fff" size="large" />
    </View>
  );

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="job-detail" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="edit-profile" />
      <Stack.Screen name="availability" />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthGuard />
      <Toast />
    </GestureHandlerRootView>
  );
}

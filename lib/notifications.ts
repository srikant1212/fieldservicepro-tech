import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(userId: string): Promise<string | null> {
  if (!Device.isDevice) return null;

  // Respect the in-app switch (Notification Settings). Unset counts as on.
  const { data: profile } = await supabase.from('profiles').select('push_notifications').eq('id', userId).single();
  if (profile?.push_notifications === false) return null;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('jobs', {
      name: 'Job Notifications',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066FF',
    });
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    // Save token to profile
    await supabase.from('profiles').update({ push_token: token } as any).eq('id', userId);
    return token;
  } catch (e) {
    console.error('Push token error:', e);
    return null;
  }
}

export function setupNotificationListeners(onReceive?: (n: any) => void, onResponse?: (r: any) => void) {
  const sub1 = Notifications.addNotificationReceivedListener(n => onReceive?.(n));
  const sub2 = Notifications.addNotificationResponseReceivedListener(r => onResponse?.(r));
  return () => { sub1.remove(); sub2.remove(); };
}

// Open the job when a push notification is tapped, whether the app was running or launched by the tap.
// The backend sends `data: { job_id, type }` with job notifications.
export function handleNotificationTaps(onOpenJob: (jobId: string) => void) {
  let lastHandledId: string | null = null;
  const open = (response: Notifications.NotificationResponse | null) => {
    const request = response?.notification?.request;
    const jobId = request?.content?.data?.job_id;
    if (!request || typeof jobId !== 'string' || request.identifier === lastHandledId) return;
    lastHandledId = request.identifier;
    onOpenJob(jobId);
  };
  // Tap that launched the app from a closed state
  const launchResponse = Notifications.getLastNotificationResponse();
  if (launchResponse) {
    open(launchResponse);
    Notifications.clearLastNotificationResponse();
  }
  return setupNotificationListeners(undefined, open);
}

// Stop pushes to this device: the backend only sends when a push token is saved
export async function unregisterPushNotifications(userId: string) {
  return supabase.from('profiles').update({ push_token: null } as any).eq('id', userId);
}

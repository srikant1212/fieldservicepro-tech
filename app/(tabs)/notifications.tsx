import { useState, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useNotificationStore } from '../../stores/notificationStore';
import { LoadError } from '../../components/LoadError';

const TYPE_STYLES: Record<string, { icon: string; color: string }> = {
  job_assigned: { icon: 'briefcase-outline', color: '#0066FF' },
  job_rescheduled: { icon: 'calendar-outline', color: '#8B5CF6' },
  job_cancelled: { icon: 'close-circle-outline', color: '#EF4444' },
  salary_paid: { icon: 'cash-outline', color: '#10B981' },
};
const DEFAULT_STYLE = { icon: 'notifications-outline', color: '#64748B' };

function timeAgo(dateStr: string) {
  const mins = Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
}

export default function NotificationsScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const refreshUnread = useNotificationStore(s => s.refreshUnread);
  const incoming = useNotificationStore(s => s.incoming);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id) { setLoading(false); return; }
    const { data, error } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) setLoadError(true);
    else { setItems(data || []); setLoadError(false); }
    setLoading(false);
    setRefreshing(false);
    refreshUnread(user.id);
  };

  useFocusEffect(useCallback(() => { fetchNotifications(); }, [user?.id]));
  // A notification arrived live while this screen is mounted: show it without a manual refresh
  useEffect(() => { if (incoming > 0) fetchNotifications(); }, [incoming]);

  const openItem = async (n: any) => {
    if (!n.read) {
      setItems(prev => prev.map(i => i.id === n.id ? { ...i, read: true } : i));
      const { error } = await supabase.from('notifications').update({ read: true } as any).eq('id', n.id);
      if (!error) refreshUnread(user?.id);
    }
    // Job notifications carry the job's id
    if (n.reference_id && String(n.type || '').startsWith('job')) {
      router.push({ pathname: '/job-detail', params: { id: n.reference_id } } as any);
    }
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    setItems(prev => prev.map(i => ({ ...i, read: true })));
    await supabase.from('notifications').update({ read: true } as any).eq('user_id', user.id).eq('read', false);
    refreshUnread(user.id);
  };

  const unreadCount = items.filter(i => !i.read).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Notifications</Text>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllRead} hitSlop={10}>
            <Text style={styles.markAll}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color="#0066FF" size="large" />
      ) : loadError && items.length === 0 ? (
        <LoadError onRetry={() => { setLoading(true); fetchNotifications(); }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchNotifications(); }} tintColor="#0066FF" />}
          renderItem={({ item }) => {
            const style = TYPE_STYLES[item.type] || DEFAULT_STYLE;
            return (
              <TouchableOpacity style={[styles.row, !item.read && styles.rowUnread]} onPress={() => openItem(item)} activeOpacity={0.7}>
                <View style={[styles.iconWrap, { backgroundColor: style.color + '15' }]}>
                  <Ionicons name={style.icon as any} size={20} color={style.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowTitle, !item.read && { fontWeight: '800' }]} numberOfLines={1}>{item.title}</Text>
                  {item.message ? <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text> : null}
                  <Text style={styles.rowTime}>{timeAgo(item.created_at)}</Text>
                </View>
                {!item.read ? <View style={styles.unreadDot} /> : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="notifications-off-outline" size={48} color="#CBD5E1" />
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptySub}>Job assignments and updates will appear here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  markAll: { fontSize: 13, fontWeight: '700', color: '#0066FF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  rowUnread: { borderColor: '#BFDBFE', backgroundColor: '#F8FBFF' },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  rowMessage: { fontSize: 13, color: '#64748B', marginTop: 2 },
  rowTime: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#0066FF' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 80 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
});

import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const COLORS = { primary: '#0066FF', dark: '#1E293B', gray: '#64748B', border: '#E2E8F0', background: '#F8FAFC', success: '#10B981', warning: '#F59E0B', danger: '#EF4444' };
const STATUS_COLORS: Record<string,string> = { scheduled: COLORS.primary, in_progress: COLORS.warning, completed: COLORS.success, cancelled: COLORS.danger };

export default function History() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'completed'|'cancelled'>('all');

  useFocusEffect(useCallback(() => { fetchJobs(); }, [user?.id]));

  const fetchJobs = async () => {
    setLoading(true);
    const { data } = await supabase.from('jobs')
      .select('id,job_number,title,status,date,customer_name,address,estimate,closing_notes')
      .eq('assigned_to', user?.id || '')
      .in('status', ['completed', 'cancelled'])
      .order('date', { ascending: false });
    setJobs(data || []);
    setLoading(false);
  };

  const filtered = filter === 'all' ? jobs : jobs.filter(j => j.status === filter);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Job History</Text>
        <Text style={styles.sub}>{jobs.length} total jobs</Text>
      </View>
      <View style={styles.filters}>
        {(['all','completed','cancelled'] as const).map(f => (
          <TouchableOpacity key={f} style={[styles.filterBtn, filter === f && styles.filterActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f.charAt(0).toUpperCase()+f.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> : (
        <FlatList data={filtered} keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<View style={{ alignItems: 'center', marginTop: 40 }}><Ionicons name="folder-open-outline" size={48} color={COLORS.gray} /><Text style={{ color: COLORS.gray, marginTop: 12 }}>No jobs found</Text></View>}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/job-detail', params: { id: item.id } } as any)}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={styles.jobTitle}>#{item.job_number} — {item.title}</Text>
                <View style={{ backgroundColor: (STATUS_COLORS[item.status] || '#94A3B8')+'20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: STATUS_COLORS[item.status] || '#94A3B8' }}>{(item.status || '').replace('_',' ').toUpperCase()}</Text>
                </View>
              </View>
              <Text style={styles.meta}>{item.customer_name}</Text>
              {!!item.date && <Text style={styles.meta}>{new Date(item.date+'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</Text>}
              {!!item.estimate && <Text style={[styles.meta, { color: COLORS.success, fontWeight: '700' }]}>{`Est: $${item.estimate}`}</Text>}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 22, fontWeight: '900', color: '#1E293B' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  filters: { flexDirection: 'row', padding: 16, gap: 8 },
  filterBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9' },
  filterActive: { backgroundColor: '#0066FF' },
  filterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  filterTextActive: { color: '#fff' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  jobTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  meta: { fontSize: 12, color: '#64748B', marginTop: 3 },
});

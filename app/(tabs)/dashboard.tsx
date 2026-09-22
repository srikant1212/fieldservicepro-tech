import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Image } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { formatDate } from '../../lib/formatters';

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6', in_progress: '#F59E0B', completed: '#10B981', cancelled: '#EF4444',
};

export default function Dashboard() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [org, setOrg] = useState<any>(null);

  useFocusEffect(useCallback(() => { fetchData(); }, [user?.id]));

  const fetchData = async () => {
    if (!user?.id) return;
    try {
      const [jobsRes, orgRes] = await Promise.all([
        supabase.from('jobs').select('*').eq('assigned_to', user.id).order('date', { ascending: true }),
        supabase.from('organizations').select('name, logo_url, brand_color').eq('id', user.organization_id || '').single(),
      ]);
      setJobs(jobsRes.data || []);
      setOrg(orgRes.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); setRefreshing(false); }
  };

  const today = new Date().toISOString().split('T')[0];
  const todayJobs = jobs.filter(j => j.date === today);
  const upcomingJobs = jobs.filter(j => j.date > today && j.status !== 'completed');
  const completedJobs = jobs.filter(j => j.status === 'completed');
  const activeJob = jobs.find(j => j.status === 'in_progress');

  const handleStatusUpdate = async (jobId: string, status: string) => {
    await supabase.from('jobs').update({ status } as any).eq('id', jobId);
    fetchData();
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {org?.logo_url ? (
            <Image source={{ uri: org.logo_url }} style={{ width: 36, height: 36, borderRadius: 8, resizeMode: 'contain', backgroundColor: 'rgba(255,255,255,0.2)' }} />
          ) : null}
          <View>
            <Text style={styles.greeting}>Hey, {user?.display_name?.split(' ')[0]} 👋</Text>
            <Text style={styles.orgName}>{org?.name || 'Field Service Pro'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Today's Jobs", value: todayJobs.length, icon: 'today-outline', color: '#0066FF' },
          { label: 'In Progress', value: jobs.filter(j=>j.status==='in_progress').length, icon: 'time-outline', color: '#F59E0B' },
          { label: 'Completed', value: completedJobs.length, icon: 'checkmark-circle-outline', color: '#10B981' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Ionicons name={s.icon as any} size={22} color={s.color} />
            <Text style={styles.statValue}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#0066FF" />}>

        {/* Active job banner */}
        {activeJob && (
          <TouchableOpacity style={styles.activeJobBanner} onPress={() => router.push({ pathname: '/job-detail', params: { id: activeJob.id } } as any)}>
            <View style={styles.activeJobLeft}>
              <View style={styles.activeDot} />
              <View>
                <Text style={styles.activeJobTitle}>Currently Working</Text>
                <Text style={styles.activeJobName}>{activeJob.title}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#F59E0B" />
          </TouchableOpacity>
        )}

        {/* Today's jobs */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today — {new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
          {todayJobs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-circle-outline" size={32} color="#10B981" />
              <Text style={styles.emptyText}>No jobs today — enjoy your day!</Text>
            </View>
          ) : todayJobs.map(job => (
            <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push({ pathname: '/job-detail', params: { id: job.id } } as any)}>
              <View style={[styles.statusBar, { backgroundColor: STATUS_COLORS[job.status] || '#94A3B8' }]} />
              <View style={styles.jobBody}>
                <View style={styles.jobRow}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[job.status] || '#94A3B8') + '20' }]}>
                    <Text style={[styles.statusText, { color: STATUS_COLORS[job.status] || '#94A3B8' }]}>{job.status?.replace('_', ' ')}</Text>
                  </View>
                </View>
                <Text style={styles.jobCustomer}>{job.customer_name}</Text>
                {job.address ? <View style={styles.jobMeta}><Ionicons name="location-outline" size={12} color="#94A3B8" /><Text style={styles.jobMetaText} numberOfLines={1}>{job.address}</Text></View> : null}
                {job.time_start ? <View style={styles.jobMeta}><Ionicons name="time-outline" size={12} color="#94A3B8" /><Text style={styles.jobMetaText}>{job.time_start?.slice(0,5)}{job.time_end ? ` — ${job.time_end?.slice(0,5)}` : ''}</Text></View> : null}
                
                {job.status === 'scheduled' && (
                  <TouchableOpacity style={styles.startBtn} onPress={() => handleStatusUpdate(job.id, 'in_progress')}>
                    <Ionicons name="play" size={14} color="#fff" />
                    <Text style={styles.startBtnText}>Start Job</Text>
                  </TouchableOpacity>
                )}
                {job.status === 'in_progress' && (
                  <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#10B981' }]} onPress={() => router.push({ pathname: '/job-detail', params: { id: job.id } } as any)}>
                    <Ionicons name="arrow-forward" size={14} color="#fff" />
                    <Text style={styles.startBtnText}>Continue Job</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming */}
        {upcomingJobs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming ({upcomingJobs.length})</Text>
            {upcomingJobs.slice(0, 5).map(job => (
              <TouchableOpacity key={job.id} style={styles.upcomingCard} onPress={() => router.push({ pathname: '/job-detail', params: { id: job.id } } as any)}>
                <View style={styles.upcomingDate}>
                  <Text style={styles.upcomingDay}>{new Date(job.date).toLocaleDateString('en-AU', { day: 'numeric' })}</Text>
                  <Text style={styles.upcomingMonth}>{new Date(job.date).toLocaleDateString('en-AU', { month: 'short' })}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
                  <Text style={styles.jobCustomer}>{job.customer_name}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#0066FF', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20 },
  greeting: { fontSize: 22, fontWeight: '800', color: '#fff' },
  orgName: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  notifBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  statsRow: { flexDirection: 'row', backgroundColor: '#0066FF', paddingHorizontal: 16, paddingBottom: 20, gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 12, alignItems: 'center', gap: 4 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 10, color: '#fff', textAlign: 'center', fontWeight: '700' },
  activeJobBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFBEB', margin: 16, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#F59E0B' },
  activeJobLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B' },
  activeJobTitle: { fontSize: 11, fontWeight: '700', color: '#F59E0B', textTransform: 'uppercase' },
  activeJobName: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginTop: 2 },
  section: { paddingHorizontal: 16, marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 16 },
  jobCard: { backgroundColor: '#fff', borderRadius: 16, flexDirection: 'row', marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3 },
  statusBar: { width: 5 },
  jobBody: { flex: 1, padding: 14 },
  jobRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  statusText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },
  jobCustomer: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  jobMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 2 },
  jobMetaText: { fontSize: 12, color: '#94A3B8', flex: 1 },
  startBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0066FF', borderRadius: 10, padding: 10, marginTop: 10, alignSelf: 'flex-start' },
  startBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  emptyCard: { backgroundColor: '#fff', borderRadius: 16, padding: 24, alignItems: 'center', gap: 8 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  upcomingCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8 },
  upcomingDate: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  upcomingDay: { fontSize: 16, fontWeight: '900', color: '#0066FF' },
  upcomingMonth: { fontSize: 10, fontWeight: '700', color: '#0066FF' },
});

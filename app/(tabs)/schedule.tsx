import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function Schedule() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());

  useFocusEffect(useCallback(() => { fetchJobs(); }, [user?.id]));

  const fetchJobs = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('jobs').select('*')
      .eq('assigned_to', user.id).order('date').order('time_start');
    setJobs(data || []);
    setLoading(false);
  };

  const getDaysInMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const days = [];
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const today = new Date().toISOString().split('T')[0];
  const selectedStr = selectedDate.toISOString().split('T')[0];
  const selectedJobs = jobs.filter(j => j.date === selectedStr);
  const jobDates = new Set(jobs.map(j => j.date));

  const STATUS_COLORS: Record<string,string> = { scheduled:'#3B82F6', in_progress:'#F59E0B', completed:'#10B981', cancelled:'#EF4444' };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth()-1, 1))}>
          <Ionicons name="chevron-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{selectedDate.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</Text>
        <TouchableOpacity onPress={() => setSelectedDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth()+1, 1))}>
          <Ionicons name="chevron-forward" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.calRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: 'center' }}>
        {getDaysInMonth().map(day => {
          const dayStr = day.toISOString().split('T')[0];
          const isToday = dayStr === today;
          const isSelected = dayStr === selectedStr;
          const hasJobs = jobDates.has(dayStr);
          return (
            <TouchableOpacity key={dayStr} style={[styles.dayBtn, isSelected && styles.dayBtnSelected, isToday && !isSelected && styles.dayBtnToday]}
              onPress={() => setSelectedDate(day)}>
              <Text style={[styles.dayBtnDayName, isSelected && { color: '#fff' }]}>{day.toLocaleDateString('en-AU', { weekday: 'short' }).slice(0,2)}</Text>
              <Text style={[styles.dayBtnNum, isSelected && { color: '#fff' }]}>{day.getDate()}</Text>
              {hasJobs && <View style={[styles.jobDot, isSelected && { backgroundColor: '#fff' }]} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView style={styles.jobsList} showsVerticalScrollIndicator={false}>
        <Text style={styles.dateLabel}>{selectedDate.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
        {selectedJobs.length === 0 ? (
          <View style={styles.empty}><Ionicons name="calendar-outline" size={36} color="#CBD5E1" /><Text style={styles.emptyText}>No jobs on this day</Text></View>
        ) : selectedJobs.map(job => (
          <TouchableOpacity key={job.id} style={styles.jobCard} onPress={() => router.push({ pathname: '/job-detail', params: { id: job.id } } as any)}>
            <View style={[styles.timeBar, { backgroundColor: STATUS_COLORS[job.status] || '#94A3B8' }]} />
            <View style={styles.jobInfo}>
              {job.time_start && <Text style={styles.jobTime}>{job.time_start?.slice(0,5)}{job.time_end ? ` — ${job.time_end?.slice(0,5)}` : ''}</Text>}
              <Text style={styles.jobTitle}>{job.title}</Text>
              <Text style={styles.jobCustomer}>{job.customer_name}</Text>
              {job.address && <View style={{ flexDirection:'row', gap:4, alignItems:'center' }}><Ionicons name="location-outline" size={12} color="#94A3B8"/><Text style={styles.jobAddress} numberOfLines={1}>{job.address}</Text></View>}
            </View>
            <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[job.status] || '#94A3B8' }]} />
          </TouchableOpacity>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  monthTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  calRow: { backgroundColor: '#fff', maxHeight: 90, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  dayBtn: { width: 52, height: 68, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dayBtnSelected: { backgroundColor: '#0066FF' },
  dayBtnToday: { backgroundColor: '#EFF6FF' },
  dayBtnDayName: { fontSize: 10, fontWeight: '700', color: '#94A3B8' },
  dayBtnNum: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  jobDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#0066FF' },
  jobsList: { flex: 1, padding: 16 },
  dateLabel: { fontSize: 13, fontWeight: '700', color: '#64748B', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  empty: { alignItems: 'center', padding: 40, gap: 8 },
  emptyText: { fontSize: 14, color: '#94A3B8' },
  jobCard: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 14, marginBottom: 10, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  timeBar: { width: 4 },
  jobInfo: { flex: 1, padding: 14 },
  jobTime: { fontSize: 12, fontWeight: '700', color: '#0066FF', marginBottom: 4 },
  jobTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B', marginBottom: 2 },
  jobCustomer: { fontSize: 13, color: '#64748B', marginBottom: 4 },
  jobAddress: { fontSize: 12, color: '#94A3B8', flex: 1 },
  statusDot: { width: 10, height: 10, borderRadius: 5, margin: 16, alignSelf: 'flex-start', marginTop: 20 },
});

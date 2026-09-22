import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const TIMES = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'];

export default function Availability() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [availability, setAvailability] = useState(
    DAYS.map((day, i) => ({
      day_of_week: i,
      day_name: day,
      is_available: i >= 1 && i <= 5,
      start_time: '08:00',
      end_time: '17:00',
    }))
  );

  useFocusEffect(useCallback(() => { fetchAvailability(); }, [user?.id]));

  const fetchAvailability = async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('technician_availability')
      .select('*')
      .eq('user_id', user.id);

    if (data && data.length > 0) {
      setAvailability(prev => prev.map(day => {
        const saved = data.find(d => d.day_of_week === day.day_of_week);
        return saved ? { ...day, is_available: saved.is_available, start_time: saved.start_time?.slice(0,5) || '08:00', end_time: saved.end_time?.slice(0,5) || '17:00' } : day;
      }));
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const records = availability.map(day => ({
        user_id: user.id,
        organization_id: user.organization_id,
        day_of_week: day.day_of_week,
        is_available: day.is_available,
        start_time: day.start_time,
        end_time: day.end_time,
      }));
      await supabase.from('technician_availability').delete().eq('user_id', user.id);
      const { error } = await supabase.from('technician_availability').insert(records as any);
      if (error) throw error;
      Alert.alert('✅ Saved', 'Your availability has been updated');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Availability</Text>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        <Text style={styles.hint}>Set your working hours. Your admin will see this when assigning jobs.</Text>

        {availability.map((day, idx) => (
          <View key={day.day_of_week} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={[styles.dayName, !day.is_available && { color: '#94A3B8' }]}>{day.day_name}</Text>
              <Switch
                value={day.is_available}
                onValueChange={v => setAvailability(prev => prev.map((d, i) => i === idx ? { ...d, is_available: v } : d))}
                trackColor={{ true: '#0066FF' }}
              />
            </View>
            {day.is_available && (
              <View style={styles.timeRow}>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Start</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.timePills}>
                      {TIMES.map(t => (
                        <TouchableOpacity key={t} style={[styles.timePill, day.start_time === t && styles.timePillActive]}
                          onPress={() => setAvailability(prev => prev.map((d, i) => i === idx ? { ...d, start_time: t } : d))}>
                          <Text style={[styles.timePillText, day.start_time === t && styles.timePillTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>End</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View style={styles.timePills}>
                      {TIMES.map(t => (
                        <TouchableOpacity key={t} style={[styles.timePill, day.end_time === t && styles.timePillActive]}
                          onPress={() => setAvailability(prev => prev.map((d, i) => i === idx ? { ...d, end_time: t } : d))}>
                          <Text style={[styles.timePillText, day.end_time === t && styles.timePillTextActive]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </View>
            )}
            {!day.is_available && (
              <Text style={styles.unavailableText}>Not available</Text>
            )}
          </View>
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
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  saveBtn: { backgroundColor: '#0066FF', borderRadius: 20, paddingHorizontal: 20, paddingVertical: 8 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  scroll: { flex: 1 },
  hint: { fontSize: 13, color: '#64748B', padding: 16, paddingBottom: 8 },
  dayCard: { backgroundColor: '#fff', marginHorizontal: 16, marginBottom: 10, borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  dayName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  timeRow: { gap: 12, marginTop: 8 },
  timeBlock: { gap: 6 },
  timeLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase' },
  timePills: { flexDirection: 'row', gap: 6 },
  timePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  timePillActive: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  timePillText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  timePillTextActive: { color: '#fff' },
  unavailableText: { fontSize: 13, color: '#CBD5E1', marginTop: 4 },
});

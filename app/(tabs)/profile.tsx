import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Switch } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

export default function Profile() {
  const { user, signOut, refreshUser } = useAuthStore();
  const router = useRouter();
  const [org, setOrg] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, completed: 0, inProgress: 0 });

  useFocusEffect(useCallback(() => {
    refreshUser();
    fetchData();
  }, [user?.id]));

  const fetchData = async () => {
    if (!user?.organization_id) return;
    const [orgRes, jobsRes] = await Promise.all([
      supabase.from('organizations').select('name, logo_url, email, phone').eq('id', user.organization_id).single(),
      supabase.from('jobs').select('status').eq('assigned_to', user.id || ''),
    ]);
    setOrg(orgRes.data);
    const jobs = jobsRes.data || [];
    setStats({
      total: jobs.length,
      completed: jobs.filter(j => j.status === 'completed').length,
      inProgress: jobs.filter(j => j.status === 'in_progress').length,
    });
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const initials = (user?.display_name || 'T').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <Text style={styles.name}>{user?.display_name || 'Technician'}</Text>
        <TouchableOpacity style={styles.editBtn} onPress={() => router.push('/edit-profile' as any)}>
          <Ionicons name="pencil-outline" size={14} color="#0066FF" />
          <Text style={styles.editBtnText}>Edit Profile</Text>
        </TouchableOpacity>
        <Text style={styles.role}>{user?.employment_type || 'Technician'} · {org?.name}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: 'Total Jobs', value: stats.total, color: '#0066FF' },
          { label: 'Completed', value: stats.completed, color: '#10B981' },
          { label: 'In Progress', value: stats.inProgress, color: '#F59E0B' },
        ].map(s => (
          <View key={s.label} style={styles.statCard}>
            <Text style={[styles.statValue, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Permissions */}
        <Text style={styles.sectionTitle}>My Permissions</Text>
        <View style={styles.card}>
          {[
            { label: 'Collect Payments', value: user?.can_collect_payment, icon: 'card-outline' },
            { label: 'Send Invoices', value: user?.can_send_invoice, icon: 'receipt-outline' },
            { label: 'View Financials', value: user?.can_view_financials, icon: 'bar-chart-outline' },
          ].map(p => (
            <View key={p.label} style={styles.permRow}>
              <Ionicons name={p.icon as any} size={20} color={p.value ? '#10B981' : '#CBD5E1'} />
              <Text style={[styles.permLabel, !p.value && { color: '#CBD5E1' }]}>{p.label}</Text>
              <View style={[styles.permBadge, { backgroundColor: p.value ? '#ECFDF5' : '#F8FAFC' }]}>
                <Text style={[styles.permBadgeText, { color: p.value ? '#10B981' : '#CBD5E1' }]}>
                  {p.value ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* Skills */}
        {user?.skills && user.skills.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Skills</Text>
            <View style={styles.card}>
              <View style={styles.skillsRow}>
                {user.skills.map((s: string, i: number) => (
                  <View key={i} style={styles.skillBadge}>
                    <Text style={styles.skillText}>{s}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {/* Company Info */}
        <Text style={styles.sectionTitle}>Company</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="business-outline" size={18} color="#64748B" />
            <Text style={styles.infoText}>{org?.name}</Text>
          </View>
          {org?.phone && <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={18} color="#64748B" />
            <Text style={styles.infoText}>{org.phone}</Text>
          </View>}
          {org?.email && <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color="#64748B" />
            <Text style={styles.infoText}>{org.email}</Text>
          </View>}
        </View>

        {/* Quick Links */}
        <View style={{ backgroundColor: '#fff', borderRadius: 16, marginBottom: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
          {[
            { label: 'Job History', icon: 'time-outline', route: '/history' },
            { label: 'My Availability', icon: 'calendar-outline', route: '/availability' },
            { label: 'Navigate to Job', icon: 'map-outline', route: '/map' },
          ].map((item, i) => (
            <TouchableOpacity key={item.label} style={{ flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: '#E2E8F0' }}
              onPress={() => router.push(item.route as any)}>
              <Ionicons name={item.icon as any} size={20} color="#0066FF" style={{ marginRight: 12 }} />
              <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' }}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <Text style={styles.version}>FSP Technician v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#0066FF', paddingTop: 60, paddingBottom: 28, alignItems: 'center', gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: '#fff' },
  role: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  email: { fontSize: 13, color: 'rgba(255,255,255,0.65)' },
  statsRow: { flexDirection: 'row', backgroundColor: '#0066FF', paddingBottom: 20, paddingHorizontal: 16, gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 26, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2, fontWeight: '600' },
  scroll: { flex: 1 },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 20, marginBottom: 8, marginHorizontal: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, marginHorizontal: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  permLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1E293B' },
  permBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  permBadgeText: { fontSize: 12, fontWeight: '700' },
  skillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  skillBadge: { backgroundColor: '#EFF6FF', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
  skillText: { fontSize: 13, fontWeight: '600', color: '#0066FF' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  infoText: { fontSize: 15, color: '#1E293B' },
  editBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginTop: 8 },
  editBtnText: { fontSize: 12, fontWeight: '700', color: '#0066FF' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#FEF2F2', borderRadius: 16, margin: 16, padding: 16 },
  signOutText: { fontSize: 16, fontWeight: '700', color: '#EF4444' },
  version: { textAlign: 'center', fontSize: 12, color: '#CBD5E1', marginBottom: 8 },
});

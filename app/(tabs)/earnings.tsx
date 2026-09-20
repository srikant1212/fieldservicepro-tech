import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const COLORS = { primary: '#0066FF', dark: '#1E293B', gray: '#64748B', border: '#E2E8F0', background: '#F8FAFC', success: '#10B981' };

export default function Earnings() {
  const { user } = useAuthStore();
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useFocusEffect(useCallback(() => { fetchEarnings(); }, []));

  const fetchEarnings = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('salary_payments')
      .select('*, jobs(job_number, title, customer_name, date)')
      .eq('technician_id', user?.id)
      .eq('status', 'paid')
      .order('paid_at', { ascending: false });
    setPayments(data || []);
    setTotal((data || []).reduce((sum, p) => sum + (p.amount || 0), 0));
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Earnings</Text>
      </View>
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total Earned</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
        <Text style={styles.totalSub}>{payments.length} payments received</Text>
      </View>
      {loading ? <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} /> : (
        <FlatList
          data={payments}
          keyExtractor={i => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          ListEmptyComponent={<Text style={{ textAlign: 'center', color: COLORS.gray, marginTop: 40 }}>No payments yet</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={styles.jobTitle}>Job #{item.jobs?.job_number} — {item.jobs?.title}</Text>
                <Text style={styles.amount}>${item.amount?.toFixed(2)}</Text>
              </View>
              <Text style={styles.meta}>{item.jobs?.customer_name}</Text>
              {item.jobs?.date && <Text style={styles.meta}>{new Date(item.jobs.date).toLocaleDateString('en-AU')}</Text>}
              <Text style={styles.meta}>Paid: {new Date(item.paid_at).toLocaleDateString('en-AU')}</Text>
              {item.notes && <Text style={[styles.meta, { color: COLORS.primary }]}>{item.notes}</Text>}
              <View style={{ marginTop: 6, backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, alignSelf: 'flex-start' }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: COLORS.success }}>✅ PAID</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 22, fontWeight: '900', color: COLORS.dark },
  totalCard: { margin: 16, backgroundColor: COLORS.primary, borderRadius: 20, padding: 24, alignItems: 'center' },
  totalLabel: { fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: '600' },
  totalAmount: { fontSize: 42, fontWeight: '900', color: '#fff', marginVertical: 8 },
  totalSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: COLORS.border },
  jobTitle: { fontSize: 14, fontWeight: '700', color: COLORS.dark, flex: 1 },
  amount: { fontSize: 16, fontWeight: '900', color: COLORS.success },
  meta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
});

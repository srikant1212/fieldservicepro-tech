import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Linking } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

const STATUS_COLORS: Record<string,string> = { scheduled:'#3B82F6', in_progress:'#F59E0B', completed:'#10B981', cancelled:'#EF4444' };

export default function MapScreen() {
  const { user } = useAuthStore();
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [region, setRegion] = useState({ latitude: -35.2809, longitude: 149.1300, latitudeDelta: 0.5, longitudeDelta: 0.5 });

  useFocusEffect(useCallback(() => { fetchJobs(); getLocation(); }, [user?.id]));

  const getLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setRegion(r => ({ ...r, latitude: loc.coords.latitude, longitude: loc.coords.longitude }));
  };

  const fetchJobs = async () => {
    if (!user?.id) return;
    const { data } = await supabase.from('jobs').select('*')
      .eq('assigned_to', user.id).neq('status', 'completed').not('address', 'is', null);
    if (data) {
      const geocoded = await Promise.all(data.map(async job => {
        try {
          const results = await Location.geocodeAsync(job.address);
          if (results[0]) return { ...job, lat: results[0].latitude, lng: results[0].longitude };
        } catch {}
        return null;
      }));
      setJobs(geocoded.filter(Boolean) as any[]);
    }
    setLoading(false);
  };

  const navigate = (job: any) => {
    const url = Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(job.address)}` : `geo:0,0?q=${encodeURIComponent(job.address)}`;
    Linking.openURL(url).catch(() => Linking.openURL(`https://maps.google.com/?q=${encodeURIComponent(job.address)}`));
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Job Sites</Text>
        <Text style={styles.subtitle}>{jobs.length} active jobs</Text>
      </View>

      <MapView ref={mapRef} style={styles.map} initialRegion={region} showsUserLocation showsMyLocationButton>
        {jobs.map(job => (
          <Marker key={job.id} coordinate={{ latitude: job.lat, longitude: job.lng }}
            pinColor={STATUS_COLORS[job.status] || '#94A3B8'} onPress={() => setSelected(job)}>
            <Callout tooltip>
              <View style={styles.callout}>
                <Text style={styles.calloutTitle}>{job.title}</Text>
                <Text style={styles.calloutSub}>{job.customer_name}</Text>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      {selected && (
        <View style={styles.jobCard}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setSelected(null)}>
            <Ionicons name="close" size={20} color="#64748B" />
          </TouchableOpacity>
          <Text style={styles.jobTitle}>{selected.title}</Text>
          <Text style={styles.jobCustomer}>{selected.customer_name}</Text>
          <Text style={styles.jobAddress}>{selected.address}</Text>
          <View style={styles.cardBtns}>
            <TouchableOpacity style={styles.navBtn} onPress={() => navigate(selected)}>
              <Ionicons name="navigate-outline" size={18} color="#fff" />
              <Text style={styles.navBtnText}>Navigate</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.viewBtn} onPress={() => router.push({ pathname: '/job-detail', params: { id: selected.id } } as any)}>
              <Ionicons name="briefcase-outline" size={18} color="#0066FF" />
              <Text style={styles.viewBtnText}>View Job</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: '#0066FF', paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff' },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  map: { flex: 1 },
  callout: { backgroundColor: '#fff', borderRadius: 10, padding: 10, minWidth: 140 },
  calloutTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  calloutSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  jobCard: { position: 'absolute', bottom: 90, left: 16, right: 16, backgroundColor: '#fff', borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 8 },
  closeBtn: { position: 'absolute', top: 16, right: 16 },
  jobTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B', marginBottom: 4, marginRight: 24 },
  jobCustomer: { fontSize: 14, color: '#64748B', marginBottom: 4 },
  jobAddress: { fontSize: 13, color: '#94A3B8', marginBottom: 14 },
  cardBtns: { flexDirection: 'row', gap: 10 },
  navBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0066FF', borderRadius: 12, padding: 12 },
  navBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', borderRadius: 12, padding: 12 },
  viewBtnText: { color: '#0066FF', fontWeight: '700', fontSize: 14 },
});

import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const COLORS = { primary: '#0066FF', dark: '#1E293B', gray: '#64748B', border: '#E2E8F0', background: '#F8FAFC' };

const SKILLS = ['Plumbing','Electrical','HVAC','IT Support','Cleaning','Painting','Carpentry','Landscaping','Security','Appliance Repair'];

export default function EditProfile() {
  const router = useRouter();
  const { user, refreshUser } = useAuthStore();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: '', phone: '', bio: '', vehicle_type: '',
    license_number: '', abn: '', skills: [] as string[],
  });

  useEffect(() => {
    if (user) {
      setForm({
        display_name: user.display_name || '',
        phone: (user as any).phone || '',
        bio: (user as any).bio || '',
        vehicle_type: (user as any).vehicle_type || '',
        license_number: (user as any).license_number || '',
        abn: (user as any).abn || '',
        skills: (user as any).skills || [],
      });
    }
  }, [user]);

  const toggleSkill = (skill: string) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill]
    }));
  };

  const handleSave = async () => {
    if (!form.display_name.trim()) { Alert.alert('Required', 'Name is required'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: form.display_name.trim(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        vehicle_type: form.vehicle_type.trim() || null,
        license_number: form.license_number.trim() || null,
        abn: form.abn.trim() || null,
        skills: form.skills,
      } as any).eq('id', user?.id || '');
      if (error) throw error;
      await refreshUser();
      Alert.alert('Saved!', 'Profile updated successfully');
      router.back();
    } catch (e: any) { Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <Ionicons name="arrow-back" size={24} color={COLORS.dark} />
        </TouchableOpacity>
        <Text style={styles.title}>Edit Profile</Text>
        <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save</Text>}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Personal Details</Text>
          {[
            { label: 'Full Name *', key: 'display_name', placeholder: 'John Smith' },
            { label: 'Phone', key: 'phone', placeholder: '04XX XXX XXX', keyboard: 'phone-pad' },
            { label: 'License Number', key: 'license_number', placeholder: 'e.g. EC12345' },
            { label: 'ABN', key: 'abn', placeholder: '12 345 678 901', keyboard: 'numeric' },
            { label: 'Vehicle Type', key: 'vehicle_type', placeholder: 'e.g. White Van, Ute' },
          ].map(field => (
            <View key={field.key}>
              <Text style={styles.label}>{field.label}</Text>
              <TextInput style={styles.input} value={(form as any)[field.key]}
                onChangeText={v => setForm(f => ({...f, [field.key]: v}))}
                placeholder={field.placeholder} keyboardType={(field as any).keyboard || 'default'} />
            </View>
          ))}
          <Text style={styles.label}>Bio / About Me</Text>
          <TextInput style={[styles.input, { height: 80 }]} value={form.bio}
            onChangeText={v => setForm(f => ({...f, bio: v}))}
            placeholder="Brief description of your experience..." multiline textAlignVertical="top" />
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Skills & Expertise</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {SKILLS.map(skill => (
              <TouchableOpacity key={skill} style={[styles.skillBtn, form.skills.includes(skill) && styles.skillActive]}
                onPress={() => toggleSkill(skill)}>
                <Text style={[styles.skillText, form.skills.includes(skill) && styles.skillTextActive]}>{skill}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1E293B' },
  saveBtn: { backgroundColor: '#0066FF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6, marginTop: 12, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, color: '#1E293B', backgroundColor: '#F8FAFC' },
  skillBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  skillActive: { backgroundColor: '#EFF6FF', borderColor: '#0066FF' },
  skillText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  skillTextActive: { color: '#0066FF' },
});

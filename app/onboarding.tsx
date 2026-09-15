import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

const SKILLS = ['Computer Repair','Networking','Electrical','Plumbing','HVAC','Painting','Carpentry','Cleaning','Landscaping','Security Systems','Solar','Other'];

export default function Onboarding() {
  const { user, refreshUser } = useAuthStore();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    display_name: user?.display_name || '',
    phone: user?.phone || '',
    bio: '',
    skills: [] as string[],
    vehicle_type: '',
    license_number: '',
    abn: '',
  });

  const handleSave = async () => {
    if (!form.display_name.trim()) { Alert.alert('Required', 'Please enter your name'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        display_name: form.display_name.trim(),
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        skills: form.skills,
        vehicle_type: form.vehicle_type.trim() || null,
        license_number: form.license_number.trim() || null,
        abn: form.abn.trim() || null,
      } as any).eq('id', user?.id || '');
      if (error) throw error;
      await refreshUser();
      router.replace('/(tabs)/dashboard');
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skill: string) => {
    setForm(f => ({
      ...f,
      skills: f.skills.includes(skill) ? f.skills.filter(s => s !== skill) : [...f.skills, skill]
    }));
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <View style={styles.logoBox}><Ionicons name="construct" size={32} color="#fff" /></View>
        <Text style={styles.title}>Welcome to FSP!</Text>
        <Text style={styles.subtitle}>Set up your tech profile</Text>
        <View style={styles.steps}>
          {[1,2,3].map(s => <View key={s} style={[styles.step, step >= s && styles.stepActive]} />)}
        </View>
      </View>

      <ScrollView style={styles.form} keyboardShouldPersistTaps="handled">
        {step === 1 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Personal Details</Text>
            {[
              { label: 'Full Name *', key: 'display_name', placeholder: 'John Smith' },
              { label: 'Phone Number', key: 'phone', placeholder: '0400 000 000' },
              { label: 'ABN (if contractor)', key: 'abn', placeholder: '12 345 678 901' },
              { label: 'License Number', key: 'license_number', placeholder: 'Trade license number' },
            ].map(f => (
              <View key={f.key} style={styles.field}>
                <Text style={styles.label}>{f.label}</Text>
                <TextInput style={styles.input} placeholder={f.placeholder} placeholderTextColor="#CBD5E1"
                  value={form[f.key as keyof typeof form] as string}
                  onChangeText={v => setForm(prev => ({ ...prev, [f.key]: v }))} />
              </View>
            ))}
            <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(2)}>
              <Text style={styles.nextBtnText}>Next</Text>
              <Ionicons name="arrow-forward" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Your Skills</Text>
            <Text style={styles.stepSub}>Select all that apply</Text>
            <View style={styles.skillsGrid}>
              {SKILLS.map(skill => (
                <TouchableOpacity key={skill} style={[styles.skillBtn, form.skills.includes(skill) && styles.skillBtnActive]}
                  onPress={() => toggleSkill(skill)}>
                  <Text style={[styles.skillBtnText, form.skills.includes(skill) && styles.skillBtnTextActive]}>{skill}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.navBtns}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Ionicons name="arrow-back" size={18} color="#64748B" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.nextBtn} onPress={() => setStep(3)}>
                <Text style={styles.nextBtnText}>Next</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.stepContent}>
            <Text style={styles.stepTitle}>Vehicle & Bio</Text>
            <View style={styles.field}>
              <Text style={styles.label}>Vehicle Type</Text>
              <TextInput style={styles.input} placeholder="e.g. White Toyota HiLux" placeholderTextColor="#CBD5E1"
                value={form.vehicle_type} onChangeText={v => setForm(f => ({ ...f, vehicle_type: v }))} />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Short Bio</Text>
              <TextInput style={[styles.input, { height: 100, textAlignVertical: 'top' }]}
                placeholder="Tell customers a bit about yourself..." placeholderTextColor="#CBD5E1"
                value={form.bio} onChangeText={v => setForm(f => ({ ...f, bio: v }))} multiline />
            </View>
            <View style={styles.navBtns}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(2)}>
                <Ionicons name="arrow-back" size={18} color="#64748B" />
                <Text style={styles.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.nextBtn, { backgroundColor: '#10B981' }, saving && { opacity: 0.7 }]} onPress={handleSave} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" size="small" /> : <><Text style={styles.nextBtnText}>Get Started!</Text><Ionicons name="checkmark" size={18} color="#fff" /></>}
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0066FF' },
  header: { alignItems: 'center', paddingTop: 60, paddingBottom: 28, paddingHorizontal: 20 },
  logoBox: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '900', color: '#fff', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginBottom: 16 },
  steps: { flexDirection: 'row', gap: 8 },
  step: { width: 32, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  stepActive: { backgroundColor: '#fff' },
  form: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  stepContent: { padding: 24 },
  stepTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  stepSub: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  input: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 15, color: '#1E293B', backgroundColor: '#fff' },
  skillsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  skillBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  skillBtnActive: { backgroundColor: '#0066FF', borderColor: '#0066FF' },
  skillBtnText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
  skillBtnTextActive: { color: '#fff' },
  navBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
  backBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 14, padding: 16, backgroundColor: '#F1F5F9' },
  backBtnText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  nextBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#0066FF', borderRadius: 14, padding: 16 },
  nextBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

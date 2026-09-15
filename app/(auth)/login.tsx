import { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { Ionicons } from '@expo/vector-icons';

export default function Login() {
  const { initialize } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) { Alert.alert('Required', 'Please enter email and password'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (error) throw error;
      await initialize();
    } catch (e: any) {
      Alert.alert('Login Failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBox}>
            <Ionicons name="construct" size={40} color="#fff" />
          </View>
          <Text style={styles.title}>FSP Technician</Text>
          <Text style={styles.subtitle}>Field Service Pro — Tech Portal</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.welcomeText}>Welcome back 👋</Text>
          <Text style={styles.welcomeSub}>Sign in to view your jobs</Text>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput style={styles.input} placeholder="your@email.com" placeholderTextColor="#94A3B8"
                value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#94A3B8" style={{ marginRight: 10 }} />
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="••••••••" placeholderTextColor="#94A3B8"
                value={password} onChangeText={setPassword} secureTextEntry={!showPass} />
              <TouchableOpacity onPress={() => setShowPass(!showPass)}>
                <Ionicons name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color="#94A3B8" />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[styles.loginBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            Contact your administrator if you need access.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0066FF' },
  scroll: { flexGrow: 1 },
  header: { alignItems: 'center', paddingTop: 80, paddingBottom: 40, paddingHorizontal: 24 },
  logoBox: { width: 80, height: 80, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '900', color: '#fff', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)' },
  form: { flex: 1, backgroundColor: '#F8FAFC', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 28, paddingTop: 32 },
  welcomeText: { fontSize: 24, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  welcomeSub: { fontSize: 15, color: '#64748B', marginBottom: 28 },
  field: { marginBottom: 20 },
  label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 14 },
  input: { flex: 1, fontSize: 15, color: '#1E293B' },
  loginBtn: { backgroundColor: '#0066FF', borderRadius: 16, padding: 18, alignItems: 'center', marginTop: 8 },
  loginBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  helpText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 24, lineHeight: 20 },
});

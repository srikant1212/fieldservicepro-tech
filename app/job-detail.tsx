import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image, Platform, Linking, Modal } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { haptic } from '../lib/haptics';

const STATUS_COLORS: Record<string,string> = { scheduled:'#3B82F6', in_progress:'#F59E0B', completed:'#10B981', cancelled:'#EF4444' };
const STATUS_LABELS: Record<string,string> = { scheduled:'Scheduled', in_progress:'In Progress', completed:'Completed', cancelled:'Cancelled' };

export default function JobDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<any>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', qty: '1', cost: '' });
  const [showMaterials, setShowMaterials] = useState(false);

  useFocusEffect(useCallback(() => { fetchJob(); }, [id]));

  const fetchJob = async () => {
    if (!id) return;
    const { data } = await supabase.from('jobs').select('*').eq('id', id as string).single();
    if (data) {
      setJob(data);
      setNotes(data.notes || '');
      setClosingNotes(data.closing_notes || '');
      if (data.status === 'in_progress') { setTimerRunning(true); }
      // Load photos
      const { data: files } = await supabase.storage.from('job-photos').list(`${id}/`);
      if (files?.length) {
        const urls = files.map(f => supabase.storage.from('job-photos').getPublicUrl(`${id}/${f.name}`).data.publicUrl);
        setPhotos(urls);
      }
    }
    // Fetch materials
    const { data: mats } = await supabase.from('job_materials').select('*').eq('job_id', id as string);
    setMaterials(mats || []);
    setLoading(false);
  };

  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => setTimerSeconds(s => s + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const formatTimer = (s: number) => `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  const handleStart = async () => {
    haptic.medium();
    const startedAt = new Date().toISOString();
    await supabase.from('jobs').update({ status: 'in_progress', started_at: startedAt } as any).eq('id', id as string);
    setJob({ ...job, status: 'in_progress' });
    setTimerRunning(true);
    Alert.alert('⏱ Job Started!', 'Timer is now running');
  };

  const handleComplete = async () => {
    haptic.success();
    setTimerRunning(false);
    const completedAt = new Date().toISOString();
    await supabase.from('jobs').update({ status: 'completed', closing_notes: closingNotes, completed_at: completedAt, time_spent_seconds: timerSeconds } as any).eq('id', id as string);
    setJob({ ...job, status: 'completed' });
    setShowCompleteModal(false);
    // Send completion email
    supabase.functions.invoke('send-job-notification', { body: { job_id: id, type: 'completed' } }).catch(() => {});
    Alert.alert('✅ Job Completed!', 'Great work! Completion email sent to customer.');
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    await supabase.from('jobs').update({ notes } as any).eq('id', id as string);
    setSavingNotes(false);
    haptic.light();
    Alert.alert('✅ Saved', 'Notes updated');
  };

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed'); return; }
    Alert.alert('Add Photo', 'Choose source', [
      { text: 'Camera', onPress: () => launchCamera() },
      { text: 'Library', onPress: () => launchLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const launchCamera = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) uploadPhoto(result.assets[0].uri);
  };

  const launchLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true, selectionLimit: 5 });
    if (!result.canceled) result.assets.forEach(a => uploadPhoto(a.uri));
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const fileName = `${id}/${Date.now()}.jpg`;
      await supabase.storage.from('job-photos').upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });
      const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(fileName);
      setPhotos(prev => [...prev, urlData.publicUrl]);
      haptic.light();
    } catch (e) { Alert.alert('Upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const handleNavigate = () => {
    if (!job?.address) return;
    const url = Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(job.address)}` : `geo:0,0?q=${encodeURIComponent(job.address)}`;
    Linking.openURL(url);
  };

  const handleCall = () => {
    if (!job?.customer_phone) { Alert.alert('No phone number'); return; }
    Alert.alert('Call Customer', job.customer_phone, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Linking.openURL(`tel:${job.customer_phone}`) },
    ]);
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.name.trim()) return;
    const { data } = await supabase.from('job_materials').insert({
      job_id: id,
      name: newMaterial.name.trim(),
      quantity: parseInt(newMaterial.qty) || 1,
      unit_cost: parseFloat(newMaterial.cost) || 0,
      total_cost: (parseInt(newMaterial.qty)||1) * (parseFloat(newMaterial.cost)||0),
      added_by: user?.id,
    }).select().single();
    if (data) setMaterials(m => [...m, data]);
    setNewMaterial({ name: '', qty: '1', cost: '' });
  };

  const handleRemoveMaterial = async (matId: string) => {
    await supabase.from('job_materials').delete().eq('id', matId);
    setMaterials(m => m.filter(x => x.id !== matId));
  };

  const totalMaterialCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;
  if (!job) return <View style={styles.loading}><Text>Job not found</Text></View>;

  const color = STATUS_COLORS[job.status] || '#94A3B8';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.jobNumber}>{job.job_number}</Text>
          <Text style={styles.jobTitle} numberOfLines={1}>{job.title}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: color + '20' }]}>
          <Text style={[styles.statusText, { color }]}>{STATUS_LABELS[job.status] || job.status}</Text>
        </View>
      </View>

      {/* Timer */}
      {job.status === 'in_progress' && (
        <View style={styles.timerBar}>
          <Ionicons name="time-outline" size={18} color="#F59E0B" />
          <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
          <Text style={styles.timerLabel}>Time on job</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Text style={styles.customerName}>{job.customer_name}</Text>
          {job.address && <View style={styles.infoRow}><Ionicons name="location-outline" size={16} color="#64748B"/><Text style={styles.infoText}>{job.address}</Text></View>}
          {job.date && <View style={styles.infoRow}><Ionicons name="calendar-outline" size={16} color="#64748B"/><Text style={styles.infoText}>{new Date(job.date).toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}{job.time_start ? ` · ${job.time_start.slice(0,5)}` : ''}</Text></View>}
          {job.estimate > 0 && <View style={styles.infoRow}><Ionicons name="cash-outline" size={16} color="#64748B"/><Text style={styles.infoText}>Estimate: ${job.estimate}</Text></View>}
          
          <View style={styles.actionBtns}>
            {job.customer_phone && <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={18} color="#10B981"/>
              <Text style={[styles.actionBtnText, { color:'#10B981' }]}>Call</Text>
            </TouchableOpacity>}
            {job.address && <TouchableOpacity style={[styles.actionBtn, { borderColor:'#0066FF' }]} onPress={handleNavigate}>
              <Ionicons name="navigate-outline" size={18} color="#0066FF"/>
              <Text style={[styles.actionBtnText, { color:'#0066FF' }]}>Navigate</Text>
            </TouchableOpacity>}
          </View>
        </View>

        {/* Job Description */}
        {job.description && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Description</Text>
            <Text style={styles.descText}>{job.description}</Text>
          </View>
        )}

        {/* Notes */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>My Notes</Text>
            <TouchableOpacity style={styles.saveNotesBtn} onPress={handleSaveNotes} disabled={savingNotes}>
              {savingNotes ? <ActivityIndicator color="#0066FF" size="small" /> : <Text style={styles.saveNotesBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
          <TextInput style={styles.notesInput} placeholder="Add notes about this job..." placeholderTextColor="#CBD5E1"
            value={notes} onChangeText={setNotes} multiline numberOfLines={4} textAlignVertical="top" />
        </View>

        {/* Photos */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Photos ({photos.length})</Text>
            <TouchableOpacity style={styles.addPhotoBtn} onPress={handlePickPhoto} disabled={uploadingPhoto}>
              {uploadingPhoto ? <ActivityIndicator color="#0066FF" size="small" /> : <><Ionicons name="camera-outline" size={16} color="#0066FF"/><Text style={styles.addPhotoBtnText}>Add</Text></>}
            </TouchableOpacity>
          </View>
          {photos.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {photos.map((p, i) => (
                  <Image key={i} source={{ uri: p }} style={styles.photoThumb} />
                ))}
              </View>
            </ScrollView>
          ) : (
            <TouchableOpacity style={styles.addPhotoPlaceholder} onPress={handlePickPhoto}>
              <Ionicons name="camera-outline" size={28} color="#CBD5E1"/>
              <Text style={styles.addPhotoText}>Tap to add before/after photos</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Materials / Parts Used */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 14, margin: 16, padding: 16 }}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowMaterials(!showMaterials)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="construct-outline" size={18} color="#0066FF" />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>Materials & Parts</Text>
              {materials.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{materials.length}</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {totalMaterialCost > 0 && <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>${totalMaterialCost.toFixed(2)}</Text>}
              <Ionicons name={showMaterials ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
          {showMaterials && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {materials.map(m => (
                <View key={m.id} style={styles.materialRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>Qty: {m.quantity} × ${m.unit_cost} = ${m.total_cost}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveMaterial(m.id)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addMaterialRow}>
                <TextInput style={[styles.materialInput, { flex: 2 }]} placeholder="Material name" value={newMaterial.name} onChangeText={v => setNewMaterial(p => ({...p, name: v}))} />
                <TextInput style={[styles.materialInput, { flex: 0.6 }]} placeholder="Qty" value={newMaterial.qty} onChangeText={v => setNewMaterial(p => ({...p, qty: v}))} keyboardType="numeric" />
                <TextInput style={[styles.materialInput, { flex: 0.8 }]} placeholder="$Cost" value={newMaterial.cost} onChangeText={v => setNewMaterial(p => ({...p, cost: v}))} keyboardType="decimal-pad" />
                <TouchableOpacity style={styles.addMaterialBtn} onPress={handleAddMaterial}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Materials / Parts Used */}
        <View style={{ paddingHorizontal: 16, marginBottom: 8, backgroundColor: '#fff', borderRadius: 14, margin: 16, padding: 16 }}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowMaterials(!showMaterials)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="construct-outline" size={18} color="#0066FF" />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>Materials & Parts</Text>
              {materials.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{materials.length}</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {totalMaterialCost > 0 && <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>${totalMaterialCost.toFixed(2)}</Text>}
              <Ionicons name={showMaterials ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
          {showMaterials && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {materials.map(m => (
                <View key={m.id} style={styles.materialRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>Qty: {m.quantity} × ${m.unit_cost} = ${m.total_cost}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveMaterial(m.id)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addMaterialRow}>
                <TextInput style={[styles.materialInput, { flex: 2 }]} placeholder="Material name" value={newMaterial.name} onChangeText={v => setNewMaterial(p => ({...p, name: v}))} />
                <TextInput style={[styles.materialInput, { flex: 0.6 }]} placeholder="Qty" value={newMaterial.qty} onChangeText={v => setNewMaterial(p => ({...p, qty: v}))} keyboardType="numeric" />
                <TextInput style={[styles.materialInput, { flex: 0.8 }]} placeholder="$Cost" value={newMaterial.cost} onChangeText={v => setNewMaterial(p => ({...p, cost: v}))} keyboardType="decimal-pad" />
                <TouchableOpacity style={styles.addMaterialBtn} onPress={handleAddMaterial}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        {job.status === 'scheduled' && (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Ionicons name="play" size={20} color="#fff"/>
            <Text style={styles.startBtnText}>Start Job</Text>
          </TouchableOpacity>
        )}
        {job.status === 'in_progress' && (
          <TouchableOpacity style={styles.completeBtn} onPress={() => setShowCompleteModal(true)}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff"/>
            <Text style={styles.completeBtnText}>Complete Job</Text>
          </TouchableOpacity>
        )}
        {job.status === 'completed' && (
          <View style={styles.completedBar}>
            <Ionicons name="checkmark-circle" size={24} color="#10B981"/>
            <Text style={styles.completedText}>Job Completed</Text>
          </View>
        )}
      </View>

      {/* Complete Modal */}
      <Modal visible={showCompleteModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Complete Job</Text>
            <Text style={styles.modalSub}>Add closing notes before finishing</Text>
            <TextInput style={styles.closingNotesInput} placeholder="What was done? Any follow-up needed?"
              placeholderTextColor="#CBD5E1" value={closingNotes} onChangeText={setClosingNotes}
              multiline numberOfLines={4} textAlignVertical="top" />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleComplete}>
                <Text style={styles.modalConfirmText}>Complete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 3 },
  backBtn: { padding: 4 },
  jobNumber: { fontSize: 12, fontWeight: '700', color: '#94A3B8' },
  jobTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  statusText: { fontSize: 12, fontWeight: '700' },
  timerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FFFBEB', padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#FDE68A' },
  timerText: { fontSize: 22, fontWeight: '900', color: '#F59E0B', fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 12, color: '#92400E', flex: 1 },
  scroll: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 16, margin: 16, marginBottom: 8, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 },
  customerName: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  infoText: { fontSize: 14, color: '#475569', flex: 1 },
  actionBtns: { flexDirection: 'row', gap: 10, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 10, padding: 10, borderWidth: 1.5, borderColor: '#10B981' },
  actionBtnText: { fontSize: 14, fontWeight: '700' },
  descText: { fontSize: 14, color: '#475569', lineHeight: 20 },
  notesInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1E293B', height: 100 },
  saveNotesBtn: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  saveNotesBtnText: { fontSize: 13, fontWeight: '700', color: '#0066FF' },
  addPhotoBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  addPhotoBtnText: { fontSize: 13, fontWeight: '700', color: '#0066FF' },
  photoThumb: { width: 100, height: 100, borderRadius: 10 },
  addPhotoPlaceholder: { alignItems: 'center', padding: 24, gap: 8, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  materialRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12 },
  addMaterialRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  materialInput: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, padding: 8, fontSize: 13, backgroundColor: '#fff' },
  addMaterialBtn: { backgroundColor: '#0066FF', borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center' },
  badge: { backgroundColor: '#0066FF', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '800', color: '#fff' },
  addPhotoText: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },
  bottomBar: { padding: 16, paddingBottom: 32, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#0066FF', borderRadius: 16, padding: 18 },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  completeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#10B981', borderRadius: 16, padding: 18 },
  completeBtnText: { fontSize: 17, fontWeight: '800', color: '#fff' },
  completedBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  completedText: { fontSize: 17, fontWeight: '800', color: '#10B981' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderRadius: 24, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  modalSub: { fontSize: 14, color: '#64748B', marginBottom: 16 },
  closingNotesInput: { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1E293B', height: 120, marginBottom: 16 },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancelBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#F1F5F9', alignItems: 'center' },
  modalCancelText: { fontSize: 15, fontWeight: '700', color: '#64748B' },
  modalConfirmBtn: { flex: 1, padding: 16, borderRadius: 14, backgroundColor: '#10B981', alignItems: 'center' },
  modalConfirmText: { fontSize: 15, fontWeight: '800', color: '#fff' },
});

import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image, Platform, Linking, Modal, KeyboardAvoidingView, RefreshControl } from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { startJob, notifyOnTheWay, updateJob } from '../lib/jobActions';
import { useAuthStore } from '../stores/authStore';
import { haptic } from '../lib/haptics';
import { toast } from '../lib/toast';
import { createJobReportPdf } from '../lib/jobReport';
import { CLOSING_QUESTIONS, EMPTY_CLOSING_ANSWERS, formatClosingNotes, parseClosingNotes, type ClosingAnswers } from '../lib/closingNotes';
import { formatCurrency, telUrl } from '../lib/formatters';
import { RescheduleSheet, formatRescheduleDate } from '../components/RescheduleSheet';
import { useSafeHeaderTop } from '../lib/useSafeHeaderTop';
import { NotFound } from '../components/NotFound';

const STATUS_COLORS: Record<string,string> = { 
  new:'#6B7280', scheduled:'#8B5CF6', accepted:'#14B8A6', travelling:'#F59E0B', 
  on_site:'#EF4444', in_progress:'#0066FF', completed:'#10B981', 
  cancelled:'#EF4444', pending:'#F59E0B' 
};
const STATUS_LABELS: Record<string,string> = { 
  new:'New', scheduled:'Scheduled', accepted:'Accepted', travelling:'Travelling', 
  on_site:'On Site', in_progress:'In Progress', completed:'Completed', 
  cancelled:'Cancelled', pending:'Pending' 
};

const ACTIVITY_STYLES: Record<string, { icon: string; color: string; bg: string }> = {
  note_added: { icon: 'document-text-outline', color: '#0066FF', bg: '#EFF6FF' },
  photo_added: { icon: 'camera-outline', color: '#10B981', bg: '#F0FDF4' },
  started: { icon: 'play-circle-outline', color: '#0066FF', bg: '#EFF6FF' },
  completed: { icon: 'checkmark-circle-outline', color: '#10B981', bg: '#F0FDF4' },
};
const DEFAULT_ACTIVITY_STYLE = { icon: 'time-outline', color: '#F59E0B', bg: '#FEF3C7' };

export default function JobDetail() {
  const headerTop = useSafeHeaderTop();
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try { await fetchJob(); } finally { setRefreshing(false); }
  };
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState<any[]>([]);
  const [actorNames, setActorNames] = useState<Record<string,string>>({});
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [reportBusy, setReportBusy] = useState<'view' | 'send' | null>(null);
  const [signerName, setSignerName] = useState('');
  const [closingAnswers, setClosingAnswers] = useState<ClosingAnswers>(EMPTY_CLOSING_ANSWERS);
  const [materials, setMaterials] = useState<any[]>([]);
  const [newMaterial, setNewMaterial] = useState({ name: '', qty: '1', cost: '' });
  const [showMaterials, setShowMaterials] = useState(false);

  useFocusEffect(useCallback(() => { fetchJob(); }, [id]));

  const fetchJob = async () => {
    if (!id) { setLoading(false); return; }
    const { data } = await supabase.from('jobs').select('*').eq('id', id as string).single();
    if (data) {
      setJob(data);
      setNotes(data.notes || '');
      // Load activity feed
      const { data: actData } = await supabase.from('job_activity_log')
        .select('*').eq('job_id', id as string).order('created_at', { ascending: false }).limit(20);
      setActivity(actData || []);
      // Names for other people's activity entries
      const otherIds = [...new Set((actData || []).map(a => a.user_id).filter((u: any) => u && u !== user?.id))];
      if (otherIds.length) {
        const { data: people } = await supabase.from('profiles').select('id, display_name').in('id', otherIds as string[]);
        setActorNames(Object.fromEntries((people || []).filter(p => p.display_name).map(p => [p.id, p.display_name])));
      }
      setClosingAnswers(parseClosingNotes(data.closing_notes));
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

  // Timer is always computed from the persisted start time, so it survives screen switches and restarts.
  // Falls back to the 'started' activity entry if the jobs.started_at column isn't populated.
  const jobStartedAt: string | null = job?.status === 'in_progress'
    ? (job.started_at || activity.find(a => a.action === 'started')?.created_at || null)
    : null;

  useEffect(() => {
    if (!jobStartedAt) return;
    const tick = () => setTimerSeconds(Math.max(0, Math.floor((Date.now() - new Date(jobStartedAt).getTime()) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [jobStartedAt]);

  const formatTimer = (s: number) => `${Math.floor(s/3600).toString().padStart(2,'0')}:${Math.floor((s%3600)/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`;

  // Moves the job to another day and records why in the job's activity (the office sees it there)
  const [showReschedule, setShowReschedule] = useState(false);
  const handleReschedule = async (date: string, reason: string) => {
    const { error } = await supabase.from('jobs').update({ date } as any).eq('id', id as string);
    if (error) { Alert.alert('Error', 'Failed to reschedule the job. Please try again.'); return false; }
    setJob((prev: any) => ({ ...prev, date }));
    const entry = { job_id: id, user_id: user?.id, action: 'rescheduled', details: `Job rescheduled to ${formatRescheduleDate(date)}${reason ? ` — ${reason}` : ''}` };
    const { error: logError } = await supabase.from('job_activity_log').insert(entry);
    if (!logError) setActivity(prev => [{ ...entry, created_at: new Date().toISOString() }, ...prev]);
    toast.success('Job rescheduled', formatRescheduleDate(date));
    return true;
  };

  // Accepting only tells the office the job has been seen; the customer is not contacted
  const handleAccept = async () => {
    haptic.medium();
    const { error } = await supabase.from('jobs').update({ status: 'accepted' } as any).eq('id', id as string);
    if (error) { Alert.alert('Error', error.code === '23514' ? 'Accepting jobs needs a database update that has not been applied yet. Please contact your administrator.' : 'Failed to accept the job. Please try again.'); return; }
    setJob((prev: any) => ({ ...prev, status: 'accepted' }));
    const entry = { job_id: id, user_id: user?.id, action: 'accepted', details: 'Job accepted by technician' };
    const { error: logError } = await supabase.from('job_activity_log').insert(entry);
    if (!logError) setActivity(prev => [{ ...entry, created_at: new Date().toISOString() }, ...prev]);
  };

  // Starting travel emails and texts the customer, so ask first
  const handleStart = () => {
    Alert.alert('Start Travel?', 'Customer will be notified by email and SMS that you are on the way.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Proceed', onPress: async () => {
        haptic.medium();
        const { error } = await supabase.from('jobs').update({ status: 'travelling' } as any).eq('id', id as string);
        if (error) { Alert.alert('Error', 'Failed to start travel. Please try again.'); return; }
        setJob((prev: any) => ({ ...prev, status: 'travelling' }));
        // Notify customer team member is on the way
        notifyOnTheWay(job, user);
      }},
    ]);
  };

  const handleOnSite = async () => {
    haptic.medium();
    const { error } = await supabase.from('jobs').update({ status: 'on_site' } as any).eq('id', id as string);
    if (error) { Alert.alert('Error', 'Failed to update status. Please try again.'); return; }
    setJob((prev: any) => ({ ...prev, status: 'on_site' }));
  };

  const handleStartWork = async () => {
    haptic.medium();
    const { error, startedAt } = await startJob(id as string, user?.id);
    if (!error) {
      setJob((prev: any) => ({ ...prev, status: 'in_progress', started_at: startedAt }));
      setActivity(prev => [{ action: 'started', details: 'Job started by technician', created_at: startedAt, user_id: user?.id }, ...prev]);
    } else {
      Alert.alert('Error', 'Failed to start job. Please try again.');
    }
  };

  // Completing emails the customer, so ask first
  const confirmComplete = () => {
    if (completing) return;
    if (!job?.customer_email) { handleComplete(); return; }
    Alert.alert('Complete Job?', 'A job completion email will be sent to the customer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Proceed', onPress: () => handleComplete() },
    ]);
  };

  const handleComplete = async () => {
    // A second tap while the first is still saving would complete the job (and email the customer) twice
    if (completing) return;
    setCompleting(true);
    const completedAt = new Date().toISOString();
    const closingNotes = formatClosingNotes(closingAnswers) || null;
    const { error } = await updateJob(id as string,
      { status: 'completed', closing_notes: closingNotes },
      {
        completed_at: completedAt, time_spent_seconds: timerSeconds, customer_signature_name: signerName || null,
        // Same answers in their own columns (also written by the web app)
        problem_description: closingAnswers.problem.trim() || null,
        troubleshooting_notes: closingAnswers.troubleshooting.trim() || null,
        resolution_notes: closingAnswers.resolution.trim() || null,
      });
    if (error) {
      haptic.error();
      Alert.alert('Error', 'Failed to complete job. Please try again.');
      setCompleting(false);
      return;
    }
    haptic.success();
    setJob((prev: any) => ({ ...prev, status: 'completed', completed_at: completedAt }));
    setShowCompleteModal(false);
    supabase.from('job_activity_log').insert({
      job_id: id, user_id: user?.id, action: 'completed', details: 'Job completed by technician'
    }).then(() => {});
    // Auto-save PDF report to storage
    const completedJob = { ...job, status: 'completed', closing_notes: closingNotes, completed_at: completedAt, time_spent_seconds: timerSeconds, customer_signature_name: signerName || null };
    createJobReportPdf(completedJob, user, { base64: true }).then(({ base64 }) => supabase.functions.invoke('send-job-report', {
      body: { job_id: id, customer_email: job?.customer_email, customer_name: job?.customer_name, job_number: job?.job_number, save_only: true, pdf_base64: base64 }
    })).then((res: any) => {
      if (res?.data?.report_url) {
        supabase.from('jobs').update({ report_url: res.data.report_url } as any).eq('id', id as string).then(() => {});
      }
    }).catch(() => {});
    // Send professional job completed email
    supabase.functions.invoke('send-notification-email', {
      body: { type: 'job_completed', job_id: id }
    }).catch(() => {});
    toast.success('Job completed', 'Completion email sent to customer');
    // Dashboard refetches jobs on focus, so it shows the updated status
    router.dismissTo('/(tabs)/dashboard' as any);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.from('job_activity_log').insert({
        job_id: id,
        user_id: user?.id,
        action: 'note_added',
        details: newNote.trim()
      });
      if (error) throw error;
      setActivity(prev => [{ action: 'note_added', details: newNote.trim(), created_at: new Date().toISOString(), user_id: user?.id }, ...prev]);
      setNewNote('');
      setShowNoteInput(false);
    } catch { Alert.alert('Error', 'Failed to save note'); }
    finally { setAddingNote(false); }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    // Job notes are shared with the office, who may have added to them since this screen loaded.
    // Read the latest copy first and merge, so saving here can never wipe someone else's notes.
    const loaded: string = job?.notes || '';
    const { data: latestRow, error: readError } = await supabase.from('jobs').select('notes').eq('id', id as string).single();
    if (readError) {
      setSavingNotes(false);
      Alert.alert('Error', 'Failed to save notes');
      return;
    }
    const latest: string = (latestRow as any)?.notes || '';
    let merged = notes;
    let added = notes.trim();
    if (latest !== loaded) {
      if (notes.startsWith(loaded)) {
        // Only added to the end: put the addition after the latest saved notes
        added = notes.slice(loaded.length).trim();
        merged = added ? `${latest}\n${added}` : latest;
      } else if (notes !== loaded) {
        // Edited in the middle while someone else also changed them: keep both versions
        merged = `${latest}\n${notes}`.trim();
      } else {
        merged = latest;
        added = '';
      }
    } else if (notes.startsWith(loaded)) {
      added = notes.slice(loaded.length).trim();
    }
    const { error } = await supabase.from('jobs').update({ notes: merged } as any).eq('id', id as string);
    if (error) {
      setSavingNotes(false);
      Alert.alert('Error', 'Failed to save notes');
      return;
    }
    if (added && notes.trim() !== loaded.trim()) {
      const { error: logError } = await supabase.from('job_activity_log').insert({
        job_id: id, user_id: user?.id, action: 'note_added', details: added
      });
      if (!logError) {
        setActivity(prev => [{ action: 'note_added', details: added, created_at: new Date().toISOString(), user_id: user?.id }, ...prev]);
      }
    }
    setNotes(merged);
    setJob((prev: any) => ({ ...prev, notes: merged }));
    setSavingNotes(false);
    haptic.light();
  };

  const handlePickPhoto = () => {
    Alert.alert('Add Photo', 'Choose source', [
      { text: 'Camera', onPress: () => launchCamera() },
      { text: 'Library', onPress: () => launchLibrary() },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // Camera access is only asked for when the camera is chosen
  const launchCamera = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Camera access needed', 'Allow camera access in Settings to take photos of the job.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) uploadPhoto(result.assets[0].uri);
    } catch (e: any) { Alert.alert('Could not open the camera', e.message); }
  };

  // The system photo picker needs no permission: the app only receives the photos that are picked
  const launchLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsMultipleSelection: true, selectionLimit: 5 });
      if (!result.canceled) result.assets.forEach(a => uploadPhoto(a.uri));
    } catch (e: any) { Alert.alert('Could not open your photos', e.message); }
  };

  const uploadPhoto = async (uri: string) => {
    setUploadingPhoto(true);
    try {
      // Upload as ArrayBuffer — blobs upload as 0-byte files from React Native
      const arrayBuffer = await fetch(uri).then(res => res.arrayBuffer());
      if (!arrayBuffer.byteLength) throw new Error('Empty file');
      const fileName = `${id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
      const { error: uploadError } = await supabase.storage.from('job-photos').upload(fileName, arrayBuffer, { contentType: 'image/jpeg', upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(fileName);
      setPhotos(prev => [...prev, urlData.publicUrl]);
      // Also record it in job_photos, which is where the web app looks for a job's photos.
      // The web groups photos as before/after; photos from this app are filed under "after".
      const { error: recordError } = await supabase.from('job_photos').insert({ job_id: id, file_path: fileName, photo_type: 'after', uploaded_by: user?.id } as any);
      if (recordError) console.warn('job_photos insert failed:', recordError.message);
      // Log to activity feed
      try { await supabase.from('job_activity_log').insert({
        job_id: id,
        user_id: user?.id,
        action: 'photo_added',
        details: 'Photo uploaded by technician',
        photo_url: urlData.publicUrl
      }); } catch {}
      haptic.light();
    } catch (e) { Alert.alert('Upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const handleNavigate = () => {
    if (!job?.address) return;
    const url = Platform.OS === 'ios' ? `maps:?q=${encodeURIComponent(job.address)}` : `geo:0,0?q=${encodeURIComponent(job.address)}`;
    Linking.openURL(url);
  };

  const handleSendETA = () => {
    if (!job?.customer_email) { Alert.alert('No email', 'No customer email on this job'); return; }
    Alert.alert('Send ETA', 'Send ETA notification to customer?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        try {
          const { error } = await supabase.functions.invoke('send-notification-email', {
            body: { type: 'eta_update', job_id: id }
          });
          if (error) throw error;
          toast.success('ETA sent', 'Notification sent to customer');
        } catch { Alert.alert('Error', 'Failed to send ETA'); }
      }}
    ]);
  };

  const handleRevertStatus = () => {
    const statusMap: Record<string,string> = {
      accepted: 'scheduled',
      travelling: 'accepted',
      on_site: 'travelling',
      in_progress: 'on_site',
    };
    const prevStatus = statusMap[job?.status || ''];
    if (!prevStatus) return;
    Alert.alert(
      'Revert Status',
      `Go back to "${prevStatus.replace('_', ' ')}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revert', style: 'destructive', onPress: async () => {
          // Leaving In Progress clears the start time so the timer restarts from zero next time
          const { error } = await updateJob(id as string, { status: prevStatus }, job?.status === 'in_progress' ? { started_at: null } : {});
          if (error) { Alert.alert('Error', 'Failed to revert status. Please try again.'); return; }
          setJob((prev: any) => ({ ...prev, status: prevStatus, ...(prev.status === 'in_progress' ? { started_at: null } : {}) }));
          const entry = { job_id: id, user_id: user?.id, action: prevStatus, details: `Status reverted to ${prevStatus.replace('_', ' ')}` };
          const { error: logError } = await supabase.from('job_activity_log').insert(entry);
          if (!logError) setActivity(prev => [{ ...entry, created_at: new Date().toISOString() }, ...prev]);
        }}
      ]
    );
  };

  const handleCall = () => {
    if (!job?.customer_phone) { Alert.alert('No phone number'); return; }
    Alert.alert('Call Customer', job.customer_phone, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Call', onPress: () => Linking.openURL(telUrl(job.customer_phone)) },
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

  const handleRemoveMaterial = (mat: any) => {
    Alert.alert('Remove Material', `Remove "${mat.name}" from this job?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const { error } = await supabase.from('job_materials').delete().eq('id', mat.id);
        if (error) { Alert.alert('Error', 'Failed to remove material'); return; }
        setMaterials(m => m.filter(x => x.id !== mat.id));
      }}
    ]);
  };

  const totalMaterialCost = materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);

  const photoModal = selectedPhoto ? (
    <Modal visible={true} transparent animationType="fade" onRequestClose={() => setSelectedPhoto(null)}>
      <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' }}
        onPress={() => setSelectedPhoto(null)} activeOpacity={1}>
        <Image source={{ uri: selectedPhoto }} style={{ width: '100%', height: '80%', resizeMode: 'contain' }} />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 14 }}>Tap to close</Text>
      </TouchableOpacity>
    </Modal>
  ) : null;

  // Opens the saved report PDF. If none was saved at completion (e.g. the app was closed), build and save it now.
  const handleViewReport = async () => {
    if (reportBusy) return;
    setReportBusy('view');
    try {
      let url: string | null = job.report_url || null;
      if (!url) {
        const { base64 } = await createJobReportPdf(job, user, { base64: true });
        const { data, error } = await supabase.functions.invoke('send-job-report', {
          body: { job_id: job.id, customer_email: job.customer_email, customer_name: job.customer_name, job_number: job.job_number, save_only: true, pdf_base64: base64 }
        });
        if (error) throw error;
        url = data?.report_url || null;
        if (url) {
          supabase.from('jobs').update({ report_url: url } as any).eq('id', job.id).then(() => {});
          setJob((prev: any) => ({ ...prev, report_url: url }));
        }
      }
      if (!url) throw new Error('The report could not be prepared. Please try again.');
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not open the report');
    } finally {
      setReportBusy(null);
    }
  };

  const handleSendReport = () => {
    if (reportBusy) return;
    if (!job?.customer_email) { Alert.alert('No email', 'No customer email on this job'); return; }
    Alert.alert('Send Report', `Email the job report to ${job.customer_email}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        setReportBusy('send');
        try {
          // Generate the PDF here and send it with the request: the server stores it and links it in the email
          const { base64 } = await createJobReportPdf(job, user, { base64: true });
          const { data, error } = await supabase.functions.invoke('send-job-report', {
            body: { job_id: job.id, customer_email: job.customer_email, customer_name: job.customer_name, job_number: job.job_number, pdf_base64: base64 }
          });
          if (error) throw error;
          const sentAt = new Date().toISOString();
          await supabase.from('jobs').update({ report_sent_at: sentAt, ...(data?.report_url ? { report_url: data.report_url } : {}) } as any).eq('id', job.id);
          setJob((prev: any) => ({ ...prev, report_sent_at: sentAt, ...(data?.report_url ? { report_url: data.report_url } : {}) }));
          const entry = { job_id: job.id, user_id: user?.id, action: 'report_sent', details: `Job report sent to ${job.customer_email}` };
          const { error: logError } = await supabase.from('job_activity_log').insert(entry);
          if (!logError) setActivity(prev => [{ ...entry, created_at: sentAt }, ...prev]);
          toast.success('Report sent', `Sent to ${job.customer_email}`);
        } catch (e: any) {
          Alert.alert('Error', e.message || 'Failed to send the report');
        } finally {
          setReportBusy(null);
        }
      }},
    ]);
  };

  if (loading) return <View style={styles.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;
  if (!job) return <NotFound title="Job not found" onRetry={() => { setLoading(true); fetchJob(); }} onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard')} />;

  const color = STATUS_COLORS[job.status] || '#94A3B8';

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: color, paddingTop: headerTop }]}>
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
          <Ionicons name="time-outline" size={18} color="#0066FF" />
          <Text style={styles.timerText}>{formatTimer(timerSeconds)}</Text>
          <Text style={styles.timerLabel}>Time on job</Text>
        </View>
      )}

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={"#0066FF"} />}>
        {/* Customer Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Text style={styles.customerName}>{job.customer_name}</Text>
          {!!job.address && <View style={styles.infoRow}><Ionicons name="location-outline" size={16} color="#64748B"/><Text style={styles.infoText}>{job.address}</Text></View>}
          {!!job.date && <View style={styles.infoRow}><Ionicons name="calendar-outline" size={16} color="#64748B"/><Text style={styles.infoText}>{new Date(job.date).toLocaleDateString('en-AU', { weekday:'long', day:'numeric', month:'long' })}{job.time_start ? ` · ${job.time_start.slice(0,5)}` : ''}</Text></View>}
          {job.estimate > 0 && user?.can_view_financials && <View style={styles.infoRow}><Ionicons name="cash-outline" size={16} color="#64748B"/><Text style={styles.infoText}>Estimate: ${job.estimate}</Text></View>}
          
          <View style={styles.actionBtns}>
            {!!job.customer_phone && <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
              <Ionicons name="call-outline" size={18} color="#10B981"/>
              <Text style={[styles.actionBtnText, { color:'#10B981' }]}>Call</Text>
            </TouchableOpacity>}
            {!!job.address && <TouchableOpacity style={[styles.actionBtn, { borderColor:'#0066FF' }]} onPress={handleNavigate}>
              <Ionicons name="navigate-outline" size={18} color="#0066FF"/>
              <Text style={[styles.actionBtnText, { color:'#0066FF' }]}>Navigate</Text>
            </TouchableOpacity>}
          </View>
        </View>

        {/* Job Description */}
        {!!job.description && (
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
          <TextInput style={styles.notesInput} placeholder="Add notes about this job..." placeholderTextColor="#94A3B8"
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
                  <TouchableOpacity key={i} onPress={() => setSelectedPhoto(p)}>
                    <Image source={{ uri: p }} style={styles.photoThumb} />
                  </TouchableOpacity>
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
        <View style={styles.card}>
          <TouchableOpacity style={styles.sectionHeader} onPress={() => setShowMaterials(!showMaterials)}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="construct-outline" size={18} color="#0066FF" />
              <Text style={{ fontSize: 15, fontWeight: '800', color: '#1E293B', marginBottom: 4 }}>Materials & Parts</Text>
              {materials.length > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{materials.length}</Text></View>}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              {totalMaterialCost > 0 && !!user?.can_view_financials && <Text style={{ fontSize: 13, fontWeight: '700', color: '#10B981' }}>{formatCurrency(totalMaterialCost)}</Text>}
              <Ionicons name={showMaterials ? 'chevron-up' : 'chevron-down'} size={18} color="#94A3B8" />
            </View>
          </TouchableOpacity>
          {showMaterials && (
            <View style={{ marginTop: 12, gap: 8 }}>
              {materials.map(m => (
                <View key={m.id} style={styles.materialRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#1E293B' }}>{m.name}</Text>
                    <Text style={{ fontSize: 12, color: '#94A3B8' }}>Qty: {m.quantity}{user?.can_view_financials ? ` × ${formatCurrency(Number(m.unit_cost) || 0)} = ${formatCurrency(Number(m.total_cost) || 0)}` : ''}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleRemoveMaterial(m)}>
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addMaterialRow}>
                <TextInput style={[styles.materialInput, { flex: 2 }]} placeholder="Material name" value={newMaterial.name} onChangeText={v => setNewMaterial(p => ({...p, name: v}))} placeholderTextColor="#94A3B8" />
                <TextInput style={[styles.materialInput, { flex: 0.6 }]} placeholder="Qty" value={newMaterial.qty} onChangeText={v => setNewMaterial(p => ({...p, qty: v}))} keyboardType="numeric" placeholderTextColor="#94A3B8" />
                <TextInput style={[styles.materialInput, { flex: 0.8 }]} placeholder="$Cost" value={newMaterial.cost} onChangeText={v => setNewMaterial(p => ({...p, cost: v}))} keyboardType="decimal-pad" placeholderTextColor="#94A3B8" />
                <TouchableOpacity style={styles.addMaterialBtn} onPress={handleAddMaterial}>
                  <Ionicons name="add" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        {job.status !== 'completed' && job.status !== 'cancelled' && (
          <View style={{ flexDirection: 'row', gap: 8, marginHorizontal: 16, marginBottom: 12 }}>
            {job.customer_email && (job.status === 'travelling' || job.status === 'on_site' || job.status === 'in_progress') ? (
              <TouchableOpacity onPress={handleSendETA}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                <Ionicons name="time-outline" size={16} color="#0066FF" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#0066FF' }}>Send ETA</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity onPress={() => setShowReschedule(true)}
              style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
              <Ionicons name="calendar-outline" size={16} color="#0066FF" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0066FF' }}>Reschedule</Text>
            </TouchableOpacity>
            {['accepted','travelling','on_site','in_progress'].includes(job.status) ? (
              <TouchableOpacity onPress={handleRevertStatus}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#FEE2E2' }}>
                <Ionicons name="arrow-undo-outline" size={16} color="#EF4444" />
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#EF4444' }}>Revert</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Activity Feed */}
        <View style={{ backgroundColor: '#fff', borderRadius: 14, margin: 16, padding: 16 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>Activity Feed</Text>
            <TouchableOpacity onPress={() => setShowNoteInput(!showNoteInput)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}>
              <Ionicons name="add" size={16} color="#0066FF" />
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#0066FF' }}>Add Note</Text>
            </TouchableOpacity>
          </View>
          {showNoteInput && (
            <View style={{ marginBottom: 12 }}>
              <TextInput
                style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 14, color: '#1E293B', minHeight: 80, textAlignVertical: 'top', marginBottom: 8 }}
                placeholder="Write a note..."
                placeholderTextColor="#94A3B8"
                value={newNote}
                onChangeText={setNewNote}
                multiline
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => { setShowNoteInput(false); setNewNote(''); }}
                  style={{ flex: 1, padding: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontWeight: '600' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleAddNote} disabled={addingNote}
                  style={{ flex: 2, padding: 10, borderRadius: 10, backgroundColor: '#0066FF', alignItems: 'center' }}>
                  {addingNote ? <ActivityIndicator color="#fff" size="small" /> :
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Save Note</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
          {activity.length === 0 ? (
            <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', paddingVertical: 12 }}>No activity yet</Text>
          ) : (
            activity.map((a, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: '#F1F5F9' }}>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: (ACTIVITY_STYLES[a.action] || DEFAULT_ACTIVITY_STYLE).bg, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={(ACTIVITY_STYLES[a.action] || DEFAULT_ACTIVITY_STYLE).icon as any} size={16} color={(ACTIVITY_STYLES[a.action] || DEFAULT_ACTIVITY_STYLE).color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 2 }}>
                    {a.user_id === user?.id ? 'You' : actorNames[a.user_id] || 'Team member'}
                  </Text>
                  {a.action === 'photo_added' ? (() => {
                    let photoUrl = a.photo_url;
                    if (!photoUrl) {
                      try { const parsed = JSON.parse(a.details || ''); photoUrl = parsed.url; } catch {}
                    }
                    return photoUrl ? (
                      <TouchableOpacity onPress={() => setSelectedPhoto(photoUrl)}>
                        <Image source={{ uri: photoUrl }} style={{ width: 120, height: 90, borderRadius: 10, marginBottom: 4 }} />
                        <Text style={{ fontSize: 11, color: '#94A3B8' }}>Tap to view</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={{ fontSize: 13, color: '#1E293B' }}>{a.details}</Text>
                    );
                  })() : (
                    <Text style={{ fontSize: 13, color: '#1E293B' }}>{a.details}</Text>
                  )}
                  <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>{new Date(a.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={{ height: 170 }} />
      </ScrollView>

      {photoModal}
      <RescheduleSheet visible={showReschedule} currentDate={job.date} onClose={() => setShowReschedule(false)} onSave={handleReschedule} />

      {/* Bottom Action */}
      <View style={styles.bottomBar}>
        {(job.status === 'new' || job.status === 'scheduled' || job.status === 'pending') && (
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#14B8A6' }]} onPress={handleAccept}>
            <Ionicons name="checkmark-outline" size={20} color="#fff"/>
            <Text style={styles.startBtnText}>Accept Job</Text>
          </TouchableOpacity>
        )}
        {job.status === 'accepted' && (
          <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
            <Ionicons name="car-outline" size={20} color="#fff"/>
            <Text style={styles.startBtnText}>Start Travel</Text>
          </TouchableOpacity>
        )}
        {job.status === 'travelling' && (
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#EF4444' }]} onPress={handleOnSite}>
            <Ionicons name="location-outline" size={20} color="#fff"/>
            <Text style={styles.startBtnText}>Arrived On Site</Text>
          </TouchableOpacity>
        )}
        {job.status === 'on_site' && (
          <TouchableOpacity style={[styles.startBtn, { backgroundColor: '#0066FF' }]} onPress={handleStartWork}>
            <Ionicons name="construct-outline" size={20} color="#fff"/>
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
          <View style={{ gap: 10 }}>
            <View style={styles.completedBar}>
              <Ionicons name="checkmark-circle" size={24} color="#10B981"/>
              <Text style={styles.completedText}>Job Completed</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={handleViewReport} disabled={!!reportBusy}
                style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#0066FF', opacity: reportBusy ? 0.6 : 1 }}>
                {reportBusy === 'view' ? <ActivityIndicator color="#0066FF" size="small" /> : <Ionicons name="document-text-outline" size={18} color="#0066FF" />}
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0066FF' }}>View Report</Text>
              </TouchableOpacity>
              {!!job.customer_email && (
                <TouchableOpacity onPress={handleSendReport} disabled={!!reportBusy}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 13, borderRadius: 12, backgroundColor: '#0066FF', opacity: reportBusy ? 0.6 : 1 }}>
                  {reportBusy === 'send' ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="mail-outline" size={18} color="#fff" />}
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>{job.report_sent_at ? 'Resend Report' : 'Send Report'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </View>

      {/* Complete Modal */}
      <Modal visible={showCompleteModal} transparent animationType="slide" onRequestClose={() => setShowCompleteModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <TouchableOpacity style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' }} activeOpacity={1} onPress={() => setShowCompleteModal(false)} />
          <View style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 40 }}>
            <Text style={styles.modalTitle}>Complete Job</Text>
            <Text style={styles.modalSub}>Answer what you can below, then add the customer's name</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 320, marginTop: 12 }} showsVerticalScrollIndicator={false}>
              {CLOSING_QUESTIONS.map(q => (
                <View key={q.key} style={{ marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 6 }}>{q.question}</Text>
                  <TextInput
                    style={{ borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, fontSize: 14, color: '#1E293B', minHeight: 68, textAlignVertical: 'top' }}
                    placeholder={q.placeholder}
                    placeholderTextColor="#94A3B8"
                    value={closingAnswers[q.key]}
                    onChangeText={v => setClosingAnswers(prev => ({ ...prev, [q.key]: v }))}
                    multiline
                    scrollEnabled={false}
                  />
                </View>
              ))}
            </ScrollView>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 16 }}>CUSTOMER NAME (OPTIONAL)</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, padding: 12, fontSize: 15, marginBottom: 16, color: '#1E293B' }}
              placeholder="Customer name confirms job completion"
              placeholderTextColor="#94A3B8"
              value={signerName}
              onChangeText={setSignerName}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCompleteModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, completing && { opacity: 0.6 }]} onPress={confirmComplete} disabled={completing}>
                {completing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.modalConfirmText}>Complete Job</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
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
  timerBar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EFF6FF', padding: 14, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#BFDBFE' },
  timerText: { fontSize: 22, fontWeight: '900', color: '#0066FF', fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 12, color: '#1E40AF', flex: 1 },
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

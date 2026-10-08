import { useEffect, useState } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { toLocalDateStr } from '../lib/formatters';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** The date as shown in the job's activity, e.g. "Mon, 12 Oct 2026" */
export function formatRescheduleDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

type Props = {
  visible: boolean;
  /** The job's current date (YYYY-MM-DD), shown selected when the sheet opens */
  currentDate?: string | null;
  onClose: () => void;
  /** Saves the new date. Resolves true when saved, so the sheet can close. */
  onSave: (date: string, reason: string) => Promise<boolean>;
};

/** Bottom sheet to move a job to another day: a month calendar plus a reason. */
export function RescheduleSheet({ visible, currentDate, onClose, onSave }: Props) {
  const today = toLocalDateStr();
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(() => new Date());
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    const start = currentDate && currentDate >= today ? currentDate : today;
    setSelected(start);
    setMonth(new Date(start + 'T00:00:00'));
    setReason('');
  }, [visible]);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  // Monday-first grid: blanks before the 1st, then the days
  const leadingBlanks = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const canGoBack = new Date(year, monthIndex, 1) > new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    const ok = await onSave(selected, reason.trim());
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>Reschedule Job</Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}><Ionicons name="close" size={24} color="#64748B" /></TouchableOpacity>
            </View>

            <View style={styles.monthRow}>
              <TouchableOpacity disabled={!canGoBack} onPress={() => setMonth(new Date(year, monthIndex - 1, 1))} hitSlop={10}>
                <Ionicons name="chevron-back" size={22} color={canGoBack ? '#0066FF' : '#CBD5E1'} />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>{month.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })}</Text>
              <TouchableOpacity onPress={() => setMonth(new Date(year, monthIndex + 1, 1))} hitSlop={10}>
                <Ionicons name="chevron-forward" size={22} color="#0066FF" />
              </TouchableOpacity>
            </View>

            <View style={styles.grid}>
              {WEEKDAYS.map(d => <Text key={d} style={styles.weekday}>{d}</Text>)}
              {cells.map((day, i) => {
                if (!day) return <View key={`b${i}`} style={styles.cell} />;
                const dateStr = toLocalDateStr(new Date(year, monthIndex, day));
                const past = dateStr < today;
                const isSelected = dateStr === selected;
                return (
                  <TouchableOpacity key={dateStr} style={styles.cell} disabled={past} onPress={() => setSelected(dateStr)}>
                    <View style={[styles.day, isSelected && styles.daySelected]}>
                      <Text style={[styles.dayText, past && styles.dayPast, isSelected && styles.dayTextSelected]}>{day}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.selectedLabel}>New date: {formatRescheduleDate(selected)}</Text>

            <Text style={styles.label}>Reason / notes</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Customer asked to move it, waiting on parts"
              placeholderTextColor="#94A3B8"
              value={reason}
              onChangeText={setReason}
              multiline
              maxLength={300}
            />

            <TouchableOpacity style={[styles.saveBtn, (saving || selected === currentDate) && { opacity: 0.5 }]} onPress={handleSave} disabled={saving || selected === currentDate}>
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Reschedule</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginBottom: 8 },
  monthLabel: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#94A3B8', marginBottom: 4 },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 2 },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  daySelected: { backgroundColor: '#0066FF' },
  dayText: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  dayPast: { color: '#CBD5E1' },
  dayTextSelected: { color: '#fff' },
  selectedLabel: { fontSize: 14, fontWeight: '700', color: '#0066FF', marginTop: 10, marginBottom: 12 },
  label: { fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12, padding: 12, minHeight: 64, fontSize: 14, color: '#1E293B', textAlignVertical: 'top', marginBottom: 14 },
  saveBtn: { backgroundColor: '#0066FF', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  saveText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});

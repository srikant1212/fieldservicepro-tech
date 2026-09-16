import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { haptic } from '../../lib/haptics';

export default function Chat() {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatRef = useRef<FlatList>(null);

  useFocusEffect(useCallback(() => {
    fetchMessages();
    const sub = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'tech_messages', filter: `organization_id=eq.${user?.organization_id}` },
        payload => { setMessages(prev => [...prev, payload.new]); setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100); })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [user?.id]));

  const fetchMessages = async () => {
    if (!user?.organization_id) return;
    const { data } = await supabase.from('tech_messages').select('*')
      .eq('organization_id', user.organization_id)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id},recipient_id.is.null`)
      .order('created_at', { ascending: true })
      .limit(100);
    setMessages(data || []);
    setLoading(false);
    setTimeout(() => flatRef.current?.scrollToEnd({ animated: false }), 100);
  };

  const handleSend = async () => {
    if (!text.trim() || !user?.id) return;
    setSending(true);
    haptic.light();
    const msg = {
      organization_id: user.organization_id,
      sender_id: user.id,
      sender_name: user.display_name || 'Tech',
      sender_role: 'technician',
      content: text.trim(),
    };
    const { error } = await supabase.from('tech_messages').insert(msg as any);
    if (!error) setText('');
    setSending(false);
  };

  const isMe = (msg: any) => msg.sender_id === user?.id;

  if (loading) return <View style={s.loading}><ActivityIndicator color="#0066FF" size="large" /></View>;

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={90}>
      <View style={s.header}>
        <View style={s.headerAvatar}><Ionicons name="business-outline" size={20} color="#0066FF" /></View>
        <View>
          <Text style={s.headerTitle}>Admin Chat</Text>
          <Text style={s.headerSub}>Message your admin team</Text>
        </View>
      </View>

      <FlatList ref={flatRef} data={messages} keyExtractor={m => m.id}
        contentContainerStyle={{ padding: 16, gap: 8 }}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="chatbubbles-outline" size={48} color="#CBD5E1" />
            <Text style={s.emptyText}>No messages yet{'\n'}Send a message to your admin</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[s.msgRow, isMe(item) && s.msgRowMe]}>
            {!isMe(item) && (
              <View style={s.avatar}><Text style={s.avatarText}>{(item.sender_name||'A')[0]}</Text></View>
            )}
            <View style={[s.bubble, isMe(item) ? s.bubbleMe : s.bubbleThem]}>
              {!isMe(item) && <Text style={s.senderName}>{item.sender_name}</Text>}
              <Text style={[s.msgText, isMe(item) && s.msgTextMe]}>{item.content}</Text>
              <Text style={[s.msgTime, isMe(item) && { color: 'rgba(255,255,255,0.6)' }]}>
                {new Date(item.created_at).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </View>
        )}
      />

      <View style={s.inputRow}>
        <TextInput style={s.input} placeholder="Message admin..." placeholderTextColor="#94A3B8"
          value={text} onChangeText={setText} multiline maxLength={500}
          onSubmitEditing={handleSend} returnKeyType="send" />
        <TouchableOpacity style={[s.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
          onPress={handleSend} disabled={!text.trim() || sending}>
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, paddingTop: 60, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  headerSub: { fontSize: 12, color: '#94A3B8' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 12, marginTop: 80 },
  emptyText: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  msgRowMe: { flexDirection: 'row-reverse' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: '#fff' },
  bubble: { maxWidth: '75%', padding: 12, borderRadius: 18, gap: 2 },
  bubbleMe: { backgroundColor: '#0066FF', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#fff', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  senderName: { fontSize: 10, fontWeight: '700', color: '#0066FF', marginBottom: 2 },
  msgText: { fontSize: 14, color: '#1E293B', lineHeight: 20 },
  msgTextMe: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#94A3B8', alignSelf: 'flex-end' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#E2E8F0', paddingBottom: Platform.OS === 'ios' ? 28 : 12 },
  input: { flex: 1, borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 15, color: '#1E293B', maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0066FF', justifyContent: 'center', alignItems: 'center' },
});

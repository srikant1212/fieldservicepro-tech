import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeHeaderTop } from '../lib/useSafeHeaderTop';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  /** Shows a back arrow when given */
  onBack?: () => void;
  /** Use a close (X) icon instead of the back arrow, for modal-style screens */
  closeIcon?: boolean;
  /** Buttons or icons shown on the right */
  right?: ReactNode;
}

// The white screen header: safe-area top padding, optional back button, title, optional right-side actions
export function AppHeader({ title, subtitle, onBack, closeIcon, right }: AppHeaderProps) {
  const headerTop = useSafeHeaderTop();
  return (
    <View style={[styles.header, { paddingTop: headerTop }]}>
      {onBack ? (
        <TouchableOpacity onPress={onBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name={closeIcon ? 'close' : 'arrow-back'} size={22} color={'#1E293B'} />
        </TouchableOpacity>
      ) : null}
      <View style={styles.titleWrap}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  backBtn: { padding: 4 },
  titleWrap: { flex: 1 },
  title: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  right: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

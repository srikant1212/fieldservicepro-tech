import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface NotificationState {
  /** Unread rows in the signed-in user's notification inbox */
  unread: number;
  refreshUnread: (userId?: string) => Promise<void>;
}

// Shared so the tab badge, the bell on the home screen and the inbox itself always agree
export const useNotificationStore = create<NotificationState>((set) => ({
  unread: 0,
  refreshUnread: async (userId) => {
    if (!userId) { set({ unread: 0 }); return; }
    const { count, error } = await supabase.from('notifications')
      .select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
    if (!error) set({ unread: count || 0 });
  },
}));

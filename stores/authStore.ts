import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  display_name: string;
  organization_id?: string;
  role?: string;
  avatar_url?: string;
  phone?: string;
  skills?: string[];
  bio?: string;
  vehicle_type?: string;
  license_number?: string;
  abn?: string;
  employment_type?: string;
  can_collect_payment?: boolean;
  can_send_invoice?: boolean;
  can_view_financials?: boolean;
}

interface AuthState {
  session: any;
  user: User | null;
  loading: boolean;
  initialize: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  loading: true,

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .maybeSingle();

        set({
          session,
          user: {
            id: session.user.id,
            email: session.user.email || '',
            display_name: profile?.display_name || '',
            organization_id: profile?.organization_id,
            role: roleData?.role || 'technician',
            avatar_url: profile?.avatar_url,
            phone: profile?.phone,
            skills: profile?.skills || [],
            bio: profile?.bio || '',
            vehicle_type: profile?.vehicle_type || '',
            license_number: profile?.license_number || '',
            abn: profile?.abn || '',
            employment_type: profile?.employment_type || 'employee',
            can_collect_payment: profile?.can_collect_payment || false,
            can_send_invoice: profile?.can_send_invoice || false,
            can_view_financials: profile?.can_view_financials || false,
          },
          loading: false,
        });
      } else {
        set({ loading: false });
      }
    } catch (e) {
      console.error('Initialize error:', e);
      set({ loading: false });
    }

    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        set({ session: null, user: null });
      } else if (session?.user) {
        await get().refreshUser();
      }
    });
  },

  refreshUser: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', session.user.id).single();
    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', session.user.id).maybeSingle();
    const user = {
      id: session.user.id,
      email: session.user.email || '',
      display_name: profile?.display_name || '',
      organization_id: profile?.organization_id,
      role: roleData?.role || 'technician',
      avatar_url: profile?.avatar_url,
      phone: profile?.phone,
      skills: profile?.skills || [],
      bio: profile?.bio || '',
      vehicle_type: profile?.vehicle_type || '',
      license_number: profile?.license_number || '',
      abn: profile?.abn || '',
      employment_type: profile?.employment_type || 'employee',
      can_collect_payment: profile?.can_collect_payment || false,
      can_send_invoice: profile?.can_send_invoice || false,
      can_view_financials: profile?.can_view_financials || false,
    };
    // This also runs in the background whenever the session is re-announced or refreshed. Keep the
    // same object when nothing changed, so screens that fill a form from the user (Edit Profile)
    // do not reset what is being typed.
    const prev = get().user;
    set({ session, user: prev && JSON.stringify(prev) === JSON.stringify(user) ? prev : user });
  },

  signOut: async () => {
    // Clear this device's push token first (needs the session), so a signed-out phone stops getting notifications.
    // Never let a failure here block signing out.
    const userId = get().user?.id;
    if (userId) {
      try {
        const { unregisterPushNotifications } = await import('../lib/notifications');
        await unregisterPushNotifications(userId);
      } catch {}
    }
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));

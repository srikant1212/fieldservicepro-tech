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
        employment_type: profile?.employment_type || 'employee',
        can_collect_payment: profile?.can_collect_payment || false,
        can_send_invoice: profile?.can_send_invoice || false,
        can_view_financials: profile?.can_view_financials || false,
      },
    });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));

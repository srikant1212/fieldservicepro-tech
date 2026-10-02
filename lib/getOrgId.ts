import { supabase } from './supabase';

export async function getOrgId(user: any): Promise<string | null> {
  if (user?.organization_id) return user.organization_id;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;
    const { data: p } = await supabase.from('profiles').select('organization_id').eq('id', session.user.id).single();
    return p?.organization_id || null;
  } catch { return null; }
}

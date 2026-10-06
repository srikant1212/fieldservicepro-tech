import { supabase } from './supabase';
import { getOrgId } from './getOrgId';

const UNDEFINED_COLUMN = '42703';

// Update a job; if an optional column isn't in the DB yet, retry with only the required fields
export async function updateJob(jobId: string, required: Record<string, any>, optional: Record<string, any> = {}) {
  const { error } = await supabase.from('jobs').update({ ...required, ...optional } as any).eq('id', jobId);
  if (error?.code === UNDEFINED_COLUMN && Object.keys(optional).length) {
    return supabase.from('jobs').update(required as any).eq('id', jobId);
  }
  return { error };
}

export async function startJob(jobId: string, userId?: string) {
  const startedAt = new Date().toISOString();
  const { error } = await updateJob(jobId, { status: 'in_progress' }, { started_at: startedAt });
  if (!error) {
    await supabase.from('job_activity_log').insert({
      job_id: jobId, user_id: userId, action: 'started', details: 'Job started by technician'
    });
  }
  return { error, startedAt };
}

// Email + SMS the customer that the technician is on the way
export function notifyOnTheWay(job: any, user: any) {
  supabase.functions.invoke('send-notification-email', {
    body: { type: 'technician_on_the_way', job_id: job.id }
  }).catch(() => {});
  if (job?.customer_phone) {
    getOrgId(user).then(orgId => {
      supabase.from('organizations').select('name, phone').eq('id', orgId || '').single().then(({ data: orgData }) => {
        const cn = (orgData as any)?.name || 'Field Service Pro';
        const cp = (orgData as any)?.phone || '';
        supabase.functions.invoke('send-sms', { body: { to: job.customer_phone, message: `Hi ${job.customer_name || 'Customer'}, your service provider is on the way to ${job.address || 'your location'}. Queries? Call ${cp} - via Field Service Pro for ${cn}`, organization_id: orgId, event_type: 'customer_on_the_way' } }).catch(() => {});
      });
    }).catch(() => {});
  }
}

import { Alert } from 'react-native';
import { supabase } from './supabase';

const SUPPORT = 'support@fieldservicepro.work';

// Edge function errors arrive as a generic "non-2xx" message; the real reason is in the response body
async function invoke(body: Record<string, any>) {
  const { data, error } = await supabase.functions.invoke('delete-account', { body });
  if (error) {
    let message = '';
    try { message = (await (error as any).context?.json?.())?.error || ''; } catch {}
    throw new Error(message || `Please try again, or email ${SUPPORT} and we will delete it for you.`);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

// Asks, then permanently deletes the signed-in account. `onDeleted` should sign the app out.
// `setBusy` lets the screen show progress while the server is working.
export async function confirmAndDeleteAccount(onDeleted: () => void | Promise<void>, setBusy: (busy: boolean) => void) {
  setBusy(true);
  let preview: { deletes_company?: boolean; other_members?: number };
  try {
    // Ask the server what deleting would remove, so the warning is accurate
    preview = await invoke({ action: 'preview' });
  } catch (e: any) {
    setBusy(false);
    Alert.alert('Could not delete account', e.message);
    return;
  }
  setBusy(false);

  const runDelete = async () => {
    setBusy(true);
    try {
      await invoke({ action: 'delete', confirm: 'DELETE' });
      await onDeleted();
      Alert.alert('Account deleted', 'Your account has been permanently deleted.');
    } catch (e: any) {
      Alert.alert('Could not delete account', e.message);
    } finally {
      setBusy(false);
    }
  };

  if (preview.deletes_company) {
    const others = preview.other_members || 0;
    Alert.alert(
      'Delete account and company?',
      `You are the only admin, so this permanently deletes your account AND your company: every job, quote, invoice and customer.${others ? ` Your ${others} team member${others === 1 ? '' : 's'} will lose access.` : ''} Any subscription is cancelled. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', style: 'destructive', onPress: () => {
          Alert.alert('Are you sure?', 'All company data will be deleted permanently.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete everything', style: 'destructive', onPress: runDelete },
          ]);
        }},
      ],
    );
  } else {
    Alert.alert(
      'Delete account?',
      'This permanently deletes your account and personal details. All your data will be deleted and you will be signed out. Jobs you worked on stay with your company. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Account', style: 'destructive', onPress: runDelete },
      ],
    );
  }
}

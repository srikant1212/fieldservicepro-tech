import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-url-polyfill/auto';

const supabaseUrl = 'https://ujocqktnovtlajntrtjk.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVqb2Nxa3Rub3Z0bGFqbnRydGprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MjYwNDcsImV4cCI6MjA5MDUwMjA0N30.ayjwCO7ol1sObUqdr1xE2d84KXgZETV3wXELKSp58k0';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
let client;

export function getSupabaseClient() {
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('VYBE authentication is not configured. Copy .env.example to .env.local and add your Supabase project URL and publishable key.');
  }

  if (client) return client;

  client = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  return client;
}

export async function signOutCurrentSession(supabase) {
  let signOutError;
  try {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    signOutError = error;
  } catch (error) {
    signOutError = error;
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (session) {
    throw signOutError || new Error('Your session is still active. Please try logging out again.');
  }

  return { warning: signOutError };
}

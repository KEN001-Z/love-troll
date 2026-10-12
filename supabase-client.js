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

function isRejectedSessionError(error) {
  return error?.status === 401 ||
    error?.code === 'bad_jwt' ||
    (error?.status === 400 &&
      /refresh token/i.test(error?.message || ''));
}

function getAuthStorageKey() {
  return `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`;
}

async function clearRejectedSession(supabase) {
  const sessionKey = getAuthStorageKey();
  window.localStorage.removeItem(sessionKey);
  window.localStorage.removeItem(`${sessionKey}-user`);

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session) throw new Error('We couldn’t clear the expired session. Please clear this site’s saved data and try again.');
}

export async function getAuthenticatedUser(supabase) {
  const hadStoredSession = Boolean(window.localStorage.getItem(getAuthStorageKey()));
  const { data: { user }, error } = await supabase.auth.getUser();
  if (!error) return { user, recovered: false };
  if (error?.name === 'AuthSessionMissingError') {
    return { user: null, recovered: hadStoredSession };
  }
  if (!isRejectedSessionError(error)) throw error;

  await clearRejectedSession(supabase);
  return { user: null, recovered: true };
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

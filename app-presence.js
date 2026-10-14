import { getSupabaseClient } from './src/js/supabase/client.js';

const PRESENCE_TOPIC = 'community:presence';
const OFFLINE_GRACE_MS = 5000;
const subscribers = new Set();
const onlineMembers = new Map();
const offlineTimers = new Map();

let supabase;
let channel;
let userId;
let lastConnectionError;

function getMembers(state) {
  const members = new Map();
  Object.values(state).flat().forEach(member => {
    if (member.user_id && !members.has(member.user_id)) members.set(member.user_id, member);
  });
  return members;
}

function notifySubscribers() {
  const members = [...onlineMembers.values()];
  subscribers.forEach(({ listener }) => listener(members));
}

function reportError(error) {
  console.error('VYBE app-wide presence could not be updated.', error);
  subscribers.forEach(({ onError }) => onError?.(error));
}

function clearOfflineTimer(id) {
  const timer = offlineTimers.get(id);
  if (timer) window.clearTimeout(timer);
  offlineTimers.delete(id);
}

function updatePresence(state) {
  const members = getMembers(state);
  members.forEach((member, id) => {
    clearOfflineTimer(id);
    onlineMembers.set(id, member);
  });

  onlineMembers.forEach((_, id) => {
    if (members.has(id) || offlineTimers.has(id)) return;
    offlineTimers.set(id, window.setTimeout(() => {
      offlineTimers.delete(id);
      if (!channel || getMembers(channel.presenceState()).has(id)) return;
      onlineMembers.delete(id);
      notifySubscribers();
    }, OFFLINE_GRACE_MS));
  });

  notifySubscribers();
}

function clearPresence() {
  offlineTimers.forEach(timer => window.clearTimeout(timer));
  offlineTimers.clear();
  onlineMembers.clear();
  notifySubscribers();
}

export function startAppPresence(client, user) {
  if (channel && supabase === client && userId === user.id) return;
  stopAppPresence();

  supabase = client;
  userId = user.id;
  const displayName = user.user_metadata?.display_name || user.email?.split('@')[0] || 'VYBE member';
  const activeChannel = client.channel(PRESENCE_TOPIC, {
    config: { private: true, presence: { key: user.id } }
  });
  channel = activeChannel;

  activeChannel
    .on('presence', { event: 'sync' }, () => updatePresence(activeChannel.presenceState()))
    .on('presence', { event: 'join' }, () => updatePresence(activeChannel.presenceState()))
    .on('presence', { event: 'leave' }, () => updatePresence(activeChannel.presenceState()))
    .subscribe(async (status, error) => {
      if (channel !== activeChannel) return;
      if (status === 'SUBSCRIBED') {
        lastConnectionError = null;
        try {
          const result = await activeChannel.track({
            user_id: user.id,
            display_name: displayName,
            online_at: new Date().toISOString()
          });
          if (result !== 'ok') throw new Error(`Presence tracking returned ${result}.`);
        } catch (trackError) {
          reportError(trackError);
        }
        return;
      }

      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status) && lastConnectionError !== status) {
        lastConnectionError = status;
        reportError(error || new Error(`Presence connection ${status.toLowerCase()}.`));
      }
    });
}

export function stopAppPresence() {
  const activeChannel = channel;
  channel = null;
  userId = null;
  clearPresence();
  if (!activeChannel || !supabase) return;

  supabase.removeChannel(activeChannel).then(status => {
    if (status !== 'ok' && status !== 'timed out') {
      reportError(new Error(`Presence channel cleanup returned ${status}.`));
    }
  }).catch(reportError);
}

export function subscribeToAppPresence(listener, onError) {
  const subscriber = { listener, onError };
  subscribers.add(subscriber);
  listener([...onlineMembers.values()]);
  return () => subscribers.delete(subscriber);
}

try {
  supabase = getSupabaseClient();
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      startAppPresence(supabase, session.user);
    } else {
      stopAppPresence();
    }
  });
} catch (error) {
  console.error('VYBE app-wide presence could not start.', error);
}

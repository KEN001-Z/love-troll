import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const status = $('[data-messages-status]');
const conversationList = $('[data-conversations]');
const conversationState = $('[data-conversation-state]');
const conversationCount = $('[data-conversation-count]');
const chatTitle = $('[data-direct-title]');
const chatSubtitle = $('[data-direct-subtitle]');
const chatAvatar = $('[data-direct-avatar]');
const chatPresence = $('[data-direct-presence]');
const history = $('[data-direct-history]');
const messageList = $('[data-direct-messages]');
const empty = $('[data-direct-empty]');
const emptyTitle = $('[data-direct-empty-title]');
const emptyCopy = $('[data-direct-empty-copy]');
const moreButton = $('[data-direct-more]');
const form = $('[data-direct-form]');
const input = $('[name="message"]', form);
const sendButton = $('[type="submit"]', form);
const count = $('[data-direct-count]');
const composerStatus = $('[data-direct-composer-status]');
const mediaFooter = $('.direct-composer-footer');
const mediaInput = document.createElement('input');
mediaInput.type = 'file'; mediaInput.className = 'visually-hidden'; mediaInput.accept = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime'; mediaInput.disabled = true;
const mediaTrigger = document.createElement('button');
mediaTrigger.type = 'button'; mediaTrigger.className = 'direct-media-button'; mediaTrigger.disabled = true; mediaTrigger.innerHTML = '<span aria-hidden="true">＋</span> Media';
mediaFooter.prepend(mediaInput, mediaTrigger);

let supabase;
let currentUser;
let currentConversation;
let channel;
let presenceChannel;
let messages = new Map();
let cursor = null;
let hasOlder = false;
let sending = false;
const loadingConversationIds = new Set();
const onlineUserIds = new Set();
let selectionVersion = 0;
const avatarUrls = new Map();
const mediaUrls = new Map();
let selectedMedia = null;
let composerResizeFrame = 0;

function setStatus(message, state = '') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function setComposer(message, state = '') {
  composerStatus.textContent = message;
  composerStatus.dataset.state = state;
}

function setPresenceIndicator(element, isOnline) {
  element.dataset.status = isOnline ? 'online' : 'offline';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', isOnline ? 'Online' : 'Offline');
  element.title = isOnline ? 'Online' : 'Offline';
}

function initials(name) {
  return (name || 'VYBE member').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'V';
}

function formatTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

async function signAvatars(rows) {
  const paths = [...new Set(rows.map(row => row.other_avatar_path || row.author_avatar_path).filter(Boolean))];
  const missing = paths.filter(path => !avatarUrls.has(path));
  if (!missing.length) return;
  const { data } = await supabase.storage.from('profile-media').createSignedUrls(missing, 3600);
  (data || []).forEach(result => { if (result.path && result.signedUrl) avatarUrls.set(result.path, result.signedUrl); });
}

async function signMedia(rows) {
  const paths = [...new Set(rows.map(row => row.media_path).filter(Boolean))];
  const missing = paths.filter(path => !mediaUrls.has(path));
  if (!missing.length) return;
  const { data } = await supabase.storage.from('direct-media').createSignedUrls(missing, 3600);
  (data || []).forEach(result => { if (result.path && result.signedUrl) mediaUrls.set(result.path, result.signedUrl); });
}

function validateMedia(file) {
  if (!file) return null;
  const isImage = file.type.startsWith('image/'); const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('Choose an image or video clip.');
  const limit = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > limit) throw new Error(`${isImage ? 'Images' : 'Clips'} must be ${isImage ? '10MB' : '50MB'} or smaller.`);
  return { file, kind: isImage ? 'image' : 'video' };
}

function setAvatar(element, name, path) {
  element.replaceChildren();
  element.textContent = initials(name);
  const url = path && avatarUrls.get(path);
  if (url) {
    const image = document.createElement('img');
    image.src = url; image.alt = ''; image.loading = 'lazy';
    image.addEventListener('load', () => { element.classList.add('has-image'); }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    element.append(image);
  }
}

function renderConversations(rows) {
  conversationList.replaceChildren();
  conversationCount.textContent = String(rows.length);
  if (!rows.length) {
    conversationState.textContent = 'Mutual connections appear here when you start a private chat.';
    return;
  }
  conversationState.textContent = '';
  rows.forEach(row => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'conversation-option'; button.dataset.conversationId = row.conversation_id;
    if (currentConversation?.id === row.conversation_id) button.classList.add('is-active');
    const avatar = document.createElement('span'); avatar.className = 'direct-avatar'; setAvatar(avatar, row.other_display_name, row.other_avatar_path);
    const copy = document.createElement('span'); copy.className = 'conversation-copy';
    const name = document.createElement('strong'); name.className = 'conversation-name';
    const nameText = document.createElement('span'); nameText.textContent = row.other_display_name || 'VYBE member';
    const presence = document.createElement('span'); presence.className = 'presence-indicator'; setPresenceIndicator(presence, onlineUserIds.has(row.other_user_id));
    name.append(nameText, presence);
    const preview = document.createElement('small'); preview.textContent = row.last_message || 'Start the conversation';
    copy.append(name, preview); button.append(avatar, copy);
    if (row.unread_count) { const unread = document.createElement('b'); unread.className = 'conversation-unread'; unread.textContent = row.unread_count > 9 ? '9+' : String(row.unread_count); button.append(unread); }
    item.append(button); conversationList.append(item);
  });
}

function updateCurrentPresence() {
  if (!currentConversation) return;
  const isOnline = onlineUserIds.has(currentConversation.other_user_id);
  setPresenceIndicator(chatPresence, isOnline);
  chatSubtitle.textContent = `${isOnline ? 'Online' : 'Offline'} · Mutual connection · private chat`;
}

function renderPresence(state) {
  onlineUserIds.clear();
  Object.values(state).flat().forEach(member => {
    if (member.user_id) onlineUserIds.add(member.user_id);
  });
  renderConversations(conversationRows);
  updateCurrentPresence();
}

function renderMessages({ preserve = false } = {}) {
  const previousHeight = history.scrollHeight;
  const nearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 100;
  const ordered = [...messages.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  messageList.replaceChildren(...ordered.map((message, index) => {
    const item = document.createElement('li');
    const own = message.author_id === currentUser.id;
    const same = ordered[index - 1]?.author_id === message.author_id;
    item.className = `direct-message${own ? ' is-own' : ''}${same ? ' is-grouped' : ''}`;
    const avatar = document.createElement('span'); avatar.className = `direct-avatar${same ? ' avatar-spacer' : ''}`;
    if (!same) setAvatar(avatar, message.author_display_name, message.author_avatar_path);
    const body = document.createElement('div'); body.className = 'direct-message-body';
    if (!same) { const author = document.createElement('a'); author.href = `profile.html?id=${encodeURIComponent(message.author_id)}`; author.textContent = message.author_display_name || 'VYBE member'; author.className = 'direct-author'; body.append(author); }
    const content = document.createElement('p'); content.textContent = message.content;
    body.append(content);
    const mediaUrl = message.media_path && mediaUrls.get(message.media_path);
    if (mediaUrl && message.media_kind === 'image') { const image = document.createElement('img'); image.className = 'direct-media-image'; image.src = mediaUrl; image.alt = 'Attached image'; image.loading = 'lazy'; body.append(image); }
    if (mediaUrl && message.media_kind === 'video') { const video = document.createElement('video'); video.className = 'direct-media-video'; video.src = mediaUrl; video.controls = true; video.preload = 'metadata'; video.setAttribute('aria-label', 'Attached video clip'); body.append(video); }
    const time = document.createElement('time'); time.dateTime = message.created_at; time.textContent = formatTime(message.created_at);
    body.append(time); item.append(avatar, body); return item;
  }));
  empty.hidden = messages.size > 0;
  moreButton.hidden = !hasOlder;
  if (!preserve || nearBottom) history.scrollTop = history.scrollHeight;
  else history.scrollTop += history.scrollHeight - previousHeight;
}

async function loadMessages({ reset = false } = {}) {
  if (!currentConversation) return;
  const conversationId = currentConversation.id;
  if (loadingConversationIds.has(conversationId)) return;
  loadingConversationIds.add(conversationId);
  if (reset) { messages = new Map(); cursor = null; hasOlder = false; renderMessages(); }
  try {
    const { data, error } = await supabase.rpc('get_direct_messages', { p_conversation_id: conversationId, p_before_created_at: cursor?.created_at || null, p_before_id: cursor?.id || null, p_limit: 50 });
    if (error) throw error;
    if (currentConversation?.id !== conversationId) return;
    await signAvatars(data || []); await signMedia(data || []);
    if (currentConversation?.id !== conversationId) return;
    (data || []).forEach(message => messages.set(message.id, message));
    if (data?.length) cursor = { created_at: data[data.length - 1].created_at, id: data[data.length - 1].id };
    hasOlder = (data || []).length === 50;
    renderMessages({ preserve: !reset });
    const { error: readError } = await supabase.rpc('mark_direct_conversation_read', { p_conversation_id: conversationId });
    if (readError && currentConversation?.id === conversationId) setComposer(`Messages loaded, but read status could not be updated: ${readError.message}`, 'error');
  } catch (error) {
    if (currentConversation?.id === conversationId) setComposer(error.message || 'We couldn’t load this conversation.', 'error');
  } finally { loadingConversationIds.delete(conversationId); }
}

async function loadSingleMessage(messageId) {
  const conversationId = currentConversation?.id;
  if (!conversationId) return;
  const { data, error } = await supabase.rpc('get_direct_message', { p_message_id: messageId });
  if (error) throw error;
  const message = Array.isArray(data) ? data[0] : data;
  if (!message || message.conversation_id !== conversationId || currentConversation?.id !== conversationId) return;
  await signAvatars([message]); await signMedia([message]);
  if (currentConversation?.id !== conversationId) return;
  const wasNearBottom = history.scrollHeight - history.scrollTop - history.clientHeight < 100;
  messages.set(message.id, message); renderMessages({ preserve: true });
  if (wasNearBottom) history.scrollTop = history.scrollHeight;
}

async function subscribe(conversationId, version) {
  if (channel) {
    const oldChannel = channel;
    channel = null;
    await supabase.removeChannel(oldChannel);
  }
  if (currentConversation?.id !== conversationId || version !== selectionVersion) return;
  channel = supabase.channel(`direct:conversation:${currentConversation.id}`, { config: { private: true } })
    .on('broadcast', { event: 'message_created' }, ({ payload }) => {
      if (payload?.message_id) loadSingleMessage(payload.message_id).catch(error => setComposer(error.message || 'A new message could not be loaded.', 'error'));
    })
    .subscribe(state => { if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') setComposer('Private chat connection interrupted. We’ll catch up when it returns.', 'error'); });
}

async function selectConversation(row) {
  const version = ++selectionVersion;
  currentConversation = { ...row, id: row.conversation_id };
  chatTitle.textContent = row.other_display_name || 'VYBE member';
  chatSubtitle.textContent = 'Offline · Mutual connection · private chat';
  setAvatar(chatAvatar, row.other_display_name, row.other_avatar_path);
  input.value = ''; input.disabled = false; mediaInput.disabled = false; mediaTrigger.disabled = false; selectedMedia = null; mediaInput.value = ''; mediaTrigger.innerHTML = '<span aria-hidden="true">＋</span> Media'; setComposer(''); resize(); updateSend();
  emptyTitle.textContent = `Say hi to ${row.other_display_name || 'your connection'}`; emptyCopy.textContent = 'A simple hello is a good place to start.';
  setPresenceIndicator(chatPresence, onlineUserIds.has(row.other_user_id));
  updateCurrentPresence();
  renderConversations(await getConversationRows());
  if (version !== selectionVersion) return;
  await loadMessages({ reset: true });
  if (version !== selectionVersion) return;
  await subscribe(currentConversation.id, version);
  if (version !== selectionVersion) return;
  window.history.replaceState({}, '', `messages.html?conversation=${encodeURIComponent(row.conversation_id)}`);
  input.focus();
}

let conversationRows = [];
async function getConversationRows() {
  const { data, error } = await supabase.rpc('get_direct_conversations');
  if (error) throw error;
  conversationRows = data || []; await signAvatars(conversationRows); renderConversations(conversationRows); return conversationRows;
}

function initializePresence() {
  const displayName = currentUser.user_metadata?.display_name || currentUser.email?.split('@')[0] || 'VYBE member';
  presenceChannel = supabase.channel('community:presence', { config: { private: true, presence: { key: currentUser.id } } });
  presenceChannel
    .on('presence', { event: 'sync' }, () => renderPresence(presenceChannel.presenceState()))
    .on('presence', { event: 'join' }, () => renderPresence(presenceChannel.presenceState()))
    .on('presence', { event: 'leave' }, () => renderPresence(presenceChannel.presenceState()))
    .subscribe(async state => {
      if (state !== 'SUBSCRIBED') return;
      const trackStatus = await presenceChannel.track({ user_id: currentUser.id, display_name: displayName, online_at: new Date().toISOString() });
      if (trackStatus !== 'ok') setStatus(`Online status could not be shared: ${trackStatus}`, 'error');
    });
}

async function sendMessage(event) {
  event.preventDefault(); const content = input.value.trim(); if (!content || sending || !currentConversation) return;
  sending = true; sendButton.disabled = true; input.disabled = true; mediaInput.disabled = true; mediaTrigger.disabled = true; setComposer('Sending…');
  let uploadedPath;
  try {
    let mediaFields = { p_media_path: null, p_media_mime: null, p_media_kind: 'none' };
    if (selectedMedia) {
      const safeName = selectedMedia.file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
      uploadedPath = `${currentUser.id}/${currentConversation.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('direct-media').upload(uploadedPath, selectedMedia.file, { contentType: selectedMedia.file.type, cacheControl: '3600', upsert: false });
      if (uploadError) throw uploadError;
      mediaFields = { p_media_path: uploadedPath, p_media_mime: selectedMedia.file.type, p_media_kind: selectedMedia.kind };
    }
    const { data, error } = await supabase.rpc('send_direct_message', { p_conversation_id: currentConversation.id, p_content: content, ...mediaFields });
    if (error) { if (uploadedPath) await supabase.storage.from('direct-media').remove([uploadedPath]); throw error; }
    input.value = ''; selectedMedia = null; mediaInput.value = ''; mediaTrigger.innerHTML = '<span aria-hidden="true">＋</span> Media'; resize(); updateSend(); setComposer('Message sent.', 'success'); if (data?.[0]?.id) await loadSingleMessage(data[0].id);
  } catch (error) { setComposer(error.message || 'Your message could not be sent.', 'error'); }
  finally { sending = false; input.disabled = false; mediaInput.disabled = false; mediaTrigger.disabled = false; updateSend(); input.focus(); }
}

function resize() {
  window.cancelAnimationFrame(composerResizeFrame);
  composerResizeFrame = window.requestAnimationFrame(() => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(Math.max(input.scrollHeight, 44), 140)}px`;
  });
}
function updateSend() { count.textContent = `${input.value.length} / 1000`; sendButton.disabled = !currentConversation || sending || !input.value.trim(); }

async function initialize() {
  try {
    supabase = getSupabaseClient(); const auth = await getAuthenticatedUser(supabase); if (!auth.user) { window.location.replace('login.html'); return; } currentUser = auth.user;
    initializePresence();
    await getConversationRows();
    const params = new URLSearchParams(window.location.search); const target = params.get('user');
    let requestedConversationId = params.get('conversation');
    if (target) {
      const { data, error } = await supabase.rpc('start_direct_conversation', { p_target_user: target });
      if (error) throw error;
      requestedConversationId = data;
      window.history.replaceState({}, '', `messages.html?conversation=${encodeURIComponent(data)}`);
      await getConversationRows();
    }
    const selected = conversationRows.find(row => row.conversation_id === requestedConversationId);
    if (selected) await selectConversation(selected);
    setStatus('');
  } catch (error) {
    const missingRpc = ['PGRST202', 'PGRST205'].includes(error.code);
    setStatus(missingRpc ? 'Private messaging is not enabled in Supabase yet. Apply the direct-message migration from SUPABASE_SETUP.md and try again.' : error.message || 'Private messages are not available yet.', 'error');
  }
  conversationList.addEventListener('click', event => { const button = event.target.closest('[data-conversation-id]'); const row = conversationRows.find(item => item.conversation_id === button?.dataset.conversationId); if (row) selectConversation(row); });
  moreButton.addEventListener('click', () => loadMessages()); form.addEventListener('submit', sendMessage); input.addEventListener('input', () => { resize(); updateSend(); }); input.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); if (!sendButton.disabled) form.requestSubmit(); } });
  mediaTrigger.addEventListener('click', () => mediaInput.click()); mediaInput.addEventListener('change', () => { try { selectedMedia = validateMedia(mediaInput.files[0]); mediaTrigger.innerHTML = `<span aria-hidden="true">✓</span> ${selectedMedia.kind === 'image' ? 'Photo ready' : 'Clip ready'}`; setComposer('Attachment ready.', 'success'); updateSend(); } catch (error) { selectedMedia = null; mediaInput.value = ''; setComposer(error.message, 'error'); } });
  $('[data-logout]').addEventListener('click', async event => { event.currentTarget.disabled = true; try { const { warning } = await signOutCurrentSession(supabase); window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html'); } catch (error) { setStatus(error.message, 'error'); event.currentTarget.disabled = false; } });
}

window.addEventListener('pagehide', () => { if (channel) supabase?.removeChannel(channel); if (presenceChannel) supabase?.removeChannel(presenceChannel); });
initialize();

import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';
import { subscribeToAppPresence } from '../../../app-presence.js';
import { getFriendlyError } from '../errors/friendly-error.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const status = $('[data-community-status]');
const logoutButton = $('[data-logout]');
const roomList = $('[data-room-list]');
const roomToggle = $('[data-room-toggle]');
const chat = $('.community-chat');
const chatTitle = $('[data-chat-title]');
const chatDescription = $('[data-chat-description]');
const chatState = $('[data-chat-state]');
const chatMemberNote = $('[data-chat-member-note]');
const chatHistory = $('[data-chat-history]');
const messageList = $('[data-chat-messages]');
const emptyState = $('[data-chat-empty]');
const emptyCopy = $('[data-empty-copy]');
const moreButton = $('[data-chat-more]');
const newMessagesButton = $('[data-chat-new]');
const chatForm = $('[data-chat-form]');
const messageInput = $('[name="message"]', chatForm);
const sendButton = $('[type="submit"]', chatForm);
const composerStatus = $('[data-chat-composer-status]');
const messageCount = $('[data-message-count]');
const anonymousToggle = $('[data-anonymous-toggle]');
const presenceCount = $('[data-presence-count]');
const presenceSummary = $('[data-presence-summary]');
const onlineMembers = $('[data-online-members]');
const reportDialog = $('[data-report-dialog]');
const reportForm = $('[data-report-form]');
const reportStatus = $('[data-report-status]');

let supabase;
let currentUser;
let currentRoom;
let roomChannel;
let roomMessages = new Map();
let messageCursor = null;
let hasOlderMessages = false;
let loadingMessages = false;
let sendingMessage = false;
let reportMessageId = null;
let avatarUrls = new Map();
let unseenMessages = 0;
const MAX_MESSAGE_LENGTH = 1000;
let composerResizeFrame = 0;

function setStatus(message, state = 'error') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function setComposerStatus(message, state = '') {
  composerStatus.textContent = message;
  composerStatus.dataset.state = state;
}

function updateAnonymousToggle() {
  const forced = currentRoom?.slug === 'anonymous-gist';
  anonymousToggle.checked = forced;
  anonymousToggle.disabled = !currentRoom || forced || sendingMessage;
}

function updateComposerState() {
  const length = messageInput.value.length;
  messageCount.textContent = `${length} / ${MAX_MESSAGE_LENGTH}`;
  sendButton.disabled = !currentRoom || sendingMessage || !messageInput.value.trim();
}

function resizeComposer() {
  window.cancelAnimationFrame(composerResizeFrame);
  composerResizeFrame = window.requestAnimationFrame(() => {
  messageInput.style.height = 'auto';
  messageInput.style.height = `${Math.min(Math.max(messageInput.scrollHeight, 44), 140)}px`;
  });
}

async function resolveAvatarUrls(messages) {
  const paths = [...new Set(messages.filter(message => message.author_avatar_path && !message.is_anonymous).map(message => message.author_avatar_path))];
  const missing = paths.filter(path => !avatarUrls.has(path));
  if (!missing.length) return;
  const { data } = await supabase.storage.from('profile-media').createSignedUrls(missing, 3600);
  (data || []).forEach(result => {
    if (result.path && result.signedUrl) avatarUrls.set(result.path, result.signedUrl);
  });
}

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function initials(name) {
  return (name || 'VYBE member').trim().split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'V';
}

function renderRoomList(rooms) {
  roomList.replaceChildren();
  rooms.forEach((room, index) => {
    const button = document.createElement('button');
    button.className = `room-option${index === 0 ? ' is-active' : ''}`;
    button.type = 'button';
    button.dataset.room = room.slug;
    if (index === 0) button.setAttribute('aria-current', 'true');
    const icon = document.createElement('span');
    icon.className = 'room-icon';
    icon.textContent = ['✦', '⌁', '♡', '?', '☺', '♪'][index] || '•';
    const copy = document.createElement('span');
    copy.innerHTML = `<strong></strong><small></small>`;
    copy.querySelector('strong').textContent = room.name;
    copy.querySelector('small').textContent = room.description;
    button.append(icon, copy);
    roomList.append(button);
  });
}

function renderPresence(members) {
  presenceCount.textContent = String(members.length);
  chatMemberNote.textContent = members.length ? `${members.length} online now` : 'Live room';
  presenceSummary.textContent = members.length ? `${members.length} ${members.length === 1 ? 'member is' : 'members are'} online now.` : 'No one is showing as online yet.';
  onlineMembers.replaceChildren();
  members.slice(0, 8).forEach(member => {
    const item = document.createElement('li');
    item.className = 'online-member';
    const avatar = document.createElement('span');
    avatar.className = 'online-avatar';
    avatar.textContent = initials(member.display_name);
    const name = document.createElement('span');
    name.textContent = member.display_name || 'VYBE member';
    item.append(avatar, name);
    onlineMembers.append(item);
  });
}

function renderMessage(message, previousMessage) {
  const item = document.createElement('li');
  const sameSpeaker = previousMessage && previousMessage.is_anonymous === message.is_anonymous && previousMessage.author_id === message.author_id;
  item.className = `chat-message${message.author_id === currentUser.id ? ' is-own' : ''}${sameSpeaker ? ' is-grouped' : ''}`;
  item.dataset.messageId = message.id;
  const avatar = document.createElement('span');
  avatar.className = 'chat-avatar';
  let profileHref = '';
  if (sameSpeaker) {
    avatar.classList.add('chat-avatar-spacer');
    avatar.setAttribute('aria-hidden', 'true');
  } else if (message.is_anonymous) {
    avatar.textContent = '?';
    avatar.setAttribute('aria-label', 'Anonymous member');
  } else {
    avatar.textContent = initials(message.author_display_name);
    avatar.setAttribute('aria-label', message.author_display_name || 'VYBE member');
    if (message.author_id) profileHref = `profile.html?id=${encodeURIComponent(message.author_id)}`;
    const avatarUrl = avatarUrls.get(message.author_avatar_path);
    if (avatarUrl) {
      const image = document.createElement('img');
      image.src = avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('load', () => { avatar.classList.add('has-image'); }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      avatar.append(image);
    }
  }
  const body = document.createElement('div');
  body.className = 'chat-message-body';
  const meta = document.createElement('div');
  meta.className = 'chat-message-meta';
  let avatarTarget = avatar;
  if (profileHref && !sameSpeaker) {
    avatarTarget = document.createElement('a');
    avatarTarget.className = 'chat-profile-link chat-avatar-profile-link';
    avatarTarget.href = profileHref;
    avatarTarget.setAttribute('aria-label', `View ${message.author_display_name || 'VYBE member'}'s profile and messaging options`);
    avatarTarget.append(avatar);
  }
  if (!sameSpeaker) {
    const author = message.is_anonymous ? document.createElement('span') : document.createElement('a');
    author.className = message.is_anonymous ? 'chat-author chat-author-anonymous' : 'chat-author';
    author.textContent = message.is_anonymous ? 'Anonymous' : (message.author_display_name || 'VYBE member');
    if (profileHref) {
      author.href = profileHref;
      author.setAttribute('aria-label', `View ${message.author_display_name || 'VYBE member'}'s profile and messaging options`);
      author.classList.add('chat-profile-link');
    }
    meta.append(author);
  }
  const time = document.createElement('time');
  time.dateTime = message.created_at;
  time.textContent = sameSpeaker ? formatTimestamp(message.created_at).split(', ').pop() : formatTimestamp(message.created_at);
  meta.append(time);
  const content = document.createElement('p');
  content.textContent = message.content;
  const actions = document.createElement('div');
  actions.className = 'chat-message-actions';
  const reportButton = document.createElement('button');
  reportButton.type = 'button';
  reportButton.className = 'chat-report-button';
  reportButton.dataset.reportMessage = message.id;
  reportButton.textContent = 'Report';
  reportButton.setAttribute('aria-label', 'Report this message');
  actions.append(reportButton);
  body.append(meta, content, actions);
  item.append(avatarTarget, body);
  return item;
}

function renderMessages({ preserveScroll = false } = {}) {
  const wasNearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 100;
  const previousHeight = chatHistory.scrollHeight;
  const ordered = [...roomMessages.values()].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  messageList.replaceChildren(...ordered.map((message, index) => renderMessage(message, ordered[index - 1])));
  emptyState.hidden = roomMessages.size > 0;
  moreButton.hidden = !hasOlderMessages;
  if (!preserveScroll || wasNearBottom) chatHistory.scrollTop = chatHistory.scrollHeight;
  else if (roomMessages.size) chatHistory.scrollTop += chatHistory.scrollHeight - previousHeight;
}

async function fetchMessages({ reset = false } = {}) {
  if (loadingMessages || !currentRoom) return;
  loadingMessages = true;
  if (reset) {
    roomMessages = new Map();
    messageCursor = null;
    hasOlderMessages = false;
    renderMessages();
  }
  chatState.textContent = 'Loading';
  try {
    const { data, error } = await supabase.rpc('get_community_messages', {
      p_room_slug: currentRoom.slug,
      p_before_created_at: messageCursor?.created_at || null,
      p_before_id: messageCursor?.id || null,
      p_limit: 50
    });
    if (error) throw error;
    const rows = data || [];
    await resolveAvatarUrls(rows);
    rows.forEach(message => roomMessages.set(message.id, message));
    if (rows.length) messageCursor = { created_at: rows[rows.length - 1].created_at, id: rows[rows.length - 1].id };
    hasOlderMessages = rows.length === 50;
    renderMessages({ preserveScroll: !reset });
    chatState.textContent = 'Connected';
    setComposerStatus('Messages are saved to Community chat.', 'success');
  } catch (error) {
    chatState.textContent = 'Unavailable';
    setComposerStatus(`We couldn’t load this room: ${getFriendlyError(error)}`, 'error');
    setStatus('Community chat is unavailable. Apply the Community migration, then reload.', 'error');
  } finally {
    loadingMessages = false;
  }
}

async function fetchSingleMessage(messageId) {
  const { data, error } = await supabase.rpc('get_community_message', { p_message_id: messageId });
  if (error) throw error;
  const message = Array.isArray(data) ? data[0] : data;
  if (!message || message.room_slug !== currentRoom?.slug) return;
  await resolveAvatarUrls([message]);
  const existed = roomMessages.has(message.id);
  roomMessages.set(message.id, message);
  const nearBottom = chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 100;
  renderMessages({ preserveScroll: true });
  if (!existed && !nearBottom) {
    unseenMessages += 1;
    newMessagesButton.textContent = unseenMessages === 1 ? '1 new message' : `${unseenMessages} new messages`;
    newMessagesButton.hidden = false;
  }
}

async function subscribeToRoom() {
  if (roomChannel) await supabase.removeChannel(roomChannel);
  roomChannel = supabase.channel(`community:room:${currentRoom.slug}`, { config: { private: true } })
    .on('broadcast', { event: 'message_created' }, ({ payload }) => {
      if (payload?.room_slug === currentRoom.slug && payload?.message_id) {
        fetchSingleMessage(payload.message_id).catch(() => setComposerStatus('A new message arrived, but could not be loaded yet.', 'error'));
      }
    })
    .subscribe(channelStatus => {
      if (channelStatus === 'SUBSCRIBED') chatState.textContent = 'Live';
      if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(channelStatus)) {
        chatState.textContent = 'Disconnected';
        setComposerStatus('Realtime connection interrupted. Messages will catch up when the connection returns.', 'error');
      }
    });
}

async function selectRoom(roomSlug) {
  const room = [...roomList.querySelectorAll('[data-room]')].map(button => ({ slug: button.dataset.room, name: button.querySelector('strong').textContent, description: button.querySelector('small').textContent })).find(candidate => candidate.slug === roomSlug);
  if (!room) return;
  currentRoom = room;
  unseenMessages = 0;
  newMessagesButton.hidden = true;
  roomList.querySelectorAll('[data-room]').forEach(button => {
    const selected = button.dataset.room === room.slug;
    button.classList.toggle('is-active', selected);
    if (selected) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
  });
  chatTitle.textContent = room.name;
  chatDescription.textContent = room.description;
  chatMemberNote.textContent = presenceCount.textContent === '0' ? 'Live room' : `${presenceCount.textContent} here now`;
  updateAnonymousToggle();
  emptyCopy.textContent = `${room.name} is ready for real conversations. Be the first to start the gist.`;
  roomToggle.setAttribute('aria-expanded', 'false');
  roomList.classList.remove('is-open');
  await fetchMessages({ reset: true });
  await subscribeToRoom();
}

async function sendMessage(event) {
  event.preventDefault();
  const content = messageInput.value.trim();
  if (!content || sendingMessage || !currentRoom) return;
  sendingMessage = true;
  sendButton.disabled = true;
  messageInput.disabled = true;
  setComposerStatus('Sending…');
  try {
    const { data, error } = await supabase.rpc('send_community_message', {
      p_room_slug: currentRoom.slug,
      p_content: content,
      p_is_anonymous: anonymousToggle.checked
    });
    if (error) throw error;
    messageInput.value = '';
    resizeComposer();
    updateComposerState();
    setComposerStatus('Message sent.', 'success');
    if (data?.id) await fetchSingleMessage(data.id);
  } catch (error) {
    setComposerStatus(`Message failed: ${getFriendlyError(error)}`, 'error');
  } finally {
    sendingMessage = false;
    sendButton.disabled = false;
    messageInput.disabled = false;
    updateAnonymousToggle();
    updateComposerState();
    messageInput.focus();
  }
}

function openReport(messageId) {
  reportMessageId = messageId;
  reportForm.reset();
  reportStatus.hidden = true;
  reportStatus.textContent = '';
  reportDialog.showModal();
}

async function submitReport(event) {
  event.preventDefault();
  const reason = new FormData(reportForm).get('reason');
  const submitButton = reportForm.querySelector('[type="submit"]');
  if (!reportMessageId || !reason || submitButton.disabled) return;
  submitButton.disabled = true;
  reportStatus.hidden = true;
  try {
    const { error } = await supabase.rpc('report_community_message', {
      p_message_id: reportMessageId,
      p_reason: reason
    });
    if (error) throw error;
    reportStatus.textContent = 'Thanks — your report was submitted privately.';
    reportStatus.dataset.state = 'success';
    reportStatus.hidden = false;
    reportMessageId = null;
  } catch (error) {
    reportStatus.textContent = getFriendlyError(error);
    reportStatus.dataset.state = 'error';
    reportStatus.hidden = false;
  } finally {
    submitButton.disabled = false;
  }
}

async function initialize() {
  try {
    supabase = getSupabaseClient();
    const auth = await getAuthenticatedUser(supabase);
    if (!auth.user) {
      window.location.replace(auth.recovered ? 'login.html?session=expired' : 'login.html');
      return;
    }
    currentUser = auth.user;
    subscribeToAppPresence(
      renderPresence,
      error => setStatus(`Online status could not be updated: ${getFriendlyError(error)}`, 'error')
    );
    const { data: rooms, error } = await supabase.from('community_rooms').select('slug,name,description,sort_order').order('sort_order');
    if (error) throw error;
    if (!rooms?.length) throw new Error('No Community rooms are configured.');
    renderRoomList(rooms);
    const requestedRoom = new URLSearchParams(window.location.search).get('room');
    const firstRoom = rooms.some(room => room.slug === requestedRoom) ? requestedRoom : rooms[0].slug;
    await selectRoom(firstRoom);
    messageInput.disabled = false;
    sendButton.disabled = false;
    updateAnonymousToggle();
    messageInput.addEventListener('input', () => { resizeComposer(); updateComposerState(); });
    messageInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        if (!sendButton.disabled) chatForm.requestSubmit();
      }
    });
    newMessagesButton.addEventListener('click', () => {
      chatHistory.scrollTop = chatHistory.scrollHeight;
      unseenMessages = 0;
      newMessagesButton.hidden = true;
    });
    chatHistory.addEventListener('scroll', () => {
      if (chatHistory.scrollHeight - chatHistory.scrollTop - chatHistory.clientHeight < 100) {
        unseenMessages = 0;
        newMessagesButton.hidden = true;
      }
    });
    updateComposerState();
    chatForm.addEventListener('submit', sendMessage);
    setStatus('', '');
  } catch (error) {
    roomList.innerHTML = '<p class="room-error">Community rooms could not load. Apply the Community migration and reload.</p>';
    setStatus(`We couldn’t open Community: ${getFriendlyError(error)}`);
    setComposerStatus('Community chat is unavailable until its Supabase migration is applied.', 'error');
  }

  roomList.addEventListener('click', async event => {
    const roomButton = event.target.closest('[data-room]');
    if (!roomButton) return;
    await selectRoom(roomButton.dataset.room);
    window.history.replaceState({}, '', `community.html?room=${encodeURIComponent(roomButton.dataset.room)}`);
  });
  roomToggle.addEventListener('click', () => {
    const open = roomList.classList.toggle('is-open');
    roomToggle.setAttribute('aria-expanded', String(open));
  });
  moreButton.addEventListener('click', () => fetchMessages());
  messageList.addEventListener('click', event => {
    const reportButton = event.target.closest('[data-report-message]');
    if (reportButton) openReport(reportButton.dataset.reportMessage);
  });
  reportForm.addEventListener('submit', submitReport);
  reportDialog.querySelectorAll('[data-close-report]').forEach(button => {
    button.addEventListener('click', () => reportDialog.close());
  });
  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      if (roomChannel) await supabase.removeChannel(roomChannel);
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setStatus(`We couldn’t log you out: ${getFriendlyError(error)}`);
      logoutButton.disabled = false;
    }
  });
}

window.addEventListener('pagehide', () => {
  if (roomChannel) supabase?.removeChannel(roomChannel);
});

initialize();

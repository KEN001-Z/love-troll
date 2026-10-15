import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';
import { subscribeToAppPresence } from '../../../app-presence.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const status = $('[data-home-status]');
const greeting = $('[data-name-greeting]');
const homeHello = $('[data-home-hello]');
const welcomeNote = $('[data-welcome-note]');
const matchNote = $('[data-match-note]');
const communityRooms = $('[data-community-rooms]');
const communityRoomsMessage = $('[data-community-rooms-message]');
const conversationPrompt = $('[data-conversation-prompt]');
const nextPromptButton = $('[data-next-prompt]');
const profileProgress = $('[data-profile-progress]');
const peopleMessage = $('[data-people-message]');
const peoplePhotoMessage = $('[data-people-photo-message]');
const suggestionList = $('[data-suggestions]');
const connectionsMessage = $('[data-connections-message]');
const connectionList = $('[data-connections]');
const connectionsPhotoMessage = $('[data-connections-photo-message]');
const feedSection = $('.feed-section');
const feedPostList = $('[data-feed-posts]');
const feedState = $('[data-feed-state]');
const feedRetry = $('[data-feed-retry]');
const feedMore = $('[data-feed-more]');
const feedSentinel = $('[data-feed-sentinel]');
const feedRefresh = $('[data-feed-refresh]');
const feedFilters = $$('[data-feed-filter]');
const homeSearch = $('[data-home-search]');
const peopleRetry = $('[data-people-retry]');
const peopleLoadMore = $('[data-people-more]');
const searchStatus = $('[data-search-status]');
const postForm = $('[data-post-form]');
const composerStatus = $('[data-composer-status]');
const postContentInput = postForm ? postForm.querySelector('[name="content"]') : null;
const postAnonymousInput = postForm ? postForm.querySelector('[name="is_anonymous"]') : null;
const postCharacterCount = postForm ? postForm.querySelector('[data-post-character-count]') : null;
const postSubmitButton = postForm ? postForm.querySelector('[type="submit"]') : null;
const postMediaInput = postForm ? postForm.querySelector('[data-post-media]') : null;
const postMediaTrigger = postForm ? postForm.querySelector('[data-post-media-trigger]') : null;
const postMediaPreview = postForm ? postForm.querySelector('[data-post-media-preview]') : null;
const createKindButtons = $$('[data-create-kind]');
const createChoiceButtons = $$('[data-create-select]');
const createCaptureButtons = $$('[data-create-capture]');
const createChoose = $('[data-create-choose]');
const createPreview = $('[data-create-preview]');
const createFields = $('[data-create-fields]');
const createPreviewStage = $('[data-create-preview-stage]');
const createPreviewMedia = $('[data-create-preview-media]');
const createTextCard = $('[data-create-text-card]');
const createTextPreview = $('[data-create-text-preview]');
const createVideoControls = $('[data-create-video-controls]');
const createVideoProgress = $('[data-create-video-progress]');
const createGalleryDots = $('[data-create-gallery-dots]');
const createPhotoTools = $('[data-create-photo-tools]');
const createPhotoThumbnails = $('[data-create-photo-thumbnails]');
const createPrevPhoto = $('[data-create-photo-prev]');
const createNextPhoto = $('[data-create-photo-next]');
const createReplaceMedia = $('[data-create-replace-media]');
const createRemoveMedia = $('[data-create-remove-media]');
const createAddPhotos = $('[data-create-add-photos]');
const createRetryButton = $('[data-create-retry]');
const createUploadProgress = $('[data-create-upload-progress]');
const createDetailButtons = $$('[data-create-insert]');
const discardConfirm = $('[data-discard-confirm]');
const discardKeepButton = $('[data-discard-keep]');
const discardConfirmButton = $('[data-discard-confirm-action]');
const mobileCreateButton = $('[data-mobile-create]');
const mobileCreateMenu = $('[data-mobile-create-menu]');
const notificationTrigger = $('[data-notification-open]');
const notificationDrawer = $('[data-notification-drawer]');
const notificationClose = $('[data-notification-close]');
const notificationList = $('[data-notification-list]');
const notificationEmpty = $('[data-notification-empty]');
const notificationStatus = $('[data-notification-status]');
const notificationToolbar = $('[data-notification-toolbar]');
const notificationSelectAll = $('[data-notification-select-all]');
const notificationExitSelection = $('[data-notification-exit-selection]');
const notificationMarkAll = $('[data-notification-mark-all]');
const notificationDeleteSelected = $('[data-notification-delete-selected]');
const notificationDeleteAll = $('[data-notification-delete-all]');
const notificationBadge = $('[data-notification-badge]');
const notificationToasts = $('[data-notification-toasts]');
const pushToggle = $('[data-push-toggle]');
const pushStatus = $('[data-push-status]');
const pushReminder = $('[data-push-reminder]');
const pushReminderMessage = $('[data-push-reminder-message]');
const pushReminderEnable = $('[data-push-reminder-enable]');
const pushReminderDismiss = $('[data-push-reminder-dismiss]');
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';
let pushReminderDismissed = false;
const POST_MEDIA_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime';
const labels = {
  food: {
    indomie: 'Indomie',
    jollof: 'Jollof rice',
    'pepper-soup': 'Pepper soup',
    suya: 'Suya',
    'moi-moi': 'Moi moi',
    'puff-puff': 'Puff-puff'
  },
  lookingFor: {
    friendships: 'Friendships',
    romance: 'Romance',
    'just-vibes': 'Just vibes'
  },
  relationship: {
    single: 'Single',
    complicated: "It’s complicated",
    cruise: 'Here for cruise'
  },
  vibe: {
    lowkey: 'Low-key & chill',
    outside: 'Outside, occasionally',
    'deep-gist': 'Deep gist',
    'chaotic-good': 'Chaotic good'
  },
  interests: {
    music: 'Music',
    movies: 'Films & series',
    food: 'Food',
    games: 'Games',
    gist: 'Gist',
    football: 'Football',
    fashion: 'Fashion',
    travel: 'Travel',
    books: 'Books',
    tech: 'Tech'
  }
};

let supabase;
let currentUserId;
let notificationChannel;
let notificationAudioContext;
let notificationItems = [];
let notificationAvatarUrls = new Map();
const selectedNotificationIds = new Set();
let notificationActionsBusy = false;
let notificationSelectionMode = false;
let notificationLongPressTriggered = false;
const onlineUserIds = new Set();
let ownInterests = [];
let ownMatchmakingEnabled = false;
let activePeopleFilter = 'for-you';
let candidates = [];
const pendingActions = new Set();
const PEOPLE_PAGE_SIZE = 24;
let peopleOffset = 0;
let peopleHasMore = false;
let peopleRequestId = 0;
let peopleLoading = false;
const DEMO_NAME_PATTERNS = [/^test\s*user$/i, /^demo/i, /^sample/i, /^guest/i, /^user$/i];
const FEED_PAGE_SIZE = 15;
let feedFilter = 'all';
let feedCursor = null;
let feedHasMore = true;
let feedRequest = null;
let feedObserver = null;
let feedAutoLoadEnabled = true;
let feedChannel;
let feedRefreshTimer;
let feedRefreshPending = false;
let feedRefreshingHead = false;
let composerBusy = false;
let editingPostId = null;
let selectedPostMedia = [];
let editingMediaPreview = [];
let createMediaIndex = 0;
let createPickerAction = 'new';
let createPickerKind = '';
let composerInitialState = null;
let createSoundOn = false;
let createRestoreFocus = null;
const postMediaUrls = new Map();
const loadedPosts = new Map();
const isImmersiveFeed = document.body.classList.contains('vibe-body');
const isCardFeedLayout = document.body.classList.contains('vibe-feed-cards');
let feedPlaybackObserver;
let activeFeedVideo;
const composerSheet = $('[data-composer-sheet]');
const composerTitle = $('#composer-title');
const reelToast = $('[data-reel-toast]');
const reelNewPill = $('[data-reel-new]');
const reelSoundButton = $('[data-reel-sound]');
const REEL_SOUND_KEY = 'vybe-reel-sound';
let reelObserver;
let activeReel = null;
let reelSoundOn = false;
let reelTapTimer;
let reelLastTap = { id: '', time: 0 };
let reelToastTimer;
let feedStateTimer;
let insertNewOnRefresh = false;
let likeBackend = 'unknown';
const likeStates = new Map();
const likePending = new Set();
const followingKnown = new Set();
const followingIds = new Set();
let currentAuthor = { id: '', display_name: '', username: '', avatar_path: '' };
const MAX_POST_MEDIA = 10;
const POST_MEDIA_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  video: ['video/mp4', 'video/webm', 'video/quicktime']
};
const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const POST_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
const CONVERSATION_PROMPTS = [
  'What’s your biggest green flag?',
  'What song have you had on repeat this week?',
  'Jollof: party or pot? Defend your answer.',
  'What’s a small joy that made your week better?',
  'If we had two hours free, where would you drag me?',
  'What’s a hill you’ll die on — gently?',
  'First thing you’d eat after a long day?',
  'What’s a hobby you wish more people asked you about?'
];
let promptIndex = 0;

function syncSocialNavigation() {
  const socialNav = $('[data-social-nav]');
  if (!socialNav) return;

  const destination = window.location.pathname.endsWith('/vibe.html')
    ? 'feed'
    : window.location.hash === '#people'
      ? 'discover'
      : 'home';

  $$('[data-social-destination]', socialNav).forEach(link => {
    const selected = link.dataset.socialDestination === destination;
    if (selected) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function bindNotificationDrawer() {
  if (!notificationTrigger || !notificationDrawer) return;

  notificationTrigger.addEventListener('click', () => {
    if (notificationDrawer.open) {
      notificationDrawer.close();
      return;
    }
    notificationDrawer.showModal();
    notificationTrigger.setAttribute('aria-expanded', 'true');
    refreshNotifications({ showLoading: true });
  });
  notificationClose?.addEventListener('click', () => notificationDrawer.close());
  notificationDrawer.addEventListener('click', event => {
    if (event.target === notificationDrawer) notificationDrawer.close();
  });
  notificationDrawer.addEventListener('close', () => {
    notificationTrigger.setAttribute('aria-expanded', 'false');
    notificationTrigger.focus();
  });
  notificationList?.addEventListener('change', event => {
    const checkbox = event.target.closest('[data-notification-select]');
    if (!checkbox) return;
    const notificationId = checkbox.dataset.notificationSelect;
    if (checkbox.checked) selectedNotificationIds.add(notificationId);
    else selectedNotificationIds.delete(notificationId);
    updateNotificationActions();
  });
  notificationList?.addEventListener('click', event => {
    const markReadButton = event.target.closest('[data-notification-mark-read]');
    if (markReadButton) {
      event.preventDefault();
      event.stopPropagation();
      markNotificationRead(markReadButton);
      return;
    }
    if (notificationLongPressTriggered) {
      notificationLongPressTriggered = false;
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (!notificationSelectionMode) return;
    const link = event.target.closest('.notification-link');
    const item = link?.closest('.notification-item');
    if (!item) return;
    event.preventDefault();
    toggleNotificationSelection(item.dataset.notificationId);
  });
  notificationList?.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.target.closest('[data-notification-select]')) return;
    const link = event.target.closest('.notification-link');
    const item = link?.closest('.notification-item');
    if (!item) return;
    event.preventDefault();
    if (!notificationSelectionMode) setNotificationSelectionMode(true);
    toggleNotificationSelection(item.dataset.notificationId);
  });
  notificationSelectAll?.addEventListener('change', () => {
    notificationItems.forEach(notification => {
      const notificationId = String(notification.notification_id);
      if (notificationSelectAll.checked) selectedNotificationIds.add(notificationId);
      else selectedNotificationIds.delete(notificationId);
    });
    notificationList?.querySelectorAll('[data-notification-select]').forEach(checkbox => {
      checkbox.checked = notificationSelectAll.checked;
    });
    updateNotificationActions();
  });
  notificationMarkAll?.addEventListener('click', markAllNotificationsRead);
  notificationDeleteSelected?.addEventListener('click', deleteSelectedNotifications);
  notificationDeleteAll?.addEventListener('click', deleteAllNotifications);
  notificationExitSelection?.addEventListener('click', () => setNotificationSelectionMode(false));
  pushToggle?.addEventListener('click', togglePushNotifications);
  pushReminderEnable?.addEventListener('click', async () => {
    pushReminderEnable.disabled = true;
    try {
      await enablePushNotifications();
    } finally {
      pushReminderEnable.disabled = false;
      await initializePushNotifications();
    }
  });
  pushReminderDismiss?.addEventListener('click', dismissPushReminder);
}

function setNotificationStatus(message, isError = false) {
  if (!notificationStatus) return;
  notificationStatus.textContent = message;
  notificationStatus.hidden = !message;
  if (isError) notificationStatus.dataset.state = 'error';
  else delete notificationStatus.dataset.state;
}

function unlockNotificationAudio() {
  if (!window.AudioContext) return;
  notificationAudioContext ||= new window.AudioContext();
  if (notificationAudioContext.state === 'running') return;
  notificationAudioContext.resume().then(() => {
    if (notificationAudioContext.state !== 'running') {
      console.warn('VYBE could not start the notification chime because audio is still suspended.');
    }
  }).catch(error => console.warn('VYBE could not enable the notification chime.', error));
}

function playNotificationSound() {
  if (!notificationAudioContext || notificationAudioContext.state !== 'running') return;

  const context = notificationAudioContext;
  const now = context.currentTime;
  [880, 1320].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const volume = context.createGain();
    const startAt = now + index * 0.07;
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, startAt);
    volume.gain.setValueAtTime(0.0001, startAt);
    volume.gain.exponentialRampToValueAtTime(index ? 0.027 : 0.06, startAt + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.55);
    oscillator.connect(volume);
    volume.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + 0.56);
  });
}

function updateNotificationBadge(notifications) {
  if (!notificationTrigger || !notificationBadge) return;
  const unreadCount = notifications.filter(item => !item.read_at).length;
  notificationBadge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  notificationBadge.hidden = unreadCount === 0;
  const label = unreadCount
    ? `Notifications, ${unreadCount} unread`
    : 'Open notifications';
  notificationTrigger.setAttribute('aria-label', label);
  notificationTrigger.title = label;
}

function updateNotificationActions() {
  if (!notificationToolbar) return;
  const availableIds = new Set(notificationItems.map(item => String(item.notification_id)));
  for (const id of selectedNotificationIds) {
    if (!availableIds.has(id)) selectedNotificationIds.delete(id);
  }
  const selectedCount = selectedNotificationIds.size;
  notificationToolbar.hidden = !notificationSelectionMode || notificationItems.length === 0;
  if (notificationList) notificationList.dataset.selectionMode = String(notificationSelectionMode);
  if (notificationSelectAll) {
    notificationSelectAll.checked = notificationItems.length > 0 && selectedCount === notificationItems.length;
    notificationSelectAll.indeterminate = selectedCount > 0 && selectedCount < notificationItems.length;
    notificationSelectAll.disabled = notificationActionsBusy;
  }
  if (notificationMarkAll) notificationMarkAll.disabled = notificationActionsBusy;
  if (notificationDeleteSelected) {
    notificationDeleteSelected.disabled = notificationActionsBusy || selectedCount === 0;
    notificationDeleteSelected.textContent = selectedCount
      ? `Delete selected (${selectedCount})`
      : 'Delete selected';
  }
  if (notificationDeleteAll) notificationDeleteAll.disabled = notificationActionsBusy;
  if (notificationExitSelection) notificationExitSelection.disabled = notificationActionsBusy;
  notificationList?.querySelectorAll('[data-notification-select]').forEach(checkbox => {
    checkbox.disabled = notificationActionsBusy;
  });
  notificationList?.querySelectorAll('[data-notification-mark-read]').forEach(button => {
    button.disabled = notificationActionsBusy;
  });
}

function setNotificationSelectionMode(enabled) {
  notificationSelectionMode = enabled;
  if (!enabled) {
    selectedNotificationIds.clear();
    if (notificationSelectAll) notificationSelectAll.checked = false;
  }
  updateNotificationActions();
}

function toggleNotificationSelection(notificationId) {
  if (!notificationId || notificationActionsBusy) return;
  if (!notificationSelectionMode) setNotificationSelectionMode(true);
  if (selectedNotificationIds.has(notificationId)) selectedNotificationIds.delete(notificationId);
  else selectedNotificationIds.add(notificationId);
  const checkbox = notificationList?.querySelector(`[data-notification-select="${CSS.escape(notificationId)}"]`);
  if (checkbox) checkbox.checked = selectedNotificationIds.has(notificationId);
  updateNotificationActions();
}

function notificationAge(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return '';
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const units = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];
  const [unit, duration] = units.find(([, length]) => Math.abs(seconds) >= length) || ['second', 1];
  return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(Math.round(seconds / duration), unit);
}

function notificationMessage(notification) {
  if (notification.kind === 'like') {
    return notification.post_type === 'video' ? ' liked your video.' : ' liked your post.';
  }
  if (notification.kind === 'follow') return ' followed you.';
  if (notification.kind === 'match') return ' matched with you.';
  if (notification.kind === 'message') return ' sent you a message.';
  return ' sent you interest.';
}

function notificationUrl(notification) {
  if (notification.kind === 'like' && notification.post_id) {
    return `vibe.html#post-${encodeURIComponent(notification.post_id)}`;
  }
  if (notification.kind === 'message') {
    const conversation = notification.conversation_id
      ? `?conversation=${encodeURIComponent(notification.conversation_id)}`
      : '';
    return `messages.html${conversation}`;
  }
  return `profile.html?id=${encodeURIComponent(notification.actor_id)}`;
}

function addNotificationAvatar(container, name, avatarUrl) {
  container.textContent = name.slice(0, 1).toLocaleUpperCase();
  if (!avatarUrl) return;
  const image = document.createElement('img');
  image.src = avatarUrl;
  image.alt = '';
  image.loading = 'lazy';
  image.addEventListener('error', () => image.remove(), { once: true });
  container.append(image);
}

function renderNotifications(notifications, avatarUrls) {
  if (!notificationList || !notificationEmpty) return;
  notificationItems = notifications;
  notificationAvatarUrls = avatarUrls;
  notificationList.replaceChildren();
  notifications.forEach(notification => {
    const name = sanitizeName(notification.actor_display_name) || 'A VYBE member';
    const item = document.createElement('li');
    item.className = 'notification-item';
    item.dataset.unread = String(!notification.read_at);
    const notificationId = String(notification.notification_id);
    item.dataset.notificationId = notificationId;

    const select = document.createElement('input');
    select.className = 'notification-select';
    select.type = 'checkbox';
    select.dataset.notificationSelect = notificationId;
    select.checked = selectedNotificationIds.has(notificationId);
    select.setAttribute('aria-label', `Select notification from ${name}`);
    item.addEventListener('pointerdown', event => {
      if (event.button !== 0 || notificationSelectionMode || event.target.closest('button, input')) return;
      const startX = event.clientX;
      const startY = event.clientY;
      const holdTimer = window.setTimeout(() => {
        notificationLongPressTriggered = true;
        setNotificationSelectionMode(true);
        toggleNotificationSelection(notificationId);
      }, 550);
      const clearHold = () => {
        window.clearTimeout(holdTimer);
        item.removeEventListener('pointerup', clearHold);
        item.removeEventListener('pointercancel', clearHold);
        item.removeEventListener('pointermove', cancelOnMove);
      };
      const cancelOnMove = moveEvent => {
        if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 12) clearHold();
      };
      item.addEventListener('pointerup', clearHold, { once: true });
      item.addEventListener('pointercancel', clearHold, { once: true });
      item.addEventListener('pointermove', cancelOnMove);
    });
    item.addEventListener('contextmenu', event => event.preventDefault());

    const link = document.createElement('a');
    link.className = 'notification-link';
    link.href = notificationUrl(notification);
    const avatar = document.createElement('span');
    avatar.className = 'notification-avatar';
    avatar.setAttribute('aria-hidden', 'true');
    addNotificationAvatar(avatar, name, avatarUrls.get(notification.actor_id));

    const copy = document.createElement('span');
    copy.className = 'notification-copy';
    const message = document.createElement('span');
    const actorName = document.createElement('strong');
    actorName.textContent = name;
    message.append(actorName, document.createTextNode(notificationMessage(notification)));
    const time = document.createElement('time');
    time.className = 'notification-time';
    time.dateTime = notification.created_at;
    time.textContent = notificationAge(notification.created_at);
    copy.append(message, time);

    const unreadDot = document.createElement('span');
    unreadDot.className = 'notification-unread-dot';
    unreadDot.setAttribute('aria-hidden', 'true');
    link.append(avatar, copy, unreadDot);
    item.append(select, link);
    if (!notification.read_at) {
      const markReadButton = document.createElement('button');
      markReadButton.className = 'notification-mark-read';
      markReadButton.type = 'button';
      markReadButton.dataset.notificationMarkRead = notificationId;
      markReadButton.setAttribute('aria-label', `Mark ${name}’s notification as read`);
      markReadButton.textContent = 'Mark as read';
      item.append(markReadButton);
    }
    notificationList.append(item);
  });

  const hasNotifications = notifications.length > 0;
  notificationList.hidden = !hasNotifications;
  notificationEmpty.hidden = hasNotifications;
  if (!hasNotifications) setNotificationSelectionMode(false);
  updateNotificationBadge(notifications);
  updateNotificationActions();
}

function showNotificationToast(notification, avatarUrl = '') {
  if (!notificationToasts) return;
  const name = sanitizeName(notification.actor_display_name) || 'A VYBE member';
  const username = typeof notification.actor_username === 'string'
    ? notification.actor_username.trim()
    : '';
  const toast = document.createElement('article');
  toast.className = 'notification-toast';
  const link = document.createElement('a');
  link.className = 'notification-toast-link';
  link.href = notificationUrl(notification);
  const destinationLabel = notification.kind === 'message'
    ? 'Open conversation.'
    : notification.kind === 'like'
      ? 'View post.'
      : 'View profile.';
  link.setAttribute('aria-label', `${name}${notificationMessage(notification)} ${destinationLabel}`);

  const avatar = document.createElement('span');
  avatar.className = 'notification-toast-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  addNotificationAvatar(avatar, name, avatarUrl);

  const copy = document.createElement('span');
  copy.className = 'notification-toast-copy';
  const brand = document.createElement('span');
  brand.className = 'notification-toast-brand';
  brand.textContent = notification.kind === 'follow'
    ? 'NEW FOLLOWER'
    : notification.kind === 'like'
      ? 'NEW LIKE'
      : 'A LITTLE VYBE UPDATE';
  const message = document.createElement('span');
  message.className = 'notification-toast-message';
  const actorName = document.createElement('strong');
  actorName.textContent = name;
  message.append(actorName, document.createTextNode(notificationMessage(notification)));
  copy.append(brand, message);
  if (username) {
    const handle = document.createElement('span');
    handle.className = 'notification-toast-handle';
    handle.textContent = `@${username}`;
    copy.append(handle);
  }
  const profileAction = document.createElement('span');
  profileAction.className = 'notification-toast-profile-action';
  profileAction.textContent = notification.kind === 'message'
    ? 'Open conversation →'
    : notification.kind === 'like'
      ? 'View post →'
      : 'View profile →';
  copy.append(profileAction);
  link.append(avatar, copy);

  const close = document.createElement('button');
  close.className = 'notification-toast-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Dismiss notification');
  close.textContent = '×';
  close.addEventListener('click', () => dismissNotificationToast(toast));
  toast.append(link, close);
  notificationToasts.prepend(toast);
  window.setTimeout(() => dismissNotificationToast(toast), 6500);
}

function dismissNotificationToast(toast) {
  if (!toast.isConnected) return;
  toast.classList.add('notification-toast-leave');
  window.setTimeout(() => toast.remove(), 220);
}

async function refreshNotifications({ showLoading = false, incomingId = null } = {}) {
  if (!supabase || !currentUserId || !notificationList) return;
  if (showLoading) {
    notificationList.hidden = true;
    notificationEmpty.hidden = true;
    if (notificationToolbar) notificationToolbar.hidden = true;
    setNotificationStatus('Loading your notifications…');
  }

  try {
    const { data, error } = await supabase.rpc('get_my_notifications');
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('VYBE returned an invalid notifications response.');
    const avatars = await signProfileAvatars(data.map(item => ({
      id: item.actor_id,
      avatar_path: item.actor_avatar_path
    })));
    renderNotifications(data, avatars.urlsByProfileId);
    setNotificationStatus('');
    if (incomingId) {
      const incoming = data.find(item => String(item.notification_id) === String(incomingId));
      if (incoming) showNotificationToast(incoming, avatars.urlsByProfileId.get(incoming.actor_id));
    }
  } catch (error) {
    const missingNotificationsRpc = error.code === 'PGRST202' ||
      /could not find the function public\.get_my_notifications/i.test(error.message || '');
    setNotificationStatus(missingNotificationsRpc
      ? 'Notifications aren’t set up in this Supabase project yet. Apply the notifications migration, then refresh this page.'
      : `We couldn’t load your notifications. ${error.message || 'Please try again.'}`,
    true);
  }
}

async function markAllNotificationsRead() {
  if (!supabase || notificationActionsBusy) return;
  notificationActionsBusy = true;
  updateNotificationActions();
  try {
    const { error } = await supabase.rpc('mark_my_notifications_read');
    if (error) throw error;
    const readAt = new Date().toISOString();
    notificationItems.forEach(item => { item.read_at ||= readAt; });
    renderNotifications(notificationItems, notificationAvatarUrls);
    setNotificationStatus('All notifications marked as read.');
  } catch (error) {
    setNotificationStatus(`We couldn’t mark your notifications as read. ${error.message || 'Please try again.'}`, true);
  } finally {
    notificationActionsBusy = false;
    updateNotificationActions();
  }
}

async function markNotificationRead(button) {
  const notificationId = button.dataset.notificationMarkRead;
  if (!supabase || notificationActionsBusy || !notificationId) return;

  notificationActionsBusy = true;
  button.textContent = 'Marking…';
  updateNotificationActions();
  try {
    const { data, error } = await supabase.rpc('mark_my_notification_read', {
      p_notification_id: notificationId
    });
    if (error) throw error;
    if (typeof data !== 'boolean') {
      throw new Error('VYBE could not confirm that the notification was marked as read.');
    }
    if (!data) {
      await refreshNotifications();
      setNotificationStatus('This notification is no longer unread. Your notifications have been refreshed.');
      return;
    }

    const notification = notificationItems.find(item =>
      String(item.notification_id) === notificationId
    );
    if (notification) notification.read_at = new Date().toISOString();
    renderNotifications(notificationItems, notificationAvatarUrls);
    setNotificationStatus('Notification marked as read.');
  } catch (error) {
    const missingMarkReadRpc = error.code === 'PGRST202' ||
      /could not find the function public\.mark_my_notification_read/i.test(error.message || '');
    setNotificationStatus(missingMarkReadRpc
      ? 'Per-notification read isn’t enabled in this Supabase project yet. Apply migration 20261015002128_mark_single_notification_read.sql, then refresh and try again.'
      : `We couldn’t mark this notification as read. ${error.message || 'Please try again.'}`,
    true);
  } finally {
    if (button.isConnected) button.textContent = 'Mark as read';
    notificationActionsBusy = false;
    updateNotificationActions();
  }
}

async function deleteSelectedNotifications() {
  if (!supabase || notificationActionsBusy || selectedNotificationIds.size === 0) return;
  const ids = [...selectedNotificationIds];
  notificationActionsBusy = true;
  updateNotificationActions();
  try {
    const { data: deletedCount, error } = await supabase.rpc('delete_my_notifications', {
      p_notification_ids: ids
    });
    if (error) throw error;
    if (!Number.isInteger(deletedCount)) throw new Error('VYBE could not confirm how many notifications were deleted.');
    ids.forEach(id => selectedNotificationIds.delete(id));
    renderNotifications(
      notificationItems.filter(item => !ids.includes(String(item.notification_id))),
      notificationAvatarUrls
    );
    setNotificationStatus(`${deletedCount} notification${deletedCount === 1 ? '' : 's'} deleted.`);
  } catch (error) {
    setNotificationStatus(`We couldn’t delete the selected notifications. ${error.message || 'Please try again.'}`, true);
  } finally {
    notificationActionsBusy = false;
    updateNotificationActions();
  }
}

async function deleteAllNotifications() {
  if (!supabase || notificationActionsBusy || !window.confirm('Delete all notifications? This cannot be undone.')) return;
  notificationActionsBusy = true;
  updateNotificationActions();
  try {
    const { data: deletedCount, error } = await supabase.rpc('delete_my_notifications', {
      p_notification_ids: null
    });
    if (error) throw error;
    if (!Number.isInteger(deletedCount)) throw new Error('VYBE could not confirm how many notifications were deleted.');
    selectedNotificationIds.clear();
    renderNotifications([], notificationAvatarUrls);
    setNotificationStatus(`All ${deletedCount} notification${deletedCount === 1 ? '' : 's'} deleted.`);
  } catch (error) {
    setNotificationStatus(`We couldn’t delete your notifications. ${error.message || 'Please try again.'}`, true);
  } finally {
    notificationActionsBusy = false;
    updateNotificationActions();
  }
}

function startNotificationRealtime() {
  if (!notificationTrigger || !currentUserId) return;
  document.addEventListener('pointerdown', unlockNotificationAudio);
  document.addEventListener('keydown', unlockNotificationAudio);
  notificationChannel = supabase
    .channel(`notifications:${currentUserId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `recipient_id=eq.${currentUserId}`
    }, payload => {
      playNotificationSound();
      refreshNotifications({ incomingId: payload.new?.id });
    })
    .subscribe(state => {
      if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        setNotificationStatus('Live notification updates are unavailable. Open notifications to refresh.', true);
      }
    });
  window.addEventListener('pagehide', () => {
    if (notificationChannel) supabase?.removeChannel(notificationChannel);
  }, { once: true });
}

function setPushStatus(message, isError = false) {
  if (!pushStatus) return;
  pushStatus.textContent = message;
  if (isError) pushStatus.dataset.state = 'error';
  else delete pushStatus.dataset.state;
}

function setPushReminder(message, { canEnable = true, buttonText = 'Enable push alerts' } = {}) {
  if (!pushReminder || !pushReminderMessage) return;
  pushReminderMessage.textContent = message;
  pushReminder.hidden = pushReminderDismissed;
  if (pushReminderEnable) {
    pushReminderEnable.hidden = !canEnable;
    pushReminderEnable.textContent = buttonText;
  }
}

function hidePushReminder() {
  if (pushReminder) pushReminder.hidden = true;
}

function dismissPushReminder() {
  pushReminderDismissed = true;
  hidePushReminder();
}

function decodeVapidPublicKey(key) {
  const padding = '='.repeat((4 - key.length % 4) % 4);
  const base64 = `${key.replace(/-/g, '+').replace(/_/g, '/')}${padding}`;
  const decoded = Uint8Array.from(atob(base64), character => character.charCodeAt(0));
  if (decoded.length !== 65 || decoded[0] !== 4) {
    throw new Error('The VAPID public key is invalid. Configure the matching public key and reload VYBE.');
  }
  return decoded;
}

function hasValidVapidPublicKey() {
  try {
    decodeVapidPublicKey(VAPID_PUBLIC_KEY);
    return true;
  } catch {
    return false;
  }
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return Boolean(navigator.standalone) ||
    window.matchMedia('(display-mode: standalone)').matches;
}

async function savePushSubscription(subscription) {
  const keys = subscription.toJSON().keys;
  if (!keys?.p256dh || !keys.auth) {
    throw new Error('The browser returned an incomplete push subscription.');
  }
  const { error } = await supabase.rpc('register_my_push_subscription', {
    p_endpoint: subscription.endpoint,
    p_p256dh: keys.p256dh,
    p_auth_secret: keys.auth,
    p_user_agent: navigator.userAgent.slice(0, 300)
  });
  if (error) throw error;
}

async function enablePushNotifications() {
  if (!pushToggle || !supabase) return;
  pushToggle.disabled = true;
  setPushStatus('Setting up notifications…');
  try {
    if (!window.isSecureContext || !('Notification' in window) ||
        !('serviceWorker' in navigator) || !('PushManager' in window)) {
      throw new Error('This browser cannot receive web push notifications.');
    }
    if (!hasValidVapidPublicKey()) {
      throw new Error('Push is not configured yet. Set a valid VITE_VAPID_PUBLIC_KEY and reload.');
    }
    if (isIosDevice() && !isStandaloneApp()) {
      throw new Error('On iPhone or iPad, add VYBE to your Home Screen and open the installed app to enable push.');
    }

    const permission = Notification.permission === 'granted'
      ? 'granted'
      : await Notification.requestPermission();
    if (permission !== 'granted') {
      pushToggle.disabled = permission === 'denied';
      setPushStatus(
        permission === 'denied'
          ? 'Notifications are blocked for this site. Allow them in your browser settings to turn them on.'
          : 'Allow notifications in your browser to receive message and activity alerts.',
        permission === 'denied'
      );
      return;
    }

    const registration = await navigator.serviceWorker.register('/service-worker.js', {
      scope: '/',
      updateViaCache: 'none'
    });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    let createdSubscription = false;
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidPublicKey(VAPID_PUBLIC_KEY)
      });
      createdSubscription = true;
    }
    try {
      await savePushSubscription(subscription);
    } catch (error) {
      if (createdSubscription) {
        try {
          const removed = await subscription.unsubscribe();
          if (!removed) console.warn('VYBE could not roll back the unsaved push subscription.');
        } catch (cleanupError) {
          console.warn('VYBE could not roll back the unsaved push subscription.', cleanupError);
        }
      }
      throw error;
    }
    pushToggle.textContent = 'Turn off on this device';
    pushToggle.disabled = false;
    setPushStatus('You’ll get message and activity alerts on this device.');
  } catch (error) {
    pushToggle.disabled = false;
    setPushStatus(`Notifications couldn’t be enabled. ${error.message || 'Please try again.'}`, true);
  }
}

async function initializePushNotifications() {
  if (!pushToggle) return;
  if (!window.isSecureContext || !('Notification' in window) ||
      !('serviceWorker' in navigator) || !('PushManager' in window)) {
    pushToggle.disabled = true;
    pushToggle.textContent = 'Push not supported';
    const message = 'This browser cannot receive push notifications. In-app alerts will still work.';
    setPushStatus(message);
    setPushReminder(message, { canEnable: false });
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await savePushSubscription(subscription);
      pushToggle.disabled = false;
      pushToggle.textContent = 'Turn off on this device';
      if (!hasValidVapidPublicKey()) {
        const message = 'This device has a push subscription, but VYBE’s push keys aren’t configured for this site. Contact the site administrator; you can still turn push off below.';
        setPushStatus(message);
        setPushReminder(message, { canEnable: false });
      } else if (Notification.permission === 'denied') {
        const message = 'This device is subscribed, but VYBE notifications are blocked in browser settings. Allow them there, or turn them off below.';
        setPushStatus(message);
        setPushReminder(
          'Notifications are blocked for VYBE in browser settings. Allow them there to receive alerts, or turn them off in the Notifications drawer.',
          { canEnable: false }
        );
      } else {
        setPushStatus('You’ll get message and activity alerts on this device.');
        hidePushReminder();
      }
      return;
    }

    pushToggle.textContent = 'Enable on this device';
    if (!hasValidVapidPublicKey()) {
      pushToggle.disabled = true;
      const message = 'Push notifications aren’t configured for this VYBE site yet. The site administrator must configure the public VAPID key and matching server secrets before users can enable push.';
      setPushStatus(message);
      setPushReminder(message, { canEnable: false });
      return;
    }
    if (isIosDevice() && !isStandaloneApp()) {
      pushToggle.disabled = true;
      const message = 'On iPhone or iPad, add VYBE to your Home Screen first, then open it there to turn on push.';
      setPushStatus(message);
      setPushReminder(message, { canEnable: false });
      return;
    }
    if (Notification.permission === 'denied') {
      pushToggle.disabled = false;
      pushToggle.textContent = 'Show how to allow';
      const message = 'Notifications are blocked for VYBE. Allow them in this site’s browser settings, then reload VYBE and enable push.';
      setPushStatus(message);
      setPushReminder(message, { canEnable: false });
      return;
    }
    pushToggle.disabled = false;
    const message = 'Turn on push alerts to hear from your people, even when VYBE is closed.';
    setPushStatus(message);
    setPushReminder(message);
  } catch (error) {
    pushToggle.disabled = false;
    setPushStatus(`Push status couldn’t be checked. ${error.message || 'Try enabling notifications again.'}`, true);
    setPushReminder('Push is not fully set up on this device yet. Try again to finish enabling alerts.', {
      buttonText: 'Finish setup'
    });
  }
}

async function disablePushNotifications() {
  if (!supabase) throw new Error('VYBE is still connecting. Please try again in a moment.');
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) {
    setPushStatus('Push is already off on this device.');
    return;
  }

  const { error } = await supabase.from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  if (error) throw error;
  const removed = await subscription.unsubscribe();
  if (!removed) throw new Error('The browser did not confirm that push was turned off.');
  setPushStatus('Push is off on this device. Your in-app notifications are still here.');
}

async function togglePushNotifications() {
  if (!pushToggle || pushToggle.disabled) return;
  pushToggle.disabled = true;
  let refreshPushState = true;
  try {
    const registration = await navigator.serviceWorker.getRegistration('/');
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      dismissPushReminder();
      await disablePushNotifications();
    } else if (Notification.permission === 'denied') {
      pushToggle.textContent = 'Show how to allow';
      setPushStatus('VYBE can’t open browser settings for you. Click the site controls or lock icon beside the address, open Site settings, set Notifications to Allow, then reload VYBE and enable push.', true);
      refreshPushState = false;
    }
    else await enablePushNotifications();
  } catch (error) {
    setPushStatus(`We couldn’t update push on this device. ${error.message || 'Please try again.'}`, true);
  } finally {
    pushToggle.disabled = false;
    if (refreshPushState) await initializePushNotifications();
  }
}

function applyHomeSearch() {
  const query = (homeSearch?.value || '').trim().toLocaleLowerCase();
  let postCount = 0;
  let peopleCount = 0;
  feedPostList?.querySelectorAll('.feed-post').forEach(item => {
    const visible = !query || (item.dataset.searchText || item.textContent).toLocaleLowerCase().includes(query);
    item.hidden = !visible;
    if (visible) postCount += 1;
  });
  suggestionList?.querySelectorAll('.suggestion-card').forEach(item => {
    const visible = !query || (item.dataset.searchText || item.textContent).toLocaleLowerCase().includes(query);
    item.hidden = !visible;
    if (visible) peopleCount += 1;
  });
  if (searchStatus) {
    searchStatus.hidden = !query;
    searchStatus.textContent = query ? `${postCount} loaded post${postCount === 1 ? '' : 's'} and ${peopleCount} suggested profile${peopleCount === 1 ? '' : 's'} match “${homeSearch.value.trim()}”.` : '';
  }
}

function sanitizeName(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';
  return DEMO_NAME_PATTERNS.some(pattern => pattern.test(trimmed)) ? '' : trimmed;
}

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setStatus(message, state = '') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function createProfilePresence(userId) {
  const status = makeElement('span', 'app-presence-status');
  status.dataset.profilePresenceId = userId;
  const online = onlineUserIds.has(userId);
  status.dataset.status = online ? 'online' : 'offline';
  status.append(
    makeElement('span', 'app-presence-dot'),
    makeElement('span', '', online ? 'Online' : 'Offline')
  );
  return status;
}

function renderAppPresence(members) {
  onlineUserIds.clear();
  members.forEach(member => onlineUserIds.add(member.user_id));
  document.querySelectorAll('[data-profile-presence-id]').forEach(status => {
    const online = onlineUserIds.has(status.dataset.profilePresenceId);
    status.dataset.status = online ? 'online' : 'offline';
    status.lastElementChild.textContent = online ? 'Online' : 'Offline';
  });
}

function setSectionMessage(element, message, state = '') {
  element.textContent = message;
  element.dataset.state = state;
  element.hidden = !message;
}

function setFeedState(message, state = '') {
  if (!feedState) return;
  window.clearTimeout(feedStateTimer);
  if (isImmersiveFeed && state === 'error' && feedPostList?.querySelector('[data-post-id]')) {
    showReelToast(message);
    feedState.textContent = '';
    feedState.dataset.state = '';
    feedState.hidden = true;
    return;
  }
  feedState.textContent = message;
  feedState.dataset.state = state;
  feedState.hidden = !message;
  if (isImmersiveFeed && state === 'success' && message) {
    feedStateTimer = window.setTimeout(() => {
      if (feedState.dataset.state === 'success') setFeedState('');
    }, 3200);
  }
}

function setComposerStatus(message, state = '') {
  if (!composerStatus) return;
  composerStatus.textContent = message;
  composerStatus.dataset.state = state;
  composerStatus.hidden = !message;
}

function explainPostBackendError(error) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) {
    return 'The post publishing and Feed update requires the latest VYBE posts migration. Apply the reviewed migration, then try again.';
  }
  if (/bucket.*not found/i.test(error?.message || '')) {
    return 'Photo and video posting needs the private post-media Storage bucket and its access policies. Your caption and selected media are kept; configure post-media in Supabase, then retry.';
  }
  if (/media_(path|mime|kind).*schema cache|could not find the .* column of .*posts/i.test(error?.message || '')) {
    return 'Photo and video posting needs the post-media database columns enabled in Supabase. Your caption and selected media are kept; apply the reviewed post-media setup, then retry.';
  }
  return error?.message || 'Please try again.';
}

function updateFeedFilters(busy = Boolean(feedRequest)) {
  feedFilters.forEach(button => {
    const selected = button.dataset.feedFilter === feedFilter;
    button.setAttribute('aria-pressed', String(selected));
    button.disabled = busy || !currentUserId;
  });
}

function setFeedInteractionEnabled(enabled) {
  if (feedRefresh) feedRefresh.disabled = !enabled;
  feedFilters.forEach(button => { button.disabled = !enabled; });
  if (postContentInput) postContentInput.disabled = !enabled;
  if (postAnonymousInput) postAnonymousInput.disabled = !enabled;
  if (postSubmitButton) postSubmitButton.disabled = !enabled;
  if (postMediaInput) postMediaInput.disabled = !enabled;
  if (postMediaTrigger) postMediaTrigger.disabled = !enabled || Boolean(editingPostId);
  if (feedRetry) feedRetry.disabled = !enabled;
  if (feedMore) feedMore.disabled = !enabled;
  createKindButtons.forEach(button => { button.disabled = !enabled; });
  createChoiceButtons.forEach(button => { button.disabled = !enabled; });
  createCaptureButtons.forEach(button => { button.disabled = !enabled; });
  if (mobileCreateButton) mobileCreateButton.disabled = !enabled;
  if (composerSheet && !composerSheet.open) {
    postMediaInput.disabled = !enabled;
    if (createChoiceButtons.length) {
      createChoiceButtons.forEach(button => { button.disabled = !enabled; });
    }
  }
  updateCreateSubmitState();
}

function updateCreateSubmitState() {
  if (!isImmersiveFeed || !postSubmitButton || composerBusy) return;
  postSubmitButton.disabled = !currentUserId || !postContentInput.value.trim();
}

function insertCreateDetail(value) {
  if (!postContentInput || postContentInput.disabled) return;
  const start = postContentInput.selectionStart ?? postContentInput.value.length;
  const end = postContentInput.selectionEnd ?? start;
  const before = postContentInput.value.slice(0, start);
  const prefix = before && !/\s$/.test(before) ? ' ' : '';
  const insertion = `${prefix}${value}`;
  if (postContentInput.value.length - (end - start) + insertion.length > postContentInput.maxLength) {
    setComposerStatus(`Keep your caption under ${postContentInput.maxLength} characters.`, 'error');
    return;
  }
  postContentInput.setRangeText(insertion, start, end, 'end');
  postContentInput.dispatchEvent(new Event('input', { bubbles: true }));
  postContentInput.focus({ preventScroll: true });
}

function startPostCreation(kind) {
  if (!postForm || !feedSection) {
    window.location.assign(`vibe.html?create=${encodeURIComponent(kind)}#feed`);
    return;
  }
  if (!isImmersiveFeed) {
    document.body.classList.add('is-composing');
    feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (kind === 'image' || kind === 'video') {
      postMediaInput.multiple = kind === 'image';
      postMediaInput.accept = POST_MEDIA_TYPES[kind].join(',');
      postMediaInput.click();
    } else {
      postContentInput.focus({ preventScroll: true });
    }
    return;
  }
  if (!composerSheet.open) {
    prepareNewComposer();
    createRestoreFocus = document.activeElement;
    openComposerSheet();
  }
  if (kind === 'image' || kind === 'video') {
    launchCreatePicker(kind, 'new');
  } else if (kind === 'thought') {
    showCreateStep('preview');
    postContentInput.focus({ preventScroll: true });
  } else {
    showCreateStep('choose');
    createChoiceButtons[0]?.focus({ preventScroll: true });
  }
  updateCreateSubmitState();
}

function prepareNewComposer() {
  releaseSelectedPostMedia();
  postForm.reset();
  editingPostId = null;
  editingMediaPreview = [];
  createMediaIndex = 0;
  createSoundOn = false;
  const previewSoundButton = $('[data-create-video-sound]');
  previewSoundButton?.setAttribute('aria-pressed', 'false');
  previewSoundButton?.setAttribute('aria-label', 'Turn preview sound on');
  if (previewSoundButton) previewSoundButton.textContent = 'Sound off';
  composerInitialState = { content: '', anonymous: false };
  postMediaInput.value = '';
  postMediaInput.accept = POST_MEDIA_ACCEPT;
  postMediaInput.multiple = true;
  postMediaInput.removeAttribute('capture');
  if (composerTitle) composerTitle.textContent = 'Create a post';
  postSubmitButton.textContent = 'Post ↗';
  postCharacterCount.textContent = `0 / ${postContentInput.maxLength}`;
  setComposerStatus('');
  if (createRetryButton) createRetryButton.hidden = true;
  if (createUploadProgress) createUploadProgress.hidden = true;
  showCreateStep('choose');
  renderPostMediaPreview();
}

function showCreateStep(step) {
  if (!createChoose || !createPreview) return;
  createChoose.hidden = step !== 'choose';
  createPreview.hidden = step !== 'preview';
  createFields.hidden = step !== 'preview';
  if (step === 'preview') renderCreatePreview();
}

function launchCreatePicker(kind, action = 'new', capture = '') {
  if (!postMediaInput || composerBusy || editingPostId) return;
  createPickerAction = action;
  createPickerKind = kind;
  postMediaInput.value = '';
  postMediaInput.accept = kind === 'image' ? 'image/*' : 'video/*';
  postMediaInput.multiple = kind === 'image' && action !== 'replace' && !capture;
  postMediaInput.disabled = false;
  if (capture) postMediaInput.setAttribute('capture', capture);
  else postMediaInput.removeAttribute('capture');
  postMediaInput.click();
}

function openComposerFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const kind = params.get('create');
  if (!postForm || !['thought', 'image', 'video'].includes(kind)) return;
  if (isImmersiveFeed) {
    startPostCreation(kind);
    window.history.replaceState(null, '', `${window.location.pathname}#feed`);
    return;
  }
  document.body.classList.add('is-composing');
  window.history.replaceState(null, '', `${window.location.pathname}#feed`);
  requestAnimationFrame(() => {
    feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (kind === 'thought') {
      postContentInput.focus({ preventScroll: true });
    } else {
      postMediaInput.multiple = kind === 'image';
      postMediaInput.accept = POST_MEDIA_TYPES[kind].join(',');
      postMediaTrigger.focus({ preventScroll: true });
      setComposerStatus(kind === 'image' ? 'Choose one or more photos to attach.' : 'Choose a video clip to attach.');
    }
  });
}

function releaseSelectedPostMedia() {
  selectedPostMedia.forEach(media => {
    if (media.previewUrl) URL.revokeObjectURL(media.previewUrl);
  });
  selectedPostMedia = [];
}

function renderCreatePreview() {
  if (!createPreviewMedia || !createTextCard) return;
  createPreviewMedia.replaceChildren();
  createGalleryDots.replaceChildren();
  createPhotoThumbnails.replaceChildren();
  const media = editingPostId ? editingMediaPreview : selectedPostMedia;
  const isEditing = Boolean(editingPostId);
  const hasPhotos = media.some(item => item.kind === 'image');
  const isVideo = media[createMediaIndex]?.kind === 'video';

  createTextPreview.textContent = postContentInput.value.trim() || 'Your words, your VYBE.';
  createTextCard.hidden = media.length > 0;
  createPreviewMedia.hidden = media.length === 0;
  createVideoControls.hidden = !isVideo;
  createPhotoTools.hidden = isEditing || !hasPhotos;
  createPrevPhoto.hidden = !hasPhotos || media.length < 2;
  createNextPhoto.hidden = !hasPhotos || media.length < 2;
  createReplaceMedia.hidden = isEditing || !media.length;
  createRemoveMedia.hidden = isEditing || !media.length;
  createAddPhotos.hidden = isEditing || !hasPhotos || media.length >= MAX_POST_MEDIA;

  if (!media.length) {
    postMediaInput.disabled = Boolean(editingPostId) || !currentUserId;
    updateCreateSubmitState();
    return;
  }

  const gallery = media.length > 1 && hasPhotos ? makeElement('div', 'create-preview-gallery') : null;
  if (gallery) {
    gallery.addEventListener('scroll', () => {
      const nextIndex = Math.round(gallery.scrollLeft / gallery.clientWidth);
      if (nextIndex !== createMediaIndex) {
        createMediaIndex = nextIndex;
        updateCreatePreviewControls(media);
      }
    }, { passive: true });
    createPreviewMedia.append(gallery);
  }

  media.forEach((item, index) => {
    const slide = gallery || createPreviewMedia;
    const target = gallery ? makeElement('div', 'create-preview-slide') : slide;
    const source = item.previewUrl || item.url || postMediaUrls.get(item.path);
    if (item.kind === 'image') {
      const image = makeElement('img', 'create-preview-image');
      image.src = source || '';
      image.alt = `Photo ${index + 1} preview`;
      image.addEventListener('load', () => updateCreatePreviewOrientation(image), { once: true });
      target.append(image);
      if (gallery) slide.append(target);
    } else {
      const video = makeElement('video', 'create-preview-video');
      video.src = source || '';
      video.muted = !createSoundOn;
      video.loop = true;
      video.playsInline = true;
      video.autoplay = true;
      video.addEventListener('loadedmetadata', () => {
        video.classList.toggle('is-wide', video.videoWidth / video.videoHeight > .8);
      }, { once: true });
      video.addEventListener('timeupdate', () => {
        if (video === createPreviewMedia.querySelector('video') && video.duration) {
          createVideoProgress.style.width = `${(video.currentTime / video.duration) * 100}%`;
        }
      });
      video.addEventListener('click', () => {
        if (video.paused) video.play().catch(() => {});
        else video.pause();
      });
      target.append(video);
      if (gallery) slide.append(target);
    }
    if (gallery) createGalleryDots.append(makeElement('span', index === createMediaIndex ? 'is-active' : ''));

    if (hasPhotos && !isEditing) {
      const thumb = makeElement('div', 'create-photo-thumb');
      thumb.draggable = true;
      thumb.dataset.photoIndex = String(index);
      const select = makeElement('button', 'create-photo-select');
      select.type = 'button';
      select.setAttribute('aria-label', `Show photo ${index + 1}`);
      const thumbnail = makeElement('img');
      thumbnail.src = item.previewUrl;
      thumbnail.alt = '';
      select.append(thumbnail);
      select.addEventListener('click', () => {
        createMediaIndex = index;
        if (gallery) gallery.scrollTo({ left: gallery.clientWidth * index, behavior: 'smooth' });
        updateCreatePreviewControls(media);
      });
      const move = makeElement('div', 'create-photo-reorder');
      const up = makeElement('button', '', '‹');
      up.type = 'button';
      up.disabled = index === 0;
      up.setAttribute('aria-label', `Move photo ${index + 1} earlier`);
      up.addEventListener('click', () => moveCreatePhoto(index, -1));
      const down = makeElement('button', '', '›');
      down.type = 'button';
      down.disabled = index === media.length - 1;
      down.setAttribute('aria-label', `Move photo ${index + 1} later`);
      down.addEventListener('click', () => moveCreatePhoto(index, 1));
      move.append(up, down);
      thumb.append(select, move);
      thumb.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', String(index));
        event.dataTransfer.effectAllowed = 'move';
      });
      thumb.addEventListener('dragover', event => event.preventDefault());
      thumb.addEventListener('drop', event => {
        event.preventDefault();
        const from = Number(event.dataTransfer.getData('text/plain'));
        moveCreatePhoto(from, index - from);
      });
      createPhotoThumbnails.append(thumb);
    }
  });

  postMediaInput.disabled = true;
  if (gallery) requestAnimationFrame(() => {
    gallery.scrollLeft = gallery.clientWidth * createMediaIndex;
  });
  updateCreatePreviewControls(media);
  updateCreateSubmitState();
}

function currentCreateMedia() {
  return editingPostId ? editingMediaPreview : selectedPostMedia;
}

function updateCreatePreviewControls(media = selectedPostMedia) {
  const isPhotos = media.length > 0 && media.every(item => item.kind === 'image');
  if (createPrevPhoto) createPrevPhoto.disabled = createMediaIndex <= 0;
  if (createNextPhoto) createNextPhoto.disabled = createMediaIndex >= media.length - 1;
  if (createGalleryDots) {
    [...createGalleryDots.children].forEach((dot, index) => dot.classList.toggle('is-active', index === createMediaIndex));
  }
  if (createPhotoThumbnails) {
    [...createPhotoThumbnails.children].forEach((thumb, index) => thumb.classList.toggle('is-current', index === createMediaIndex));
  }
  if (createVideoControls) createVideoControls.hidden = isPhotos || media[createMediaIndex]?.kind !== 'video';
}

function moveCreatePhoto(index, offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= selectedPostMedia.length) return;
  const [photo] = selectedPostMedia.splice(index, 1);
  selectedPostMedia.splice(destination, 0, photo);
  createMediaIndex = destination;
  renderCreatePreview();
}

function handleCreateMediaSelection() {
  const files = [...postMediaInput.files];
  if (!files.length) return;
  let validated;
  try {
    validated = files.map(validatePostMedia).filter(Boolean);
    if (!validated.length) return;
    if (validated.some(media => media.kind !== createPickerKind)) {
      throw new Error(`Choose ${createPickerKind === 'image' ? 'photos' : 'a video'} for this selection.`);
    }
    if (createPickerAction === 'replace' && validated.length !== 1) {
      throw new Error('Choose one file to replace the selected media.');
    }
    const existing = selectedPostMedia;
    const combined = createPickerAction === 'add' ? [...existing, ...validated]
      : createPickerAction === 'replace' ? existing.map((media, index) => index === createMediaIndex ? validated[0] : media)
        : validated;
    if (combined.length > MAX_POST_MEDIA) {
      throw new Error(`Add no more than ${MAX_POST_MEDIA} photos to one post.`);
    }
    if ((combined.length > 1 && combined.some(media => media.kind !== 'image')) ||
        (combined.length > 1 && combined.length !== validated.length && createPickerAction === 'replace')) {
      throw new Error('A post can include multiple photos or one video clip, not both.');
    }

    const withPreviews = validated.map(media => ({
      ...media,
      previewUrl: URL.createObjectURL(media.file)
    }));
    if (createPickerAction === 'add') {
      selectedPostMedia = [...existing, ...withPreviews];
      createMediaIndex = selectedPostMedia.length - withPreviews.length;
    } else if (createPickerAction === 'replace') {
      const previous = selectedPostMedia[createMediaIndex];
      if (previous?.previewUrl) URL.revokeObjectURL(previous.previewUrl);
      selectedPostMedia.splice(createMediaIndex, 1, withPreviews[0]);
    } else {
      releaseSelectedPostMedia();
      selectedPostMedia = withPreviews;
      createMediaIndex = 0;
    }
    postMediaInput.value = '';
    postMediaInput.accept = POST_MEDIA_ACCEPT;
    postMediaInput.multiple = true;
    postMediaInput.removeAttribute('capture');
    postMediaInput.disabled = true;
    renderPostMediaPreview();
    showCreateStep('preview');
    setComposerStatus('');
  } catch (error) {
    postMediaInput.value = '';
    postMediaInput.accept = POST_MEDIA_ACCEPT;
    postMediaInput.multiple = true;
    postMediaInput.removeAttribute('capture');
    postMediaInput.disabled = true;
    setComposerStatus(error.message || 'Choose a supported photo or video.', 'error');
    if (createPickerAction === 'new' && !selectedPostMedia.length) showCreateStep('choose');
  }
}

function removeCreateMedia() {
  if (editingPostId || !selectedPostMedia.length) return;
  const [removed] = selectedPostMedia.splice(createMediaIndex, 1);
  if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
  createMediaIndex = Math.max(0, Math.min(createMediaIndex, selectedPostMedia.length - 1));
  renderPostMediaPreview();
  renderCreatePreview();
}

function updateCreatePreviewOrientation(image) {
  image.classList.toggle('is-wide', image.naturalWidth / image.naturalHeight > .8);
}

function renderPostMediaPreview() {
  if (!postMediaPreview) return;
  postMediaPreview.replaceChildren();
  postMediaPreview.hidden = !selectedPostMedia.length;
  selectedPostMedia.forEach((media, index) => {
    const item = makeElement('span', 'post-media-item');
    item.append(makeElement('span', 'post-media-name', media.file.name));
    const remove = makeElement('button', 'post-media-remove', 'Remove');
    remove.type = 'button';
    remove.setAttribute('aria-label', `Remove ${media.file.name}`);
    remove.addEventListener('click', () => {
      const [removed] = selectedPostMedia.splice(index, 1);
      if (removed.previewUrl) URL.revokeObjectURL(removed.previewUrl);
      postMediaInput.value = '';
      renderPostMediaPreview();
    });
    item.append(remove);
    postMediaPreview.append(item);
  });
}

function validatePostMedia(file) {
  if (!file) return null;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if ((!isImage && !isVideo) ||
      (isImage && !POST_MEDIA_TYPES.image.includes(file.type)) ||
      (isVideo && !POST_MEDIA_TYPES.video.includes(file.type))) {
    throw new Error('Choose a supported JPG, PNG, WebP, GIF, MP4, WebM, or QuickTime file.');
  }
  const limit = isImage ? POST_IMAGE_MAX_BYTES : POST_VIDEO_MAX_BYTES;
  if (file.size > limit) throw new Error(`${isImage ? 'Images' : 'Clips'} must be ${isImage ? POST_IMAGE_MAX_BYTES / (1024 * 1024) : POST_VIDEO_MAX_BYTES / (1024 * 1024)}MB or smaller.`);
  return { file, kind: isImage ? 'image' : 'video' };
}

async function signPostMedia(posts) {
  const paths = [...new Set(posts.flatMap(post => {
    const media = Array.isArray(post.media_items) ? post.media_items : [];
    return media.length ? media.map(item => item.path) : [post.media_path];
  }).filter(Boolean))];
  const missing = paths.filter(path => !postMediaUrls.has(path));
  if (!missing.length) return;
  const { data, error } = await supabase.storage.from('post-media').createSignedUrls(missing, 3600);
  if (error) throw error;
  (data || []).forEach(result => { if (result.path && result.signedUrl) postMediaUrls.set(result.path, result.signedUrl); });
  const unsigned = missing.filter(path => !postMediaUrls.has(path));
  if (unsigned.length) throw new Error('Some post media could not be opened. Check post-media Storage read permissions.');
}

function postMediaItems(post) {
  if (Array.isArray(post.media_items) && post.media_items.length) return post.media_items;
  return post.media_path ? [{
    path: post.media_path,
    mime: post.media_mime,
    kind: post.media_kind
  }] : [];
}

function appendPostMedia(container, post, immersive = false) {
  const mediaItems = postMediaItems(post);
  if (!mediaItems.length) return false;
  const multiple = mediaItems.length > 1;
  const gallery = multiple
    ? makeElement('div', immersive ? 'reel-gallery' : 'post-media-gallery')
    : container;
  if (multiple) {
    gallery.setAttribute('role', 'group');
    gallery.setAttribute('aria-label', `${mediaItems.length} photos`);
  }

  mediaItems.forEach((media, index) => {
    const target = multiple
      ? makeElement('div', immersive ? 'reel-slide' : 'post-media-slide')
      : gallery;
    const mediaUrl = postMediaUrls.get(media.path);
    if (!mediaUrl) {
      target.append(makeElement('p', 'post-media-unavailable', 'This post’s media could not be loaded.'));
    } else if (media.kind === 'image') {
      const image = makeElement('img', immersive ? 'reel-media' : 'post-media-image');
      image.src = mediaUrl;
      image.alt = multiple
        ? `Photo ${index + 1} of ${mediaItems.length}: ${post.content || 'Photo shared on VYBE'}`
        : post.content ? `Photo post: ${post.content}` : 'Photo shared on VYBE';
      image.loading = 'lazy';
      if (immersive) {
        image.decoding = 'async';
        image.addEventListener('load', () => {
          if (image.naturalWidth && image.naturalHeight) image.classList.toggle('is-wide', image.naturalWidth / image.naturalHeight > .8);
        }, { once: true });
      }
      target.append(image);
    } else if (media.kind === 'video') {
      const video = makeElement('video', immersive ? 'reel-media' : 'post-media-video');
      video.src = mediaUrl;
      video.preload = 'metadata';
      if (immersive) {
        video.loop = true;
        video.muted = true;
        video.defaultMuted = true;
        video.playsInline = true;
        video.controls = false;
        video.setAttribute('disablepictureinpicture', '');
        video.setAttribute('aria-label', 'Video post. Tap to pause or play.');
        observeImmersiveVideo(video);
      } else {
        video.controls = true;
        video.setAttribute('aria-label', 'Attached video clip');
      }
      target.append(video);
    }
    if (target !== gallery) gallery.append(target);
  });

  if (gallery !== container) container.append(gallery);
  if (immersive && multiple) {
    const dots = makeElement('div', 'reel-dots');
    dots.setAttribute('aria-hidden', 'true');
    mediaItems.forEach((_, index) => dots.append(makeElement('i', index === 0 ? 'is-on' : '')));
    gallery.addEventListener('scroll', () => {
      const current = Math.round(gallery.scrollLeft / Math.max(1, gallery.clientWidth));
      [...dots.children].forEach((dot, index) => dot.classList.toggle('is-on', index === current));
    }, { passive: true });
    container.append(dots);
  }
  return true;
}

function formatPostDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const minutes = Math.round((date.getTime() - Date.now()) / 60000);
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(hours, 'hour');
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function observeImmersiveVideo(video) {
  if (!isImmersiveFeed) return;
  video.addEventListener('loadedmetadata', () => {
    if (video.videoWidth && video.videoHeight) video.classList.toggle('is-wide', video.videoWidth / video.videoHeight > .8);
  }, { once: true });
  video.addEventListener('timeupdate', () => {
    const item = video.closest('.reel');
    if (item && video.duration) item.style.setProperty('--p', String(video.currentTime / video.duration));
  });
  video.addEventListener('play', () => video.closest('.reel')?.classList.remove('is-paused'));
  video.addEventListener('pause', () => video.closest('.reel')?.classList.add('is-paused'));
  video.addEventListener('waiting', () => video.closest('.reel')?.classList.add('is-buffering'));
  video.addEventListener('playing', () => video.closest('.reel')?.classList.remove('is-buffering'));
}

function renderPost(post, avatarUrl = '') {
  if (isImmersiveFeed && !isCardFeedLayout) return renderImmersivePost(post, avatarUrl);
  const item = makeElement('li', 'feed-post');
  item.dataset.postId = post.id;
  item.dataset.mediaKind = post.media_kind || 'text';
  item.id = `post-${post.id}`;
  item.dataset.searchText = `${post.content} ${post.author_display_name || ''} ${post.author_username || ''}`.toLocaleLowerCase();
  const article = makeElement('article', 'post-card');

  const header = makeElement('header', 'post-header');
  const identity = makeElement('div', 'post-identity');
  const avatar = makeElement('span', `post-avatar${post.is_anonymous ? ' is-anonymous' : ''}`);
  const avatarInitial = makeElement('span', 'post-avatar-initial', post.is_anonymous ? '◉' : (sanitizeName(post.author_display_name) || 'V').slice(0, 1).toUpperCase());
  avatar.append(avatarInitial);
  if (avatarUrl && !post.is_anonymous) {
    const image = makeElement('img', 'post-avatar-image');
    image.src = avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('load', () => { avatarInitial.hidden = true; }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    avatar.append(image);
  }
  if (post.author_profile_id && !post.is_anonymous) {
    const avatarLink = makeElement('a', 'post-avatar-link');
    avatarLink.href = `profile.html?id=${encodeURIComponent(post.author_profile_id)}`;
    avatarLink.setAttribute('aria-label', `View ${sanitizeName(post.author_display_name) || 'member'}’s profile`);
    avatarLink.append(avatar);
    identity.append(avatarLink);
  } else {
    identity.append(avatar);
  }
  const author = makeElement('div', 'post-author');
  if (post.is_anonymous) {
    author.append(makeElement('span', 'post-anonymous-label', 'Anonymous'));
  } else if (post.author_profile_id) {
    const link = makeElement('a', 'post-author-link', sanitizeName(post.author_display_name) || 'VYBE member');
    link.href = `profile.html?id=${encodeURIComponent(post.author_profile_id)}`;
    author.append(link);
    if (post.author_username) author.append(makeElement('span', 'post-author-handle', `@${post.author_username}`));
  } else {
    author.append(makeElement('span', 'post-author-name', sanitizeName(post.author_display_name) || 'VYBE member'));
  }
  identity.append(author);
  header.append(identity);

  const timestamp = formatPostDate(post.created_at);
  if (timestamp) {
    const time = makeElement('time', 'post-time', timestamp);
    time.dateTime = post.created_at;
    header.append(time);
  }

  if (post.can_edit) {
    const actions = makeElement('div', 'post-owner-actions');
    const edit = makeElement('button', 'post-owner-action', 'Edit');
    edit.type = 'button';
    edit.dataset.postEdit = '';
    edit.setAttribute('aria-label', 'Edit your post');
    const remove = makeElement('button', 'post-owner-action', 'Delete');
    remove.type = 'button';
    remove.dataset.postDelete = '';
    remove.setAttribute('aria-label', 'Delete your post');
    actions.append(edit, remove);
    header.append(actions);
  }

  const content = makeElement('p', 'post-content', post.content);
  article.append(header, content);
  if (postMediaItems(post).length) {
    article.classList.add('post-card-media');
    appendPostMedia(article, post);
  }
  const actions = makeElement('div', 'post-actions');
  const conversation = makeElement('a', 'post-action', 'Join the conversation');
  conversation.href = 'community.html?room=campus-gist';
  const share = makeElement('button', 'post-action post-share', 'Share');
  share.type = 'button';
  share.dataset.postShare = '';
  share.setAttribute('aria-label', 'Copy a link to this post');
  share.dataset.postUrl = `${window.location.origin}/home.html#post-${post.id}`;
  actions.append(conversation, share);
  article.append(actions);
  item.append(article);
  return item;
}

const REEL_PALETTES = [
  ['#7357E8', '#4B33B8', '#ffffff'],
  ['#F2504A', '#C2336B', '#ffffff'],
  ['#FFD166', '#FF9A5C', '#211D2B'],
  ['#BDEBD7', '#5CC7A5', '#211D2B'],
  ['#2B2350', '#5B3FD1', '#ffffff'],
  ['#EAE4FF', '#B7A5FF', '#211D2B'],
  ['#0E7C66', '#0B4F4A', '#ffffff'],
  ['#8E2DE2', '#4A00E0', '#ffffff']
];

const REEL_ICONS = {
  heart: 'M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5c0 6.1-8 11-8 11Z',
  chat: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-5 4.5V16h-.5A2.5 2.5 0 0 1 4 13.5Z',
  share: 'M12 3v12|M7.5 7.5 12 3l4.5 4.5|M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12',
  more: 'M5 12h.01|M12 12h.01|M19 12h.01',
  play: 'M8 5.5v13l11-6.5Z',
  anon: 'M12 12.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z|M5 20a7 7 0 0 1 14 0'
};

function reelIcon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  REEL_ICONS[name].split('|').forEach(d => {
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  });
  return svg;
}

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatCount(value) {
  const number = Number(value) || 0;
  if (number >= 1e6) return `${(number / 1e6).toFixed(number >= 1e7 ? 0 : 1).replace(/\.0$/, '')}M`;
  if (number >= 1e3) return `${(number / 1e3).toFixed(number >= 1e4 ? 0 : 1).replace(/\.0$/, '')}K`;
  return String(number);
}

function showReelToast(message) {
  if (!reelToast || !message) return;
  reelToast.textContent = message;
  reelToast.hidden = false;
  window.clearTimeout(reelToastTimer);
  reelToastTimer = window.setTimeout(() => { reelToast.hidden = true; }, 3200);
}

function renderImmersivePost(post, avatarUrl = '') {
  const kind = post.media_kind || 'text';
  const item = makeElement('li', `feed-post reel reel-${kind}`);
  item.dataset.postId = post.id;
  item.dataset.mediaKind = kind;
  item.id = `post-${post.id}`;
  item.dataset.searchText = `${post.content} ${post.author_display_name || ''} ${post.author_username || ''}`.toLocaleLowerCase();
  const frame = makeElement('article', 'reel-frame');
  const hasMedia = postMediaItems(post).length > 0;
  const authorName = post.is_anonymous ? 'Anonymous' : (sanitizeName(post.author_display_name) || 'VYBE member');
  const profileHref = post.author_profile_id && !post.is_anonymous
    ? `profile.html?id=${encodeURIComponent(post.author_profile_id)}`
    : '';

  const visual = makeElement('div', `reel-visual${hasMedia ? '' : ' reel-text'}`);
  if (hasMedia) {
    appendPostMedia(visual, post, true);
  } else {
    const [from, to, ink] = REEL_PALETTES[hashString(String(post.id)) % REEL_PALETTES.length];
    const length = (post.content || '').length;
    visual.style.setProperty('--a', from);
    visual.style.setProperty('--b', to);
    visual.style.setProperty('--fg', ink);
    visual.style.setProperty('--size', length < 50 ? '2.7rem' : length < 110 ? '2.1rem' : length < 200 ? '1.7rem' : length < 400 ? '1.35rem' : '1.1rem');
    visual.append(
      makeElement('span', 'reel-kind', post.is_anonymous ? 'Anonymous gist' : 'Thought'),
      makeElement('p', 'reel-statement', post.content)
    );
  }
  const shade = makeElement('div', 'reel-shade');

  const info = makeElement('div', 'reel-info');
  const byline = makeElement('div', 'reel-byline');
  if (profileHref) {
    const author = makeElement('a', 'reel-author', authorName);
    author.href = profileHref;
    byline.append(author);
  } else {
    byline.append(makeElement('span', 'reel-author', authorName));
  }
  const when = formatPostDate(post.created_at);
  if (when) {
    const time = makeElement('time', 'reel-time', when);
    time.dateTime = post.created_at;
    byline.append(time);
  }
  info.append(byline);
  if (hasMedia && post.content) info.append(makeElement('p', 'reel-caption', post.content));

  const rail = makeElement('div', 'reel-rail');
  if (post.is_anonymous) {
    const anonymous = makeElement('span', 'reel-avatar is-anonymous');
    anonymous.append(reelIcon('anon'));
    rail.append(anonymous);
  } else {
    const creator = makeElement('div', 'reel-creator');
    const shell = makeElement(profileHref ? 'a' : 'span', 'reel-avatar-link');
    if (profileHref) {
      shell.href = profileHref;
      shell.setAttribute('aria-label', `${authorName}’s profile`);
    }
    const avatar = makeElement('span', 'reel-avatar', authorName.slice(0, 1).toUpperCase());
    if (avatarUrl) {
      const image = makeElement('img', 'reel-avatar-image');
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('load', () => { avatar.firstChild.textContent = ''; }, { once: true });
      image.addEventListener('error', () => image.remove(), { once: true });
      image.src = avatarUrl;
      avatar.append(image);
    }
    shell.append(avatar);
    creator.append(shell);
    const authorId = post.author_profile_id;
    if (authorId && !post.can_edit && authorId !== currentUserId && followingKnown.has(authorId) && !followingIds.has(authorId)) {
      const follow = makeElement('button', 'reel-follow', '+');
      follow.type = 'button';
      follow.dataset.postFollow = '';
      follow.dataset.authorId = authorId;
      follow.setAttribute('aria-label', `Follow ${authorName}`);
      creator.append(follow);
    }
    rail.append(creator);
  }

  const like = makeElement('button', 'reel-action reel-like');
  like.type = 'button';
  like.dataset.postLike = '';
  like.append(reelIcon('heart'), makeElement('span', 'reel-count', 'Like'));
  const discuss = makeElement('a', 'reel-action');
  discuss.href = 'community.html?room=campus-gist';
  discuss.setAttribute('aria-label', 'Join the Community conversation');
  discuss.append(reelIcon('chat'), makeElement('span', '', 'Gist'));
  const share = makeElement('button', 'reel-action');
  share.type = 'button';
  share.dataset.postShare = '';
  share.dataset.postUrl = `${window.location.origin}/vibe.html#post-${post.id}`;
  share.setAttribute('aria-label', 'Share this post');
  share.append(reelIcon('share'), makeElement('span', '', 'Share'));
  rail.append(like, discuss, share);

  if (post.can_edit) {
    const owner = makeElement('div', 'reel-owner');
    const more = makeElement('button', 'reel-action reel-more');
    more.type = 'button';
    more.dataset.reelMore = '';
    more.setAttribute('aria-label', 'More options for your post');
    more.setAttribute('aria-expanded', 'false');
    more.append(reelIcon('more'), makeElement('span', '', 'More'));
    const menu = makeElement('div', 'reel-menu');
    menu.hidden = true;
    const edit = makeElement('button', '', 'Edit');
    edit.type = 'button';
    edit.dataset.postEdit = '';
    const remove = makeElement('button', '', 'Delete');
    remove.type = 'button';
    remove.dataset.postDelete = '';
    menu.append(edit, remove);
    owner.append(more, menu);
    rail.append(owner);
  }

  frame.append(visual, shade, info, rail);
  if (visual.querySelector('video')) {
    const flash = makeElement('div', 'reel-flash');
    flash.setAttribute('aria-hidden', 'true');
    flash.append(reelIcon('play'));
    frame.append(flash, makeElement('div', 'reel-progress'));
  }
  item.append(frame);
  paintReelLike(item);
  return item;
}

/* ---- Likes ---------------------------------------------------------------- */

function isMissingBackend(error) {
  return ['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code);
}

function localLikesKey() {
  return `vybe-local-likes:${currentUserId || 'guest'}`;
}

function readLocalLikes() {
  try {
    return new Set(JSON.parse(window.localStorage.getItem(localLikesKey()) || '[]'));
  } catch {
    return new Set();
  }
}

function writeLocalLike(id, liked) {
  const likes = readLocalLikes();
  if (liked) likes.add(id); else likes.delete(id);
  try {
    window.localStorage.setItem(localLikesKey(), JSON.stringify([...likes].slice(-500)));
  } catch { /* Private mode: the like simply won't survive a reload. */ }
}

function paintReelLike(item) {
  const button = item.querySelector('[data-post-like]');
  if (!button) return;
  const state = likeStates.get(item.dataset.postId) || { liked: false, count: 0 };
  button.setAttribute('aria-pressed', String(state.liked));
  button.setAttribute('aria-label', state.liked ? 'Unlike this post' : 'Like this post');
  const label = button.querySelector('.reel-count');
  if (!label) return;
  if (likeBackend === 'missing') label.textContent = state.liked ? 'Liked' : 'Like';
  else label.textContent = state.count > 0 ? formatCount(state.count) : 'Like';
}

function repaintReelLikes() {
  feedPostList?.querySelectorAll('.reel[data-post-id]').forEach(paintReelLike);
}

async function loadLikeStates(posts) {
  const ids = posts.map(post => post.id).filter(Boolean);
  if (!ids.length) return;
  if (likeBackend !== 'missing') {
    try {
      const { data, error } = await supabase.rpc('get_post_like_state', { p_post_ids: ids });
      if (error) throw error;
      likeBackend = 'ok';
      (data || []).forEach(row => {
        if (likePending.has(row.post_id)) return;
        likeStates.set(row.post_id, { liked: Boolean(row.liked_by_me), count: Number(row.like_count) || 0 });
      });
      return;
    } catch (error) {
      if (!isMissingBackend(error)) {
        console.warn('VYBE could not load likes:', error);
        return;
      }
      likeBackend = 'missing';
    }
  }
  const local = readLocalLikes();
  ids.forEach(id => {
    if (!likePending.has(id)) likeStates.set(id, { liked: local.has(id), count: 0 });
  });
}

async function setReelLike(item, wantLiked) {
  const id = item?.dataset.postId;
  if (!id || likePending.has(id)) return;
  const before = likeStates.get(id) || { liked: false, count: 0 };
  const next = typeof wantLiked === 'boolean' ? wantLiked : !before.liked;
  if (next === before.liked) return;
  likePending.add(id);
  likeStates.set(id, { liked: next, count: Math.max(0, before.count + (next ? 1 : -1)) });
  paintReelLike(item);
  if (next) { try { navigator.vibrate?.(8); } catch { /* Not supported. */ } }
  try {
    if (likeBackend === 'missing') {
      writeLocalLike(id, next);
      return;
    }
    const { data, error } = await supabase.rpc('set_post_like', { p_post_id: id, p_liked: next });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) throw new Error('VYBE could not confirm that like.');
    likeBackend = 'ok';
    likeStates.set(id, { liked: Boolean(row.liked), count: Number(row.like_count) || 0 });
  } catch (error) {
    if (isMissingBackend(error)) {
      likeBackend = 'missing';
      writeLocalLike(id, next);
    } else {
      likeStates.set(id, before);
      showReelToast('Couldn’t save that like. Try again.');
    }
  } finally {
    likePending.delete(id);
    repaintReelLikes();
  }
}

/* ---- Follow --------------------------------------------------------------- */

async function loadFollowingStates(posts) {
  if (!currentUserId) return;
  const ids = [...new Set(posts
    .filter(post => post.author_profile_id && !post.is_anonymous && !post.can_edit && post.author_profile_id !== currentUserId)
    .map(post => post.author_profile_id))]
    .filter(id => !followingKnown.has(id));
  if (!ids.length) return;
  try {
    const { data, error } = await supabase.from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId)
      .in('following_id', ids);
    if (error) throw error;
    ids.forEach(id => followingKnown.add(id));
    (data || []).forEach(row => followingIds.add(row.following_id));
  } catch (error) {
    console.warn('VYBE could not check who you follow:', error);
  }
}

async function followReelAuthor(button) {
  const authorId = button.dataset.authorId;
  if (!authorId || button.disabled) return;
  button.disabled = true;
  try {
    const { data, error } = await supabase.rpc('toggle_follow', { target_user: authorId });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.following !== 'boolean') throw new Error('VYBE could not confirm that follow.');
    if (result.following) followingIds.add(authorId); else followingIds.delete(authorId);
    feedPostList.querySelectorAll(`[data-post-follow][data-author-id="${CSS.escape(authorId)}"]`)
      .forEach(el => el.classList.toggle('is-following', result.following));
    showReelToast(result.following ? 'Following' : 'Unfollowed');
  } catch (error) {
    showReelToast(error.message || 'Couldn’t follow right now. Try again.');
  } finally {
    button.disabled = false;
  }
}

/* ---- Playback and navigation ---------------------------------------------- */

function syncReelSoundButton() {
  if (!reelSoundButton) return;
  reelSoundButton.setAttribute('aria-pressed', String(reelSoundOn));
  reelSoundButton.setAttribute('aria-label', reelSoundOn ? 'Mute sound' : 'Turn sound on');
}

function setReelSound(on) {
  reelSoundOn = on;
  try { window.localStorage.setItem(REEL_SOUND_KEY, on ? '1' : '0'); } catch { /* Optional. */ }
  feedPostList?.querySelectorAll('video').forEach(video => { video.muted = !on; });
  syncReelSoundButton();
}

function playReelVideo(video) {
  video.muted = !reelSoundOn;
  const attempt = video.play();
  if (attempt && typeof attempt.catch === 'function') {
    attempt.catch(() => {
      if (!video.muted) {
        video.muted = true;
        reelSoundOn = false;
        syncReelSoundButton();
        video.play().catch(() => { /* Tap the video to play. */ });
      }
    });
  }
}

function activateReel(item) {
  if (!item.dataset.postId || activeReel === item) return;
  if (activeReel) deactivateReel(activeReel);
  activeReel = item;
  item.classList.add('is-active');
  const video = item.querySelector('video');
  document.body.classList.toggle('reel-has-video', Boolean(video));
  if (video && !composerSheet?.open) {
    delete video.dataset.userPaused;
    playReelVideo(video);
  }
  const next = item.nextElementSibling;
  next?.querySelectorAll('video').forEach(upcoming => { upcoming.preload = 'auto'; });
  const siblings = [...feedPostList.children];
  if (feedHasMore && feedAutoLoadEnabled && !feedRequest && siblings.length - siblings.indexOf(item) <= 4) loadFeed();
}

function deactivateReel(item) {
  item.classList.remove('is-active');
  item.querySelectorAll('video').forEach(video => {
    video.pause();
    try { video.currentTime = 0; } catch { /* Not seekable yet. */ }
  });
  if (activeReel === item) activeReel = null;
}

function togglePlayback(item) {
  const video = item.querySelector('video');
  if (!video) return;
  if (video.paused) {
    delete video.dataset.userPaused;
    playReelVideo(video);
  } else {
    video.dataset.userPaused = '1';
    video.pause();
  }
}

function stepReel(direction) {
  const items = [...feedPostList.children].filter(el => !el.hidden);
  if (!items.length) return;
  let index = items.indexOf(activeReel);
  if (index < 0 && isCardFeedLayout) {
    const midpoint = window.innerHeight / 2;
    index = items.reduce((closestIndex, item, itemIndex) => {
      const closestDistance = Math.abs(items[closestIndex].getBoundingClientRect().top - midpoint);
      const distance = Math.abs(item.getBoundingClientRect().top - midpoint);
      return distance < closestDistance ? itemIndex : closestIndex;
    }, 0);
  }
  index = Math.max(0, index);
  const target = items[Math.min(items.length - 1, Math.max(0, index + direction))];
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function spawnHeartBurst(item, clientX, clientY) {
  const frame = item.querySelector('.reel-frame');
  if (!frame) return;
  const rect = frame.getBoundingClientRect();
  const burst = makeElement('span', 'reel-burst');
  burst.setAttribute('aria-hidden', 'true');
  burst.append(reelIcon('heart'));
  burst.style.left = `${clientX - rect.left}px`;
  burst.style.top = `${clientY - rect.top}px`;
  burst.style.setProperty('--tilt', `${Math.round(Math.random() * 30 - 15)}deg`);
  frame.append(burst);
  burst.addEventListener('animationend', () => burst.remove(), { once: true });
  window.setTimeout(() => burst.remove(), 1300);
}

function handleReelTap(item, event) {
  const id = item.dataset.postId;
  const now = Date.now();
  window.clearTimeout(reelTapTimer);
  if (reelLastTap.id === id && now - reelLastTap.time < 300) {
    reelLastTap = { id: '', time: 0 };
    spawnHeartBurst(item, event.clientX, event.clientY);
    setReelLike(item, true);
    return;
  }
  reelLastTap = { id, time: now };
  reelTapTimer = window.setTimeout(() => togglePlayback(item), 300);
}

function closeReelMenus() {
  feedPostList?.querySelectorAll('.reel-menu').forEach(menu => {
    if (menu.hidden) return;
    menu.hidden = true;
    menu.parentElement?.querySelector('[data-reel-more]')?.setAttribute('aria-expanded', 'false');
  });
}

function handleReelClick(event) {
  const target = event.target;
  const item = target.closest('.reel[data-post-id]');
  if (!item) {
    if (target.closest('[data-reel-end-post]')) startPostCreation('thought');
    else if (target.closest('[data-reel-top]')) feedPostList.scrollTo({ top: 0 });
    return;
  }
  const likeButton = target.closest('[data-post-like]');
  if (likeButton) { setReelLike(item); return; }
  const followButton = target.closest('[data-post-follow]');
  if (followButton) { followReelAuthor(followButton); return; }
  const moreButton = target.closest('[data-reel-more]');
  if (moreButton) {
    const menu = moreButton.parentElement.querySelector('.reel-menu');
    const open = menu.hidden;
    closeReelMenus();
    menu.hidden = !open;
    moreButton.setAttribute('aria-expanded', String(open));
    return;
  }
  if (target.closest('[data-post-edit], [data-post-delete]')) closeReelMenus();
  const caption = target.closest('.reel-caption');
  if (caption) { caption.classList.toggle('is-open'); return; }
  if (!target.closest('.reel-visual') || target.closest('a, button')) return;
  handleReelTap(item, event);
}

function handleReelKeys(event) {
  if (event.key === 'Escape') closeReelMenus();
  if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
  if (composerSheet?.open) return;
  if (event.target.closest?.('input, textarea, select, [contenteditable="true"]')) return;
  const key = event.key.toLowerCase();
  if (key === 'arrowdown' || key === 'j' || key === 'pagedown') {
    event.preventDefault();
    stepReel(1);
  } else if (key === 'arrowup' || key === 'k' || key === 'pageup') {
    event.preventDefault();
    stepReel(-1);
  } else if (key === 'l' && activeReel) {
    if (!likeStates.get(activeReel.dataset.postId)?.liked) {
      const rect = activeReel.getBoundingClientRect();
      spawnHeartBurst(activeReel, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }
    setReelLike(activeReel);
  } else if (key === 'm') {
    setReelSound(!reelSoundOn);
  } else if (key === ' ' && activeReel && !event.target.closest?.('button, a')) {
    event.preventDefault();
    togglePlayback(activeReel);
  }
}

function openComposerSheet() {
  document.body.classList.add('is-composing');
  activeReel?.querySelector('video')?.pause();
  if (composerSheet && !composerSheet.open) {
    updateComposerViewport();
    composerSheet.showModal();
  }
}

function closeComposerSheet() {
  requestComposerClose();
}

function composerHasUnsavedChanges() {
  if (editingPostId) {
    return postContentInput.value !== composerInitialState?.content ||
      postAnonymousInput.checked !== composerInitialState?.anonymous;
  }
  return selectedPostMedia.length > 0 || Boolean(postContentInput.value.trim()) || postAnonymousInput.checked;
}

function requestComposerClose() {
  if (composerBusy || !composerSheet?.open) return;
  if (!isImmersiveFeed) {
    composerSheet.close();
    return;
  }
  if (composerHasUnsavedChanges()) {
    discardConfirm.hidden = false;
    discardKeepButton.focus({ preventScroll: true });
    return;
  }
  resetComposer();
}

function finishComposerDiscard() {
  if (discardConfirm) discardConfirm.hidden = true;
  resetComposer();
}

function updateComposerViewport() {
  if (!composerSheet) return;
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty('--composer-vh', `${height}px`);
}

function showNewPostsPill(count) {
  if (!reelNewPill) return;
  reelNewPill.textContent = count === 1 ? '1 new post' : `${count} new posts`;
  reelNewPill.hidden = false;
}

function hideNewPostsPill() {
  if (reelNewPill) reelNewPill.hidden = true;
}

function reelPostChanged(post) {
  const previous = loadedPosts.get(post.id);
  return !previous || previous.updated_at !== post.updated_at || previous.content !== post.content;
}

function showFeedEnd() {
  if (!isImmersiveFeed) {
    setFeedState('You’re all caught up.', 'empty');
    return;
  }
  setFeedState('');
  if (feedPostList.querySelector('.reel-end') || !feedPostList.querySelector('[data-post-id]')) return;
  const end = makeElement('li', 'reel reel-end');
  const card = makeElement('div', 'reel-end-card');
  const actions = makeElement('div', 'reel-end-actions');
  const post = makeElement('button', 'reel-end-primary', 'Post something');
  post.type = 'button';
  post.dataset.reelEndPost = '';
  const top = makeElement('button', 'reel-end-secondary', 'Back to top');
  top.type = 'button';
  top.dataset.reelTop = '';
  actions.append(post, top);
  card.append(
    makeElement('h2', '', 'You’re all caught up'),
    makeElement('p', '', 'New posts show up here as people share. Start something yourself while you wait.'),
    actions
  );
  end.append(card);
  feedPostList.append(end);
}

function scrollToHashPost() {
  let id = '';
  try { id = decodeURIComponent(window.location.hash.slice(1)); } catch { return; }
  if (!id.startsWith('post-')) return;
  const target = document.getElementById(id);
  if (!target || !feedPostList.contains(target)) return;
  feedPostList.style.scrollBehavior = 'auto';
  target.scrollIntoView({ block: 'start' });
  feedPostList.style.scrollBehavior = '';
}

function initReel() {
  if (reelObserver || !feedPostList) return;
  try { reelSoundOn = window.localStorage.getItem(REEL_SOUND_KEY) === '1'; } catch { reelSoundOn = false; }
  syncReelSoundButton();
  if (!('IntersectionObserver' in window)) return;
  reelObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting && entry.intersectionRatio >= .6) activateReel(entry.target);
      else if (entry.target === activeReel && entry.intersectionRatio < .3) deactivateReel(entry.target);
    });
  }, { root: feedPostList, threshold: [0, .3, .6, .9] });
}

function bindReelInteractions() {
  if (!feedPostList) return;
  feedPostList.addEventListener('click', handleReelClick);
  document.addEventListener('click', event => {
    if (!event.target.closest('.reel-owner')) closeReelMenus();
  });
  document.addEventListener('keydown', handleReelKeys);
  reelSoundButton?.addEventListener('click', () => setReelSound(!reelSoundOn));
  reelNewPill?.addEventListener('click', () => {
    hideNewPostsPill();
    insertNewOnRefresh = true;
    feedPostList.scrollTo({ top: 0 });
    refreshFeedHead();
  });
  $('[data-reel-prev]')?.addEventListener('click', () => stepReel(-1));
  $('[data-reel-next]')?.addEventListener('click', () => stepReel(1));
  document.addEventListener('visibilitychange', () => {
    const video = activeReel?.querySelector('video');
    if (!video) return;
    if (document.visibilityState === 'hidden') video.pause();
    else if (!composerSheet?.open && !video.dataset.userPaused) playReelVideo(video);
  });
  $('[data-composer-close]')?.addEventListener('click', closeComposerSheet);
  composerSheet?.addEventListener('cancel', event => {
    event.preventDefault();
    if (!discardConfirm.hidden) {
      if (discardConfirm) discardConfirm.hidden = true;
      $('[data-composer-close]')?.focus({ preventScroll: true });
      return;
    }
    requestComposerClose();
  });
  composerSheet?.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || discardConfirm.hidden) return;
    const controls = $$('button:not(:disabled), textarea:not(:disabled), input:not(:disabled)', discardConfirm)
      .filter(control => !control.hidden);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  discardKeepButton?.addEventListener('click', () => {
    discardConfirm.hidden = true;
    $('[data-composer-close]')?.focus({ preventScroll: true });
  });
  discardConfirmButton?.addEventListener('click', finishComposerDiscard);
  createRetryButton?.addEventListener('click', () => postForm.requestSubmit());
  createChoiceButtons.forEach(button => button.addEventListener('click', () => {
    startPostCreation(button.dataset.createSelect);
  }));
  createCaptureButtons.forEach(button => button.addEventListener('click', () => {
    if (!composerSheet?.open) startPostCreation();
    launchCreatePicker(button.dataset.createCapture, 'new', 'environment');
  }));
  createReplaceMedia?.addEventListener('click', () => {
    const current = selectedPostMedia[createMediaIndex];
    if (current) launchCreatePicker(current.kind, 'replace');
  });
  createRemoveMedia?.addEventListener('click', removeCreateMedia);
  createAddPhotos?.addEventListener('click', () => launchCreatePicker('image', 'add'));
  createPrevPhoto?.addEventListener('click', () => {
    createMediaIndex = Math.max(0, createMediaIndex - 1);
    renderCreatePreview();
  });
  createNextPhoto?.addEventListener('click', () => {
    createMediaIndex = Math.min(currentCreateMedia().length - 1, createMediaIndex + 1);
    renderCreatePreview();
  });
  $('[data-create-video-sound]')?.addEventListener('click', event => {
    createSoundOn = !createSoundOn;
    const button = event.currentTarget;
    const video = createPreviewMedia.querySelector('video');
    button.setAttribute('aria-pressed', String(createSoundOn));
    button.setAttribute('aria-label', createSoundOn ? 'Mute preview sound' : 'Turn preview sound on');
    button.textContent = createSoundOn ? 'Sound on' : 'Sound off';
    if (video) {
      video.muted = !createSoundOn;
      if (createSoundOn) video.play().catch(() => {
        createSoundOn = false;
        video.muted = true;
        button.setAttribute('aria-pressed', 'false');
        button.setAttribute('aria-label', 'Turn preview sound on');
        button.textContent = 'Sound off';
      });
    }
  });
  window.visualViewport?.addEventListener('resize', updateComposerViewport);
  window.visualViewport?.addEventListener('scroll', updateComposerViewport);
  composerSheet?.addEventListener('click', event => {
    if (event.target === composerSheet) closeComposerSheet();
  });
  composerSheet?.addEventListener('close', () => {
    document.body.classList.remove('is-composing');
    mobileCreateButton?.setAttribute('aria-expanded', 'false');
    const video = activeReel?.querySelector('video');
    if (video && !video.dataset.userPaused) playReelVideo(video);
    if (createRestoreFocus?.isConnected) createRestoreFocus.focus({ preventScroll: true });
    createRestoreFocus = null;
  });
}

async function hydrateFeedPosts(posts) {
  await signPostMedia(posts);
  if (isImmersiveFeed) await Promise.all([loadLikeStates(posts), loadFollowingStates(posts)]);
  const authorIds = [...new Set(posts
    .filter(post => !post.is_anonymous && post.author_profile_id)
    .map(post => post.author_profile_id))];
  const avatars = new Map();
  if (!authorIds.length) return avatars;

  try {
    const { data, error } = await supabase.rpc('get_profile_previews', { target_ids: authorIds });
    if (error) throw error;
    const profiles = data || [];
    const previewsById = new Map(profiles.map(profile => [profile.id, profile]));
    const signed = await signProfileAvatars(profiles);
    posts.forEach(post => {
      post.author_username = previewsById.get(post.author_profile_id)?.username || post.author_username || '';
    });
    return signed.urlsByProfileId;
  } catch (error) {
    console.warn('VYBE could not load some post author details:', error);
    return avatars;
  }
}

function unobservePostMedia(item) {
  reelObserver?.unobserve(item);
  if (activeReel === item) activeReel = null;
  item.querySelectorAll('video').forEach(video => {
    feedPlaybackObserver?.unobserve(video);
    if (activeFeedVideo === video) activeFeedVideo = null;
    video.pause();
  });
}

function upsertFeedPost(post, avatarUrl = '', prepend = false) {
  const existing = [...feedPostList.children].find(item => item.dataset.postId === post.id);
  const rendered = renderPost(post, avatarUrl);
  if (existing) {
    unobservePostMedia(existing);
    existing.replaceWith(rendered);
  } else if (prepend) {
    feedPostList.prepend(rendered);
  } else {
    feedPostList.append(rendered);
  }
  loadedPosts.set(post.id, post);
  if (isImmersiveFeed && !isCardFeedLayout) reelObserver?.observe(rendered);
}

function preserveFeedPosition(operation) {
  if (isImmersiveFeed) {
    operation();
    return;
  }
  const feedAtTop = window.scrollY < feedSection.getBoundingClientRect().top + window.scrollY + 120;
  const anchor = [...feedPostList.children].find(item => item.getBoundingClientRect().bottom > 0);
  const anchorId = anchor?.dataset.postId;
  const top = anchor?.getBoundingClientRect().top;
  operation();
  if (feedAtTop || !anchorId || top === undefined) return;
  requestAnimationFrame(() => {
    const currentAnchor = [...feedPostList.children].find(item => item.dataset.postId === anchorId);
    if (currentAnchor) window.scrollBy(0, currentAnchor.getBoundingClientRect().top - top);
  });
}

async function loadFeed({ reset = false } = {}) {
  if (feedRequest) {
    if (!reset) return feedRequest;
    await feedRequest;
  }

  if (reset) {
    feedCursor = null;
    feedHasMore = true;
    feedAutoLoadEnabled = true;
    feedRetry.hidden = true;
    feedMore.hidden = true;
    if (!feedPostList.childElementCount) setFeedState('Loading posts…');
  } else if (!feedHasMore) {
    if (feedPostList.childElementCount) showFeedEnd();
    else setFeedState('No posts yet. Start the gist with a post of your own.', 'empty');
    return true;
  } else {
    setFeedState(feedPostList.childElementCount ? 'Loading more posts…' : 'Loading posts…');
  }

  feedRefresh.disabled = true;
  feedMore.disabled = true;
  updateFeedFilters(true);
  const request = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_public_posts', {
        p_before_created_at: feedCursor?.created_at || null,
        p_before_id: feedCursor?.id || null,
        p_filter: feedFilter,
        p_limit: FEED_PAGE_SIZE + 1
      });
      if (error) throw error;

      const rows = data || [];
      const page = rows.slice(0, FEED_PAGE_SIZE);
      const postAvatars = await hydrateFeedPosts(page);
      feedHasMore = rows.length > FEED_PAGE_SIZE;
      if (reset) {
        [...feedPostList.children].forEach(unobservePostMedia);
        feedPostList.replaceChildren();
        loadedPosts.clear();
        if (isImmersiveFeed) {
          activeReel = null;
          hideNewPostsPill();
        }
      }
      const existingIds = new Set([...feedPostList.children].map(item => item.dataset.postId));
      page.forEach(post => {
        if (!existingIds.has(post.id)) upsertFeedPost(post, postAvatars.get(post.author_profile_id) || '');
      });
      applyHomeSearch();
      if (page.length) feedCursor = { created_at: page[page.length - 1].created_at, id: page[page.length - 1].id };

      if (!feedPostList.childElementCount && !feedHasMore) {
        setFeedState(
          feedFilter === 'anonymous'
            ? 'No anonymous posts yet. You can share one from here if you want a little cover.'
            : 'Quiet for now. If something’s on your mind, this is a good place to start.',
          'empty'
        );
      } else if (!feedHasMore) {
        showFeedEnd();
      } else {
        setFeedState('');
        if (isImmersiveFeed) feedPostList.querySelector('.reel-end')?.remove();
      }
      feedRetry.hidden = true;
      feedAutoLoadEnabled = true;
      feedMore.hidden = isImmersiveFeed || Boolean(feedObserver) || !feedHasMore;
      return true;
    } catch (error) {
      feedAutoLoadEnabled = false;
      setFeedState(`Couldn’t load posts. ${explainPostBackendError(error)}`, 'error');
      feedRetry.hidden = false;
      feedMore.hidden = true;
      return false;
    } finally {
      feedRequest = null;
      feedRefresh.disabled = false;
      updateFeedFilters();
      feedRetry.disabled = false;
      feedMore.disabled = false;
      if (feedRefreshPending) {
        feedRefreshPending = false;
        refreshFeedHead();
      }
    }
  })();
  feedRequest = request;
  return request;
}

async function refreshFeedHead() {
  if (!feedPostList || !currentUserId || document.visibilityState !== 'visible') return;
  if (feedRefreshingHead || feedRequest) {
    feedRefreshPending = true;
    return;
  }
  feedRefreshingHead = true;
  try {
    const { data, error } = await supabase.rpc('get_public_posts', {
      p_before_created_at: null,
      p_before_id: null,
      p_filter: feedFilter,
      p_limit: FEED_PAGE_SIZE
    });
    if (error) throw error;
    const posts = data || [];
    const avatars = await hydrateFeedPosts(posts);
    const existingIds = new Set([...feedPostList.children].map(item => item.dataset.postId));
    const newPosts = posts.filter(post => !existingIds.has(post.id));
    const insertNew = !isImmersiveFeed || insertNewOnRefresh;
    if (insertNew) insertNewOnRefresh = false;
    preserveFeedPosition(() => {
      posts.filter(post => existingIds.has(post.id))
        .filter(post => !isImmersiveFeed || reelPostChanged(post))
        .forEach(post => upsertFeedPost(post, avatars.get(post.author_profile_id) || ''));
      if (insertNew) newPosts.reverse().forEach(post => upsertFeedPost(post, avatars.get(post.author_profile_id) || '', true));
    });
    if (isImmersiveFeed) {
      repaintReelLikes();
      if (insertNew) hideNewPostsPill();
      else if (newPosts.length) showNewPostsPill(newPosts.length);
    }
    applyHomeSearch();
    if (newPosts.length && !isImmersiveFeed) {
      setFeedState(`${newPosts.length} new post${newPosts.length === 1 ? '' : 's'} loaded.`, 'success');
      window.setTimeout(() => {
        if (feedState.dataset.state === 'success') setFeedState('');
      }, 3000);
    }
    if (!feedPostList.childElementCount && !posts.length) {
      setFeedState(
        feedFilter === 'anonymous'
          ? 'No anonymous posts yet. You can share one from here if you want a little cover.'
          : 'Quiet for now. If something’s on your mind, this is a good place to start.',
        'empty'
      );
    }
  } catch (error) {
    setFeedState(`Couldn’t check for new posts. ${explainPostBackendError(error)}`, 'error');
    feedRetry.hidden = isImmersiveFeed && Boolean(feedPostList.childElementCount);
  } finally {
    feedRefreshingHead = false;
    if (feedRefreshPending) {
      feedRefreshPending = false;
      refreshFeedHead();
    }
  }
}

function handleFeedRealtimeChange(payload) {
  const changedId = payload.new?.id || payload.old?.id;
  if (payload.eventType === 'DELETE' && changedId) {
    const item = [...feedPostList.children].find(post => post.dataset.postId === changedId);
    if (item) {
      unobservePostMedia(item);
      item.remove();
      loadedPosts.delete(changedId);
    }
  }
  refreshFeedHead();
}

function startFeedRealtime() {
  if (!feedSection || !supabase || feedChannel) return;
  feedChannel = supabase
    .channel(`feed:posts:${currentUserId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'posts'
    }, handleFeedRealtimeChange)
    .subscribe(status => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setFeedState('Live updates are unavailable. VYBE will keep checking for new posts.', 'error');
      }
    });
  feedRefreshTimer = window.setInterval(refreshFeedHead, 30000);
  window.addEventListener('pagehide', stopFeedRealtime, { once: true });
}

function stopFeedRealtime() {
  if (feedRefreshTimer) window.clearInterval(feedRefreshTimer);
  feedRefreshTimer = null;
  if (feedChannel) supabase?.removeChannel(feedChannel);
  feedChannel = null;
}

function resumeFeedRealtime() {
  if (!currentUserId || !feedSection) return;
  startFeedRealtime();
  refreshFeedHead();
}

function resetComposer() {
  releaseSelectedPostMedia();
  postForm.reset();
  editingMediaPreview = [];
  createMediaIndex = 0;
  createSoundOn = false;
  composerInitialState = null;
  renderPostMediaPreview();
  editingPostId = null;
  document.body.classList.remove('is-composing');
  if (discardConfirm) discardConfirm.hidden = true;
  if (composerSheet?.open) composerSheet.close();
  mobileCreateButton?.setAttribute('aria-expanded', 'false');
  postMediaTrigger.disabled = !currentUserId;
  postMediaInput.multiple = true;
  postMediaInput.accept = POST_MEDIA_ACCEPT;
  postMediaInput.removeAttribute('capture');
  postMediaInput.value = '';
  postMediaInput.disabled = !currentUserId;
  if (composerTitle) composerTitle.textContent = 'Create a post';
  postSubmitButton.textContent = isImmersiveFeed ? 'Post ↗' : 'Post';
  postCharacterCount.textContent = `0 / ${postContentInput.maxLength}`;
  if (createRetryButton) createRetryButton.hidden = true;
  if (createUploadProgress) createUploadProgress.hidden = true;
  showCreateStep('choose');
  setComposerStatus('');
}

function setComposerEditing(post) {
  editingPostId = post.id;
  postContentInput.value = post.content;
  postAnonymousInput.checked = post.is_anonymous;
  composerInitialState = { content: post.content, anonymous: post.is_anonymous };
  postCharacterCount.textContent = `${post.content.length} / ${postContentInput.maxLength}`;
  if (composerTitle) composerTitle.textContent = 'Edit your post';
  postSubmitButton.textContent = isImmersiveFeed ? 'Save ↗' : 'Save changes';
  postMediaTrigger.disabled = true;
  postMediaInput.disabled = true;
  editingMediaPreview = postMediaItems(post).map(media => ({
    ...media,
    url: postMediaUrls.get(media.path) || ''
  }));
  createMediaIndex = 0;
  if (isImmersiveFeed) {
    createRestoreFocus = document.activeElement;
    openComposerSheet();
    showCreateStep('preview');
    renderCreatePreview();
  } else {
    document.body.classList.add('is-composing');
  }
  setComposerStatus('Editing your post.');
  postContentInput.focus();
  updateCreateSubmitState();
  if (!isImmersiveFeed) feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitPost(event) {
  event.preventDefault();
  if (composerBusy) return;
  const content = postContentInput.value.trim();
  if (!content || content.length > postContentInput.maxLength) {
    setComposerStatus('Write a post between 1 and 2000 characters.', 'error');
    postContentInput.focus();
    return;
  }
  if (selectedPostMedia.length > MAX_POST_MEDIA ||
      (selectedPostMedia.length > 1 && selectedPostMedia.some(media => media.kind !== 'image'))) {
    setComposerStatus(`A post can include up to ${MAX_POST_MEDIA} photos or one video clip.`, 'error');
    return;
  }

  composerBusy = true;
  postSubmitButton.disabled = true;
  if (isImmersiveFeed) {
    postForm.inert = true;
    createUploadProgress.hidden = false;
    createRetryButton.hidden = true;
  }
  setComposerStatus(editingPostId ? 'Saving your changes…' : 'Publishing your post…');
  const uploadedPaths = [];
  let saved = false;
  let saveStateUnconfirmed = false;
  try {
    let post;
    const wasEditing = Boolean(editingPostId);
    if (editingPostId) {
      const { data, error } = await supabase.from('posts')
        .update({ content, is_anonymous: postAnonymousInput.checked })
        .eq('id', editingPostId)
        .select('id,author_id,content,post_type,is_anonymous,created_at,updated_at,media_path,media_mime,media_kind')
        .single();
      if (error) throw error;
      if (!data?.id) throw new Error('VYBE could not confirm that your changes were saved.');
      post = {
        ...loadedPosts.get(data.id),
        ...data,
        media_items: loadedPosts.get(data.id)?.media_items || [],
        author_display_name: currentAuthor.display_name,
        author_profile_id: postAnonymousInput.checked ? null : currentUserId,
        author_username: currentAuthor.username,
        can_edit: true
      };
    } else {
      const uploadedMedia = [];
      for (const selected of selectedPostMedia) {
        const safeName = selected.file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        const path = `${currentUserId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('post-media').upload(path, selected.file, {
          contentType: selected.file.type,
          cacheControl: '3600',
          upsert: false
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        uploadedMedia.push({ path, mime: selected.file.type, kind: selected.kind });
      }
      const postId = crypto.randomUUID();
      const { data, error } = await supabase.rpc('create_post_with_media', {
        p_post_id: postId,
        p_content: content,
        p_is_anonymous: postAnonymousInput.checked,
        p_media: uploadedMedia
      });

      if (error && ['PGRST202', '42883'].includes(error.code)) {
        if (uploadedMedia.length > 1) {
          throw new Error('Multiple-photo posts are not available until the reviewed Feed migration is applied.');
        }
        const primaryMedia = uploadedMedia[0];
        const legacyPayload = {
          author_id: currentUserId,
          content,
          post_type: primaryMedia?.kind || 'text',
          is_anonymous: postAnonymousInput.checked
        };
        if (primaryMedia) {
          Object.assign(legacyPayload, {
            media_path: primaryMedia.path,
            media_mime: primaryMedia.mime,
            media_kind: primaryMedia.kind
          });
        }
        const legacySelection = primaryMedia
          ? 'id,author_id,content,post_type,is_anonymous,created_at,updated_at,media_path,media_mime,media_kind'
          : 'id,author_id,content,post_type,is_anonymous,created_at,updated_at';
        const { data: legacyPost, error: legacyError } = await supabase.from('posts').insert(legacyPayload)
          .select(legacySelection)
          .single();
        if (legacyError) throw legacyError;
        post = { ...legacyPost, media_items: uploadedMedia };
      } else if (error) {
        const { data: confirmedPost, error: confirmError } = await supabase.from('posts')
          .select('id,author_id,content,post_type,is_anonymous,created_at,updated_at,media_path,media_mime,media_kind')
          .eq('id', postId)
          .maybeSingle();
        if (confirmError) {
          saveStateUnconfirmed = true;
          throw error;
        }
        if (!confirmedPost) throw error;
        post = { ...confirmedPost, media_items: uploadedMedia };
      } else {
        post = Array.isArray(data) ? data[0] : data;
      }
      if (!post?.id) throw new Error('VYBE could not confirm that your post was published.');
      post.author_display_name = post.is_anonymous ? '' : currentAuthor.display_name;
      post.author_profile_id = post.is_anonymous ? null : currentUserId;
      post.author_username = post.is_anonymous ? '' : currentAuthor.username;
      post.can_edit = true;
    }

    saved = true;
    let displayWarning = '';
    try {
      await signPostMedia([post]);
    } catch (error) {
      displayWarning = `Your post was published, but its media could not be loaded: ${explainPostBackendError(error)}`;
    }

    const changedFilter = !wasEditing && feedFilter !== 'all';
    resetComposer();
    if (!wasEditing) {
      feedFilter = 'all';
      updateFeedFilters();
    }
    let authorAvatarUrl = '';
    if (currentAuthor.avatar_path) {
      try {
        const authorAvatar = await signProfileAvatars([currentAuthor]);
        authorAvatarUrl = authorAvatar.urlsByProfileId.get(currentUserId) || '';
      } catch (error) {
        displayWarning ||= `Your post was published, but your profile photo could not be loaded: ${explainPostBackendError(error)}`;
      }
    }
    upsertFeedPost(post, authorAvatarUrl, !wasEditing);
    if (isImmersiveFeed && !wasEditing) {
      if (isCardFeedLayout) window.scrollTo({ top: 0, behavior: 'smooth' });
      else feedPostList.scrollTo({ top: 0 });
    }
    applyHomeSearch();
    const savedMessage = displayWarning || (wasEditing ? 'Your changes were saved.' : 'Your post was published.');
    if (isImmersiveFeed) showReelToast(wasEditing ? 'Changes saved' : 'Posted');
    else setComposerStatus(savedMessage, displayWarning ? 'error' : 'success');
    if (changedFilter) {
      const refreshed = await loadFeed({ reset: true });
      setFeedState(
        refreshed ? savedMessage : `${savedMessage} The Feed could not refresh; use Refresh to retry.`,
        refreshed && !displayWarning ? 'success' : 'error'
      );
    } else {
      setFeedState(savedMessage, displayWarning ? 'error' : 'success');
    }
    window.setTimeout(() => {
      if (feedState.textContent.startsWith(savedMessage)) setFeedState('');
    }, 4000);
  } catch (error) {
    let cleanupMessage = '';
    if (!saved && !saveStateUnconfirmed && uploadedPaths.length) {
      try {
        const { error: cleanupError } = await supabase.storage.from('post-media').remove(uploadedPaths);
        if (cleanupError) cleanupMessage = ` Uploaded files could not be cleaned up: ${cleanupError.message}`;
      } catch (cleanupError) {
        cleanupMessage = ` Uploaded files could not be cleaned up: ${cleanupError.message || 'please contact support.'}`;
      }
    }
    setComposerStatus(`We couldn’t confirm the post was published: ${explainPostBackendError(error)}${cleanupMessage}`, 'error');
    if (isImmersiveFeed) createRetryButton.hidden = false;
  } finally {
    composerBusy = false;
    if (isImmersiveFeed) {
      postForm.inert = false;
      createUploadProgress.hidden = true;
      postMediaInput.disabled = Boolean(editingPostId) || !currentUserId;
      createChoiceButtons.forEach(button => { button.disabled = !currentUserId; });
      createCaptureButtons.forEach(button => { button.disabled = !currentUserId; });
    }
    postSubmitButton.disabled = false;
  }
}

async function handlePostAction(event) {
  const button = event.target.closest('button[data-post-edit], button[data-post-delete], button[data-post-share]');
  if (!button) return;
  const item = button.closest('[data-post-id]');
  const post = item && [...feedPostList.children].find(entry => entry === item);
  if (!post) return;

  if (button.hasAttribute('data-post-share')) {
    const shareUrl = button.dataset.postUrl || window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'VYBE', text: 'Catch this on VYBE', url: shareUrl });
        setFeedState('Share sheet opened.', 'success');
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setFeedState('Post link copied. Send the gist to your people.', 'success');
      }
    } catch {
      setFeedState('Your browser could not share this post. Try copying the page address.', 'error');
    }
    return;
  }

  if (button.hasAttribute('data-post-edit')) {
    const record = loadedPosts.get(post.dataset.postId);
    if (!record?.can_edit) {
      setFeedState('This post is no longer available to edit. Refresh the feed and try again.', 'error');
      return;
    }
    setComposerEditing(record);
    return;
  }

  if (!window.confirm('Delete this post? This cannot be undone.')) return;
  button.disabled = true;
  try {
    const record = loadedPosts.get(post.dataset.postId);
    const { data, error } = await supabase.from('posts').delete()
      .eq('id', post.dataset.postId)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('VYBE could not confirm that your post was deleted.');
    const mediaPaths = postMediaItems(record || {}).map(media => media.path);
    unobservePostMedia(item);
    item.remove();
    loadedPosts.delete(post.dataset.postId);
    const mediaCleanup = mediaPaths.length
      ? await supabase.storage.from('post-media').remove(mediaPaths)
      : { error: null };
    if (mediaCleanup.error) {
      setFeedState(`Your post was deleted, but its media could not be cleaned up: ${mediaCleanup.error.message}`, 'error');
      return;
    }
    setFeedState('Your post was deleted.', 'success');
  } catch (error) {
    button.disabled = false;
    setFeedState(error.message || 'We couldn’t delete your post. Please try again.', 'error');
  }
}

function initializeFeedObserver() {
  if (isImmersiveFeed) return;
  if (!feedSentinel || !('IntersectionObserver' in window)) return;
  feedObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && feedHasMore && feedAutoLoadEnabled && !feedRequest) {
      loadFeed();
    }
  }, { rootMargin: '420px 0px' });
  feedObserver.observe(feedSentinel);
}

function bindFeedInteractions() {
  createKindButtons.forEach(button => button.addEventListener('click', () => startPostCreation(button.dataset.createKind)));
  mobileCreateButton?.addEventListener('click', () => {
    if (isImmersiveFeed) {
      startPostCreation();
      mobileCreateButton.setAttribute('aria-expanded', 'true');
      return;
    }
    const open = mobileCreateMenu.hidden;
    mobileCreateMenu.hidden = !open;
    mobileCreateButton.setAttribute('aria-expanded', String(open));
  });
  mobileCreateMenu?.addEventListener('click', event => {
    const action = event.target.closest('[data-create-kind]');
    if (!action) return;
    mobileCreateMenu.hidden = true;
    mobileCreateButton.setAttribute('aria-expanded', 'false');
    startPostCreation(action.dataset.createKind);
  });
  document.addEventListener('click', event => {
    if (!mobileCreateMenu.hidden && !event.target.closest('.mobile-create-wrap')) {
      mobileCreateMenu.hidden = true;
      mobileCreateButton.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !mobileCreateMenu.hidden) {
      mobileCreateMenu.hidden = true;
      mobileCreateButton.setAttribute('aria-expanded', 'false');
      mobileCreateButton.focus();
    }
  });
  if (!feedSection) return;
  feedFilters.forEach(button => button.addEventListener('click', () => {
    if (isImmersiveFeed && !feedRequest && feedFilter === button.dataset.feedFilter) {
      if (isCardFeedLayout) window.scrollTo({ top: 0, behavior: 'smooth' });
      else feedPostList.scrollTo({ top: 0 });
      insertNewOnRefresh = true;
      refreshFeedHead();
      return;
    }
    if (feedRequest || feedFilter === button.dataset.feedFilter) return;
    feedFilter = button.dataset.feedFilter;
    applyHomeSearch();
    loadFeed({ reset: true });
  }));
  feedRefresh?.addEventListener('click', () => loadFeed({ reset: true }));
  feedRetry?.addEventListener('click', () => {
    feedAutoLoadEnabled = true;
    loadFeed({ reset: true });
  });
  feedMore?.addEventListener('click', () => loadFeed());
  postForm?.addEventListener('submit', submitPost);
  postMediaTrigger?.addEventListener('click', () => postMediaInput.click());
  postMediaInput?.addEventListener('change', () => {
    if (isImmersiveFeed) {
      handleCreateMediaSelection();
      return;
    }
    try {
      const files = [...postMediaInput.files];
      const validated = files.map(validatePostMedia).filter(Boolean);
      if (validated.length > MAX_POST_MEDIA) throw new Error(`Add no more than ${MAX_POST_MEDIA} photos to one post.`);
      if (validated.length > 1 && validated.some(media => media.kind !== 'image')) {
        throw new Error('A post can include multiple photos or one video clip, not both.');
      }
      selectedPostMedia = validated;
      renderPostMediaPreview();
      const mediaLabel = selectedPostMedia.length > 1 ? `${selectedPostMedia.length} photos`
        : selectedPostMedia[0]?.kind === 'image' ? 'Photo' : 'Clip';
      setComposerStatus(selectedPostMedia.length ? `${mediaLabel} attached.` : '');
    } catch (error) {
      selectedPostMedia = [];
      postMediaInput.value = '';
      renderPostMediaPreview();
      setComposerStatus(error.message, 'error');
    }
    postMediaInput.accept = POST_MEDIA_ACCEPT;
    postMediaInput.multiple = true;
  });
  postContentInput?.addEventListener('input', () => {
    postCharacterCount.textContent = `${postContentInput.value.length} / ${postContentInput.maxLength}`;
    if (isImmersiveFeed) {
      createTextPreview.textContent = postContentInput.value.trim() || 'Your words, your VYBE.';
      updateCreateSubmitState();
    }
  });
  createDetailButtons.forEach(button => button.addEventListener('click', () => {
    insertCreateDetail(button.dataset.createInsert);
  }));
  feedPostList?.addEventListener('click', handlePostAction);
  homeSearch?.addEventListener('input', applyHomeSearch);
}

function renderProfileProgress(profile) {
  const details = [
    { selector: '[data-progress-university]', complete: Boolean(profile.university?.trim()) },
    { selector: '[data-progress-gender]', complete: Boolean(profile.gender?.trim()) }
  ];
  const completed = details.filter(detail => detail.complete).length;
  details.forEach(({ selector, complete }) => {
    const row = $(selector, profileProgress);
    row.classList.toggle('is-complete', complete);
    $('.progress-item-mark', row).textContent = complete ? '✓' : '○';
    $('[data-progress-state]', row).textContent = complete ? 'Added' : 'Not added yet';
  });
  const percent = Math.round(completed / details.length * 100);
  $('[data-profile-progress-ring]', profileProgress).style.strokeDashoffset = String(100 - percent);
  $('[data-profile-progress-percent]', profileProgress).textContent = `${percent}%`;
  $('[data-profile-progress-gauge]', profileProgress).setAttribute('aria-label', `Profile completion: ${percent}%`);
  $('[data-profile-progress-summary]', profileProgress).textContent = `${completed} of ${details.length} details added`;
  profileProgress.hidden = completed === details.length;
}

function resolveMediaValue(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

async function signProfileAvatars(profiles) {
  const profilesWithPhotos = profiles.filter(profile => resolveMediaValue(profile.avatar_url || profile.avatar_path));
  const urlsByProfileId = new Map();
  if (!profilesWithPhotos.length) return { urlsByProfileId, warning: '' };

  try {
    const signedPaths = [];
    const directUrls = new Map();
    profilesWithPhotos.forEach(profile => {
      const value = resolveMediaValue(profile.avatar_url || profile.avatar_path);
      if (!value) return;
      if (/^https?:\/\//i.test(value) || value.startsWith('data:')) {
        directUrls.set(profile.id, value);
      } else {
        signedPaths.push(value);
      }
    });

    const urlsByPath = new Map();
    const uniqueSignedPaths = [...new Set(signedPaths)];
    let failedCount = 0;
    if (uniqueSignedPaths.length) {
      const { data, error } = await supabase.storage.from('profile-media').createSignedUrls(uniqueSignedPaths, 3600);
      if (error) return { urlsByProfileId, warning: `We couldn’t load profile photos: ${error.message}` };
      (data || []).forEach(result => {
        if (result.error || !result.signedUrl) {
          failedCount += 1;
        } else {
          urlsByPath.set(result.path, result.signedUrl);
        }
      });
    }

    profilesWithPhotos.forEach(profile => {
      const value = resolveMediaValue(profile.avatar_url || profile.avatar_path);
      if (!value) return;
      if (directUrls.has(profile.id)) {
        urlsByProfileId.set(profile.id, directUrls.get(profile.id));
        return;
      }
      const url = urlsByPath.get(value);
      if (url) {
        urlsByProfileId.set(profile.id, url);
        return;
      }
      if (uniqueSignedPaths.includes(value)) failedCount += 1;
    });
    return {
      urlsByProfileId,
      warning: failedCount ? `${failedCount} profile photo${failedCount === 1 ? '' : 's'} couldn’t be loaded.` : ''
    };
  } catch (error) {
    return { urlsByProfileId, warning: `We couldn’t load profile photos: ${error.message || 'Please try again.'}` };
  }
}

function renderTags(container, values, dictionary) {
  values.forEach(value => container.append(makeElement('span', 'interest-tag', dictionary[value] || value)));
}

function renderPeopleSkeletons() {
  suggestionList.replaceChildren();
  for (let index = 0; index < 6; index += 1) {
    const skeleton = makeElement('li', 'people-skeleton');
    skeleton.setAttribute('aria-hidden', 'true');
    suggestionList.append(skeleton);
  }
  suggestionList.setAttribute('aria-busy', 'true');
}

function searchHaystack(profile) {
  return [
    profile.display_name,
    profile.username,
    profile.university,
    profile.bio,
    ...(profile.interests || []),
    ...(profile.hobbies || [])
  ].filter(Boolean).join(' ').toLocaleLowerCase();
}

function renderCandidates() {
  const visible = candidates;
  suggestionList.replaceChildren();
  suggestionList.setAttribute('aria-busy', String(peopleLoading));

  if (!visible.length) {
    const empty = makeElement('li', 'people-empty');
    const title = peopleHasMore ? 'Keep exploring.' : 'Your next connection is waiting.';
    const copy = peopleHasMore
      ? 'Browse recent members, with shared interests highlighted when you have them in common.'
      : 'People who turn on matchmaking will show up here as they join VYBE.';
    empty.append(
      makeElement('p', 'home-eyebrow', 'YOUR PEOPLE, YOUR PACE'),
      makeElement('h3', '', title),
      makeElement('p', '', copy)
    );
    suggestionList.append(empty);
  } else {
    visible.forEach(candidate => suggestionList.append(renderCandidate(candidate)));
  }

  peopleLoadMore.hidden = !peopleHasMore;
  peopleLoadMore.disabled = peopleLoading;
  peopleLoadMore.textContent = peopleLoading && peopleOffset ? 'Loading more…' : 'Load more people';
  peopleRetry.hidden = false;
  peopleRetry.hidden = !suggestionList.dataset.error;
  applyHomeSearch();
}

function renderCandidate(candidate) {
  const profile = candidate.profile;
  const name = sanitizeName(profile.display_name) || profile.username || 'VYBE member';
  const card = makeElement('li', 'suggestion-card');
  card.dataset.profileId = profile.id;

  const profileHref = `profile.html?id=${encodeURIComponent(profile.id)}`;
  const avatarLink = makeElement('a', 'suggestion-avatar-link');
  avatarLink.href = profileHref;
  avatarLink.setAttribute('aria-label', `View ${name}'s profile`);

  const visual = makeElement('div', 'suggestion-visual');
  visual.setAttribute('aria-hidden', 'true');
  const monogram = makeElement('span', 'suggestion-monogram', name.slice(0, 1).toLocaleUpperCase());
  visual.append(monogram);
  if (candidate.avatarUrl) {
    const image = makeElement('img', 'suggestion-avatar-image');
    image.src = candidate.avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('load', () => { monogram.hidden = true; }, { once: true });
    image.addEventListener('error', () => {
      image.remove();
      monogram.hidden = false;
      setSectionMessage(peoplePhotoMessage, 'A profile photo could not be displayed. You can still open the profile.', 'error');
    }, { once: true });
    visual.append(image);
  }
  avatarLink.append(visual);

  const body = makeElement('div', 'suggestion-body');
  const heading = makeElement('div', 'suggestion-heading');
  const headingInfo = makeElement('div');
  const profileLink = makeElement('a', 'suggestion-name', name);
  profileLink.href = profileHref;
  profileLink.title = name;
  const profileHeading = makeElement('h3');
  profileHeading.append(profileLink);
  headingInfo.append(profileHeading);
  headingInfo.append(createProfilePresence(profile.id));
  if (profile.username) headingInfo.append(makeElement('p', 'suggestion-handle', `@${profile.username}`));
  const intentionBits = [`Here for ${labels.lookingFor[profile.looking_for] || 'new connections'}`];
  if (profile.university?.trim()) intentionBits.push(profile.university.trim());
  headingInfo.append(makeElement('p', 'suggestion-intention', intentionBits.join(' · ')));
  heading.append(headingInfo);
  body.append(heading);

  const shared = (profile.interests || []).filter(interest => ownInterests.includes(interest));
  const shortDetail = profile.username
    ? `@${profile.username}`
    : shared[0]
      ? labels.interests[shared[0]] || shared[0]
      : profile.university?.trim() || 'Open to meet';
  body.append(makeElement('p', 'suggestion-handle', shortDetail));

  const actions = makeElement('div', 'suggestion-actions');
  const follow = makeElement('button', 'suggestion-follow', candidate.following ? 'Following' : 'Follow');
  follow.type = 'button';
  follow.dataset.follow = '';
  follow.disabled = candidate.followStatusAvailable === false;
  if (follow.disabled) follow.title = 'Follow status is temporarily unavailable.';
  follow.setAttribute('aria-label', `${candidate.following ? 'Unfollow' : 'Follow'} ${name}`);
  follow.setAttribute('aria-pressed', String(Boolean(candidate.following)));

  const view = makeElement('a', 'suggestion-view', 'View profile');
  view.href = profileHref;
  view.setAttribute('aria-label', `View ${name}'s profile`);

  actions.append(follow, view);
  body.append(actions);

  card.dataset.searchText = searchHaystack(profile);
  card.append(avatarLink, body);
  return card;
}

async function loadSuggestions({ reset = true } = {}) {
  if (!reset && peopleLoading) return;
  const requestId = ++peopleRequestId;
  const filter = activePeopleFilter || 'for-you';
  const offset = reset ? 0 : peopleOffset;
  peopleLoading = true;
  peopleRetry.hidden = true;
  suggestionList.dataset.error = '';
  setSectionMessage(peopleMessage, reset ? 'Finding people you might click with…' : 'Loading more people…');
  if (reset) {
    peopleOffset = 0;
    peopleHasMore = false;
    candidates = [];
    renderPeopleSkeletons();
  } else {
    renderCandidates();
  }

  try {
    let profiles = [];
    let nextOffset = offset + PEOPLE_PAGE_SIZE;
    if (filter === 'following') {
      const { data: follows, error: followsError } = await supabase.from('follows')
        .select('following_id,created_at')
        .eq('follower_id', currentUserId)
        .order('created_at', { ascending: false })
        .order('following_id', { ascending: true })
        .range(offset, offset + PEOPLE_PAGE_SIZE);
      if (followsError) throw followsError;
      if (requestId !== peopleRequestId) return;
      const page = follows || [];
      peopleHasMore = page.length > PEOPLE_PAGE_SIZE;
      const followPage = page.slice(0, PEOPLE_PAGE_SIZE);
      const ids = [...new Set(followPage.map(row => row.following_id).filter(Boolean))];
      if (ids.length) {
        let profileQuery = supabase.from('profiles')
          .select('id,display_name,username,bio,interests,hobbies,avatar_path,university,created_at')
          .in('id', ids)
          .eq('onboarding_completed', true)
          .eq('matchmaking_enabled', true)
          .eq('profile_visibility', 'campus');
        const { data, error } = await profileQuery;
        if (error) throw error;
        const byId = new Map((data || []).map(profile => [profile.id, profile]));
        profiles = followPage.flatMap(row => {
          const profile = byId.get(row.following_id);
          return profile ? [{ ...profile, followed_at: row.created_at }] : [];
        });
      }
    } else {
      let result = await supabase.rpc('discover_profiles', {
        result_offset: offset,
        result_limit: PEOPLE_PAGE_SIZE + 1,
        p_matchmaking_only: true
      });
      if (result.error?.code === 'PGRST202') {
        result = await supabase.rpc('discover_profiles', {
          result_offset: offset,
          result_limit: PEOPLE_PAGE_SIZE + 1
        });
      }
      if (result.error) throw result.error;
      if (requestId !== peopleRequestId) return;
      const page = result.data || [];
      peopleHasMore = page.length > PEOPLE_PAGE_SIZE;
      profiles = page.slice(0, PEOPLE_PAGE_SIZE);
    }
    if (requestId !== peopleRequestId) return;

    const ids = profiles.map(profile => profile.id);
    let followedIds = new Set(ids);
    let followStatusUnavailable = false;
    if (filter !== 'following' && ids.length) {
      const { data: followData, error: followError } = await supabase.from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', ids);
      if (followError?.code === '42501') {
        followStatusUnavailable = true;
      } else {
        if (followError) throw followError;
        if (requestId !== peopleRequestId) return;
        followedIds = new Set((followData || []).map(follow => follow.following_id));
      }
    }
    const { urlsByProfileId, warning } = await signProfileAvatars(profiles);
    if (requestId !== peopleRequestId) return;
    const notices = [
      warning,
      followStatusUnavailable ? 'Profile discovery and follow controls need the latest Supabase migration.' : ''
    ].filter(Boolean);
    setSectionMessage(peoplePhotoMessage, notices.join(' '), notices.length ? 'error' : '');

    let nextCandidates = profiles.map(profile => ({
      profile,
      avatarUrl: urlsByProfileId.get(profile.id),
      following: followedIds.has(profile.id),
      followStatusAvailable: !followStatusUnavailable
    }));
    if (filter === 'for-you') {
      nextCandidates.sort((first, second) => {
        const firstShared = (first.profile.interests || []).filter(item => ownInterests.includes(item)).length;
        const secondShared = (second.profile.interests || []).filter(item => ownInterests.includes(item)).length;
        return secondShared - firstShared ||
          new Date(second.profile.created_at).getTime() - new Date(first.profile.created_at).getTime() ||
          first.profile.id.localeCompare(second.profile.id);
      });
    }
    const uniqueIds = new Set(candidates.map(candidate => candidate.profile.id));
    candidates.push(...nextCandidates.filter(candidate => !uniqueIds.has(candidate.profile.id)));
    peopleOffset = nextOffset;
    setSectionMessage(peopleMessage, '');
    renderCandidates();
  } catch (error) {
    if (requestId === peopleRequestId) {
      suggestionList.replaceChildren();
      suggestionList.setAttribute('aria-busy', 'false');
      suggestionList.dataset.error = 'true';
      peopleLoadMore.hidden = true;
      peopleRetry.hidden = false;
      setSectionMessage(peopleMessage, `We couldn’t load people to meet: ${error.message || 'Please try again.'}`, 'error');
    }
    throw error;
  } finally {
    if (requestId === peopleRequestId) {
      peopleLoading = false;
      suggestionList.setAttribute('aria-busy', 'false');
      peopleLoadMore.disabled = false;
      renderCandidates();
    }
  }
}

function renderConnections(matches, profiles, urlsByProfileId) {
  const profileById = new Map((profiles || []).map(profile => [profile.id, profile]));
  const visibleMatches = matches.flatMap(match => {
    const otherId = match.user_a === currentUserId ? match.user_b : match.user_a;
    const profile = profileById.get(otherId);
    return profile ? [{ profile, createdAt: match.created_at }] : [];
  });

  connectionList.replaceChildren();
  if (!visibleMatches.length) {
    const empty = makeElement('li', 'connection-empty');
    empty.append(
      makeElement('span', 'connection-empty-mark', '♡'),
      makeElement('strong', '', 'Nothing mutual just yet.'),
      makeElement('span', '', 'Take your time. When the feeling is mutual, your connection will show up here.')
    );
    connectionList.append(empty);
    return;
  }

  visibleMatches.forEach(({ profile, createdAt }) => {
    const name = sanitizeName(profile.display_name) || 'VYBE member';
    const item = makeElement('li', 'connection-item');
    const avatar = makeElement('span', 'connection-avatar');
    const monogram = makeElement('span', 'connection-avatar-initial', name.slice(0, 1).toUpperCase());
    avatar.append(monogram);
    const avatarUrl = urlsByProfileId.get(profile.id);
    if (avatarUrl) {
      const image = makeElement('img', 'connection-avatar-image');
      image.src = avatarUrl;
      image.alt = '';
      image.loading = 'lazy';
      image.addEventListener('load', () => { monogram.hidden = true; }, { once: true });
      image.addEventListener('error', () => {
        image.remove();
        setSectionMessage(connectionsPhotoMessage, 'A connection photo could not be displayed.', 'error');
      }, { once: true });
      avatar.append(image);
    }
    item.append(avatar);
    const description = makeElement('span', 'connection-description');
    description.append(makeElement('span', 'connection-name', name));
    description.append(createProfilePresence(profile.id));
    const date = new Date(createdAt);
    const caption = Number.isNaN(date.getTime())
      ? 'The feeling is mutual'
      : `Matched ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`;
    description.append(makeElement('span', 'connection-caption', caption));
    item.append(description);
    const messageLink = makeElement('a', 'connection-message-link', 'Message');
    messageLink.href = `messages.html?user=${encodeURIComponent(profile.id)}`;
    messageLink.setAttribute('aria-label', `Message ${name}`);
    item.append(messageLink);
    connectionList.append(item);
  });
}

async function loadConnections() {
  const { data: matches, error } = await supabase.from('matches')
    .select('id, user_a, user_b, created_at')
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  setSectionMessage(connectionsMessage, '');

  const otherIds = [...new Set((matches || []).map(match => match.user_a === currentUserId ? match.user_b : match.user_a))];
  if (!otherIds.length) {
    renderConnections([], [], new Map());
    return;
  }

  const { data: profiles, error: profilesError } = await supabase.rpc('get_profile_previews', { target_ids: otherIds });
  if (profilesError) throw profilesError;
  const { urlsByProfileId, warning } = await signProfileAvatars(profiles || []);
  setSectionMessage(connectionsPhotoMessage, warning, warning ? 'error' : '');
  renderConnections(matches || [], profiles || [], urlsByProfileId);
}

async function handleCandidateAction(button) {
  const card = button.closest('[data-profile-id]');
  const candidate = candidates.find(item => item.profile.id === card?.dataset.profileId);
  if (!candidate || pendingActions.has(candidate.profile.id)) return;

  if (button.hasAttribute('data-skip')) {
    candidate.skipped = true;
    setSectionMessage(peopleMessage, '');
    renderCandidates();
    return;
  }

  if (button.hasAttribute('data-follow')) {
    pendingActions.add(candidate.profile.id);
    const controls = card.querySelectorAll('button');
    controls.forEach(control => { control.disabled = true; });
    const originalLabel = button.textContent;
    button.textContent = candidate.following ? 'Unfollowing…' : 'Following…';
    setSectionMessage(peopleMessage, '');
    try {
      const { data, error } = await supabase.rpc('toggle_follow', { target_user: candidate.profile.id });
      if (error) throw error;
      const result = Array.isArray(data) ? data[0] : data;
      if (!result || typeof result.following !== 'boolean') {
        throw new Error('VYBE could not confirm that follow change. Please try again.');
      }
      candidate.following = Boolean(result.following);
      if (activePeopleFilter === 'following' && !candidate.following) {
        candidates = candidates.filter(item => item.profile.id !== candidate.profile.id);
      }
      setSectionMessage(
        peopleMessage,
        candidate.following
          ? `You’re now following ${sanitizeName(candidate.profile.display_name) || 'this VYBE member'}.`
          : `You unfollowed ${sanitizeName(candidate.profile.display_name) || 'this VYBE member'}.`,
        'success'
      );
      renderCandidates();
    } catch (error) {
      setSectionMessage(peopleMessage, error.message || 'We couldn’t update your follow. Please try again.', 'error');
      controls.forEach(control => { control.disabled = false; });
      button.textContent = originalLabel || 'Follow';
    } finally {
      pendingActions.delete(candidate.profile.id);
    }
    return;
  }

  pendingActions.add(candidate.profile.id);
  const controls = card.querySelectorAll('button');
  controls.forEach(control => { control.disabled = true; });
  const originalLabel = button.textContent;
  button.textContent = '…';
  setSectionMessage(peopleMessage, '');
  try {
    const { data, error } = await supabase.rpc('express_interest', { target_user: candidate.profile.id });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.matched !== 'boolean') {
      throw new Error('VYBE could not confirm that interest. Please try again.');
    }
    if (result.matched && !result.match_id) {
      throw new Error('VYBE confirmed a mutual interest but could not return the connection. Please refresh and check your connections.');
    }

    const matchedName = sanitizeName(candidate.profile.display_name) || 'this VYBE member';
    candidate.liked = true;
    setSectionMessage(
      peopleMessage,
      result.matched
        ? `It’s mutual with ${matchedName}! You’re a match. 💜`
        : 'Interest sent. If they’re into you too, you’ll both get a match. 💜',
      'success'
    );
    renderCandidates();
    if (result.matched) {
      try {
        await loadConnections();
      } catch (error) {
        setSectionMessage(peopleMessage, `You’re matched! We couldn’t refresh your connections: ${error.message}`, 'error');
      }
    }
  } catch (error) {
    setSectionMessage(peopleMessage, error.message || 'We couldn’t send that interest. Please try again.', 'error');
    controls.forEach(control => { control.disabled = false; });
    button.textContent = originalLabel || 'Send interest';
  } finally {
    pendingActions.delete(candidate.profile.id);
  }
}

function hourGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  return 'Evening';
}

function setConversationPrompt(index) {
  if (!conversationPrompt) return;
  promptIndex = ((index % CONVERSATION_PROMPTS.length) + CONVERSATION_PROMPTS.length) % CONVERSATION_PROMPTS.length;
  conversationPrompt.textContent = `“${CONVERSATION_PROMPTS[promptIndex]}”`;
}

function roomMark(slug) {
  if (slug === 'relationships') return '♡';
  if (slug === 'anonymous-gist') return '◉';
  return '✳';
}

function roomTone(slug) {
  if (slug === 'relationships') return 'room-love';
  if (slug === 'anonymous-gist') return 'room-anon';
  return 'room-campus';
}

function renderCommunityRooms(rooms) {
  if (!communityRooms) return;
  communityRooms.replaceChildren();
  if (!rooms.length) {
    setSectionMessage(communityRoomsMessage, 'No community rooms are set up yet. Check back when conversations open.');
    return;
  }
  setSectionMessage(communityRoomsMessage, '');
  rooms.slice(0, 4).forEach(room => {
    const link = makeElement('a', `room-teaser ${roomTone(room.slug)}`);
    link.href = `community.html?room=${encodeURIComponent(room.slug)}`;
    const emoji = makeElement('span', 'room-emoji', roomMark(room.slug));
    const copy = makeElement('span');
    copy.append(makeElement('strong', '', room.name || room.slug));
    copy.append(makeElement('small', '', room.description || 'Open the room and join when you’re ready.'));
    const arrow = makeElement('span', 'room-arrow', '↗');
    link.append(emoji, copy, arrow);
    communityRooms.append(link);
  });
}

async function loadCommunityRooms() {
  if (!communityRooms) return;
  const { data, error } = await supabase.from('community_rooms').select('slug,name,description,sort_order').order('sort_order').limit(4);
  if (error) throw error;
  if (data?.length) renderCommunityRooms(data);
}

async function initialize() {
  const logoutButton = $('[data-logout]');
  syncSocialNavigation();
  bindNotificationDrawer();
  window.addEventListener('hashchange', syncSocialNavigation);
  window.addEventListener('popstate', syncSocialNavigation);
  bindFeedInteractions();
  if (isImmersiveFeed) {
    initReel();
    bindReelInteractions();
  }
  setConversationPrompt(new Date().getDate() % CONVERSATION_PROMPTS.length);
  nextPromptButton?.addEventListener('click', () => setConversationPrompt(promptIndex + 1));
  suggestionList?.addEventListener('click', event => {
    const button = event.target.closest('button[data-skip], button[data-follow]');
    if (button) handleCandidateAction(button);
  });

  try {
    supabase = getSupabaseClient();
    const { user, recovered } = await getAuthenticatedUser(supabase);
    if (!user) {
      window.location.replace(recovered ? 'login.html?session=expired' : 'login.html');
      return;
    }
    currentUserId = user.id;
    startNotificationRealtime();
    refreshNotifications();
    void initializePushNotifications();
    subscribeToAppPresence(
      renderAppPresence,
      error => setStatus(`Online status could not be updated: ${error.message || 'Please try again.'}`, 'error')
    );

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('display_name,username,avatar_path,interests,matchmaking_enabled,onboarding_completed,university,gender')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    document.documentElement.classList.add('home-session-checked');
    window.dispatchEvent(new Event('vybe:home-session-checked'));
    currentAuthor = {
      id: user.id,
      display_name: profile.display_name || user.user_metadata?.display_name || '',
      username: profile.username || '',
      avatar_path: profile.avatar_path || ''
    };
    ownInterests = profile.interests || [];
    ownMatchmakingEnabled = Boolean(profile.matchmaking_enabled);
    if (profileProgress) renderProfileProgress(profile);

    const safeName = sanitizeName(profile.display_name) || sanitizeName(user.user_metadata?.display_name);
    if (homeHello) homeHello.textContent = hourGreeting();
    if (greeting) greeting.textContent = safeName ? `, ${safeName}` : '';
    if (welcomeNote) {
      const campus = profile.university?.trim();
      welcomeNote.textContent = campus
        ? `${campus} energy, plus whoever else is around. Discover people, join a room, or just see what’s happening.`
        : 'See who’s around, join a conversation, or just catch the gist — at your own pace.';
    }
    if (matchNote) {
      matchNote.textContent = ownMatchmakingEnabled
        ? 'Send interest. They’ll only see a match if they feel the same. No score, no countdown, no pressure.'
        : 'Interest is off on your profile right now. Switch it on when you’re ready — nobody is rushed.';
    }
    const profileAvatar = $('[data-profile-avatar]');
    if (profileAvatar) profileAvatar.textContent = safeName ? safeName.slice(0, 1).toUpperCase() : 'V';
    setFeedInteractionEnabled(true);
    openComposerFromUrl();
    initializeFeedObserver();
    startFeedRealtime();
    window.addEventListener('pageshow', resumeFeedRealtime);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshFeedHead();
    });
    const results = await Promise.allSettled([
      feedSection ? loadFeed({ reset: true }) : Promise.resolve(true),
      suggestionList ? loadSuggestions() : Promise.resolve(),
      connectionList ? loadConnections() : Promise.resolve(),
      communityRooms ? loadCommunityRooms() : Promise.resolve()
    ]);
    if (isImmersiveFeed) scrollToHashPost();
    if (feedSection && results[0].status === 'rejected') {
      setFeedState(`We couldn’t load posts: ${explainPostBackendError(results[0].reason)}`, 'error');
      feedRetry.hidden = false;
    }
    if (results[1].status === 'rejected') {
      setSectionMessage(peopleMessage, `We couldn’t load people to meet: ${results[1].reason.message || 'Please try again.'}`, 'error');
      suggestionList?.replaceChildren();
    }
    if (results[2].status === 'rejected') {
      setSectionMessage(connectionsMessage, `We couldn’t load your connections: ${results[2].reason.message || 'Please try again.'}`, 'error');
    }
    if (results[3].status === 'rejected') {
      setSectionMessage(communityRoomsMessage, `Rooms are listed from Community. We couldn’t refresh them: ${results[3].reason.message || 'Please try again.'}`, 'error');
    }
  } catch (error) {
    document.documentElement.classList.add('home-session-checked');
    window.dispatchEvent(new Event('vybe:home-session-checked'));
    setStatus(error.message || 'We couldn’t load your VYBE home. Please refresh and try again.');
  }

  logoutButton?.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setStatus(`We couldn’t log you out: ${error.message || 'Please try again.'}`, 'error');
      logoutButton.disabled = false;
    }
  });
}

initialize();

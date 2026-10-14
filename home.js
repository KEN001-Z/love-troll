import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';
import { subscribeToAppPresence } from './app-presence.js';

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
const searchStatus = $('[data-search-status]');
const postForm = $('[data-post-form]');
const composerStatus = $('[data-composer-status]');
const postContentInput = $('[name="content"]', postForm);
const postAnonymousInput = $('[name="is_anonymous"]', postForm);
const postCharacterCount = $('[data-post-character-count]');
const postSubmitButton = $('[type="submit"]', postForm);
const postMediaInput = $('[data-post-media]', postForm);
const postMediaTrigger = $('[data-post-media-trigger]', postForm);
const postMediaPreview = $('[data-post-media-preview]', postForm);
const createKindButtons = $$('[data-create-kind]');
const mobileCreateButton = $('[data-mobile-create]');
const mobileCreateMenu = $('[data-mobile-create-menu]');
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
const onlineUserIds = new Set();
let ownInterests = [];
let ownMatchmakingEnabled = false;
let candidates = [];
const pendingActions = new Set();
const DEMO_NAME_PATTERNS = [/^test\s*user$/i, /^demo/i, /^sample/i, /^guest/i, /^user$/i];
const FEED_PAGE_SIZE = 15;
let feedFilter = 'all';
let feedCursor = null;
let feedHasMore = true;
let feedRequest = null;
let feedObserver = null;
let feedAutoLoadEnabled = true;
let composerBusy = false;
let editingPostId = null;
let selectedPostMedia = null;
const postMediaUrls = new Map();
const loadedPosts = new Map();
const isImmersiveFeed = document.body.classList.contains('vibe-body');
let feedPlaybackObserver;
let activeFeedVideo;
let createDialog;
let createDraft = { kind: 'text', file: null, previewUrl: '', caption: '', duration: 0 };
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

function applyHomeSearch() {
  const query = (homeSearch?.value || '').trim().toLocaleLowerCase();
  let postCount = 0;
  let peopleCount = 0;
  feedPostList.querySelectorAll('.feed-post').forEach(item => {
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
  feedState.textContent = message;
  feedState.dataset.state = state;
  feedState.hidden = !message;
}

function setComposerStatus(message, state = '') {
  composerStatus.textContent = message;
  composerStatus.dataset.state = state;
  composerStatus.hidden = !message;
}

function explainPostBackendError(error) {
  if (['PGRST202', 'PGRST205', '42P01', '42883'].includes(error?.code)) {
    return 'The posts feed is not available in this Supabase project yet. Confirm the project schema and apply the matching posts migration before trying again.';
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
  feedRefresh.disabled = !enabled;
  feedFilters.forEach(button => { button.disabled = !enabled; });
  postContentInput.disabled = !enabled;
  postAnonymousInput.disabled = !enabled;
  postSubmitButton.disabled = !enabled;
  postMediaInput.disabled = !enabled;
  postMediaTrigger.disabled = !enabled || Boolean(editingPostId);
  feedRetry.disabled = !enabled;
  feedMore.disabled = !enabled;
  createKindButtons.forEach(button => { button.disabled = !enabled; });
  mobileCreateButton.disabled = !enabled;
}

function startPostCreation(kind) {
  if (createDialog) {
    openCreateFlow(kind);
    return;
  }
  feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (kind === 'image' || kind === 'video') {
    postMediaInput.accept = kind === 'image'
      ? 'image/jpeg,image/png,image/webp,image/gif'
      : 'video/mp4,video/webm,video/quicktime';
    postMediaInput.click();
    return;
  }
  window.setTimeout(() => postContentInput.focus({ preventScroll: true }), 180);
}

function renderPostMediaPreview() {
  postMediaPreview.replaceChildren();
  postMediaPreview.hidden = !selectedPostMedia;
  if (!selectedPostMedia) return;
  const label = makeElement('span', 'post-media-name', selectedPostMedia.file.name);
  const remove = makeElement('button', 'post-media-remove', 'Remove');
  remove.type = 'button';
  remove.addEventListener('click', () => {
    selectedPostMedia = null;
    postMediaInput.value = '';
    renderPostMediaPreview();
  });
  postMediaPreview.append(label, remove);
}

function validatePostMedia(file) {
  if (!file) return null;
  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  if (!isImage && !isVideo) throw new Error('Choose an image or video clip.');
  const limit = isImage ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
  if (file.size > limit) throw new Error(`${isImage ? 'Images' : 'Clips'} must be ${isImage ? '10MB' : '50MB'} or smaller.`);
  return { file, kind: isImage ? 'image' : 'video' };
}

async function signPostMedia(posts) {
  const paths = [...new Set(posts.map(post => post.media_path).filter(Boolean))];
  const missing = paths.filter(path => !postMediaUrls.has(path));
  if (!missing.length) return;
  const { data, error } = await supabase.storage.from('post-media').createSignedUrls(missing, 3600);
  if (error) throw error;
  (data || []).forEach(result => { if (result.path && result.signedUrl) postMediaUrls.set(result.path, result.signedUrl); });
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

function setupCreateFlow() {
  createDialog = document.createElement('dialog');
  createDialog.className = 'vybe-create-dialog';
  createDialog.setAttribute('aria-labelledby', 'create-flow-title');
  createDialog.innerHTML = `
    <form method="dialog" class="create-flow-shell">
      <header class="create-flow-header"><div><p class="home-eyebrow">CREATE ON VYBE</p><h2 id="create-flow-title">Make a post</h2></div><button type="button" class="create-close" data-create-close aria-label="Close creator">×</button></header>
      <ol class="create-progress" aria-label="Creation progress"><li data-create-step="1"><span>1</span> Choose</li><li data-create-step="2"><span>2</span> Details</li><li data-create-step="3"><span>3</span> Review</li></ol>
      <section data-create-panel="1"><p class="create-intro">What are you putting out there?</p><div class="create-kind-grid"><button type="button" data-create-choice="text"><b>✎</b><strong>Thought</strong><small>Words, a hot take, a question</small></button><button type="button" data-create-choice="image"><b>▧</b><strong>Photo</strong><small>One photo, full focus</small></button><button type="button" data-create-choice="video"><b>▶</b><strong>Video</strong><small>One clip, up to 50 MB</small></button></div></section>
      <section data-create-panel="2" hidden><div class="create-workspace"><div class="create-media-picker" data-create-picker><input data-create-file type="file" hidden><button type="button" class="create-dropzone" data-create-dropzone><span class="create-dropzone-icon" aria-hidden="true">+</span><strong>Add your media</strong><small>Choose a file or drop it here</small></button><div data-create-preview class="create-media-preview" hidden></div><div class="create-picker-actions"><button type="button" data-create-select>Choose another</button><button type="button" data-create-remove hidden>Remove</button></div></div><div class="create-details"><label class="create-caption">Caption<textarea data-create-caption maxlength="2000" rows="5" placeholder="Add a caption, question, or a little context."></textarea><small><span>Up to 2,000 characters</span><span data-create-count>0 / 2000</span></small></label><label class="create-anonymous"><input data-create-anonymous type="checkbox"><span><strong>Post anonymously</strong><small>Your name and profile will stay hidden.</small></span></label><p data-create-error class="create-error" role="alert" hidden></p></div></div><div class="create-nav"><button type="button" data-create-back>Back</button><button type="button" data-create-next>Review post</button></div></section>
      <section data-create-panel="3" hidden><div data-create-review class="create-review"></div><p class="create-review-note">Your post will be published to the current VYBE feed. Media is uploaded privately and shown with a signed link.</p><p data-create-publish-status class="create-publish-status" role="status"></p><div class="create-nav"><button type="button" data-create-back>Back</button><button type="button" data-create-publish class="btn">Publish</button></div></section>
    </form>`;
  document.body.append(createDialog);
  createDialog.addEventListener('click', event => { if (event.target === createDialog) closeCreateFlow(); });
  $('[data-create-close]', createDialog).addEventListener('click', closeCreateFlow);
  $$('[data-create-choice]', createDialog).forEach(button => button.addEventListener('click', () => chooseCreateKind(button.dataset.createChoice)));
  $('[data-create-select]', createDialog).addEventListener('click', () => $('[data-create-file]', createDialog).click());
  $('[data-create-dropzone]', createDialog).addEventListener('click', () => $('[data-create-file]', createDialog).click());
  $('[data-create-remove]', createDialog).addEventListener('click', clearCreateMedia);
  $('[data-create-file]', createDialog).addEventListener('change', handleCreateFile);
  $('[data-create-picker]', createDialog).addEventListener('dragover', event => {
    event.preventDefault();
    $('[data-create-picker]', createDialog).classList.add('is-dragging');
  });
  $('[data-create-picker]', createDialog).addEventListener('dragleave', () => $('[data-create-picker]', createDialog).classList.remove('is-dragging'));
  $('[data-create-picker]', createDialog).addEventListener('drop', event => {
    event.preventDefault();
    $('[data-create-picker]', createDialog).classList.remove('is-dragging');
    handleCreateFile(event.dataTransfer.files[0]);
  });
  $('[data-create-caption]', createDialog).addEventListener('input', updateCreateCount);
  $$('[data-create-back]', createDialog).forEach(button => button.addEventListener('click', () => setCreateStep(createDraft.kind === 'text' ? 1 : 2)));
  $('[data-create-next]', createDialog).addEventListener('click', reviewCreatePost);
  $('[data-create-publish]', createDialog).addEventListener('click', publishCreatePost);
  createDialog.addEventListener('cancel', event => {
    event.preventDefault();
    closeCreateFlow();
  });
}

function openCreateFlow(kind = '') { createDraft = { kind: kind === 'thought' ? 'text' : kind || 'text', file: null, previewUrl: '', caption: '' }; setCreateStep(1); createDialog.showModal(); if (kind) chooseCreateKind(createDraft.kind); }
function closeCreateFlow() { if (createDraft.caption || createDraft.file) { if (!window.confirm('Discard this unfinished post?')) return; } clearCreateMedia(); createDialog.close(); }
function setCreateStep(step) { $$('[data-create-panel]', createDialog).forEach(panel => { panel.hidden = Number(panel.dataset.createPanel) !== step; }); $$('[data-create-step]', createDialog).forEach(item => item.classList.toggle('is-current', Number(item.dataset.createStep) === step)); }
async function publishCreatePost() { const publish = $('[data-create-publish]', createDialog); publish.disabled = true; $('[data-create-publish-status]', createDialog).textContent = createDraft.file ? 'Uploading media…' : 'Publishing…'; postContentInput.value = createDraft.caption.trim(); postAnonymousInput.checked = $('[data-create-anonymous]', createDialog).checked; selectedPostMedia = createDraft.file ? { file: createDraft.file, kind: createDraft.kind } : null; const published = await submitPost(new Event('submit', { cancelable: true })); if (published) { $('[data-create-publish-status]', createDialog).textContent = 'Published. Your post is now at the top of the feed.'; window.setTimeout(() => { clearCreateMedia(); createDialog.close(); feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 800); } else { $('[data-create-publish-status]', createDialog).textContent = 'Publishing failed. Your selected media and caption are still here—try again.'; publish.disabled = false; } }

function formatMediaSize(size) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMediaDuration(seconds) {
  const rounded = Math.round(seconds || 0);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

// These declarations intentionally replace the compact legacy creator handlers above.
// The same elements and upload path remain in use.
function chooseCreateKind(kind) {
  createDraft.kind = kind;
  const file = $('[data-create-file]', createDialog);
  const picker = $('[data-create-picker]', createDialog);
  const isImage = kind === 'image';
  const isVideo = kind === 'video';
  file.accept = isImage ? 'image/jpeg,image/png,image/webp,image/gif' : isVideo ? 'video/mp4,video/webm,video/quicktime' : '';
  picker.hidden = kind === 'text';
  picker.dataset.kind = kind;
  if (kind !== 'text' && !createDraft.file) {
    const preview = $('[data-create-preview]', createDialog);
    preview.hidden = false;
    preview.replaceChildren();
    const prompt = makeElement('button', 'create-empty-media', '');
    prompt.type = 'button';
    prompt.append(makeElement('span', 'create-empty-media-mark', '+'), makeElement('strong', '', isVideo ? 'Choose a video' : 'Choose a photo'), makeElement('small', '', isVideo ? 'MP4, WEBM or MOV · up to 50 MB' : 'JPG, PNG, WEBP or GIF · up to 10 MB'));
    prompt.addEventListener('click', () => file.click());
    preview.append(prompt);
  }
  $('[data-create-caption]', createDialog).placeholder = kind === 'text'
    ? 'What’s on your mind?'
    : isImage ? 'Tell the story behind this moment.' : 'Set the scene for your clip.';
  setCreateStep(2);
  if (kind !== 'text') file.click();
}

function clearCreateMedia() {
  if (createDraft.previewUrl) URL.revokeObjectURL(createDraft.previewUrl);
  createDraft.file = null;
  createDraft.previewUrl = '';
  createDraft.duration = 0;
  const preview = $('[data-create-preview]', createDialog);
  preview.replaceChildren();
  preview.hidden = true;
  $('[data-create-remove]', createDialog).hidden = true;
  $('[data-create-file]', createDialog).value = '';
}

function handleCreateFile(file = $('[data-create-file]', createDialog).files[0]) {
  try {
    const media = validatePostMedia(file);
    if (!media || media.kind !== createDraft.kind) throw new Error(`Choose a ${createDraft.kind === 'image' ? 'photo' : 'video'} file.`);
    clearCreateMedia();
    createDraft.file = file;
    createDraft.previewUrl = URL.createObjectURL(file);
    const preview = $('[data-create-preview]', createDialog);
    const mediaElement = document.createElement(media.kind === 'image' ? 'img' : 'video');
    mediaElement.src = createDraft.previewUrl;
    mediaElement.alt = media.kind === 'image' ? `Selected photo: ${file.name}` : '';
    mediaElement.controls = media.kind === 'video';
    mediaElement.muted = true;
    mediaElement.playsInline = true;
    mediaElement.addEventListener('error', () => setCreateError('That media file could not be read. Choose another one.'));
    const meta = makeElement('p', 'create-media-meta', `${file.name} · ${formatMediaSize(file.size)}`);
    if (media.kind === 'video') mediaElement.addEventListener('loadedmetadata', () => {
      createDraft.duration = mediaElement.duration;
      meta.textContent = `${file.name} · ${formatMediaDuration(mediaElement.duration)} · ${formatMediaSize(file.size)}`;
    });
    preview.append(mediaElement, meta);
    preview.hidden = false;
    $('[data-create-remove]', createDialog).hidden = false;
    setCreateError('');
  } catch (error) {
    setCreateError(error.message);
  }
}

function reviewCreatePost() {
  updateCreateCount();
  if (!createDraft.caption.trim()) return setCreateError('Add a caption or post text before continuing.');
  if (createDraft.kind !== 'text' && !createDraft.file) return setCreateError('Choose media before continuing.');
  const review = $('[data-create-review]', createDialog);
  review.replaceChildren();
  const card = makeElement('article', 'create-preview-card');
  const byline = makeElement('div', 'create-preview-byline');
  byline.append(makeElement('span', 'create-preview-avatar', $('[data-profile-avatar]')?.textContent || 'V'), makeElement('strong', '', createDraft.kind === 'text' ? 'Your VYBE thought' : 'Your VYBE post'));
  card.append(byline);
  if (createDraft.previewUrl) {
    const media = document.createElement(createDraft.kind === 'image' ? 'img' : 'video');
    media.src = createDraft.previewUrl;
    media.controls = createDraft.kind === 'video';
    media.muted = true;
    media.playsInline = true;
    card.append(media);
  }
  card.append(makeElement('p', 'create-review-caption', createDraft.caption));
  review.append(card);
  $('[data-create-publish-status]', createDialog).textContent = '';
  setCreateError('');
  setCreateStep(3);
}

function observeImmersiveVideo(video) {
  if (!isImmersiveFeed || !('IntersectionObserver' in window)) return;
  if (!feedPlaybackObserver) {
    feedPlaybackObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const candidate = entry.target;
        if (entry.isIntersecting && entry.intersectionRatio >= .72) {
          if (activeFeedVideo && activeFeedVideo !== candidate) activeFeedVideo.pause();
          activeFeedVideo = candidate;
          candidate.play().catch(() => { /* The visible native controls remain available. */ });
        } else if (candidate !== activeFeedVideo || entry.intersectionRatio < .35) {
          candidate.pause();
        }
      });
    }, { threshold: [.35, .72] });
  }
  feedPlaybackObserver.observe(video);
}

function renderPost(post, avatarUrl = '') {
  if (isImmersiveFeed) return renderImmersivePost(post, avatarUrl);
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
  const mediaUrl = postMediaUrls.get(post.media_path);
  if (mediaUrl && post.media_kind === 'image') {
    article.classList.add('post-card-media');
    const image = makeElement('img', 'post-media-image');
    image.src = mediaUrl; image.alt = 'Attached image'; image.loading = 'lazy';
    article.append(image);
  } else if (mediaUrl && post.media_kind === 'video') {
    article.classList.add('post-card-media');
    const video = makeElement('video', 'post-media-video');
    video.src = mediaUrl; video.controls = true; video.preload = 'metadata';
    video.setAttribute('aria-label', 'Attached video clip');
    article.append(video);
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

function renderImmersivePost(post, avatarUrl = '') {
  const item = makeElement('li', `feed-post immersive-post immersive-${post.media_kind || 'text'}`);
  item.dataset.postId = post.id;
  item.dataset.mediaKind = post.media_kind || 'text';
  item.id = `post-${post.id}`;
  item.dataset.searchText = `${post.content} ${post.author_display_name || ''} ${post.author_username || ''}`.toLocaleLowerCase();
  const article = makeElement('article', 'immersive-post-frame');
  const mediaUrl = postMediaUrls.get(post.media_path);
  const isMedia = mediaUrl && ['image', 'video'].includes(post.media_kind);

  const visual = makeElement('div', `immersive-visual${isMedia ? '' : ' immersive-copy-visual'}`);
  if (mediaUrl && post.media_kind === 'image') {
    const image = makeElement('img', 'immersive-media immersive-image');
    image.src = mediaUrl;
    image.alt = post.content ? `Photo post: ${post.content}` : 'Photo shared on VYBE';
    image.loading = 'lazy';
    visual.append(image);
  } else if (mediaUrl && post.media_kind === 'video') {
    const video = makeElement('video', 'immersive-media immersive-video');
    video.src = mediaUrl;
    video.controls = true;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.preload = 'metadata';
    video.setAttribute('aria-label', 'Video post. Starts muted; use native controls for sound.');
    visual.append(video);
    observeImmersiveVideo(video);
  } else {
    const type = makeElement('span', 'immersive-text-type', post.is_anonymous ? 'ANONYMOUS GIST' : 'VYBE THOUGHT');
    const statement = makeElement('p', 'immersive-text-statement', post.content);
    visual.append(type, statement);
  }

  const overlay = makeElement('div', 'immersive-overlay');
  const identity = makeElement('div', 'immersive-identity');
  const avatar = makeElement('span', `immersive-avatar${post.is_anonymous ? ' is-anonymous' : ''}`);
  avatar.textContent = post.is_anonymous ? '◉' : (sanitizeName(post.author_display_name) || 'V').slice(0, 1).toUpperCase();
  if (avatarUrl && !post.is_anonymous) {
    const image = makeElement('img', 'immersive-avatar-image');
    image.alt = ''; image.loading = 'lazy';
    image.addEventListener('load', () => { avatar.textContent = ''; }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    image.src = avatarUrl;
    avatar.append(image);
  }
  const byline = makeElement('div', 'immersive-byline');
  if (post.author_profile_id && !post.is_anonymous) {
    const profile = makeElement('a', 'immersive-author', sanitizeName(post.author_display_name) || 'VYBE member');
    profile.href = `profile.html?id=${encodeURIComponent(post.author_profile_id)}`;
    byline.append(profile);
  } else byline.append(makeElement('strong', 'immersive-author', post.is_anonymous ? 'Anonymous' : (sanitizeName(post.author_display_name) || 'VYBE member')));
  const time = formatPostDate(post.created_at);
  byline.append(makeElement('span', 'immersive-time', time || 'Now'));
  identity.append(avatar, byline);

  const caption = makeElement('p', 'immersive-caption', isMedia ? post.content : '');
  if (!isMedia) caption.hidden = true;
  const actions = makeElement('div', 'immersive-actions');
  if (post.author_profile_id && !post.is_anonymous) {
    const visit = makeElement('a', 'immersive-action', 'Profile');
    visit.href = `profile.html?id=${encodeURIComponent(post.author_profile_id)}`;
    visit.setAttribute('aria-label', `Visit ${sanitizeName(post.author_display_name) || 'creator'}'s profile`);
    actions.append(visit);
  }
  const conversation = makeElement('a', 'immersive-action', 'Discuss');
  conversation.href = 'community.html?room=campus-gist';
  conversation.setAttribute('aria-label', 'Join the Community conversation');
  const share = makeElement('button', 'immersive-action immersive-share', 'Share');
  share.type = 'button'; share.dataset.postShare = '';
  share.dataset.postUrl = `${window.location.origin}/vibe.html#post-${post.id}`;
  share.setAttribute('aria-label', 'Share this post');
  actions.append(conversation, share);
  overlay.append(identity, caption, actions);
  article.append(visual, overlay);
  item.append(article);
  return item;
}

const previewPosts = [
  { name: 'Tomi Adebayo', username: '@tomideoluw', format: 'REEL PREVIEW', type: 'reel', avatar: 'T', body: 'POV: you came for one lecture and somehow became the class rep 😭', artTop: 'CAMPUS CHRONICLES', artMain: '8:01 AM\nLECTURE', artBottom: 'UNILAG · MONDAY MORNING', likes: 218, comments: 24, time: '12 min' },
  { name: 'Ifeoma Nwosu', username: '@ifeoncampus', format: 'PHOTO PREVIEW', type: 'photo', avatar: 'I', body: 'Small wins: making it through the week and finding the best jollof spot near campus. 📍', artTop: 'THE LUNCH BREAK', artMain: 'JOLLOF\nO’CLOCK', artBottom: 'YABA · LAGOS', likes: 96, comments: 11, time: '38 min' },
  { name: 'Anonymous student', username: 'Campus anonymous', format: 'TEXT PREVIEW', type: 'text', avatar: '◉', body: 'The group project has 8 people but somehow I’m the whole department. Please explain. 😭', artTop: 'ANONYMOUS GIST', artMain: 'GROUP\nPROJECTS…', artBottom: 'WE KNOW THE FEELING', likes: 143, comments: 32, time: '1 hr' }
];

function renderPreviewPost(post, index) {
  const item = makeElement('li', `feed-post demo-feed-post demo-${post.type}`);
  item.dataset.demoPost = String(index);
  item.id = `feed-preview-${index}`;
  item.dataset.searchText = `${post.name} ${post.username} ${post.body} ${post.format}`.toLocaleLowerCase();
  const article = makeElement('article', 'demo-post-card');
  const header = makeElement('header', 'demo-post-header');
  const identity = makeElement('div', 'demo-post-identity');
  identity.append(makeElement('span', 'demo-post-avatar', post.avatar));
  const byline = makeElement('span', 'demo-post-byline');
  byline.append(makeElement('strong', '', post.name), makeElement('small', '', `${post.username} · ${post.time}`));
  identity.append(byline);
  header.append(identity, makeElement('span', 'demo-post-badge', post.format));
  const visual = makeElement('div', `demo-post-visual demo-art-${post.type}`);
  visual.setAttribute('aria-label', `${post.type} post preview artwork`);
  visual.append(makeElement('span', 'demo-art-kicker', post.artTop));
  visual.append(makeElement('span', 'demo-art-title', post.artMain));
  if (post.type === 'reel') visual.append(makeElement('span', 'demo-play-mark', '▶'));
  visual.append(makeElement('span', 'demo-art-footer', post.artBottom));
  const caption = makeElement('p', 'demo-post-caption', post.body);
  const actions = makeElement('div', 'demo-post-actions');
  const like = makeElement('button', 'demo-action demo-like');
  like.type = 'button';
  like.dataset.demoLike = '';
  like.setAttribute('aria-pressed', 'false');
  like.setAttribute('aria-label', `Like sample post, ${post.likes} likes`);
  like.append(makeElement('span', 'demo-action-icon', '♡'), makeElement('span', 'demo-action-count', String(post.likes)));
  const comment = makeElement('button', 'demo-action');
  comment.type = 'button';
  comment.dataset.demoComment = '';
  comment.setAttribute('aria-expanded', 'false');
  comment.setAttribute('aria-label', `Show ${post.comments} sample comments`);
  comment.append(makeElement('span', 'demo-action-icon demo-comment-icon'), makeElement('span', 'demo-action-count', String(post.comments)));
  const share = makeElement('button', 'demo-action demo-share', 'Share');
  share.type = 'button';
  share.dataset.demoShare = '';
  actions.append(like, comment, share);
  const comments = makeElement('div', 'demo-comments');
  comments.hidden = true;
  comments.append(makeElement('p', 'demo-sample-comment', index === 0 ? 'Bola: The lecturer appearing before the students is wild 😂' : 'Mimi: This is too real for a Tuesday 😭'));
  const commentForm = makeElement('form', 'demo-comment-form');
  const input = makeElement('input');
  input.name = 'preview_comment';
  input.placeholder = 'Add a comment…';
  input.maxLength = 240;
  input.setAttribute('aria-label', 'Add a preview comment');
  const submit = makeElement('button', '', 'Post');
  submit.type = 'submit';
  commentForm.append(input, submit);
  comments.append(commentForm);
  article.append(header, visual, caption, actions, comments);
  item.append(article);
  return item;
}

function renderPreviewFeed() {
  const previews = feedFilter === 'anonymous'
    ? previewPosts.filter(post => post.name === 'Anonymous student')
    : previewPosts;
  feedPostList.replaceChildren(...previews.map(renderPreviewPost));
  applyHomeSearch();
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
    feedPostList.replaceChildren();
    loadedPosts.clear();
    feedRetry.hidden = true;
    feedMore.hidden = true;
    setFeedState('Loading posts…');
  } else if (!feedHasMore) {
    setFeedState(feedPostList.childElementCount ? 'You’re all caught up.' : 'No posts yet. Start the gist with a post of your own.', 'empty');
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
      await signPostMedia(page);
      feedHasMore = rows.length > FEED_PAGE_SIZE;
      const authorIds = [...new Set(page.filter(post => !post.is_anonymous && post.author_profile_id).map(post => post.author_profile_id))];
      let postAvatars = new Map();
      let previewsById = new Map();
      if (authorIds.length) {
        try {
          const { data: previews, error: previewsError } = await supabase.rpc('get_profile_previews', { target_ids: authorIds });
          if (!previewsError) {
            const profiles = previews || [];
            previewsById = new Map(profiles.map(profile => [profile.id, profile]));
            const signed = await signProfileAvatars(profiles);
            postAvatars = signed.urlsByProfileId;
          }
        } catch {
          // Keep the feed available if profile photos are unavailable.
        }
      }
      const existingIds = new Set([...feedPostList.children].map(item => item.dataset.postId));
      page.forEach(post => {
        post.author_username = previewsById.get(post.author_profile_id)?.username || '';
        loadedPosts.set(post.id, post);
        if (!existingIds.has(post.id)) feedPostList.append(renderPost(post, postAvatars.get(post.author_profile_id) || ''));
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
        setFeedState('You’re all caught up.', 'empty');
      } else {
        setFeedState('');
      }
      feedRetry.hidden = true;
      feedAutoLoadEnabled = true;
      feedMore.hidden = Boolean(feedObserver) || !feedHasMore;
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
    }
  })();
  feedRequest = request;
  return request;
}

function resetComposer() {
  postForm.reset();
  selectedPostMedia = null;
  renderPostMediaPreview();
  editingPostId = null;
  postMediaTrigger.disabled = !currentUserId;
  postSubmitButton.textContent = 'Post';
  postCharacterCount.textContent = `0 / ${postContentInput.maxLength}`;
  setComposerStatus('');
}

function setComposerEditing(post) {
  editingPostId = post.id;
  postContentInput.value = post.content;
  postAnonymousInput.checked = post.is_anonymous;
  postCharacterCount.textContent = `${post.content.length} / ${postContentInput.maxLength}`;
  postSubmitButton.textContent = 'Save changes';
  postMediaTrigger.disabled = true;
  setComposerStatus('Editing your post.');
  postContentInput.focus();
  feedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function submitPost(event) {
  event.preventDefault();
  if (composerBusy) return false;
  const content = postContentInput.value.trim();
  if (!content) {
    setComposerStatus('Write something before posting.', 'error');
    postContentInput.focus();
    return false;
  }

  let published = false;
  composerBusy = true;
  postSubmitButton.disabled = true;
  setComposerStatus(editingPostId ? 'Saving your changes…' : 'Publishing your post…');
  try {
    let postId;
    let uploadedMediaPath = null;
    if (editingPostId) {
      const { data, error } = await supabase.from('posts')
        .update({ content, is_anonymous: postAnonymousInput.checked })
        .eq('id', editingPostId)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error('VYBE could not confirm that your changes were saved.');
      postId = data.id;
    } else {
      let mediaFields = { media_path: null, media_mime: null, media_kind: 'none', post_type: 'text' };
      if (selectedPostMedia) {
        const safeName = selectedPostMedia.file.name.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80);
        uploadedMediaPath = `${currentUserId}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('post-media').upload(uploadedMediaPath, selectedPostMedia.file, { contentType: selectedPostMedia.file.type, cacheControl: '3600', upsert: false });
        if (uploadError) throw uploadError;
        mediaFields = { media_path: uploadedMediaPath, media_mime: selectedPostMedia.file.type, media_kind: selectedPostMedia.kind, post_type: selectedPostMedia.kind };
      }
      const { data, error } = await supabase.from('posts').insert({
        author_id: currentUserId,
        content,
        ...mediaFields,
        is_anonymous: postAnonymousInput.checked
      }).select('id').single();
      if (error) { if (uploadedMediaPath) await supabase.storage.from('post-media').remove([uploadedMediaPath]); throw error; }
      if (!data?.id) throw new Error('VYBE could not confirm that your post was published.');
      postId = data.id;
    }

    const wasEditing = Boolean(editingPostId);
    resetComposer();
    feedFilter = 'all';
    await loadFeed({ reset: true });
    const visible = [...feedPostList.children].some(item => item.dataset.postId === postId);
    const savedMessage = wasEditing ? 'Your changes were saved.' : 'Your post was published.';
    setComposerStatus(
      visible
        ? savedMessage
        : `${savedMessage} The feed could not confirm it is visible yet; use Refresh feed to check.`,
      visible ? 'success' : 'error'
    );
    published = true;
  } catch (error) {
    setComposerStatus(`We couldn’t save your post: ${explainPostBackendError(error)}`, 'error');
  } finally {
    composerBusy = false;
    postSubmitButton.disabled = false;
  }
  return published;
}

async function handlePostAction(event) {
  const demoLike = event.target.closest('button[data-demo-like]');
  if (demoLike) {
    const count = $('.demo-action-count', demoLike);
    const liked = demoLike.getAttribute('aria-pressed') !== 'true';
    const likes = Number(count.textContent) || 0;
    demoLike.setAttribute('aria-pressed', String(liked));
    count.textContent = String(Math.max(0, likes + (liked ? 1 : -1)));
    demoLike.setAttribute('aria-label', `Like sample post, ${count.textContent} likes`);
    return;
  }
  const demoComment = event.target.closest('button[data-demo-comment]');
  if (demoComment) {
    const comments = demoComment.closest('.demo-post-card').querySelector('.demo-comments');
    comments.hidden = !comments.hidden;
    demoComment.setAttribute('aria-expanded', String(!comments.hidden));
    if (!comments.hidden) $('input[name="preview_comment"]', comments).focus();
    return;
  }
  const demoShare = event.target.closest('button[data-demo-share]');
  if (demoShare) {
    const card = demoShare.closest('[data-demo-post]');
    const previewUrl = `${window.location.origin}${window.location.pathname}#feed-preview-${card.dataset.demoPost}`;
    try {
      await navigator.clipboard.writeText(previewUrl);
      setFeedState('Sample post link copied.', 'success');
    } catch {
      setFeedState('Copy the page link to share this sample post.', 'preview');
    }
    return;
  }
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
    if (record?.media_path) await supabase.storage.from('post-media').remove([record.media_path]);
    const refreshed = await loadFeed({ reset: true });
    setFeedState(
      refreshed ? 'Your post was deleted.' : 'Your post was deleted, but the feed could not refresh. Try again.',
      refreshed ? 'success' : 'error'
    );
  } catch (error) {
    button.disabled = false;
    setFeedState(error.message || 'We couldn’t delete your post. Please try again.', 'error');
  }
}

function initializeFeedObserver() {
  if (!('IntersectionObserver' in window)) return;
  feedObserver = new IntersectionObserver(entries => {
    if (entries.some(entry => entry.isIntersecting) && feedHasMore && feedAutoLoadEnabled && !feedRequest) {
      loadFeed();
    }
  }, { rootMargin: '420px 0px' });
  feedObserver.observe(feedSentinel);
}

function bindFeedInteractions() {
  createKindButtons.forEach(button => button.addEventListener('click', () => startPostCreation(button.dataset.createKind)));
  mobileCreateButton.addEventListener('click', () => {
    const open = mobileCreateMenu.hidden;
    mobileCreateMenu.hidden = !open;
    mobileCreateButton.setAttribute('aria-expanded', String(open));
  });
  mobileCreateMenu.addEventListener('click', event => {
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
  feedFilters.forEach(button => button.addEventListener('click', () => {
    if (feedRequest || feedFilter === button.dataset.feedFilter) return;
    feedFilter = button.dataset.feedFilter;
    applyHomeSearch();
    loadFeed({ reset: true });
  }));
  feedRefresh.addEventListener('click', () => loadFeed({ reset: true }));
  feedRetry.addEventListener('click', () => {
    feedAutoLoadEnabled = true;
    loadFeed();
  });
  feedMore.addEventListener('click', () => loadFeed());
  postForm.addEventListener('submit', submitPost);
  postMediaTrigger.addEventListener('click', () => {
    postMediaInput.accept = POST_MEDIA_ACCEPT;
    postMediaInput.click();
  });
  postMediaInput.addEventListener('change', () => {
    postMediaInput.accept = POST_MEDIA_ACCEPT;
    try {
      selectedPostMedia = validatePostMedia(postMediaInput.files[0]);
      renderPostMediaPreview();
      const mediaLabel = selectedPostMedia?.kind === 'image' ? 'Photo' : 'Clip';
      setComposerStatus(`${mediaLabel} attached.`, 'success');
    } catch (error) {
      selectedPostMedia = null;
      postMediaInput.value = '';
      renderPostMediaPreview();
      setComposerStatus(error.message, 'error');
    }
  });
  postContentInput.addEventListener('input', () => {
    postCharacterCount.textContent = `${postContentInput.value.length} / ${postContentInput.maxLength}`;
  });
  feedPostList.addEventListener('click', handlePostAction);
  feedPostList.addEventListener('submit', handlePreviewComment);
  homeSearch?.addEventListener('input', applyHomeSearch);
}

function handlePreviewComment(event) {
  const form = event.target.closest('.demo-comment-form');
  if (!form) return;
  event.preventDefault();
  const input = $('input[name="preview_comment"]', form);
  const text = input.value.trim();
  if (!text) return;
  const comment = makeElement('p', 'demo-sample-comment');
  comment.append(makeElement('strong', '', 'You: '), document.createTextNode(text));
  form.before(comment);
  input.value = '';
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

function renderCandidates() {
  const visible = candidates.filter(candidate => !candidate.skipped && !candidate.liked);
  suggestionList.replaceChildren();

  if (!visible.length) {
    setSectionMessage(peopleMessage, '');
    const empty = makeElement('li', 'people-empty');
    const campusText = !ownMatchmakingEnabled
      ? 'Matchmaking is off. You can switch it on from your profile whenever you’re ready to meet people.'
      : candidates.length
        ? 'You’ve seen everyone in this batch. Check back later as more people join.'
        : 'The campus is quiet for now, but the vibe is still alive. Come back for the next wave of people and moments.';
    const title = !ownMatchmakingEnabled
      ? 'Your call, no pressure.'
      : candidates.length ? 'You’re all caught up.' : 'Your VYBE story starts here.';
    empty.append(
      makeElement('p', 'home-eyebrow', !ownMatchmakingEnabled ? 'YOUR PEOPLE, YOUR PACE' : candidates.length ? 'THAT’S EVERYONE FOR NOW' : 'YOUR PEOPLE, YOUR PACE'),
      makeElement('h3', '', title),
      makeElement('p', '', campusText)
    );
    if (!ownMatchmakingEnabled) {
      const profileLink = makeElement('a', 'text-link', 'Update your profile →');
      profileLink.href = 'profile.html';
      empty.append(profileLink);
    }
    suggestionList.append(empty);
    applyHomeSearch();
    return;
  }

  visible.forEach(candidate => suggestionList.append(renderCandidate(candidate)));
  applyHomeSearch();
}

function renderCandidate(candidate) {
  const profile = candidate.profile;
  const name = sanitizeName(profile.display_name) || 'VYBE member';
  const card = makeElement('li', 'suggestion-card');
  card.dataset.profileId = profile.id;

  const profileHref = `profile.html?id=${encodeURIComponent(profile.id)}`;
  const avatarLink = makeElement('a', 'suggestion-avatar-link');
  avatarLink.href = profileHref;
  avatarLink.setAttribute('aria-label', `View ${name}'s profile`);

  const visual = makeElement('div', 'suggestion-visual');
  visual.setAttribute('aria-hidden', 'true');
  const monogram = makeElement('span', 'suggestion-monogram', name.slice(0, 1).toUpperCase());
  visual.append(monogram);
  visual.append(makeElement('span', 'suggestion-visual-note', 'A new face on VYBE'));
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
  const detail = shared.length
    ? `A little common ground: ${shared.map(value => labels.interests[value] || value).join(', ')}.`
    : labels.food[profile.food_personality]
      ? `If their personality were food: ${labels.food[profile.food_personality]}.`
      : 'Open their profile, or send interest if the vibe feels right.';
  card.dataset.searchText = `${name} ${profile.username || ''} ${profile.university || ''} ${detail} ${(profile.interests || []).map(value => labels.interests[value] || value).join(' ')} ${(profile.vibe || []).map(value => labels.vibe[value] || value).join(' ')}`.toLocaleLowerCase();
  body.append(makeElement('p', 'suggestion-detail', detail));

  const interests = makeElement('div', 'interest-tags');
  renderTags(interests, (profile.interests || []).slice(0, 4), labels.interests);
  if (interests.childElementCount) body.append(interests);

  const vibeValues = (profile.vibe || []).map(value => labels.vibe[value] || value);
  if (vibeValues.length) {
    const vibe = makeElement('p', 'suggestion-vibe', `Their vibe: ${vibeValues.slice(0, 2).join(' · ')}`);
    body.append(vibe);
  }

  const actions = makeElement('div', 'suggestion-actions');
  const skip = makeElement('button', 'suggestion-skip', 'Not now');
  skip.type = 'button';
  skip.dataset.skip = '';
  skip.setAttribute('aria-label', `Skip ${name}`);
  skip.title = 'Hide this person for now. They will not be notified.';
  const like = makeElement('button', 'suggestion-like', 'Send interest');
  like.type = 'button';
  like.dataset.like = '';
  like.setAttribute('aria-label', `Send interest to ${name}`);
  like.title = 'Let them know you’re interested. They’ll only see a match if they feel the same.';
  const view = makeElement('a', 'suggestion-view', 'View profile');
  view.href = profileHref;
  view.setAttribute('aria-label', `View ${name}'s profile`);
  actions.append(skip, like, view);
  body.append(actions);
  card.append(avatarLink, body);
  return card;
}

async function loadSuggestions() {
  if (!ownMatchmakingEnabled) {
    candidates = [];
    setSectionMessage(peopleMessage, '');
    renderCandidates();
    return;
  }
  setSectionMessage(peopleMessage, 'Finding people you might click with…');
  const { data, error } = await supabase.rpc('discover_profiles');
  if (error) throw error;

  const profiles = (data || []).filter(profile =>
    sanitizeName(profile.display_name) && profile.id !== currentUserId
  );
  const { urlsByProfileId, warning } = await signProfileAvatars(profiles);
  setSectionMessage(peoplePhotoMessage, warning, warning ? 'error' : '');
  candidates = profiles.map(profile => ({
    profile,
    avatarUrl: urlsByProfileId.get(profile.id),
    skipped: false,
    liked: false
  }));
  setSectionMessage(peopleMessage, '');
  renderCandidates();
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
  window.addEventListener('hashchange', syncSocialNavigation);
  window.addEventListener('popstate', syncSocialNavigation);
  setupCreateFlow();
  bindFeedInteractions();
  setConversationPrompt(new Date().getDate() % CONVERSATION_PROMPTS.length);
  nextPromptButton?.addEventListener('click', () => setConversationPrompt(promptIndex + 1));
  suggestionList?.addEventListener('click', event => {
    const button = event.target.closest('button[data-skip], button[data-like]');
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
    subscribeToAppPresence(
      renderAppPresence,
      error => setStatus(`Online status could not be updated: ${error.message || 'Please try again.'}`, 'error')
    );

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('display_name, interests, matchmaking_enabled, onboarding_completed, university, gender')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    ownInterests = profile.interests || [];
    ownMatchmakingEnabled = Boolean(profile.matchmaking_enabled);
    if (profileProgress) renderProfileProgress(profile);

    const safeName = sanitizeName(profile.display_name) || sanitizeName(user.user_metadata?.display_name);
    if (homeHello) homeHello.textContent = hourGreeting();
    greeting.textContent = safeName ? `, ${safeName}` : '';
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
    initializeFeedObserver();
    const results = await Promise.allSettled([
      loadFeed({ reset: true }),
      suggestionList ? loadSuggestions() : Promise.resolve(),
      connectionList ? loadConnections() : Promise.resolve(),
      communityRooms ? loadCommunityRooms() : Promise.resolve()
    ]);
    if (results[0].status === 'rejected') {
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
    setStatus(error.message || 'We couldn’t load your VYBE home. Please refresh and try again.');
  }

  logoutButton.addEventListener('click', async () => {
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

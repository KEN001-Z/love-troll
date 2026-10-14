import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const status = $('[data-profile-status]');
const page = $('[data-profile-page]');
const labels = {
  interests: {
    music: 'Music',
    movies: 'Films & series',
    food: 'Food',
    games: 'Gaming',
    gist: 'Memes, comedy & gist',
    football: 'Football',
    fashion: 'Fashion',
    travel: 'Travel',
    books: 'Books',
    tech: 'Tech'
  },
  intentions: { friendships: 'Friendship', romance: 'Romance', 'just-vibes': 'Just vibes' }
};
const genderLabels = {
  woman: 'Female',
  man: 'Male',
  non_binary: 'Non-binary',
  prefer_not_to_say: 'Prefer not to say'
};
const interestOptions = Object.keys(labels.interests);
const editDialog = $('[data-edit-dialog]');
const editForm = $('[data-edit-form]');
const moreDialog = $('[data-more-dialog]');
const profilePostList = $('[data-profile-post-list]');
const profilePostState = $('[data-profile-post-state]');
const profilePostEmpty = $('[data-profile-post-empty]');
const profilePostRetry = $('[data-profile-post-retry]');
const profilePostMore = $('[data-profile-post-more]');
let supabase;
let currentUser;
let ownProfile;
let profile;
let targetId;
let sendingInterest = false;
const PROFILE_POST_PAGE_SIZE = 16;
const profilePostMediaUrls = new Map();
let profilePostCursor = null;
let profilePostHasMore = true;
let profilePostRequest = null;
let profilePostChannel;
let profilePostRefreshTimer;
let profilePostRefreshing = false;
const messageButton = $('[data-message]');
const followButton = $('[data-follow]');
let changingFollow = false;
const cropState = {
  avatar: { file: null, url: '', x: 50, y: 50 },
  cover: { file: null, url: '', x: 50, y: 50 }
};

function setMessage(element, message, state = '') {
  element.textContent = message;
  element.dataset.state = state;
  element.hidden = !message;
}

function friendlyError(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function addTextChips(container, values, transform = value => value) {
  container.replaceChildren();
  for (const value of values) {
    const chip = document.createElement('span');
    chip.className = 'profile-chip';
    chip.textContent = transform(value);
    container.append(chip);
  }
}

function resolveMediaUrl(value) {
  if (!value || typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
}

async function signedAsset(path) {
  const resolved = resolveMediaUrl(path);
  if (!resolved) return '';
  if (/^https?:\/\//i.test(resolved) || resolved.startsWith('data:')) return resolved;
  const { data, error } = await supabase.storage.from('profile-media').createSignedUrl(resolved, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('VYBE couldn’t load this profile photo.');
  return data.signedUrl;
}

async function renderPhotos() {
  const avatar = $('[data-avatar]');
  const initials = $('[data-initials]');
  const cover = $('[data-cover]');
  initials.textContent = (profile.display_name || profile.username || '?').trim().slice(0, 1).toUpperCase();
  initials.hidden = false;
  avatar.querySelector('img')?.remove();
  cover.classList.remove('has-image');
  cover.style.backgroundImage = '';
  const failures = [];
  const avatarSource = resolveMediaUrl(profile.avatar_url || profile.avatar_path);
  const coverSource = resolveMediaUrl(profile.cover_url || profile.cover_path);

  if (avatarSource) {
    try {
      const image = document.createElement('img');
      image.alt = '';
      image.loading = 'eager';
      image.fetchPriority = 'high';
      image.decoding = 'async';
      image.addEventListener('load', () => {
        image.classList.add('is-loaded');
        initials.hidden = true;
      }, { once: true });
      image.addEventListener('error', () => {
        image.remove();
        initials.hidden = false;
        setMessage($('[data-action-feedback]'), 'The profile photo could not be loaded.', 'error');
      }, { once: true });
      image.src = await signedAsset(avatarSource);
      avatar.append(image);
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (coverSource) {
    try {
      cover.style.backgroundImage = `url("${await signedAsset(coverSource)}")`;
      cover.classList.add('has-image');
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length) setMessage($('[data-action-feedback]'), failures.join(' '), 'error');
}

function renderProfile() {
  const authName = currentUser.user_metadata?.display_name;
  const authDisplayName = profile.is_owner && typeof authName === 'string' ? authName.trim() : '';
  const name = profile.display_name?.trim() || authDisplayName || 'Name not provided';
  document.title = `${name} — VYBE`;
  $('[data-name]').textContent = name;
  $('[data-about-name]').textContent = name;
  $('[data-username]').textContent = profile.username
    ? `@${profile.username}`
    : profile.is_owner ? 'Add an optional username in Edit profile' : '';
  $('[data-username]').hidden = !profile.username && !profile.is_owner;
  $('[data-education]').textContent = [profile.department, profile.academic_level, profile.university].filter(Boolean).join(' · ') || 'University details not shared';
  const gender = profile.gender === 'prefer_not_to_say'
    ? ''
    : profile.gender?.startsWith('self_describe:') ? profile.gender.slice('self_describe:'.length) : genderLabels[profile.gender] || '';
  $('[data-gender]').textContent = gender ? `Gender: ${gender}` : '';
  $('[data-gender]').hidden = !gender;
  $('[data-bio]').textContent = profile.bio || '';
  $('[data-bio]').hidden = !profile.bio;
  $('[data-about-bio]').textContent = profile.bio || 'No bio yet. A short intro is always optional.';
  $('[data-mood]').textContent = `Currently: ${profile.current_mood}`;
  $('[data-mood]').hidden = !profile.current_mood;
  $('[data-followers]').textContent = Number(profile.follower_count || 0).toLocaleString();
  $('[data-following]').textContent = Number(profile.following_count || 0).toLocaleString();
  $('[data-likes]').textContent = Number(profile.like_count || 0).toLocaleString();
  $('[data-post-count]').textContent = Number(profile.post_count || 0).toLocaleString();
  $('[data-about-mood]').textContent = `Currently in the mood for: ${profile.current_mood}`;
  $('[data-about-mood]').hidden = !profile.current_mood;
  $('[data-catchphrase]').textContent = profile.catchphrase ? `“${profile.catchphrase}”` : '';
  $('[data-catchphrase]').hidden = !profile.catchphrase;

  const interestNames = [...(profile.interests || []).map(value => labels.interests[value] || value), ...(profile.hobbies || [])];
  addTextChips($('[data-interests]'), interestNames);
  $('[data-no-interests]').hidden = interestNames.length > 0;
  addTextChips($('[data-tags]'), profile.personality_tags || []);
  $('[data-no-tags]').hidden = Boolean(profile.personality_tags?.length);

  const matchSection = $('[data-match-section]');
  const showMatch = Boolean(profile.can_receive_interest || (profile.is_owner && profile.looking_for));
  matchSection.hidden = !showMatch;
  if (showMatch) {
    $('[data-intention]').textContent = `Open to: ${labels.intentions[profile.looking_for] || 'meeting people'}`;
    const sharedInterests = (profile.interests || []).filter(interest => ownProfile.interests?.includes(interest));
    const sharedHobbies = (profile.hobbies || []).filter(hobby => ownProfile.hobbies?.includes(hobby));
    addTextChips(
      $('[data-shared-interests]'),
      [...sharedInterests.map(value => labels.interests[value] || value), ...sharedHobbies].map(value => `In common: ${value}`)
    );
  }

  $('[data-edit]').hidden = !profile.is_owner;
  $('[data-edit-avatar]').hidden = !profile.is_owner;
  $('[data-edit-cover]').hidden = !profile.is_owner;
  $('[data-interest]').hidden = !profile.can_receive_interest;
  followButton.hidden = profile.is_owner;
  followButton.disabled = profile.is_owner;
  followButton.textContent = profile.is_following ? 'Following' : 'Follow';
  messageButton.hidden = profile.is_owner;
  if (profile.is_owner) {
    messageButton.removeAttribute('href');
  } else {
    messageButton.href = `messages.html?user=${encodeURIComponent(profile.id)}`;
  }
  $('[data-more]').hidden = profile.is_owner;
  $('[data-social-note]').hidden = profile.is_owner;

  if (profile.is_owner) {
    $('[data-avatar]').setAttribute('aria-label', 'Your profile photo');
  } else {
    $('[data-avatar]').setAttribute('aria-label', `${name}'s profile photo`);
  }
  renderPhotos();
}

function activateTab(tab) {
  $$('[data-tab]').forEach(button => {
    const selected = button === tab;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
  $$('[data-panel]').forEach(panel => { panel.hidden = panel.dataset.panel !== tab.dataset.tab; });
}

function renderInterestOptions(selected = []) {
  const container = $('[data-interest-options]');
  container.replaceChildren();
  for (const value of interestOptions) {
    const label = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.name = 'interests';
    checkbox.value = value;
    checkbox.checked = selected.includes(value);
    label.append(checkbox, document.createTextNode(labels.interests[value]));
    container.append(label);
  }
}

function openEditDialog(focusField) {
  editForm.elements.namedItem('display_name').value = profile.display_name || '';
  editForm.elements.namedItem('username').value = profile.username || '';
  editForm.elements.namedItem('university').value = profile.university || '';
  const genderSelect = editForm.elements.namedItem('gender');
  const genderDescription = editForm.elements.namedItem('gender_description');
  const isSelfDescribed = profile.gender?.startsWith('self_describe:');
  genderSelect.value = isSelfDescribed ? 'self_describe' : genderLabels[profile.gender] ? profile.gender : '';
  genderDescription.value = isSelfDescribed ? profile.gender.slice('self_describe:'.length) : '';
  toggleGenderDescription();
  editForm.elements.namedItem('department').value = profile.department || '';
  editForm.elements.namedItem('academic_level').value = profile.academic_level || '';
  editForm.elements.namedItem('bio').value = profile.bio || '';
  editForm.elements.namedItem('hobbies').value = (profile.hobbies || []).join(', ');
  editForm.elements.namedItem('personality_tags').value = (profile.personality_tags || []).join(', ');
  editForm.elements.namedItem('current_mood').value = profile.current_mood || '';
  editForm.elements.namedItem('catchphrase').value = profile.catchphrase || '';
  editForm.elements.namedItem('profile_visibility').value = profile.profile_visibility || 'campus';
  editForm.elements.namedItem('matchmaking_enabled').checked = Boolean(ownProfile.matchmaking_enabled);
  editForm.elements.namedItem('looking_for').value = ownProfile.looking_for || '';
  editForm.elements.namedItem('relationship_status').value = ownProfile.relationship_status || '';
  editForm.elements.namedItem('avatar').value = '';
  editForm.elements.namedItem('cover').value = '';
  $$('[data-camera-input]').forEach(input => { input.value = ''; });
  resetCropState('avatar');
  resetCropState('cover');
  $('[data-bio-count]').textContent = String((profile.bio || '').length);
  renderInterestOptions(profile.interests || []);
  toggleIntentionFields();
  setMessage($('[data-edit-feedback]'), '');
  editDialog.showModal();
  if (focusField) {
    requestAnimationFrame(() => {
      const field = ['avatar', 'cover'].includes(focusField)
        ? $(`[data-photo-pick="camera"][data-photo-kind="${focusField}"]`)
        : editForm.elements.namedItem(focusField);
      field.scrollIntoView({ block: 'center' });
      field.focus({ preventScroll: true });
    });
  }
}

function clampPosition(value) {
  return Math.min(100, Math.max(0, value));
}

function updateCropPreview(kind) {
  const state = cropState[kind];
  const positioning = $('[data-photo-positioning]');
  const card = $(`[data-photo-position-card="${kind}"]`);
  const preview = $(`[data-photo-preview="${kind}"]`);
  const image = $('img', preview);
  const horizontal = $(`[data-photo-position-axis="${kind}-x"]`);
  const vertical = $(`[data-photo-position-axis="${kind}-y"]`);
  card.hidden = !state.file;
  positioning.hidden = !cropState.avatar.file && !cropState.cover.file;
  horizontal.value = String(state.x);
  vertical.value = String(state.y);
  if (state.file) {
    if (image.src !== state.url) image.src = state.url;
    image.style.objectPosition = `${state.x}% ${state.y}%`;
  } else {
    image.removeAttribute('src');
  }
}

function resetCropState(kind) {
  const state = cropState[kind];
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = null;
  state.url = '';
  state.x = 50;
  state.y = 50;
  updateCropPreview(kind);
}

function setCropFile(kind, file) {
  const state = cropState[kind];
  if (state.url) URL.revokeObjectURL(state.url);
  state.file = file || null;
  state.url = file ? URL.createObjectURL(file) : '';
  state.x = 50;
  state.y = 50;
  const selected = $(`[data-photo-selected="${kind}"]`);
  selected.textContent = file ? `Selected: ${file.name}` : '';
  selected.hidden = !file;
  updateCropPreview(kind);
}

function initCropControls() {
  for (const kind of ['avatar', 'cover']) {
    const inputs = [$(`[data-gallery-input="${kind}"]`), $(`[data-camera-input="${kind}"]`)];
    inputs.forEach(input => input.addEventListener('change', () => {
      setCropFile(kind, input.files[0]);
    }));
    $$(`[data-photo-pick][data-photo-kind="${kind}"]`).forEach(button => {
      button.addEventListener('click', () => {
        const input = button.dataset.photoPick === 'camera' ? inputs[1] : inputs[0];
        input.click();
      });
    });
    const preview = $(`[data-photo-preview="${kind}"]`);
    const horizontal = $(`[data-photo-position-axis="${kind}-x"]`);
    const vertical = $(`[data-photo-position-axis="${kind}-y"]`);
    horizontal.addEventListener('input', () => {
      cropState[kind].x = Number(horizontal.value);
      updateCropPreview(kind);
    });
    vertical.addEventListener('input', () => {
      cropState[kind].y = Number(vertical.value);
      updateCropPreview(kind);
    });
    preview.addEventListener('pointerdown', event => {
      if (!cropState[kind].file) return;
      preview.setPointerCapture(event.pointerId);
      preview.dataset.dragging = 'true';
      preview.dataset.pointerX = String(event.clientX);
      preview.dataset.pointerY = String(event.clientY);
    });
    preview.addEventListener('pointermove', event => {
      if (preview.dataset.dragging !== 'true') return;
      const rect = preview.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = event.clientX - Number(preview.dataset.pointerX);
      const dy = event.clientY - Number(preview.dataset.pointerY);
      cropState[kind].x = clampPosition(cropState[kind].x - (dx / rect.width) * 100);
      cropState[kind].y = clampPosition(cropState[kind].y - (dy / rect.height) * 100);
      preview.dataset.pointerX = String(event.clientX);
      preview.dataset.pointerY = String(event.clientY);
      updateCropPreview(kind);
    });
    const stopDragging = () => { preview.dataset.dragging = 'false'; };
    preview.addEventListener('pointerup', stopDragging);
    preview.addEventListener('pointercancel', stopDragging);
  }
}

async function cropImage(file, kind) {
  const state = cropState[kind];
  if (!file || !state.file || state.file !== file) return file;
  const image = new Image();
  image.src = state.url;
  await image.decode();
  const width = kind === 'avatar' ? 800 : 1600;
  const height = kind === 'avatar' ? 800 : 500;
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const renderedWidth = image.naturalWidth * scale;
  const renderedHeight = image.naturalHeight * scale;
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = ((renderedWidth - width) * state.x / 100) / scale;
  const sourceY = ((renderedHeight - height) * state.y / 100) / scale;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, file.type, .92));
  if (!blob) throw new Error('The selected image could not be prepared.');
  return new File([blob], file.name, { type: file.type, lastModified: Date.now() });
}

function toggleIntentionFields() {
  const enabled = editForm.elements.namedItem('matchmaking_enabled').checked;
  $('[data-matchmaking-settings]').classList.toggle('is-enabled', enabled);
  $$('[data-intention-fields]').forEach(field => { field.hidden = !enabled; });
  editForm.elements.namedItem('looking_for').required = enabled;
  editForm.elements.namedItem('relationship_status').required = enabled;
}

function toggleGenderDescription() {
  const isSelfDescribed = editForm.elements.namedItem('gender').value === 'self_describe';
  const field = $('[data-gender-description-field]');
  field.hidden = !isSelfDescribed;
  editForm.elements.namedItem('gender_description').required = isSelfDescribed;
}

function splitTags(value, limit, label, maxLength) {
  const items = value.split(',').map(item => item.trim()).filter(Boolean);
  if (items.length > limit) throw new Error(`Choose up to ${limit} ${label}.`);
  if (items.some(item => item.length > maxLength)) throw new Error(`${label} must be ${maxLength} characters or fewer each.`);
  return [...new Set(items)];
}

function validateImage(file, label) {
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error(`${label} must be a JPG, PNG, or WebP image.`);
  }
  if (file.size > 5 * 1024 * 1024) throw new Error(`${label} must be 5 MB or smaller.`);
}

async function uploadProfileImage(file, folder, progress) {
  const extensions = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
  const path = `${currentUser.id}/${folder}/${crypto.randomUUID()}.${extensions[file.type]}`;
  progress.hidden = false;
  progress.removeAttribute('value');
  const { error } = await supabase.storage.from('profile-media').upload(path, file, {
    contentType: file.type,
    cacheControl: '3600'
  });
  if (error) throw error;
  return path;
}

async function saveProfile(event) {
  event.preventDefault();
  const button = $('button[type="submit"]', editForm);
  const feedback = $('[data-edit-feedback]');
  const progress = $('[data-upload-progress]');
  const oldLabel = button.textContent;
  const createdPaths = [];
  let profileSaved = false;
  button.disabled = true;
  button.textContent = 'Saving…';
  setMessage(feedback, '');
  progress.hidden = true;

  try {
    const avatar = await cropImage(cropState.avatar.file, 'avatar');
    const cover = await cropImage(cropState.cover.file, 'cover');
    validateImage(avatar, 'Profile photo');
    validateImage(cover, 'Cover photo');
    const matchmakingEnabled = editForm.elements.namedItem('matchmaking_enabled').checked;
    const hobbies = splitTags(editForm.elements.namedItem('hobbies').value, 12, 'hobbies', 40);
    const personalityTags = splitTags(editForm.elements.namedItem('personality_tags').value, 8, 'personality tags', 24);

    let nextAvatarPath = profile.avatar_path;
    let nextCoverPath = profile.cover_path;
    if (avatar) {
      setMessage(feedback, 'Uploading profile photo…');
      nextAvatarPath = await uploadProfileImage(avatar, 'avatar', progress);
      createdPaths.push(nextAvatarPath);
    }
    if (cover) {
      setMessage(feedback, 'Uploading cover photo…');
      nextCoverPath = await uploadProfileImage(cover, 'cover', progress);
      createdPaths.push(nextCoverPath);
    }

    setMessage(feedback, 'Saving profile details…');
    const updates = {
      display_name: editForm.elements.namedItem('display_name').value.trim(),
      username: editForm.elements.namedItem('username').value.trim().toLowerCase(),
      university: editForm.elements.namedItem('university').value.trim() || null,
      gender: (() => {
        const selectedGender = editForm.elements.namedItem('gender').value;
        if (selectedGender === 'self_describe') {
          const description = editForm.elements.namedItem('gender_description').value.trim();
          if (!description) throw new Error('Describe your gender or choose another option.');
          return `self_describe:${description}`;
        }
        return selectedGender || null;
      })(),
      department: editForm.elements.namedItem('department').value.trim() || null,
      academic_level: editForm.elements.namedItem('academic_level').value.trim() || null,
      bio: editForm.elements.namedItem('bio').value.trim() || null,
      interests: $$('input[name="interests"]:checked', editForm).map(input => input.value),
      hobbies,
      personality_tags: personalityTags,
      current_mood: editForm.elements.namedItem('current_mood').value.trim() || null,
      catchphrase: editForm.elements.namedItem('catchphrase').value.trim() || null,
      profile_visibility: editForm.elements.namedItem('profile_visibility').value,
      matchmaking_enabled: matchmakingEnabled,
      looking_for: matchmakingEnabled ? editForm.elements.namedItem('looking_for').value : null,
      relationship_status: matchmakingEnabled
        ? editForm.elements.namedItem('relationship_status').value
        : ownProfile.relationship_status,
      avatar_path: nextAvatarPath,
      cover_path: nextCoverPath,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('profiles')
      .update(updates)
      .eq('id', currentUser.id)
      .select('id')
      .single();
    if (error) throw error;
    if (!data?.id) throw new Error('VYBE couldn’t confirm that your profile was saved.');
    profileSaved = true;
    ownProfile = { ...ownProfile, ...updates };

    await loadProfile();
    editDialog.close();
    setMessage($('[data-action-feedback]'), 'Profile updated.', 'success');
  } catch (error) {
    if (profileSaved) {
      editDialog.close();
      setMessage($('[data-action-feedback]'), `Your changes were saved, but the profile could not refresh: ${friendlyError(error)}`, 'error');
      return;
    }
    if (!profileSaved && createdPaths.length) {
      const { error: cleanupError } = await supabase.storage.from('profile-media').remove(createdPaths);
      if (cleanupError) {
        setMessage(feedback, `${friendlyError(error)} The new photo could not be cleaned up: ${cleanupError.message}`, 'error');
        return;
      }
    }
    setMessage(feedback, friendlyError(error), 'error');
  } finally {
    button.disabled = false;
    button.textContent = oldLabel;
    progress.hidden = true;
  }
}

async function loadProfile() {
  const { data, error } = await supabase.rpc('get_profile_public', { target_profile: targetId });
  if (error) throw error;
  profile = Array.isArray(data) ? data[0] : data;
  if (!profile || profile.id !== targetId) {
    throw new Error('This profile is private or unavailable. You can still meet more people from the VYBE home page.');
  }
  if (profile.is_owner !== (targetId === currentUser.id)) {
    throw new Error('VYBE could not verify this profile’s account identity. Please reload and try again.');
  }
  renderProfile();
}

function profilePostMedia(post) {
  if (Array.isArray(post.media_items) && post.media_items.length) return post.media_items;
  return post.media_path ? [{ path: post.media_path, mime: post.media_mime, kind: post.media_kind }] : [];
}

async function signProfilePostMedia(posts) {
  const paths = [...new Set(posts.flatMap(post => profilePostMedia(post).map(media => media.path)).filter(Boolean))];
  const missing = paths.filter(path => !profilePostMediaUrls.has(path));
  if (!missing.length) return;
  const { data, error } = await supabase.storage.from('post-media').createSignedUrls(missing, 3600);
  if (error) throw error;
  (data || []).forEach(result => {
    if (result.path && result.signedUrl) profilePostMediaUrls.set(result.path, result.signedUrl);
  });
  if (missing.some(path => !profilePostMediaUrls.has(path))) {
    throw new Error('Some post media could not be opened. Check post-media Storage read permissions.');
  }
}

function renderProfilePost(post, avatarUrl = '') {
  const item = document.createElement('article');
  item.className = 'profile-post-card';
  item.dataset.postId = post.id;
  item.id = `profile-post-${post.id}`;

  const header = document.createElement('header');
  header.className = 'profile-post-header';
  const avatar = document.createElement('span');
  avatar.className = 'profile-post-avatar';
  avatar.textContent = (profile.display_name || profile.username || 'V').trim().slice(0, 1).toUpperCase();
  if (avatarUrl) {
    const image = document.createElement('img');
    image.src = avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('load', () => { avatar.textContent = ''; }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    avatar.append(image);
  }

  const identity = document.createElement('div');
  identity.className = 'profile-post-identity';
  const name = document.createElement('strong');
  name.textContent = profile.display_name?.trim() || 'VYBE member';
  identity.append(name);
  if (profile.username) {
    const username = document.createElement('span');
    username.textContent = `@${profile.username}`;
    identity.append(username);
  }
  const time = document.createElement('time');
  time.dateTime = post.created_at;
  const date = new Date(post.created_at);
  time.textContent = Number.isNaN(date.getTime())
    ? ''
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
  header.append(avatar, identity, time);

  const content = document.createElement('p');
  content.className = 'profile-post-content';
  content.textContent = post.content;
  item.append(header, content);

  const mediaItems = profilePostMedia(post);
  if (mediaItems.length) {
    const gallery = document.createElement('div');
    gallery.className = 'profile-post-gallery';
    gallery.setAttribute('role', 'group');
    if (mediaItems.length > 1) gallery.setAttribute('aria-label', `${mediaItems.length} photos`);
    mediaItems.forEach((media, index) => {
      const slide = document.createElement('div');
      slide.className = 'profile-post-slide';
      const source = profilePostMediaUrls.get(media.path);
      if (source && media.kind === 'image') {
        const image = document.createElement('img');
        image.src = source;
        image.alt = mediaItems.length > 1
          ? `Photo ${index + 1} of ${mediaItems.length}: ${post.content}`
          : post.content ? `Photo post: ${post.content}` : 'Photo shared on VYBE';
        image.loading = 'lazy';
        slide.append(image);
      } else if (source && media.kind === 'video') {
        const video = document.createElement('video');
        video.src = source;
        video.controls = true;
        video.playsInline = true;
        video.preload = 'metadata';
        video.setAttribute('aria-label', 'Attached video clip');
        slide.append(video);
      } else {
        const unavailable = document.createElement('p');
        unavailable.className = 'profile-post-media-error';
        unavailable.textContent = 'This post’s media could not be loaded.';
        slide.append(unavailable);
      }
      gallery.append(slide);
    });
    item.append(gallery);
  }
  return item;
}

function setProfilePostState(message, state = '') {
  profilePostState.textContent = message;
  profilePostState.dataset.state = state;
  profilePostState.hidden = !message;
}

async function loadProfilePosts({ reset = false } = {}) {
  if (profilePostRequest) {
    if (!reset) return profilePostRequest;
    await profilePostRequest;
  }
  if (reset) {
    profilePostCursor = null;
    profilePostHasMore = true;
    profilePostRetry.hidden = true;
    if (!profilePostList.childElementCount) setProfilePostState('Loading posts…');
  } else if (!profilePostHasMore) {
    setProfilePostState(profilePostList.childElementCount ? 'You’re all caught up.' : '', 'empty');
    return true;
  }
  profilePostMore.disabled = true;

  const request = (async () => {
    try {
      const { data, error } = await supabase.rpc('get_profile_posts', {
        target_profile: targetId,
        p_before_created_at: profilePostCursor?.created_at || null,
        p_before_id: profilePostCursor?.id || null,
        p_limit: PROFILE_POST_PAGE_SIZE + 1
      });
      if (error) throw error;
      const rows = data || [];
      const posts = rows.slice(0, PROFILE_POST_PAGE_SIZE);
      await signProfilePostMedia(posts);
      let avatarUrl = '';
      const avatarPath = profile.avatar_url || profile.avatar_path;
      if (avatarPath) {
        try {
          avatarUrl = await signedAsset(avatarPath);
        } catch (error) {
          console.warn('VYBE could not load this profile photo for its posts:', error);
        }
      }

      if (reset) profilePostList.replaceChildren();
      const existingIds = new Set([...profilePostList.children].map(item => item.dataset.postId));
      posts.forEach(post => {
        if (!existingIds.has(post.id)) profilePostList.append(renderProfilePost(post, avatarUrl));
      });
      profilePostHasMore = rows.length > PROFILE_POST_PAGE_SIZE;
      if (posts.length) {
        const lastPost = posts[posts.length - 1];
        profilePostCursor = { created_at: lastPost.created_at, id: lastPost.id };
      }
      profilePostEmpty.hidden = profilePostList.childElementCount > 0;
      setProfilePostState(
        profilePostList.childElementCount
          ? profilePostHasMore ? '' : 'You’re all caught up.'
          : '',
        profilePostList.childElementCount && !profilePostHasMore ? 'empty' : ''
      );
      profilePostRetry.hidden = true;
      profilePostMore.hidden = !profilePostHasMore;
      return true;
    } catch (error) {
      profilePostEmpty.hidden = true;
      setProfilePostState(
        ['PGRST202', 'PGRST205', '42883'].includes(error?.code)
          ? 'Profile posts need the latest reviewed Feed migration. Apply it, then retry.'
          : `Couldn’t load posts. ${friendlyError(error)}`,
        'error'
      );
      profilePostRetry.hidden = false;
      profilePostMore.hidden = true;
      return false;
    } finally {
      profilePostRequest = null;
      profilePostMore.disabled = false;
    }
  })();
  profilePostRequest = request;
  return request;
}

function refreshProfilePosts() {
  if (profilePostRefreshing || document.visibilityState !== 'visible') return;
  profilePostRefreshing = true;
  Promise.all([loadProfile(), loadProfilePosts({ reset: true })])
    .catch(error => setProfilePostState(`Couldn’t refresh profile posts. ${friendlyError(error)}`, 'error'))
    .finally(() => { profilePostRefreshing = false; });
}

function startProfilePostRealtime() {
  if (!profilePostList || !targetId || !supabase || profilePostChannel) return;
  profilePostChannel = supabase
    .channel(`profile:posts:${targetId}:${currentUser.id}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'posts'
    }, payload => {
      const authorId = payload.new?.author_id || payload.old?.author_id;
      if (payload.eventType === 'DELETE' || authorId === targetId) refreshProfilePosts();
    })
    .subscribe(channelStatus => {
      if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'TIMED_OUT') {
        setProfilePostState('Live post updates are unavailable. VYBE will keep checking for changes.', 'error');
      }
    });
  profilePostRefreshTimer = window.setInterval(refreshProfilePosts, 30000);
  window.addEventListener('pagehide', stopProfilePostRealtime, { once: true });
}

function stopProfilePostRealtime() {
  if (profilePostRefreshTimer) window.clearInterval(profilePostRefreshTimer);
  profilePostRefreshTimer = null;
  if (profilePostChannel) supabase?.removeChannel(profilePostChannel);
  profilePostChannel = null;
}

function resumeProfilePostRealtime() {
  if (!targetId) return;
  startProfilePostRealtime();
  refreshProfilePosts();
}

async function loadInterestState() {
  if (profile.id === currentUser.id) return;
  const { data: match, error: matchError } = await supabase.from('matches')
    .select('id')
    .or(`and(user_a.eq.${currentUser.id},user_b.eq.${profile.id}),and(user_b.eq.${currentUser.id},user_a.eq.${profile.id})`)
    .maybeSingle();
  if (matchError) throw matchError;
  if (match) {
    const button = $('[data-interest]');
    button.textContent = 'It’s a match!';
    button.disabled = true;
    return;
  }
  if (!profile.can_receive_interest) return;
  const { data, error } = await supabase.from('discovery_likes')
    .select('target_id')
    .eq('user_id', currentUser.id)
    .eq('target_id', profile.id)
    .maybeSingle();
  if (error) throw error;
  if (data) {
    const button = $('[data-interest]');
    button.textContent = 'Interest sent';
    button.disabled = true;
  }
}

async function toggleFollow() {
  if (changingFollow || profile?.is_owner) return;
  changingFollow = true;
  followButton.disabled = true;
  const wasFollowing = profile.is_following;
  followButton.textContent = wasFollowing ? 'Unfollowing…' : 'Following…';
  try {
    const { data, error } = await supabase.rpc('toggle_follow', { target_user: profile.id });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    profile.is_following = Boolean(result?.following);
    profile.follower_count = result?.follower_count ?? profile.follower_count;
    followButton.textContent = profile.is_following ? 'Following' : 'Follow';
    $('[data-followers]').textContent = Number(profile.follower_count || 0).toLocaleString();
    setMessage($('[data-action-feedback]'), profile.is_following ? 'You are now following this profile.' : 'You unfollowed this profile.', 'success');
  } catch (error) {
    followButton.textContent = wasFollowing ? 'Following' : 'Follow';
    setMessage($('[data-action-feedback]'), friendlyError(error), 'error');
  } finally {
    changingFollow = false;
    followButton.disabled = false;
  }
}

async function expressInterest(button) {
  if (sendingInterest || button.disabled) return;
  sendingInterest = true;
  button.disabled = true;
  button.textContent = 'Sending…';
  setMessage($('[data-action-feedback]'), '');
  try {
    const { data, error } = await supabase.rpc('express_interest', { target_user: profile.id });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.matched !== 'boolean') throw new Error('VYBE could not confirm that interest. Please try again.');
    if (result.matched && !result.match_id) {
      throw new Error('VYBE confirmed a mutual interest but could not return the connection. Refresh to check your connections.');
    }
    button.textContent = result.matched ? 'It’s a match!' : 'Interest sent';
    setMessage(
      $('[data-action-feedback]'),
      result.matched ? 'It’s mutual — you’re a match. 💜' : 'Interest sent. If they’re into you too, you’ll both get a match. 💜',
      'success'
    );
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Send interest';
    setMessage($('[data-action-feedback]'), friendlyError(error), 'error');
  } finally {
    sendingInterest = false;
  }
}

async function shareProfile() {
  const url = new URL(`profile.html?id=${encodeURIComponent(profile.id)}`, window.location.href).toString();
  try {
    if (navigator.share) {
      await navigator.share({ title: `${profile.display_name?.trim() || 'VYBE profile'} on VYBE`, url });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      setMessage($('[data-action-feedback]'), 'Profile link copied.', 'success');
    } else {
      throw new Error('Sharing isn’t supported in this browser.');
    }
  } catch (error) {
    if (error?.name !== 'AbortError') setMessage($('[data-action-feedback]'), friendlyError(error), 'error');
  }
}

async function initialize() {
  try {
    supabase = getSupabaseClient();
    const { user, recovered } = await getAuthenticatedUser(supabase);
    if (!user) {
      const loginUrl = new URL('login.html', window.location.href);
      if (recovered) loginUrl.searchParams.set('session', 'expired');
      loginUrl.searchParams.set('returnTo', `${window.location.pathname}${window.location.search}${window.location.hash}`);
      window.location.replace(loginUrl);
      return;
    }
    currentUser = user;
    const { data: me, error: ownError } = await supabase.from('profiles')
      .select('id,onboarding_completed,interests,hobbies,matchmaking_enabled,looking_for,relationship_status')
      .eq('id', user.id)
      .maybeSingle();
    if (ownError) throw ownError;
    if (!me?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    ownProfile = me;
    targetId = new URLSearchParams(window.location.search).get('id') || user.id;

    await loadProfile();
    status.hidden = true;
    page.hidden = false;
    loadProfilePosts({ reset: true });
    startProfilePostRealtime();
    window.addEventListener('pageshow', resumeProfilePostRealtime);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshProfilePosts();
    });
    if (targetId === currentUser.id && new URLSearchParams(window.location.search).get('edit') === 'complete') {
      openEditDialog('university');
    }
    loadInterestState().catch(error => {
      setMessage($('[data-action-feedback]'), friendlyError(error), 'error');
    });
    window.dispatchEvent(new Event('vybe:page-ready'));
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = ['PGRST202', 'PGRST204', 'PGRST205', '42703'].includes(error?.code)
      ? 'Student profiles aren’t enabled yet. Apply the discovery and student-profile Supabase migrations, then reload.'
      : friendlyError(error);
    status.hidden = false;
    window.dispatchEvent(new Event('vybe:page-ready'));
  }

  $('[data-tab]').parentElement.addEventListener('click', event => {
    const tab = event.target.closest('[data-tab]');
    if (tab) activateTab(tab);
  });
  $('[data-tab]').parentElement.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = $$('[data-tab]');
    const current = tabs.indexOf(event.target.closest('[data-tab]'));
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
    activateTab(tabs[next]);
  });
  profilePostRetry.addEventListener('click', () => loadProfilePosts({ reset: true }));
  profilePostMore.addEventListener('click', () => loadProfilePosts());

  $('[data-edit]').addEventListener('click', () => openEditDialog());
  $('[data-edit-avatar]').addEventListener('click', () => openEditDialog('avatar'));
  $('[data-edit-cover]').addEventListener('click', () => openEditDialog('cover'));
  $('[data-close-edit]').addEventListener('click', () => editDialog.close());
  $('[data-cancel-edit]').addEventListener('click', () => editDialog.close());
  $('[data-more]').addEventListener('click', () => moreDialog.showModal());
  $$('[data-close-more]').forEach(button => button.addEventListener('click', () => moreDialog.close()));
  $('[data-share]').addEventListener('click', shareProfile);
  $('[data-interest]').addEventListener('click', event => expressInterest(event.currentTarget));
  followButton.addEventListener('click', toggleFollow);
  editForm.addEventListener('submit', saveProfile);
  initCropControls();
  editForm.elements.namedItem('matchmaking_enabled').addEventListener('change', toggleIntentionFields);
  editForm.elements.namedItem('gender').addEventListener('change', toggleGenderDescription);
  editForm.elements.namedItem('bio').addEventListener('input', event => {
    $('[data-bio-count]').textContent = String(event.currentTarget.value.length);
  });
  $('[data-logout]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setMessage(status, `We couldn’t log you out: ${friendlyError(error)}`, 'error');
      button.disabled = false;
    }
  });
}

initialize();

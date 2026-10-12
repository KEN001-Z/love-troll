import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

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
const interestOptions = Object.keys(labels.interests);
const editDialog = $('[data-edit-dialog]');
const editForm = $('[data-edit-form]');
const moreDialog = $('[data-more-dialog]');
let supabase;
let currentUser;
let ownProfile;
let profile;
let targetId;
let sendingInterest = false;

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

async function signedAsset(path) {
  if (!path) return '';
  const { data, error } = await supabase.storage.from('profile-media').createSignedUrl(path, 3600);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error('VYBE couldn’t load this profile photo.');
  return data.signedUrl;
}

async function renderPhotos() {
  const avatar = $('[data-avatar]');
  const initials = $('[data-initials]');
  const cover = $('[data-cover]');
  initials.textContent = (profile.display_name || profile.username || '?').trim().slice(0, 1).toUpperCase();
  avatar.querySelector('img')?.remove();
  cover.classList.remove('has-image');
  cover.style.backgroundImage = '';
  const failures = [];

  if (profile.avatar_path) {
    try {
      const image = document.createElement('img');
      image.src = await signedAsset(profile.avatar_path);
      image.alt = '';
      image.addEventListener('error', () => setMessage($('[data-action-feedback]'), 'The profile photo could not be loaded.', 'error'), { once: true });
      avatar.append(image);
      initials.hidden = true;
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (profile.cover_path) {
    try {
      cover.style.backgroundImage = `url("${await signedAsset(profile.cover_path)}")`;
      cover.classList.add('has-image');
    } catch (error) {
      failures.push(error.message);
    }
  }
  if (failures.length) setMessage($('[data-action-feedback]'), failures.join(' '), 'error');
}

function renderProfile() {
  const name = profile.display_name?.trim() || 'VYBE student';
  document.title = `${name} — VYBE`;
  $('[data-name]').textContent = name;
  $('[data-about-name]').textContent = name;
  $('[data-username]').textContent = `@${profile.username}`;
  $('[data-education]').textContent = [profile.department, profile.academic_level, profile.university].filter(Boolean).join(' · ') || 'University details not shared';
  $('[data-bio]').textContent = profile.bio || '';
  $('[data-bio]').hidden = !profile.bio;
  $('[data-about-bio]').textContent = profile.bio || 'No bio yet. A short intro is always optional.';
  $('[data-mood]').textContent = `Currently: ${profile.current_mood}`;
  $('[data-mood]').hidden = !profile.current_mood;
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
  $('[data-interest]').hidden = !profile.can_receive_interest;
  $('[data-follow]').hidden = profile.is_owner;
  $('[data-message]').hidden = profile.is_owner;
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

function openEditDialog() {
  editForm.elements.namedItem('display_name').value = profile.display_name || '';
  editForm.elements.namedItem('username').value = profile.username || '';
  editForm.elements.namedItem('university').value = profile.university || '';
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
  $('[data-bio-count]').textContent = String((profile.bio || '').length);
  renderInterestOptions(profile.interests || []);
  toggleIntentionFields();
  setMessage($('[data-edit-feedback]'), '');
  editDialog.showModal();
}

function toggleIntentionFields() {
  const enabled = editForm.elements.namedItem('matchmaking_enabled').checked;
  $$('[data-intention-fields]').forEach(field => { field.hidden = !enabled; });
  editForm.elements.namedItem('looking_for').required = enabled;
  editForm.elements.namedItem('relationship_status').required = enabled;
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
    const avatar = editForm.elements.namedItem('avatar').files[0];
    const cover = editForm.elements.namedItem('cover').files[0];
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
  if (!profile) {
    throw new Error('This profile is private or unavailable. You can still meet more people from the VYBE home page.');
  }
  renderProfile();
}

async function loadInterestState() {
  if (!profile.can_receive_interest) return;
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
      await navigator.share({ title: `${profile.display_name || 'VYBE student'} on VYBE`, url });
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
      window.location.replace(recovered ? 'login.html?session=expired' : 'login.html');
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
    await loadInterestState();
    status.hidden = true;
    page.hidden = false;
  } catch (error) {
    status.dataset.state = 'error';
    status.textContent = ['PGRST202', 'PGRST204', 'PGRST205', '42703'].includes(error?.code)
      ? 'Student profiles aren’t enabled yet. Apply the discovery and student-profile Supabase migrations, then reload.'
      : friendlyError(error);
    status.hidden = false;
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

  $('[data-edit]').addEventListener('click', openEditDialog);
  $('[data-close-edit]').addEventListener('click', () => editDialog.close());
  $('[data-cancel-edit]').addEventListener('click', () => editDialog.close());
  $('[data-more]').addEventListener('click', () => moreDialog.showModal());
  $$('[data-close-more]').forEach(button => button.addEventListener('click', () => moreDialog.close()));
  $('[data-share]').addEventListener('click', shareProfile);
  $('[data-interest]').addEventListener('click', event => expressInterest(event.currentTarget));
  editForm.addEventListener('submit', saveProfile);
  editForm.elements.namedItem('matchmaking_enabled').addEventListener('change', toggleIntentionFields);
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

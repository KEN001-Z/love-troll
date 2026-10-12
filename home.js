import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const status = $('[data-home-status]');
const greeting = $('[data-name-greeting]');
const profileProgress = $('[data-profile-progress]');
const peopleMessage = $('[data-people-message]');
const peoplePhotoMessage = $('[data-people-photo-message]');
const suggestionList = $('[data-suggestions]');
const connectionsMessage = $('[data-connections-message]');
const connectionList = $('[data-connections]');
const connectionsPhotoMessage = $('[data-connections-photo-message]');
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
let ownInterests = [];
let ownMatchmakingEnabled = false;
let candidates = [];
const pendingActions = new Set();
const DEMO_NAME_PATTERNS = [/^test\s*user$/i, /^demo/i, /^sample/i, /^guest/i, /^user$/i];

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

function setSectionMessage(element, message, state = '') {
  element.textContent = message;
  element.dataset.state = state;
  element.hidden = !message;
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

async function signProfileAvatars(profiles) {
  const profilesWithPhotos = profiles.filter(profile => profile.avatar_path);
  const urlsByProfileId = new Map();
  if (!profilesWithPhotos.length) return { urlsByProfileId, warning: '' };

  try {
    const paths = [...new Set(profilesWithPhotos.map(profile => profile.avatar_path))];
    const { data, error } = await supabase.storage.from('profile-media').createSignedUrls(paths, 3600);
    if (error) return { urlsByProfileId, warning: `We couldn’t load profile photos: ${error.message}` };

    const urlsByPath = new Map();
    let failedCount = 0;
    (data || []).forEach(result => {
      if (result.error || !result.signedUrl) {
        failedCount += 1;
      } else {
        urlsByPath.set(result.path, result.signedUrl);
      }
    });
    profilesWithPhotos.forEach(profile => {
      const url = urlsByPath.get(profile.avatar_path);
      if (url) urlsByProfileId.set(profile.id, url);
      else if (!(data || []).some(result => result.path === profile.avatar_path && (result.error || !result.signedUrl))) {
        failedCount += 1;
      }
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
    return;
  }

  visible.forEach(candidate => suggestionList.append(renderCandidate(candidate)));
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
  headingInfo.append(makeElement('p', 'suggestion-intention', `Here for ${labels.lookingFor[profile.looking_for] || 'new connections'}`));
  heading.append(headingInfo);
  body.append(heading);

  const shared = (profile.interests || []).filter(interest => ownInterests.includes(interest));
  const detail = shared.length
    ? `A little common ground: ${shared.map(value => labels.interests[value] || value).join(', ')}.`
    : labels.food[profile.food_personality]
      ? `If their personality were food: ${labels.food[profile.food_personality]}.`
      : 'Say hello and find out what you have in common.';
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
  const skip = makeElement('button', 'suggestion-skip', '×');
  skip.type = 'button';
  skip.dataset.skip = '';
  skip.setAttribute('aria-label', `Skip ${name}`);
  skip.title = 'Not now';
  const like = makeElement('button', 'suggestion-like', '♡');
  like.type = 'button';
  like.dataset.like = '';
  like.setAttribute('aria-label', `Send interest to ${name}`);
  like.title = 'Send interest';
  actions.append(skip, like);
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
    const date = new Date(createdAt);
    const caption = Number.isNaN(date.getTime())
      ? 'The feeling is mutual'
      : `Matched ${new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)}`;
    description.append(makeElement('span', 'connection-caption', caption));
    item.append(description);
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
    button.textContent = '♡';
  } finally {
    pendingActions.delete(candidate.profile.id);
  }
}

async function initialize() {
  const logoutButton = $('[data-logout]');
  suggestionList.addEventListener('click', event => {
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
    renderProfileProgress(profile);

    const safeName = sanitizeName(profile.display_name) || sanitizeName(user.user_metadata?.display_name);
    greeting.textContent = safeName ? `, ${safeName}` : '';
    const results = await Promise.allSettled([loadSuggestions(), loadConnections()]);
    if (results[0].status === 'rejected') {
      setSectionMessage(peopleMessage, `We couldn’t load people to meet: ${results[0].reason.message || 'Please try again.'}`, 'error');
      suggestionList.replaceChildren();
    }
    if (results[1].status === 'rejected') {
      setSectionMessage(connectionsMessage, `We couldn’t load your connections: ${results[1].reason.message || 'Please try again.'}`, 'error');
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

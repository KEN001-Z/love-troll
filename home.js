import { getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const status = $('[data-home-status]');
const greeting = $('[data-name-greeting]');
const peopleMessage = $('[data-people-message]');
const suggestionList = $('[data-suggestions]');
const connectionsMessage = $('[data-connections-message]');
const connectionList = $('[data-connections]');
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
let candidates = [];
const pendingActions = new Set();

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

function renderTags(container, values, dictionary) {
  values.forEach(value => container.append(makeElement('span', 'interest-tag', dictionary[value] || value)));
}

function renderCandidates() {
  const visible = candidates.filter(candidate => !candidate.skipped && !candidate.liked);
  suggestionList.replaceChildren();

  if (!visible.length) {
    setSectionMessage(peopleMessage, '');
    const empty = makeElement('li', 'people-empty');
    empty.append(
      makeElement('p', 'home-eyebrow', candidates.length ? 'THAT’S EVERYONE FOR NOW' : 'YOUR PEOPLE, YOUR PACE'),
      makeElement('h3', '', candidates.length ? 'You’re all caught up.' : 'Your VYBE story starts here.'),
      makeElement('p', '', candidates.length
        ? 'You’ve seen everyone in this batch. Check back later as more people join.'
        : 'No completed profiles are available just yet. As people finish setting up, they’ll show here.')
    );
    suggestionList.append(empty);
    return;
  }

  visible.forEach(candidate => suggestionList.append(renderCandidate(candidate)));
}

function renderCandidate(candidate) {
  const profile = candidate.profile;
  const name = profile.display_name?.trim() || 'VYBE member';
  const card = makeElement('li', 'suggestion-card');
  card.dataset.profileId = profile.id;

  const visual = makeElement('div', 'suggestion-visual');
  visual.setAttribute('aria-hidden', 'true');
  visual.append(makeElement('span', 'suggestion-monogram', name.slice(0, 1).toUpperCase()));
  visual.append(makeElement('span', 'suggestion-visual-note', 'A new face on VYBE'));

  const body = makeElement('div', 'suggestion-body');
  const heading = makeElement('div', 'suggestion-heading');
  const headingInfo = makeElement('div');
  headingInfo.append(makeElement('h3', 'suggestion-name', name));
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
  const skip = makeElement('button', 'suggestion-skip', 'Not now');
  skip.type = 'button';
  skip.dataset.skip = '';
  skip.setAttribute('aria-label', `Skip ${name}`);
  const like = makeElement('button', 'suggestion-like', 'Send interest');
  like.type = 'button';
  like.dataset.like = '';
  like.setAttribute('aria-label', `Send interest to ${name}`);
  actions.append(skip, like);
  body.append(actions);
  card.append(visual, body);
  return card;
}

async function loadSuggestions() {
  setSectionMessage(peopleMessage, 'Finding people you might click with…');
  const { data, error } = await supabase.from('profiles')
    .select('id, display_name, relationship_status, food_personality, looking_for, vibe, interests')
    .eq('onboarding_completed', true)
    .in('relationship_status', ['single', 'complicated', 'cruise'])
    .neq('id', currentUserId)
    .order('created_at', { ascending: false })
    .limit(40);
  if (error) throw error;

  candidates = (data || []).map(profile => ({ profile, skipped: false, liked: false }));
  setSectionMessage(peopleMessage, '');
  renderCandidates();
}

function renderConnections(matches, profiles) {
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
    const name = profile.display_name?.trim() || 'VYBE member';
    const item = makeElement('li', 'connection-item');
    item.append(makeElement('span', 'connection-avatar', name.slice(0, 1).toUpperCase()));
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
    renderConnections([], []);
    return;
  }

  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select('id, display_name')
    .in('id', otherIds);
  if (profilesError) throw profilesError;
  renderConnections(matches || [], profiles || []);
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
  button.textContent = 'Sending…';
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

    candidate.liked = true;
    setSectionMessage(
      peopleMessage,
      result.matched
        ? `It’s mutual with ${candidate.profile.display_name?.trim() || 'this VYBE member'}! You’re a match. 💜`
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
    button.textContent = 'Send interest';
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
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user) {
      window.location.replace('login.html');
      return;
    }
    currentUserId = user.id;

    const { data: profile, error: profileError } = await supabase.from('profiles')
      .select('display_name, interests, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    ownInterests = profile.interests || [];

    const name = profile.display_name?.trim() || user.user_metadata?.display_name?.trim();
    greeting.textContent = name ? `, ${name}` : '';
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
      showStatus(`We couldn’t log you out: ${error.message || 'Please try again.'}`);
      logoutButton.disabled = false;
    }
  });
}

initialize();

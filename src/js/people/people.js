import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const status = $('[data-people-page-status]');
const peopleMessage = $('[data-people-message]');
const peoplePhotoMessage = $('[data-people-photo-message]');
const suggestionList = $('[data-suggestions]');
const peopleSearch = $('[data-people-search]');
const peopleSearchClear = $('[data-people-search-clear]');
const peopleFilterButtons = $$('[data-people-filter]');
const peopleRetry = $('[data-people-retry]');
const peopleLoadMore = $('[data-people-more]');
const interestLabels = {
  music: 'Music',
  movies: 'Films & series',
  food: 'Food',
  games: 'Gaming',
  gist: 'Gist',
  football: 'Football',
  fashion: 'Fashion',
  travel: 'Travel',
  books: 'Books',
  tech: 'Tech'
};
const PAGE_SIZE = 24;
const DISCOVERY_REFRESH_INTERVAL = 60_000;

let supabase;
let currentUserId;
let ownInterests = [];
let activeFilter = 'for-you';
let searchTerm = '';
let candidates = [];
let discoveryLimited = false;
let offset = 0;
let hasMore = false;
let loading = false;
let requestId = 0;
let searchTimer;
const pendingFollows = new Set();

function makeElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function setMessage(element, message, state = '') {
  element.textContent = message;
  element.dataset.state = state;
  element.hidden = !message;
}

function setPageStatus(message, state = '') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function profileName(profile) {
  return profile.display_name?.trim() || profile.username || 'VYBE member';
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

function renderSkeletons() {
  suggestionList.replaceChildren();
  suggestionList.setAttribute('aria-busy', 'true');
  for (let index = 0; index < 6; index += 1) {
    const skeleton = makeElement('li', 'people-skeleton');
    skeleton.setAttribute('aria-hidden', 'true');
    suggestionList.append(skeleton);
  }
}

function updateTabs() {
  peopleFilterButtons.forEach(button => {
    const selected = button.dataset.peopleFilter === activeFilter;
    button.setAttribute('aria-selected', String(selected));
    button.tabIndex = selected ? 0 : -1;
  });
}

function renderEmptyState() {
  const empty = makeElement('li', 'people-empty');
  const searching = Boolean(searchTerm);
  const title = discoveryLimited
    ? 'Your discovery list is limited.'
    : searching
    ? hasMore ? 'No matches in this batch.' : 'No results for that search.'
    : activeFilter === 'following'
      ? hasMore ? 'No visible profiles in this batch.' : 'You’re not following anyone yet.'
      : activeFilter === 'new'
        ? hasMore ? 'No new faces in this batch.' : 'More new faces soon.'
        : hasMore ? 'Keep exploring.' : 'Your next connection is waiting.';
  const copy = discoveryLimited
    ? 'The current database function only includes members who enabled matchmaking. Apply 20261014014300_split_profile_discovery_by_matchmaking.sql to include every campus-visible member.'
    : searching
    ? hasMore
      ? 'There may be more matches further down. Load more people to keep looking.'
      : 'Try another name or username, or clear your search to browse everyone.'
    : activeFilter === 'following'
      ? hasMore
        ? 'Some followed profiles are private or no longer available to discover. Load more to check the rest.'
        : 'Follow someone you like and you’ll find them here when their profile is visible.'
      : activeFilter === 'new'
        ? 'New VYBE members will show up here, ordered by when they joined.'
        : hasMore
          ? 'Browse recent members, with shared interests highlighted when you have them in common.'
          : 'Complete your profile and check back as more people join VYBE.';
  empty.append(
    makeElement('p', 'home-eyebrow', searching ? 'SEARCH' : activeFilter === 'following' ? 'YOUR CIRCLE' : activeFilter === 'new' ? 'NEW ON VYBE' : 'YOUR PEOPLE, YOUR PACE'),
    makeElement('h2', '', title),
    makeElement('p', '', copy)
  );

  if (searching) {
    const clear = makeElement('button', 'people-empty-action', 'Clear search');
    clear.type = 'button';
    clear.dataset.clearPeopleSearch = '';
    empty.append(clear);
  } else if (activeFilter === 'following') {
    const explore = makeElement('button', 'people-empty-action', 'Explore For You');
    explore.type = 'button';
    explore.dataset.returnDiscovery = '';
    empty.append(explore);
  } else if (!hasMore && activeFilter === 'for-you') {
    const profileLink = makeElement('a', 'people-empty-action', 'Complete your profile');
    profileLink.href = 'profile.html?edit=complete';
    empty.append(profileLink);
  }
  suggestionList.append(empty);
}

function renderTags(container, values) {
  values.forEach(value => {
    const label = interestLabels[value] || value;
    container.append(makeElement('span', 'interest-tag', label));
  });
}

function renderCandidate(candidate) {
  const profile = candidate.profile;
  const name = profileName(profile);
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
  const createdAt = Date.parse(profile.created_at || '');
  if (Number.isFinite(createdAt) && Date.now() - createdAt < 14 * 24 * 60 * 60 * 1000) {
    visual.append(makeElement('span', 'people-new-badge', 'NEW'));
  }

  if (candidate.avatarUrl) {
    const image = makeElement('img', 'suggestion-avatar-image');
    image.src = candidate.avatarUrl;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('load', () => { monogram.hidden = true; }, { once: true });
    image.addEventListener('error', () => {
      image.remove();
      monogram.hidden = false;
      setMessage(peoplePhotoMessage, 'A profile photo could not be displayed. You can still open the profile.', 'error');
    }, { once: true });
    visual.append(image);
  }
  avatarLink.append(visual);

  const body = makeElement('div', 'suggestion-body');
  const heading = makeElement('div', 'suggestion-heading');
  const profileLink = makeElement('a', 'suggestion-name', name);
  profileLink.href = profileHref;
  profileLink.title = name;
  const profileHeading = makeElement('h2');
  profileHeading.append(profileLink);
  const identity = makeElement('div', 'suggestion-identity');
  identity.append(profileHeading);
  if (profile.username) identity.append(makeElement('p', 'suggestion-handle', `@${profile.username}`));
  const follow = makeElement('button', 'suggestion-follow', candidate.following ? 'Unfollow' : 'Follow');
  follow.type = 'button';
  follow.dataset.follow = '';
  follow.setAttribute('aria-label', `${candidate.following ? 'Unfollow' : 'Follow'} ${name}`);
  follow.setAttribute('aria-pressed', String(Boolean(candidate.following)));
  heading.append(identity, follow);
  body.append(heading);

  const bio = typeof profile.bio === 'string' ? profile.bio.trim() : '';
  if (bio) body.append(makeElement('p', 'suggestion-detail', bio));
  if (profile.university?.trim()) body.append(makeElement('p', 'suggestion-location', profile.university.trim()));

  const shared = (profile.interests || []).filter(interest => ownInterests.includes(interest));
  if (shared.length && activeFilter === 'for-you') {
    body.append(makeElement(
      'p',
      'suggestion-common-ground',
      `You both like ${shared.slice(0, 2).map(value => interestLabels[value] || value).join(' and ')}`
    ));
  }

  const interests = [...(profile.interests || []), ...(profile.hobbies || [])].slice(0, 4);
  if (interests.length) {
    const tags = makeElement('div', 'interest-tags');
    renderTags(tags, interests);
    body.append(tags);
  }

  const actions = makeElement('div', 'suggestion-actions');
  const view = makeElement('a', 'suggestion-view', 'View profile');
  view.href = profileHref;
  view.setAttribute('aria-label', `View ${name}'s profile`);
  actions.append(view);
  body.append(actions);

  card.dataset.searchText = searchHaystack(profile);
  card.append(avatarLink, body);
  return card;
}

function renderCandidates() {
  if (suggestionList.dataset.error === 'true') {
    suggestionList.setAttribute('aria-busy', String(loading));
    peopleLoadMore.hidden = true;
    return;
  }

  const visible = candidates.filter(candidate => !searchTerm || searchHaystack(candidate.profile).includes(searchTerm));
  suggestionList.replaceChildren();
  suggestionList.setAttribute('aria-busy', String(loading));
  if (visible.length) visible.forEach(candidate => suggestionList.append(renderCandidate(candidate)));
  else renderEmptyState();

  peopleLoadMore.hidden = !hasMore;
  peopleLoadMore.disabled = loading;
  peopleLoadMore.textContent = loading && offset ? 'Loading more…' : 'Load more people';
}

async function signAvatars(profiles) {
  const paths = [...new Set(profiles.map(profile => profile.avatar_path).filter(path => typeof path === 'string' && path.trim()))];
  const urls = new Map();
  if (!paths.length) return { urls, warning: '' };

  const direct = paths.filter(path => /^https?:\/\//i.test(path) || path.startsWith('data:'));
  direct.forEach(path => {
    for (const profile of profiles) if (profile.avatar_path === path) urls.set(profile.id, path);
  });
  const storagePaths = paths.filter(path => !direct.includes(path));
  if (!storagePaths.length) return { urls, warning: '' };
  const { data, error } = await supabase.storage.from('profile-media').createSignedUrls(storagePaths, 3600);
  if (error) return { urls, warning: `We couldn’t load profile photos: ${error.message}` };

  let failedCount = 0;
  const urlsByPath = new Map();
  (data || []).forEach(result => {
    if (result.error || !result.signedUrl) failedCount += 1;
    else urlsByPath.set(result.path, result.signedUrl);
  });
  profiles.forEach(profile => {
    const url = urlsByPath.get(profile.avatar_path);
    if (url) urls.set(profile.id, url);
  });
  return {
    urls,
    warning: failedCount ? `${failedCount} profile photo${failedCount === 1 ? '' : 's'} couldn’t be loaded.` : ''
  };
}

async function loadPeople({ reset = true, background = false } = {}) {
  if (!reset && loading) return;
  const id = ++requestId;
  const pageOffset = reset ? 0 : offset;
  let usingLegacyDiscovery = false;
  loading = true;
  peopleRetry.hidden = true;
  suggestionList.dataset.error = '';
  discoveryLimited = false;
  setMessage(peopleMessage, reset ? 'Finding people you might click with…' : 'Loading more people…');
  if (reset) {
    if (background) {
      renderCandidates();
    } else {
      candidates = [];
      offset = 0;
      hasMore = false;
      renderSkeletons();
    }
  } else {
    renderCandidates();
  }

  try {
    let profiles = [];
    let pageHasMore = false;
    if (activeFilter === 'following') {
      const { data: follows, error: followsError } = await supabase.from('follows')
        .select('following_id,created_at')
        .eq('follower_id', currentUserId)
        .order('created_at', { ascending: false })
        .order('following_id', { ascending: true })
        .range(pageOffset, pageOffset + PAGE_SIZE);
      if (followsError) throw followsError;
      if (id !== requestId) return;
      const followPage = follows || [];
      pageHasMore = followPage.length > PAGE_SIZE;
      const visibleFollowRows = followPage.slice(0, PAGE_SIZE);
      const ids = [...new Set(visibleFollowRows.map(row => row.following_id).filter(Boolean))];
      if (ids.length) {
        const { data, error } = await supabase.rpc('get_profile_previews', { target_ids: ids });
        if (error) throw error;
        const profilesById = new Map((data || []).map(profile => [profile.id, profile]));
        profiles = visibleFollowRows.flatMap(row => {
          const profile = profilesById.get(row.following_id);
          return profile ? [{ ...profile, followed_at: row.created_at }] : [];
        });
      }
    } else {
      let result = await supabase.rpc('discover_profiles', {
        result_offset: pageOffset,
        result_limit: PAGE_SIZE + 1,
        p_matchmaking_only: false
      });
      if (result.error?.code === 'PGRST202') {
        result = await supabase.rpc('discover_profiles', {
          result_offset: pageOffset,
          result_limit: PAGE_SIZE + 1
        });
        if (result.error) throw result.error;
        usingLegacyDiscovery = true;
      } else if (result.error) {
        throw result.error;
      }
      if (id !== requestId) return;
      const page = result.data || [];
      pageHasMore = page.length > PAGE_SIZE;
      profiles = page.slice(0, PAGE_SIZE);
      if (searchTerm) {
        profiles = profiles.filter(profile => searchHaystack(profile).includes(searchTerm));
      }
    }
    if (id !== requestId) return;

    let followedIds = new Set(profiles.map(profile => profile.id));
    if (activeFilter !== 'following' && profiles.length) {
      const ids = profiles.map(profile => profile.id);
      const { data, error } = await supabase.from('follows')
        .select('following_id')
        .eq('follower_id', currentUserId)
        .in('following_id', ids);
      if (error) throw error;
      if (id !== requestId) return;
      followedIds = new Set((data || []).map(follow => follow.following_id));
    }

    const { urls, warning } = await signAvatars(profiles);
    if (id !== requestId) return;
    setMessage(peoplePhotoMessage, warning, warning ? 'error' : '');

    let pageCandidates = profiles.map(profile => ({
      profile,
      avatarUrl: urls.get(profile.id),
      following: followedIds.has(profile.id)
    }));
    if (activeFilter === 'following' && searchTerm) {
      pageCandidates = pageCandidates.filter(candidate => searchHaystack(candidate.profile).includes(searchTerm));
    }
    if (activeFilter === 'for-you') {
      pageCandidates = pageCandidates.filter(candidate => !candidate.following);
      pageCandidates.sort((first, second) => {
        const firstShared = (first.profile.interests || []).filter(item => ownInterests.includes(item)).length;
        const secondShared = (second.profile.interests || []).filter(item => ownInterests.includes(item)).length;
        return secondShared - firstShared ||
          new Date(second.profile.created_at).getTime() - new Date(first.profile.created_at).getTime() ||
          first.profile.id.localeCompare(second.profile.id);
      });
    }

    if (background) {
      candidates = pageCandidates;
    } else {
      const seen = new Set(candidates.map(candidate => candidate.profile.id));
      candidates.push(...pageCandidates.filter(candidate => !seen.has(candidate.profile.id)));
    }
    offset = pageOffset + PAGE_SIZE;
    hasMore = pageHasMore;
    discoveryLimited = usingLegacyDiscovery;
    if (discoveryLimited) {
      setMessage(
        peopleMessage,
        'Discovery is using the older database function, so members who turned off matchmaking are missing. Apply 20261014014300_split_profile_discovery_by_matchmaking.sql to show all visible members.',
        'warning'
      );
    } else {
      setMessage(peopleMessage, '');
    }
    suggestionList.dataset.error = '';
  } catch (error) {
    if (id === requestId) {
      if (!background) suggestionList.replaceChildren();
      suggestionList.setAttribute('aria-busy', 'false');
      suggestionList.dataset.error = 'true';
      peopleLoadMore.hidden = true;
      peopleRetry.hidden = false;
      const errorMessage = error?.code === 'PGRST202'
        ? 'The VYBE discovery function is not installed yet. Apply 20261014014300_split_profile_discovery_by_matchmaking.sql in Supabase, then try again.'
        : error.message || 'Please try again.';
      setMessage(peopleMessage, `We couldn’t load people to meet: ${errorMessage}`, 'error');
    }
  } finally {
    if (id === requestId) {
      loading = false;
      renderCandidates();
    }
  }
}

function refreshPeopleInBackground() {
  if (document.visibilityState !== 'visible' || loading) return;
  loadPeople({ background: true });
}

function startDiscoveryRefresh() {
  const refreshTimer = window.setInterval(refreshPeopleInBackground, DISCOVERY_REFRESH_INTERVAL);
  const refreshWhenVisible = () => refreshPeopleInBackground();
  document.addEventListener('visibilitychange', refreshWhenVisible);
  window.addEventListener('pageshow', refreshWhenVisible);
  window.addEventListener('pagehide', () => {
    window.clearInterval(refreshTimer);
    document.removeEventListener('visibilitychange', refreshWhenVisible);
    window.removeEventListener('pageshow', refreshWhenVisible);
  }, { once: true });
}

function setFilter(filter) {
  if (!['for-you', 'new', 'following'].includes(filter)) return;
  activeFilter = filter;
  updateTabs();
  loadPeople();
}

async function toggleFollow(button) {
  const card = button.closest('[data-profile-id]');
  const candidate = candidates.find(item => item.profile.id === card?.dataset.profileId);
  if (!candidate || pendingFollows.has(candidate.profile.id)) return;

  const wasFollowing = candidate.following;
  pendingFollows.add(candidate.profile.id);
  button.disabled = true;
  button.textContent = wasFollowing ? 'Unfollowing…' : 'Following…';
  setMessage(peopleMessage, wasFollowing ? 'Updating your follow…' : 'Following this person…');
  try {
    const { data, error } = await supabase.rpc('toggle_follow', { target_user: candidate.profile.id });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    if (!result || typeof result.following !== 'boolean') {
      throw new Error('VYBE could not confirm that follow change. Please try again.');
    }
    candidate.following = result.following;
    if (activeFilter === 'following' && !candidate.following) {
      candidates = candidates.filter(item => item.profile.id !== candidate.profile.id);
    }
    setMessage(
      peopleMessage,
      candidate.following
        ? `You’re now following ${profileName(candidate.profile)}.`
        : `You unfollowed ${profileName(candidate.profile)}.`,
      'success'
    );
    renderCandidates();
  } catch (error) {
    button.disabled = false;
    button.textContent = wasFollowing ? 'Unfollow' : 'Follow';
    button.setAttribute('aria-label', `${wasFollowing ? 'Unfollow' : 'Follow'} ${profileName(candidate.profile)}`);
    setMessage(peopleMessage, error.message || 'We couldn’t update your follow. Please try again.', 'error');
  } finally {
    pendingFollows.delete(candidate.profile.id);
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
    currentUserId = user.id;

    const { data: profile, error } = await supabase.from('profiles')
      .select('display_name,interests,onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!profile?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    ownInterests = profile.interests || [];
    const safeName = profile.display_name?.trim() || user.user_metadata?.display_name || '';
    $('[data-profile-avatar]').textContent = safeName ? safeName.slice(0, 1).toLocaleUpperCase() : 'V';
    updateTabs();
    await loadPeople();
    startDiscoveryRefresh();
  } catch (error) {
    setPageStatus(error.message || 'We couldn’t load Meet People. Please refresh and try again.', 'error');
    peopleRetry.hidden = false;
  }

  peopleFilterButtons.forEach(button => button.addEventListener('click', () => setFilter(button.dataset.peopleFilter)));
  $('[data-people-tabs]').addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...peopleFilterButtons];
    const current = tabs.indexOf(event.target.closest('[role="tab"]'));
    if (current < 0) return;
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
    setFilter(tabs[next].dataset.peopleFilter);
  });
  peopleSearch.addEventListener('input', () => {
    searchTerm = peopleSearch.value.trim().toLocaleLowerCase();
    peopleSearchClear.hidden = !searchTerm;
    window.clearTimeout(searchTimer);
    setMessage(peopleMessage, searchTerm ? 'Searching VYBE members…' : 'Finding people you might click with…');
    searchTimer = window.setTimeout(() => loadPeople(), 300);
  });
  const clearSearch = () => {
    window.clearTimeout(searchTimer);
    peopleSearch.value = '';
    searchTerm = '';
    peopleSearchClear.hidden = true;
    loadPeople();
    peopleSearch.focus();
  };
  peopleSearchClear.addEventListener('click', clearSearch);
  peopleRetry.addEventListener('click', () => {
    setPageStatus('');
    loadPeople();
  });
  peopleLoadMore.addEventListener('click', () => loadPeople({ reset: false }));
  suggestionList.addEventListener('click', event => {
    const clear = event.target.closest('[data-clear-people-search]');
    if (clear) {
      clearSearch();
      return;
    }
    const explore = event.target.closest('[data-return-discovery]');
    if (explore) {
      const forYouTab = $('[data-people-filter="for-you"]');
      forYouTab.focus();
      setFilter('for-you');
      return;
    }
    const button = event.target.closest('button[data-follow]');
    if (button) toggleFollow(button);
  });
  $('[data-logout]').addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setPageStatus(`We couldn’t log you out: ${error.message || 'Please try again.'}`, 'error');
      button.disabled = false;
    }
  });
}

initialize();

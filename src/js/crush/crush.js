import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';
import { getFriendlyError } from '../errors/friendly-error.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const status = $('[data-crush-status]');
const flow = $('[data-flow]');
const flowSteps = $$('[data-flow-step]');
const form = $('[data-crush-form]');
const progressFill = $('[data-progress-fill]');
const stepLabel = $('[data-step-label]');
const flowIntro = $('[data-flow-intro]');
const stepError = $$('[data-step-error]');
const saveButton = $('[data-save-setup]');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const interestLabels = {
  music: 'Music',
  movies: 'Films & shows',
  food: 'Food debates',
  games: 'Games',
  gist: 'Good gist',
  football: 'Football',
  fashion: 'Fashion',
  travel: 'Travel',
  books: 'Books',
  tech: 'Tech'
};
const intentionLabels = {
  romance: 'Open to romance',
  friendships: 'Open to friendship',
  'just-vibes': 'Just vibes'
};
let supabase;
let currentUser;
let profile;
let currentStep = 0;
let busy = false;

function setStatus(message, state = 'success') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

function clearErrors() {
  stepError.forEach(element => {
    element.hidden = true;
    element.textContent = '';
  });
  $('[data-interest-error]').hidden = true;
  $$('[aria-invalid="true"]', form).forEach(element => element.removeAttribute('aria-invalid'));
}

function showStepError(message) {
  const error = stepError[currentStep];
  error.textContent = message;
  error.hidden = false;
  error.focus?.();
}

function setStep(step) {
  currentStep = step;
  flowSteps.forEach((element, index) => { element.hidden = index !== step; });
  stepLabel.textContent = `STEP ${step + 1} OF ${flowSteps.length}`;
  progressFill.style.width = `${((step + 1) / flowSteps.length) * 100}%`;
  flowIntro.textContent = [
    'Give us something to work with. Keep it you; this is not a job interview 😭',
    'A quick look before you save. No surprise profile edits.',
    'One small safety check before you save.'
  ][step];
  clearErrors();
  flowSteps[step].scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest' });
  flowSteps[step].focus({ preventScroll: true });
}

function hydrateForm() {
  form.elements.namedItem('bio').value = profile.bio || '';
  form.elements.namedItem('looking_for').value = profile.looking_for || '';
  form.elements.namedItem('relationship_status').value = profile.relationship_status || '';
  const selectedInterests = new Set(profile.interests || []);
  $$('input[name="interests"]', form).forEach(input => { input.checked = selectedInterests.has(input.value); });
}

function validateSetup() {
  const bio = form.elements.namedItem('bio');
  const lookingFor = form.elements.namedItem('looking_for');
  const relationshipStatus = form.elements.namedItem('relationship_status');
  const interests = $$('input[name="interests"]:checked', form).map(input => input.value);

  if (!interests.length) {
    $('[data-interest-error]').hidden = false;
    $('input[name="interests"]', form).focus();
    return false;
  }
  if (!lookingFor.value) {
    lookingFor.setAttribute('aria-invalid', 'true');
    lookingFor.focus();
    showStepError('Choose what you’re open to so we can finish your preview.');
    return false;
  }
  if (!relationshipStatus.value) {
    relationshipStatus.setAttribute('aria-invalid', 'true');
    relationshipStatus.focus();
    showStepError('Choose a relationship status to finish your preview.');
    return false;
  }
  if (bio.value.length > 280) {
    bio.setAttribute('aria-invalid', 'true');
    bio.focus();
    showStepError('Keep your intro to 280 characters or less.');
    return false;
  }
  return true;
}

function renderPreview() {
  const name = profile.display_name?.trim() || 'VYBE member';
  const bio = form.elements.namedItem('bio').value.trim();
  const interests = $$('input[name="interests"]:checked', form).map(input => input.value);
  const avatar = $('[data-preview-avatar]');
  avatar.replaceChildren(document.createTextNode(name.slice(0, 1).toUpperCase()));
  $('[data-preview-name]').textContent = name;
  $('[data-preview-intention]').textContent = intentionLabels[form.elements.namedItem('looking_for').value];
  $('[data-preview-bio]').textContent = bio || 'A little mystery is allowed. Your intro will show here if you add one.';
  const tags = $('[data-preview-tags]');
  tags.replaceChildren(...interests.map(interest => {
    const tag = document.createElement('span');
    tag.textContent = interestLabels[interest] || interest;
    return tag;
  }));
}

async function showProfileAvatar() {
  const path = profile.avatar_path;
  if (!path) return;
  try {
    const { data, error } = await supabase.storage.from('profile-media').createSignedUrl(path, 3600);
    if (error) throw error;
    if (!data?.signedUrl) throw new Error('VYBE could not prepare your profile photo preview.');
    const image = document.createElement('img');
    image.src = data.signedUrl;
    image.alt = '';
    image.addEventListener('error', () => {
      image.remove();
      setStatus('Your profile photo could not be previewed. The rest of your setup is still available.', 'error');
    }, { once: true });
    $('[data-preview-avatar]').replaceChildren(image);
  } catch (error) {
    setStatus(`We couldn’t load your profile photo preview: ${getFriendlyError(error)}`, 'error');
  }
}

function openFlow() {
  setStatus('');
  hydrateForm();
  flow.hidden = false;
  flow.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  setStep(0);
}

function closeFlow() {
  flow.hidden = true;
  setStatus('');
  $('[data-start-flow]').focus({ preventScroll: true });
  $('#crush-hub').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
}

async function saveSetup() {
  if (busy) return;
  busy = true;
  saveButton.disabled = true;
  saveButton.setAttribute('aria-busy', 'true');
  saveButton.firstChild.textContent = 'Saving… ';
  setStatus('');
  try {
    const interests = $$('input[name="interests"]:checked', form).map(input => input.value);
    const updates = {
      bio: form.elements.namedItem('bio').value.trim() || null,
      interests,
      looking_for: form.elements.namedItem('looking_for').value,
      relationship_status: form.elements.namedItem('relationship_status').value,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('profiles')
      .update(updates)
      .eq('id', currentUser.id)
      .select('id')
      .maybeSingle();
    if (error) throw error;
    if (!data?.id) throw new Error('VYBE couldn’t confirm that your setup was saved.');

    profile = { ...profile, ...updates };
    setStatus(profile.matchmaking_enabled
      ? 'Your setup is saved. Your existing matchmaking setting was left unchanged; this flow did not start a queue or create a match.'
      : 'Your setup is saved to your existing VYBE profile. Matching remains off; no queue or match was started.');
    flow.hidden = true;
    $('#crush-hub').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  } catch (error) {
    showStepError(getFriendlyError(error));
  } finally {
    busy = false;
    saveButton.disabled = false;
    saveButton.removeAttribute('aria-busy');
    saveButton.firstChild.textContent = 'Save my setup ';
  }
}

async function initialize() {
  $$('[data-start-flow]').forEach(button => button.addEventListener('click', openFlow));
  $$('[data-cancel-flow]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    closeFlow();
  }));
  $('[data-next-step]', flowSteps[0]).addEventListener('click', () => {
    if (!validateSetup()) return;
    renderPreview();
    showProfileAvatar();
    setStep(1);
  });
  $('[data-prev-step]', flowSteps[1]).addEventListener('click', () => setStep(0));
  $('[data-next-step]', flowSteps[1]).addEventListener('click', () => setStep(2));
  $('[data-prev-step]', flowSteps[2]).addEventListener('click', () => setStep(1));
  saveButton.addEventListener('click', saveSetup);
  form.addEventListener('submit', event => event.preventDefault());

  try {
    supabase = getSupabaseClient();
    const { user, recovered } = await getAuthenticatedUser(supabase);
    if (!user) {
      window.location.replace(recovered ? 'login.html?session=expired' : 'login.html');
      return;
    }
    currentUser = user;
    const { data, error } = await supabase.from('profiles')
      .select('display_name, bio, interests, looking_for, relationship_status, avatar_path, matchmaking_enabled, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.onboarding_completed) {
      window.location.replace('onboarding.html');
      return;
    }
    profile = data;
    if (!profile.display_name) profile.display_name = user.user_metadata?.display_name || user.user_metadata?.full_name || '';

    $('[data-logout]').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const result = await signOutCurrentSession(supabase);
        if (result.warning) setStatus('You’re signed out on this device, but VYBE could not confirm server sign-out.', 'error');
        window.location.replace('index.html');
      } catch (error) {
        setStatus(`We couldn’t log you out: ${getFriendlyError(error)}`, 'error');
        button.disabled = false;
      }
    });
  } catch (error) {
    setStatus(`VYBE Crush couldn’t load: ${getFriendlyError(error)}`, 'error');
    status.focus();
  }
}

initialize();

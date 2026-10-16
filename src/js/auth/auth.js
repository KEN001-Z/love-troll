import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from '../supabase/client.js';
import { navigateWithTransition } from '../app/page-transition.js';
import { getFriendlyError, isSessionExpiredError } from '../errors/friendly-error.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function setStatus(status, message, state = 'fail') {
  if (!status) return;
  status.hidden = false;
  status.className = `status ${state}`;
  status.textContent = message;
}

function setBusy(button, busy, label) {
  button.disabled = busy;
  button.textContent = busy ? 'Just a sec…' : label;
  button.setAttribute('aria-busy', String(busy));
}

function startEmailCooldown(button, initialLabel, action) {
  const expiresAt = Date.now() + 60_000;
  let timer;
  const update = () => {
    const remaining = Math.ceil((expiresAt - Date.now()) / 1000);
    if (remaining <= 0) {
      window.clearInterval(timer);
      button.disabled = false;
      button.textContent = initialLabel;
      return;
    }
    button.disabled = true;
    button.textContent = `${action} in ${remaining}s`;
  };
  update();
  timer = window.setInterval(update, 1000);
}

function onboardingLoginUrl() {
  const login = new URL('login.html', window.location.href);
  login.searchParams.set('session', 'expired');
  login.searchParams.set('returnTo', 'onboarding.html');
  return login.toString();
}

async function getAuthenticatedDestination(supabase, user) {
  const { data: profile, error } = await supabase.from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (getRequestedReturnTo() === new URL('onboarding.html', window.location.href).pathname) {
    return 'onboarding.html';
  }
  if (!profile?.onboarding_completed) return 'onboarding.html';
  return getRequestedReturnTo() || 'home.html';
}

function getRequestedReturnTo() {
  const requested = new URLSearchParams(window.location.search).get('returnTo');
  if (!requested) return '';

  let destination;
  try {
    destination = new URL(requested, window.location.href);
  } catch {
    return '';
  }
  const allowedPaths = ['messages.html', 'profile.html', 'onboarding.html']
    .map(page => new URL(page, window.location.href).pathname);
  if (destination.origin !== window.location.origin ||
      !allowedPaths.includes(destination.pathname)) return '';
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

function loginCallbackUrl() {
  const callback = new URL('login.html', window.location.href);
  callback.searchParams.set('session', 'oauth');
  const returnTo = getRequestedReturnTo();
  if (returnTo) callback.searchParams.set('returnTo', returnTo);
  return callback.toString();
}

async function ensureUserProfile(supabase, user) {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: getUserDisplayName(user)
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

function getUserDisplayName(user, fallback = null) {
  return user.user_metadata?.display_name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.name ||
    fallback ||
    null;
}

function isAtLeast18(value) {
  const birthDate = new Date(`${value}T00:00:00`);
  if (!value || Number.isNaN(birthDate.getTime())) return false;
  const today = new Date();
  let years = today.getFullYear() - birthDate.getFullYear();
  if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) years--;
  return years >= 18;
}

function validate(form) {
  let firstInvalid;
  const email = $('[name="email"]', form);
  const password = $('[name="password"]', form);
  const name = $('[name="name"]', form);
  const dob = $('[name="dob"]', form);
  const terms = $('[name="terms"]', form);
  const errors = new Map();

  if (name && name.value.trim().length < 2) errors.set(name, 'Enter a display name with at least 2 characters.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
    errors.set(email, 'That email doesn’t look right. Please check it.');
  }
  if (password && form.dataset.form === 'signup' &&
      !(password.value.length >= 8 && /[A-Za-z]/.test(password.value) && /\d/.test(password.value))) {
    errors.set(password, 'Your password is too weak. Use at least 8 characters.');
  } else if (password && !password.value) {
    errors.set(password, 'Enter your password.');
  }
  if (dob) {
    if (!dob.value || Number.isNaN(new Date(`${dob.value}T00:00:00`).getTime())) {
      errors.set(dob, 'Enter your date of birth.');
    } else if (!isAtLeast18(dob.value)) {
      errors.set(dob, 'VYBE is for people aged 18 and above.');
    }
  }
  if (terms && !terms.checked) errors.set(terms, 'Tick the box to continue.');

  $$('input[name]', form).forEach(input => {
    const box = input.closest('.field, .check');
    const error = $('.err', box);
    const message = errors.get(input) || '';
    box.classList.toggle('bad', Boolean(message));
    error.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && !firstInvalid) firstInvalid = input;
  });

  if (dob) dob.max = new Date().toISOString().slice(0, 10);
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function validateGoogleSignup(form) {
  const dob = $('[name="dob"]', form);
  const terms = $('[name="terms"]', form);
  let firstInvalid;
  const errors = new Map();

  if (!dob.value || Number.isNaN(new Date(`${dob.value}T00:00:00`).getTime())) {
    errors.set(dob, 'Enter your date of birth.');
  } else if (!isAtLeast18(dob.value)) {
    errors.set(dob, 'VYBE is for people aged 18 and above.');
  }
  if (!terms.checked) errors.set(terms, 'Tick the box to continue.');

  [dob, terms].forEach(input => {
    const box = input.closest('.field, .check');
    const error = $('.err', box);
    const message = errors.get(input) || '';
    box.classList.toggle('bad', Boolean(message));
    error.textContent = message;
    input.setAttribute('aria-invalid', String(Boolean(message)));
    if (message && !firstInvalid) firstInvalid = input;
  });

  dob.max = new Date().toISOString().slice(0, 10);
  if (firstInvalid) firstInvalid.focus();
  return !firstInvalid;
}

function configureFieldDescriptions(form) {
  $$('input[name]', form).forEach(input => {
    const box = input.closest('.field, .check');
    const error = $('.err', box);
    const hint = $('.hint', box);
    const ids = [];
    if (error) {
      error.id = `${input.id}-err`;
      ids.push(error.id);
    }
    if (hint) {
      hint.id = `${input.id}-hint`;
      ids.unshift(hint.id);
    }
    if (ids.length) input.setAttribute('aria-describedby', ids.join(' '));
  });
}

function bindPasswordToggles() {
  $$('.pw button').forEach(button => {
    button.addEventListener('click', () => {
      const input = $('input', button.parentElement);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide' : 'Show';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    });
  });
}

function bindGoogleAuth(form, supabase) {
  const button = $('[data-google-auth]', form);
  if (!button) return;

  const status = $('.status', form);
  const label = $('.google-label', button);
  const initialLabel = label.textContent;
  let signingIn = false;

  button.addEventListener('click', async () => {
    if (signingIn) return;
    status.hidden = true;
    if (form.dataset.form === 'signup' && !validateGoogleSignup(form)) return;

    signingIn = true;
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    label.textContent = 'Connecting to Google…';
    try {
      const redirectTo = form.dataset.form === 'signup'
        ? new URL('onboarding.html', window.location.href).toString()
        : loginCallbackUrl();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
      });
      if (error) throw error;
    } catch (error) {
      setStatus(status, getFriendlyError(error, form.dataset.form));
      status.focus();
    } finally {
      button.disabled = false;
      button.setAttribute('aria-busy', 'false');
      label.textContent = initialLabel;
      signingIn = false;
    }
  });
}

async function submitAuthForm(form, supabase) {
  const kind = form.dataset.form;
  const status = $('.status', form);
  const button = $('[type="submit"]', form);
  const initialLabel = button.textContent;
  const resendButton = $('[data-resend-confirmation]', form);
  let submitting = false;
  let resending = false;
  let cooldownUntil = 0;
  let cooldownTimer;

  const startSignupCooldown = () => {
    cooldownUntil = Date.now() + 60_000;
    window.clearInterval(cooldownTimer);
    const update = () => {
      const remaining = Math.ceil((cooldownUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        window.clearInterval(cooldownTimer);
        cooldownUntil = 0;
        button.disabled = false;
        button.textContent = initialLabel;
        if (resendButton) {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend confirmation email';
        }
        return;
      }
      button.disabled = true;
      button.textContent = `Try again in ${remaining}s`;
      if (resendButton) {
        resendButton.disabled = true;
        resendButton.textContent = `Resend in ${remaining}s`;
      }
    };
    update();
    cooldownTimer = window.setInterval(update, 1000);
  };

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || cooldownUntil > Date.now()) return;
    status.hidden = true;
    if (!validate(form)) return;

    submitting = true;
    setBusy(button, true, initialLabel);
    let sentEmailRequest = false;
    try {
      if (kind === 'signup') {
        sentEmailRequest = true;
        const { data, error } = await supabase.auth.signUp({
          email: $('[name="email"]', form).value.trim(),
          password: $('[name="password"]', form).value,
          options: {
            data: { display_name: $('[name="name"]', form).value.trim() },
            emailRedirectTo: new URL('onboarding.html', window.location.href).toString()
          }
        });
        if (error) throw error;
        if (data.session) {
          const user = data.user || data.session.user;
          if (!user) throw new Error('Your account was created, but we could not start your session. Please log in to continue.');
          await ensureUserProfile(supabase, user);
          window.location.replace('onboarding.html');
          return;
        }
        setStatus(status, 'Check your email to confirm your account. The confirmation link will take you to onboarding.', 'ok');
        if (resendButton) resendButton.hidden = false;
      } else if (kind === 'login') {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: $('[name="email"]', form).value.trim(),
          password: $('[name="password"]', form).value
        });
        if (error) throw error;
        if (!data.session) {
          throw new Error('We couldn’t start your session. Confirm your email address, then try logging in again.');
        }
        const user = data.user || data.session.user;
        if (!user) throw new Error('Your session started, but we could not load your account. Please try again.');
        navigateWithTransition(await getAuthenticatedDestination(supabase, user), { replace: true });
      } else if (kind === 'reset') {
        sentEmailRequest = true;
        const { error } = await supabase.auth.resetPasswordForEmail(
          $('[name="email"]', form).value.trim(),
          { redirectTo: new URL('reset.html', window.location.href).toString() }
        );
        if (error) throw error;
        setStatus(status, 'If that email has an account, a reset link is on its way. Check your inbox and spam folder.', 'ok');
        form.reset();
      }
    } catch (error) {
      setStatus(status, getFriendlyError(error, kind));
      status.focus();
    } finally {
      setBusy(button, false, initialLabel);
      submitting = false;
      if (sentEmailRequest) {
        if (kind === 'signup') startSignupCooldown();
        else startEmailCooldown(button, initialLabel, 'Resend');
      }
    }
  });

  resendButton?.addEventListener('click', async () => {
    if (resending || cooldownUntil > Date.now()) return;
    resending = true;
    resendButton.disabled = true;
    status.hidden = true;
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: $('[name="email"]', form).value.trim(),
        options: { emailRedirectTo: new URL('onboarding.html', window.location.href).toString() }
      });
      if (error) throw error;
      setStatus(status, 'Confirmation email sent. Check your inbox and spam folder.', 'ok');
    } catch (error) {
      setStatus(status, getFriendlyError(error, 'resend'));
      status.focus();
    } finally {
      resending = false;
      startSignupCooldown();
    }
  });
}

async function submitNewPassword(form, supabase) {
  const status = $('.status', form);
  const button = $('[type="submit"]', form);
  const initialLabel = button.textContent;
  let submitting = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    const password = $('[name="new-password"]', form);
    const confirm = $('[name="confirm-password"]', form);
    status.hidden = true;
    if (!(password.value.length >= 8 && /[A-Za-z]/.test(password.value) && /\d/.test(password.value))) {
      setStatus(status, 'Your password is too weak. Use at least 8 characters.');
      password.focus();
      return;
    }
    if (password.value !== confirm.value) {
      setStatus(status, 'Those passwords do not match.');
      confirm.focus();
      return;
    }

    submitting = true;
    setBusy(button, true, initialLabel);
    try {
      const { error } = await supabase.auth.updateUser({ password: password.value });
      if (error) throw error;
      setStatus(status, 'Password updated. You can now log in with your new password.', 'ok');
      form.reset();
    } catch (error) {
      setStatus(status, getFriendlyError(error, 'password-reset'));
      status.focus();
    } finally {
      setBusy(button, false, initialLabel);
      submitting = false;
    }
  });
}

async function initializeAuthForms(supabase) {
  for (const form of $$('form[data-form]')) {
    configureFieldDescriptions(form);
    bindGoogleAuth(form, supabase);
    if (form.dataset.form === 'reset-password') {
      await submitNewPassword(form, supabase);
    } else {
      await submitAuthForm(form, supabase);
    }
  }

  const loginForm = $('form[data-form="login"]');
  if (loginForm) {
    const returningAccount = $('[data-returning-account]');
    const loginLoading = $('[data-login-loading]');
    const loginSignup = $('[data-login-signup]');
    const continueButton = $('[data-continue-account]', returningAccount);
    continueButton.addEventListener('click', async () => {
      const initialLabel = continueButton.textContent;
      continueButton.disabled = true;
      continueButton.textContent = 'Just a sec…';
      const returningStatus = $('[data-returning-status]', returningAccount);
      returningStatus.hidden = true;
      try {
        const { user } = await getAuthenticatedUser(supabase);
        if (!user) {
          window.location.replace('login.html?session=expired');
          return;
        }
        navigateWithTransition(await getAuthenticatedDestination(supabase, user), { replace: true });
      } catch (error) {
        setStatus(returningStatus, getFriendlyError(error));
        returningStatus.focus();
        continueButton.disabled = false;
        continueButton.textContent = initialLabel;
      }
    });

    const { user, recovered } = await getAuthenticatedUser(supabase);
    const showLoginForm = new URLSearchParams(window.location.search).get('showLogin') === '1';
    if (user && !showLoginForm) {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('session') === 'oauth') {
        window.location.replace(await getAuthenticatedDestination(supabase, user));
        return;
      }

      const returningStatus = $('[data-returning-status]', returningAccount);
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('display_name, avatar_path')
        .eq('id', user.id)
        .maybeSingle();
      const name = profile?.display_name ||
        getUserDisplayName(user) ||
        user.email?.split('@')[0] ||
        'Your VYBE account';
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2)
        .map(part => part[0].toUpperCase()).join('') || 'V';
      $('[data-account-name]', returningAccount).textContent = name;
      $('[data-account-email]', returningAccount).textContent = user.email || '';
      $('[data-account-initials]', returningAccount).textContent = initials;

      if (profileError) {
        setStatus(returningStatus, `We couldn't load your full profile: ${getFriendlyError(profileError)}`, 'pending');
      } else if (profile?.avatar_path) {
        const { data: avatar, error: avatarError } = await supabase.storage
          .from('profile-media')
          .createSignedUrl(profile.avatar_path, 3600);
        if (avatarError) {
          setStatus(returningStatus, `We couldn't load your profile photo: ${getFriendlyError(avatarError)}`, 'pending');
        } else if (avatar?.signedUrl) {
          const image = $('[data-account-avatar]', returningAccount);
          image.src = avatar.signedUrl;
          image.hidden = false;
          $('[data-account-initials]', returningAccount).hidden = true;
        }
      }

      returningAccount.hidden = false;
      loginLoading.hidden = true;
      loginForm.hidden = true;
      loginSignup.hidden = true;
      return;
    }
    loginLoading.hidden = true;
    loginForm.hidden = false;
    if (recovered || new URLSearchParams(window.location.search).get('session') === 'expired') {
      setStatus($('.status', loginForm), 'Your saved session expired. Log in again to continue.', 'pending');
    }
  }

  const passwordForm = $('form[data-form="reset-password"]');
  if (!passwordForm) return;
  const emailForm = $('form[data-form="reset"]');
  const showPasswordForm = () => {
    emailForm.hidden = true;
    passwordForm.hidden = false;
    $('[name="new-password"]', passwordForm).focus();
  };
  const hidePasswordForm = () => {
    passwordForm.hidden = true;
    emailForm.hidden = false;
  };

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (session && window.location.hash.includes('type=recovery')) showPasswordForm();
  supabase.auth.onAuthStateChange(event => {
    if (event === 'PASSWORD_RECOVERY') showPasswordForm();
    if (event === 'SIGNED_OUT') hidePasswordForm();
  });
}

async function initializeOnboarding(supabase) {
  const app = $('[data-onboarding]');
  const steps = $$('.onboarding-step', app);
  const progress = $('.onboarding-progress', app);
  const progressLabel = $('.progress-label', app);
  const nextButton = $('[data-next]', app);
  const backButton = $('[data-back]', app);
  const skipButton = $('[data-skip]', app);
  const reactionMessage = $('[data-reaction-message]', app);
  const status = $('.status', app);
  const answers = {
    relationship_status: null,
    food_personality: null,
    looking_for: null,
    vibe: [],
    interests: [],
    onboarding_step: 0
  };
  let currentStep = 0;
  let navigationPending = false;
  let writeQueue = Promise.resolve();
  const navigationControls = [backButton, skipButton, nextButton, ...$$('[data-value]', app)];
  const setNavigationPending = pending => {
    navigationPending = pending;
    navigationControls.forEach(control => { control.disabled = pending; });
  };

  const { user } = await getAuthenticatedUser(supabase);
  if (!user) {
    window.location.replace(onboardingLoginUrl());
    return;
  }
  const supabaseUser = user;
  let profile;
  try {
    const result = await supabase.from('profiles')
      .select('display_name, relationship_status, food_personality, looking_for, vibe, interests, matchmaking_enabled, onboarding_step, onboarding_completed')
      .eq('id', user.id)
      .maybeSingle();
    if (result.error) throw result.error;
    profile = result.data;
    if (!profile) await ensureUserProfile(supabase, user);
  } catch (error) {
    if (isSessionExpiredError(error)) {
      window.location.replace(onboardingLoginUrl());
      return;
    }
    throw error;
  }
  if (profile) {
    answers.relationship_status = profile.relationship_status;
    answers.food_personality = profile.food_personality;
    answers.looking_for = profile.looking_for;
    answers.vibe = profile.vibe || [];
    answers.interests = profile.interests || [];
    answers.onboarding_step = profile.onboarding_step || 0;
  }
  const draftKey = 'vybe-onboarding-draft';
  try {
    const draft = JSON.parse(window.sessionStorage.getItem(draftKey) || 'null');
    if (draft && typeof draft === 'object') {
      for (const key of ['relationship_status', 'food_personality', 'looking_for']) {
        if (typeof draft[key] === 'string' || draft[key] === null) answers[key] = draft[key];
      }
      for (const key of ['vibe', 'interests']) {
        if (Array.isArray(draft[key])) answers[key] = draft[key];
      }
      if (Number.isInteger(draft.onboarding_step)) answers.onboarding_step = draft.onboarding_step;
    }
  } catch (error) {
    console.warn('VYBE could not restore the onboarding draft.', error);
  }
  currentStep = Math.min(answers.onboarding_step, steps.length - 1);

  const render = () => {
    steps.forEach((step, index) => { step.hidden = index !== currentStep; });
    $$('[data-answer]', steps[currentStep]).forEach(group => {
      const key = group.dataset.answer;
      $$('[data-value]', group).forEach(option => {
        const selected = Array.isArray(answers[key])
          ? answers[key].includes(option.dataset.value)
          : answers[key] === option.dataset.value;
        option.setAttribute('aria-pressed', String(selected));
      });
    });
    progress.max = steps.length;
    progress.value = currentStep + 1;
    progress.textContent = `${currentStep + 1} of ${steps.length}`;
    progressLabel.textContent = `Question ${currentStep + 1} of ${steps.length}`;
    backButton.hidden = currentStep === 0;
    nextButton.textContent = currentStep === steps.length - 1 ? 'Finish my VYBE' : 'Continue';
    skipButton.textContent = currentStep === steps.length - 1 ? 'Skip & finish' : 'Skip this one';
    reactionMessage.hidden = true;
    reactionMessage.textContent = '';
    status.hidden = true;
    steps[currentStep].focus?.();
  };

  const saveChoice = (button, isMulti) => {
    const key = button.closest('[data-answer]').dataset.answer;
    const value = button.dataset.value;
    if (isMulti) {
      const selected = new Set(answers[key]);
      if (selected.has(value)) selected.delete(value);
      else selected.add(value);
      answers[key] = [...selected];
    } else {
      answers[key] = answers[key] === value ? null : value;
    }
    $(`[data-answer="${key}"]`, app).querySelectorAll('[data-value]').forEach(option => {
      const active = Array.isArray(answers[key])
        ? answers[key].includes(option.dataset.value)
        : answers[key] === option.dataset.value;
      option.setAttribute('aria-pressed', String(active));
    });
    const selected = Array.isArray(answers[key])
      ? answers[key].includes(value)
      : answers[key] === value;
    return {
      selected,
      reaction: selected ? button.dataset.reaction || '' : ''
    };
  };

  const persistAnswers = (complete, nextStep = currentStep) => {
    const write = writeQueue.then(async () => {
      setStatus(status, 'Saving your answers…', 'pending');
      const { error } = await supabase.from('profiles').upsert({
        id: supabaseUser.id,
        display_name: getUserDisplayName(supabaseUser, profile?.display_name),
        relationship_status: answers.relationship_status,
        food_personality: answers.food_personality,
        looking_for: answers.looking_for,
        matchmaking_enabled: Boolean(
          complete &&
          profile?.matchmaking_enabled &&
          answers.relationship_status &&
          ['single', 'complicated', 'cruise'].includes(answers.relationship_status) &&
          answers.looking_for
        ),
        vibe: answers.vibe,
        interests: answers.interests,
        onboarding_completed: complete,
        onboarding_step: complete ? steps.length : nextStep,
        updated_at: new Date().toISOString()
      }, { onConflict: 'id' });
      if (error) throw error;
    });
    writeQueue = write.catch(() => {});

    return write.then(() => {
      try {
        window.sessionStorage.removeItem(draftKey);
      } catch (error) {
        console.warn('VYBE could not clear the saved onboarding draft.', error);
      }
      status.hidden = true;
      if (complete) {
        window.location.replace('home.html');
      }
      return true;
    }).catch(error => {
      if (isSessionExpiredError(error)) {
        try {
          window.sessionStorage.setItem(draftKey, JSON.stringify(answers));
        } catch (storageError) {
          console.warn('VYBE could not preserve the onboarding draft for sign-in.', storageError);
        }
        window.location.replace(onboardingLoginUrl());
        return false;
      }
      setStatus(status, getFriendlyError(error, 'onboarding'));
      status.focus();
      return false;
    });
  };

  app.addEventListener('click', async event => {
    if (navigationPending) return;
    const choice = event.target.closest('[data-value]');
    if (choice) {
      const result = saveChoice(choice, choice.closest('[data-answer]').dataset.multiple === 'true');
      reactionMessage.textContent = result.reaction;
      reactionMessage.hidden = !result.reaction;
      await persistAnswers(false);
      return;
    }
    if (event.target.closest('[data-back]')) {
      const previousStep = Math.max(0, currentStep - 1);
      if (previousStep === currentStep) return;
      setNavigationPending(true);
      try {
        if (!await persistAnswers(false, previousStep)) return;
        currentStep = previousStep;
        render();
      } finally {
        setNavigationPending(false);
      }
      return;
    }
    if (event.target.closest('[data-next]') || event.target.closest('[data-skip]')) {
      setNavigationPending(true);
      try {
        if (currentStep < steps.length - 1) {
          if (!await persistAnswers(false, currentStep + 1)) return;
          currentStep++;
          render();
        } else {
          await persistAnswers(true);
        }
      } finally {
        setNavigationPending(false);
      }
    }
  });

  $('[data-logout]', app).addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setStatus(status, `We couldn't log you out: ${getFriendlyError(error)}`);
      status.focus();
      button.disabled = false;
    }
  });

  $('[data-edit-profile]', app).addEventListener('click', () => {
    currentStep = 0;
    $('.onboarding-done', app).hidden = true;
    $('.onboarding-questions', app).hidden = false;
    render();
  });

  render();
  if (profile?.onboarding_completed) {
    window.location.replace('home.html');
  }
}

async function initializeLanding(supabase) {
  const guestControls = $$('[data-auth-guest]');
  const userControls = $$('[data-auth-user]');
  const status = $('[data-auth-status]');
  const applySession = session => {
    guestControls.forEach(element => { element.hidden = Boolean(session); });
    userControls.forEach(element => { element.hidden = !session; });
  };
  const { user } = await getAuthenticatedUser(supabase);
  const landingPath = window.location.pathname;
  const isLandingPage = landingPath === '/' || landingPath.endsWith('/index.html') ||
    landingPath.endsWith('/');
  if (user && isLandingPage &&
      new URLSearchParams(window.location.search).get('logout') !== 'unconfirmed') {
    const loginUrl = new URL('login.html', window.location.href);
    loginUrl.searchParams.set('session', 'returning');
    const returnTo = getRequestedReturnTo();
    if (returnTo) loginUrl.searchParams.set('returnTo', returnTo);
    window.location.replace(loginUrl.toString());
    return;
  }
  applySession(user);
  supabase.auth.onAuthStateChange((_event, updatedSession) => applySession(updatedSession));

  if (new URLSearchParams(window.location.search).get('logout') === 'unconfirmed') {
    setStatus(status, 'You’re signed out on this device, but Supabase could not confirm that the session was revoked. Please try again when you have a connection.');
  }

  const logout = $('[data-logout]');
  if (logout) {
    logout.addEventListener('click', async () => {
      logout.disabled = true;
      try {
        const { warning } = await signOutCurrentSession(supabase);
        if (warning) setStatus(status, 'You’re signed out on this device, but Supabase could not confirm that the session was revoked. Please try again when you have a connection.');
      } catch (logoutError) {
        setStatus(status, `We couldn't log you out: ${getFriendlyError(logoutError)}`);
        status.hidden = false;
        logout.disabled = false;
      }
    });
  }
}

async function initialize() {
  bindPasswordToggles();
  const status = $('form[data-form] .status') || $('[data-onboarding] .status') || $('[data-auth-status]');

  try {
    const supabase = getSupabaseClient();
    if ($('[data-onboarding]')) await initializeOnboarding(supabase);
    else if ($('form[data-form]')) await initializeAuthForms(supabase);
    else if ($('[data-auth-guest]')) await initializeLanding(supabase);
  } catch (error) {
    const loginForm = $('form[data-form="login"]');
    if (loginForm) {
      loginForm.hidden = false;
      $('[data-login-loading]').hidden = true;
    }
    if (status) {
      setStatus(status, getFriendlyError(error));
      status.focus();
    }
  }
}

initialize();

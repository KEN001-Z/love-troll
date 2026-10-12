import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function friendlyError(error) {
  const message = error?.message || '';
  if (error instanceof TypeError || /failed to fetch|networkerror|network request failed/i.test(message)) {
    return 'VYBE could not reach the server. Check your internet connection and try again.';
  }
  if (error?.code === 'email_not_confirmed' || /email not confirmed/i.test(message)) {
    return 'Confirm your email address from the link we sent you, then try logging in again.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email or password does not match an account. Check your details or reset your password.';
  }
  if (/user already registered/i.test(message)) {
    return 'An account with that email already exists. Log in or reset your password instead.';
  }
  return message || 'Something went wrong. Please try again.';
}

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

async function getAuthenticatedDestination(supabase, user) {
  const { data: profile, error } = await supabase.from('profiles')
    .select('onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return profile?.onboarding_completed ? 'home.html' : 'onboarding.html';
}

async function ensureUserProfile(supabase, user) {
  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    display_name: user.user_metadata?.display_name || null
  }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) throw error;
}

function validate(form) {
  let firstInvalid;
  const email = $('[name="email"]', form);
  const password = $('[name="password"]', form);
  const name = $('[name="name"]', form);
  const dob = $('[name="dob"]', form);
  const terms = $('[name="terms"]', form);
  const errors = new Map();

  if (name && name.value.trim().length < 2) errors.set(name, 'Abeg, enter a display name of at least 2 characters.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
    errors.set(email, 'Enter a valid email, like you@example.com.');
  }
  if (password && form.dataset.form === 'signup' &&
      !(password.value.length >= 8 && /[A-Za-z]/.test(password.value) && /\d/.test(password.value))) {
    errors.set(password, 'Use at least 8 characters, with a letter and a number.');
  } else if (password && !password.value) {
    errors.set(password, 'Enter your password.');
  }
  if (dob) {
    const birthDate = new Date(`${dob.value}T00:00:00`);
    const today = new Date();
    let years = today.getFullYear() - birthDate.getFullYear();
    if (today < new Date(today.getFullYear(), birthDate.getMonth(), birthDate.getDate())) years--;
    if (!dob.value || Number.isNaN(birthDate.getTime())) errors.set(dob, 'Enter your date of birth.');
    else if (years < 18) errors.set(dob, 'VYBE is for people aged 18 and above.');
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

async function submitAuthForm(form, supabase) {
  const kind = form.dataset.form;
  const status = $('.status', form);
  const button = $('[type="submit"]', form);
  const initialLabel = button.textContent;
  let submitting = false;

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting) return;
    status.hidden = true;
    if (!validate(form)) return;

    submitting = true;
    setBusy(button, true, initialLabel);
    try {
      if (kind === 'signup') {
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
        window.location.replace(await getAuthenticatedDestination(supabase, user));
      } else if (kind === 'reset') {
        const { error } = await supabase.auth.resetPasswordForEmail(
          $('[name="email"]', form).value.trim(),
          { redirectTo: new URL('reset.html', window.location.href).toString() }
        );
        if (error) throw error;
        setStatus(status, 'If that email has an account, a reset link is on its way. Check your inbox and spam folder.', 'ok');
        form.reset();
      }
    } catch (error) {
      setStatus(status, friendlyError(error));
      status.focus();
    } finally {
      setBusy(button, false, initialLabel);
      submitting = false;
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
      setStatus(status, 'Use at least 8 characters, with a letter and a number.');
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
      setStatus(status, friendlyError(error));
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
    if (form.dataset.form === 'reset-password') {
      await submitNewPassword(form, supabase);
    } else {
      await submitAuthForm(form, supabase);
    }
  }

  const loginForm = $('form[data-form="login"]');
  if (loginForm) {
    const { user, recovered } = await getAuthenticatedUser(supabase);
    if (user) {
      window.location.replace(await getAuthenticatedDestination(supabase, user));
      return;
    }
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

  const { user, recovered } = await getAuthenticatedUser(supabase);
  if (!user) {
    window.location.replace(recovered ? 'login.html?session=expired' : 'login.html');
    return;
  }
  const supabaseUser = user;
  const { data: profile, error: profileError } = await supabase.from('profiles')
    .select('display_name, relationship_status, food_personality, looking_for, vibe, interests, onboarding_step, onboarding_completed')
    .eq('id', user.id)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile) await ensureUserProfile(supabase, user);
  if (profile) {
    answers.relationship_status = profile.relationship_status;
    answers.food_personality = profile.food_personality;
    answers.looking_for = profile.looking_for;
    answers.vibe = profile.vibe || [];
    answers.interests = profile.interests || [];
    answers.onboarding_step = profile.onboarding_step || 0;
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
        display_name: supabaseUser.user_metadata?.display_name || profile?.display_name || null,
        relationship_status: answers.relationship_status,
        food_personality: answers.food_personality,
        looking_for: answers.looking_for,
        matchmaking_enabled: Boolean(
          complete &&
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
      status.hidden = true;
      if (complete) {
        window.location.replace('home.html');
      }
      return true;
    }).catch(error => {
      setStatus(status, `We couldn't save your answers: ${friendlyError(error)}`);
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
      setStatus(status, `We couldn't log you out: ${friendlyError(error)}`);
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
        setStatus(status, `We couldn't log you out: ${friendlyError(logoutError)}`);
        status.hidden = false;
        logout.disabled = false;
      }
    });
  }
}

async function initialize() {
  bindPasswordToggles();
  const status = $('.auth .status') || $('[data-onboarding] .status') || $('[data-auth-status]');

  try {
    const supabase = getSupabaseClient();
    if ($('[data-onboarding]')) await initializeOnboarding(supabase);
    else if ($('form[data-form]')) await initializeAuthForms(supabase);
    else if ($('[data-auth-guest]')) await initializeLanding(supabase);
  } catch (error) {
    if (status) {
      setStatus(status, friendlyError(error));
      status.focus();
    }
  }
}

initialize();

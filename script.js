/*
  VYBE: frontend prototype.
  Plain JavaScript, no frameworks, no backend, no browser storage.
  Everything lives in memory and disappears when the page is refreshed.

  File map
    1. Setup and small helpers
    2. Humour picker, toast and sharing
    3. Illustrated avatars
    4. Router (hash-based, e.g. #/discover)
    5. Home page pieces
    6. Registration demo (validation only)
    7. Onboarding
    8. Discover
    9. Quiz engine, DELULU Meter and VYBE Check
   10. Ship or Skip
   11. Profile preview, dialog and start-up
*/
(function () {
  'use strict';

  /* =====================================================
     1. SETUP AND SMALL HELPERS
     ===================================================== */
  const DATA = VYBE_DATA;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  // The only "memory" the app has. Never put passwords in here.
  const state = {
    profile: null // set when the onboarding preview is completed: { name, vibe, interests, bio }
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function icon(name) {
    return `<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-${name}"></use></svg>`;
  }

  // Always escape text that a person typed before putting it into innerHTML.
  function escapeHTML(text) {
    return String(text).replace(/[&<>"']/g, (ch) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, reduceMotion.matches ? 0 : ms));
  }

  /* =====================================================
     2. HUMOUR, TOAST AND SHARING
     ===================================================== */

  // Returns a function that picks a random message but never the same one twice in a row.
  function makePicker(list) {
    let last = -1;
    return function pickNext() {
      if (list.length === 1) return list[0];
      let next;
      do { next = Math.floor(Math.random() * list.length); } while (next === last);
      last = next;
      return list[next];
    };
  }

  const say = {};
  Object.keys(DATA.humour).forEach((key) => { say[key] = makePicker(DATA.humour[key]); });

  let toastTimer;
  function showToast(message) {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2800);
  }

  // Link people can open. Personalised result links need a backend, so for now we share the site itself.
  function getSiteUrl() {
    return window.location.href.split('#')[0];
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // Older browsers or non-secure pages: fall back to a temporary textarea.
      const helper = document.createElement('textarea');
      helper.value = text;
      helper.setAttribute('readonly', '');
      helper.style.position = 'fixed';
      helper.style.opacity = '0';
      document.body.appendChild(helper);
      helper.select();
      let worked = false;
      try { worked = document.execCommand('copy'); } catch (err) { worked = false; }
      helper.remove();
      return worked;
    }
  }

  /*
    Builds the share buttons for a result.
    Later, getSiteUrl() can be replaced by a personalised link (for example /r/abc123)
    and nothing else in this function has to change.
  */
  let sharePanelCount = 0;
  function buildSharePanel(shareText) {
    const url = getSiteUrl();
    const fallbackId = `share-fallback-text-${sharePanelCount += 1}`;
    const fullText = `${shareText}\n${url}`;
    const panel = document.createElement('div');
    panel.className = 'share-panel';
    panel.innerHTML = `
      <h3 class="share-title">Share this result</h3>
      <div class="share-row">
        <a class="btn btn-whatsapp" data-share="whatsapp" target="_blank" rel="noopener noreferrer"
           href="https://wa.me/?text=${encodeURIComponent(fullText)}">${icon('message')} WhatsApp</a>
        <button type="button" class="btn btn-soft" data-share="result">${icon('copy')} Copy result</button>
        <button type="button" class="btn btn-soft" data-share="link">${icon('link')} Copy link</button>
        ${navigator.share ? `<button type="button" class="btn btn-soft" data-share="native">${icon('share')} Share…</button>` : ''}
      </div>
      <div class="share-fallback" hidden>
        <label for="${fallbackId}">Copying didn't work automatically. Select this text and copy it:</label>
        <textarea id="${fallbackId}" readonly rows="3"></textarea>
      </div>`;

    const fallback = $('.share-fallback', panel);
    async function copyWithFeedback(text, successMessage) {
      if (await copyText(text)) {
        showToast(successMessage);
      } else {
        const box = $('textarea', fallback);
        box.value = text;
        fallback.hidden = false;
        box.focus();
        box.select();
      }
    }

    panel.addEventListener('click', async (event) => {
      const button = event.target.closest('[data-share]');
      if (!button) return;
      const kind = button.dataset.share;
      if (kind === 'result') {
        copyWithFeedback(fullText, say.copied());
      } else if (kind === 'link') {
        copyWithFeedback(url, 'Link copied.');
      } else if (kind === 'native') {
        try {
          await navigator.share({ title: 'VYBE', text: shareText, url });
        } catch (error) {
          if (error.name !== 'AbortError') copyWithFeedback(fullText, say.copied());
        }
      }
      // The WhatsApp link is a normal anchor, so the browser opens it by itself.
    });
    return panel;
  }

  /* =====================================================
     3. ILLUSTRATED AVATARS
     Simple SVG placeholders, drawn in code so they never break like remote photos can.
     ===================================================== */
  function avatarDataUri({ skin, hair, style, shirt, bg }) {
    const hairBack = {
      0: '',
      1: `<path d="M52 100 C44 165 56 200 76 204 L84 120Z M148 100 C156 165 144 200 124 204 L116 120Z" fill="${hair}"/>`,
      2: `<circle cx="100" cy="88" r="56" fill="${hair}"/>`,
      3: `<circle cx="100" cy="48" r="17" fill="${hair}"/>`
    }[style];
    const hairFront = {
      0: `<path d="M58 108 C52 58 78 46 100 46 C124 46 148 60 142 108 C132 86 118 78 100 78 C82 78 68 86 58 108Z" fill="${hair}"/>`,
      1: `<path d="M56 108 C52 56 78 44 100 44 C124 44 148 58 144 108 C132 82 116 74 100 74 C84 74 68 82 56 108Z" fill="${hair}"/>`,
      2: `<path d="M62 96 C66 70 84 62 100 62 C118 62 134 70 138 96 C128 82 116 76 100 76 C84 76 72 82 62 96Z" fill="${hair}"/>`,
      3: `<path d="M60 106 C56 62 80 52 100 52 C122 52 146 62 140 106 C130 84 118 80 100 80 C84 80 70 86 60 106Z" fill="${hair}"/>`
    }[style];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 240">
      <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></linearGradient></defs>
      <rect width="200" height="240" fill="url(#g)"/>
      ${hairBack}
      <path d="M18 240 C18 192 58 172 100 172 C142 172 182 192 182 240Z" fill="${shirt}"/>
      <rect x="87" y="140" width="26" height="40" rx="10" fill="${skin}"/>
      <ellipse cx="100" cy="110" rx="40" ry="48" fill="${skin}"/>
      ${hairFront}
      <circle cx="85" cy="114" r="3.2" fill="#2a1f36"/><circle cx="115" cy="114" r="3.2" fill="#2a1f36"/>
      <path d="M88 132 Q100 142 112 132" fill="none" stroke="#2a1f36" stroke-width="3" stroke-linecap="round"/>
    </svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  // Deterministic avatar for the person using the demo, based on their display name.
  function userAvatarUri(name) {
    const seed = hashString(name.toLowerCase());
    const skins = ['#8d5a3b', '#d9a07a', '#f0cfae', '#b97a57', '#6f4430'];
    const hairs = ['#1c1420', '#3b2a1e', '#7a3f2b', '#2a2a3a'];
    const shirts = ['#3a1170', '#ff6b81', '#6a3cc4', '#17694a'];
    const bgs = [['#e4d7fb', '#c7b0f5'], ['#fde3e6', '#f9c0c9'], ['#d9f2e6', '#b4e3cd'], ['#fff1cc', '#ffe08a']];
    return avatarDataUri({
      skin: skins[seed % skins.length],
      hair: hairs[(seed >>> 3) % hairs.length],
      style: (seed >>> 6) % 4,
      shirt: shirts[(seed >>> 9) % shirts.length],
      bg: bgs[(seed >>> 12) % bgs.length]
    });
  }

  /* =====================================================
     4. ROUTER
     ===================================================== */
  const routes = {
    home:       { nav: 'home' },
    games:      { nav: 'games' },
    delulu:     { nav: 'games',    onEnter: () => deluluQuiz.start() },
    ship:       { nav: 'ship',     onEnter: () => renderShipForm() },
    vibecheck:  { nav: 'games',    onEnter: () => vybeQuiz.start() },
    discover:   { nav: 'discover', onEnter: () => renderDiscover() },
    join:       { nav: 'account',  onEnter: () => resetJoinForm() },
    onboarding: { nav: 'account',  onEnter: () => enterOnboarding() },
    profile:    { nav: 'profile',  onEnter: () => renderProfile() }
  };

  let firstRoute = true;

  function handleRoute() {
    const hash = window.location.hash.replace(/^#\/?/, '');
    const name = routes[hash] ? hash : 'home';
    const route = routes[name];

    // Run the page's setup first: it may redirect (for example onboarding without a name).
    if (route.onEnter) {
      const redirect = route.onEnter();
      if (redirect) return;
    }

    $$('.view').forEach((view) => { view.hidden = view.id !== `view-${name}`; });
    document.title = $(`#view-${name}`).dataset.title;

    $$('[data-nav]').forEach((link) => {
      if (link.dataset.nav === route.nav) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const profileButton = $('#profile-btn');
    if (route.nav === 'account' || route.nav === 'profile') profileButton.setAttribute('aria-current', 'page');
    else profileButton.removeAttribute('aria-current');

    window.scrollTo(0, 0);
    if (!firstRoute) $('#main').focus({ preventScroll: true });
    firstRoute = false;
  }

  function goTo(name) {
    window.location.hash = `#/${name}`;
  }

  function updateProfileButton() {
    const button = $('#profile-btn');
    const label = $('#profile-btn-label');
    if (state.profile) {
      label.textContent = state.profile.name;
      button.href = '#/profile';
    } else {
      label.textContent = 'Join VYBE';
      button.href = '#/join';
    }
  }

  /* =====================================================
     5. HOME PAGE PIECES
     ===================================================== */
  const GAME_TILES = [
    { route: 'delulu',    tone: 't3', emoji: '🔮', title: 'The DELULU Meter',  text: 'Your crush replies with an emoji. How far does your imagination travel?', meta: '5 questions' },
    { route: 'ship',      tone: 't2', emoji: '💘', title: 'Ship or Skip',      text: 'Enter two names. Get a percentage, a category, and unsolicited commentary.', meta: 'No account needed' },
    { route: 'vibecheck', tone: 't1', emoji: '🪞', title: 'The VYBE Check',    text: 'Find out which relationship character you are in this chaotic cinematic universe.', meta: '6 questions' }
  ];

  function gameTilesHTML() {
    return GAME_TILES.map((game) => `
      <a class="game-tile tone-${game.tone}" href="#/${game.route}">
        <span class="game-emoji" aria-hidden="true">${game.emoji}</span>
        <h3>${game.title}</h3>
        <p>${game.text}</p>
        <span class="game-meta">${game.meta} ${icon('arrow-right')}</span>
      </a>`).join('');
  }

  function profileById(id) {
    return DATA.profiles.find((p) => p.id === id);
  }

  function chipsHTML(list) {
    return `<ul class="chips">${list.map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>`;
  }

  function renderHome() {
    // Decorative hero stack (hidden from assistive technology)
    $('#hero-stack').innerHTML = ['mina', 'daniel', 'amara'].map((id, i) => {
      const p = profileById(id);
      return `<div class="stack-card stack-${i + 1}">
        <img src="${avatarDataUri(p.avatar)}" alt="" width="200" height="240">
        <div class="stack-info"><strong>${p.name}, ${p.age}</strong>${chipsHTML(p.interests.slice(0, 2))}</div>
        <span class="demo-badge">Demo profile</span>
      </div>`;
    }).join('');

    $('#featured-grid').innerHTML = ['tobi', 'lucia', 'priya'].map((id) => {
      const p = profileById(id);
      return `<article class="mini-profile">
        <img src="${avatarDataUri(p.avatar)}" alt="Illustrated placeholder avatar of ${p.name}" width="200" height="240" loading="lazy">
        <div class="mini-body">
          <h3>${p.name}, ${p.age}</h3>
          <p class="meta">${icon('pin')} ${p.place}</p>
          <p>${p.bio}</p>
          ${chipsHTML(p.interests)}
        </div>
      </article>`;
    }).join('');

    $('#home-game-grid').innerHTML = gameTilesHTML();
    $('#games-hub-grid').innerHTML = gameTilesHTML();
  }

  /* =====================================================
     6. REGISTRATION DEMO (validation only: nothing is stored or sent)
     ===================================================== */
  const joinForm = $('#join-form');
  const joinFields = ['name', 'email', 'password', 'confirm', 'terms'];

  function validateJoin(values) {
    const errors = {};
    const name = values.name.trim();
    if (!name) errors.name = 'Enter a display name.';
    else if (name.length < 2) errors.name = 'Use at least 2 characters for your display name.';

    if (!values.email.trim()) errors.email = 'Enter an email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = 'Enter a valid email address, like name@example.com.';

    if (!values.password) errors.password = 'Enter a password.';
    else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';

    if (!values.confirm) errors.confirm = 'Enter your password again to confirm it.';
    else if (values.confirm !== values.password) errors.confirm = 'The passwords do not match. Check both fields and try again.';

    if (!values.terms) errors.terms = 'Tick the box to continue.';
    return errors;
  }

  function readJoinValues() {
    return {
      name: $('#join-name').value,
      email: $('#join-email').value,
      password: $('#join-password').value,
      confirm: $('#join-confirm').value,
      terms: $('#join-terms').checked
    };
  }

  function showJoinError(field, message) {
    const input = $(`#join-${field}`);
    const output = $(`#join-${field}-error`);
    if (message) {
      input.setAttribute('aria-invalid', 'true');
      output.innerHTML = `${icon('info')} <span>${escapeHTML(message)}</span>`;
    } else {
      input.removeAttribute('aria-invalid');
      output.textContent = '';
    }
  }

  function resetJoinForm() {
    joinForm.reset();
    joinFields.forEach((field) => showJoinError(field, ''));
    $('#signin-panel').hidden = true;
    $('#signin-toggle').setAttribute('aria-expanded', 'false');
    $$('[data-toggle-password]').forEach((button) => setPasswordVisibility(button, false));
  }

  function setPasswordVisibility(button, visible) {
    const input = $(`#${button.dataset.togglePassword}`);
    input.type = visible ? 'text' : 'password';
    button.setAttribute('aria-pressed', String(visible));
    button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
    button.innerHTML = icon(visible ? 'eye-off' : 'eye');
  }

  function setUpJoinForm() {
    joinForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const errors = validateJoin(readJoinValues());
      joinFields.forEach((field) => showJoinError(field, errors[field]));
      const firstBad = joinFields.find((field) => errors[field]);
      if (firstBad) {
        $(`#join-${firstBad}`).focus();
        return;
      }
      // Success: keep only the display name, in memory, for the preview. Email and password are discarded.
      onboardingData = { name: $('#join-name').value.trim(), vibe: '', interests: [], bio: '' };
      onboardingStep = 1;
      joinForm.reset();
      goTo('onboarding');
    });

    // Clear an error as soon as the person fixes the problem.
    joinForm.addEventListener('input', () => {
      if (!joinFields.some((field) => $(`#join-${field}`).hasAttribute('aria-invalid'))) return;
      const errors = validateJoin(readJoinValues());
      joinFields.forEach((field) => {
        if ($(`#join-${field}`).hasAttribute('aria-invalid')) showJoinError(field, errors[field]);
      });
    });

    $$('[data-toggle-password]').forEach((button) => {
      button.addEventListener('click', () => setPasswordVisibility(button, button.getAttribute('aria-pressed') !== 'true'));
    });

    $('#signin-toggle').addEventListener('click', (event) => {
      const panel = $('#signin-panel');
      panel.hidden = !panel.hidden;
      event.currentTarget.setAttribute('aria-expanded', String(!panel.hidden));
    });
  }

  /* =====================================================
     7. ONBOARDING
     ===================================================== */
  const BIO_LIMIT = 140;
  const ONBOARDING_STEPS = 4;
  let onboardingStep = 1;
  let onboardingData = { name: '', vibe: '', interests: [], bio: '' };
  let onboardingDoneMessage = '';

  function enterOnboarding() {
    if (!onboardingData.name) {
      // Nobody has done the registration demo yet.
      showToast('Start with the quick sign-up demo first.');
      goTo('join');
      return true; // true = redirected
    }
    renderOnboarding();
    return false;
  }

  function vibeLabel(id) {
    const vibe = DATA.vibes.find((v) => v.id === id);
    return vibe ? `${vibe.emoji} ${vibe.label}` : '';
  }

  function containsContactInfo(text) {
    return /[^\s@]+@[^\s@]+\.[a-z]{2,}/i.test(text)
      || /\d[\d\s().-]{6,}\d/.test(text)
      || /(^|\s)@\w{2,}/.test(text)
      || /https?:\/\/|www\./i.test(text);
  }

  // The same card is used for the onboarding preview and the profile page.
  function previewCardHTML(profile) {
    return `
      <article class="profile-card preview-card" aria-label="Preview of your profile">
        <div class="profile-photo">
          <img src="${userAvatarUri(profile.name)}" alt="Illustrated placeholder avatar for ${escapeHTML(profile.name)}" width="200" height="240">
          <span class="demo-badge">Preview, not saved</span>
        </div>
        <div class="profile-body">
          <h2>${escapeHTML(profile.name)}</h2>
          ${profile.vibe ? `<p class="meta">${escapeHTML(vibeLabel(profile.vibe))}</p>` : ''}
          <p class="bio">${profile.bio ? escapeHTML(profile.bio) : '<em>No bio yet. Mysterious, but fair.</em>'}</p>
          ${profile.interests.length ? chipsHTML(profile.interests) : ''}
        </div>
      </article>`;
  }

  function readOnboardingStep(step) {
    const root = $('#onboarding-root');
    if (step === 1) {
      const chosen = $('input[name="vibe"]:checked', root);
      onboardingData.vibe = chosen ? chosen.value : '';
    } else if (step === 2) {
      onboardingData.interests = $$('input[name="interest"]:checked', root).map((input) => input.value);
    } else if (step === 3) {
      // Never carry contact details forward, even if someone presses Back.
      const bioText = $('#bio', root).value.trim();
      if (!containsContactInfo(bioText)) onboardingData.bio = bioText;
    }
  }

  function renderOnboarding() {
    const root = $('#onboarding-root');
    const step = onboardingStep;
    const isLast = step === ONBOARDING_STEPS;
    let body = '';

    if (step === 1) {
      body = `
        <fieldset class="choice-set">
          <legend><h1 class="page-title">What kind of vibe are you looking for?</h1><span class="hint">Optional. You can change your mind any time.</span></legend>
          <div class="vibe-options">
            ${DATA.vibes.map((v) => `
              <label class="vibe-option">
                <input type="radio" name="vibe" value="${v.id}" ${onboardingData.vibe === v.id ? 'checked' : ''}>
                <span class="vibe-card"><span class="vibe-emoji" aria-hidden="true">${v.emoji}</span><strong>${v.label}</strong><span>${v.text}</span></span>
              </label>`).join('')}
          </div>
        </fieldset>`;
    } else if (step === 2) {
      body = `
        <fieldset class="choice-set">
          <legend><h1 class="page-title">A little about you</h1><span class="hint">Pick anything that sounds like you. All optional.</span></legend>
          <div class="chip-options">
            ${DATA.interests.map((interest) => `
              <label class="chip-option">
                <input type="checkbox" name="interest" value="${interest}" ${onboardingData.interests.includes(interest) ? 'checked' : ''}>
                <span>${interest}</span>
              </label>`).join('')}
          </div>
        </fieldset>`;
    } else if (step === 3) {
      body = `
        <div class="field">
          <h1 class="page-title"><label for="bio">Give people a little reason to say hello.</label></h1>
          <textarea id="bio" rows="4" maxlength="${BIO_LIMIT}" aria-describedby="bio-hint bio-count bio-error"></textarea>
          <div class="bio-meta">
            <p class="field-hint" id="bio-hint">Optional. Please don't share phone numbers, emails or social handles.</p>
            <p class="field-hint" id="bio-count"><span id="bio-count-number">0</span>/${BIO_LIMIT}</p>
          </div>
          <p class="field-error" id="bio-error" aria-live="polite"></p>
        </div>`;
    } else {
      body = `
        <h1 class="page-title">${escapeHTML(onboardingDoneMessage)}</h1>
        <p class="lead">Here is your VYBE identity. It's only a preview for this demo.</p>
        ${previewCardHTML(onboardingData)}
        <div class="edit-row">
          <button type="button" class="btn btn-soft btn-sm" data-edit-step="1">Edit vibe</button>
          <button type="button" class="btn btn-soft btn-sm" data-edit-step="2">Edit interests</button>
          <button type="button" class="btn btn-soft btn-sm" data-edit-step="3">Edit bio</button>
        </div>`;
    }

    root.innerHTML = `
      <div class="quiz-head">
        <p class="quiz-count">Step ${step} of ${ONBOARDING_STEPS}</p>
        <div class="progress" role="progressbar" aria-label="Setup progress" aria-valuemin="1" aria-valuemax="${ONBOARDING_STEPS}" aria-valuenow="${step}"><span style="width:${(step / ONBOARDING_STEPS) * 100}%"></span></div>
      </div>
      <div class="step-body">${body}</div>
      <div class="step-nav">
        ${step > 1 ? `<button type="button" class="btn btn-ghost" data-onboard="back">${icon('arrow-left')} Back</button>` : '<span></span>'}
        <div class="step-nav-right">
          ${!isLast ? '<button type="button" class="btn btn-ghost" data-onboard="skip">Skip for now</button>' : ''}
          <button type="button" class="btn btn-primary" data-onboard="next">${isLast ? 'Take Me In' : 'Continue'}</button>
        </div>
      </div>`;

    if (step === 3) {
      const bio = $('#bio', root);
      bio.value = onboardingData.bio;
      const counter = $('#bio-count-number', root);
      counter.textContent = bio.value.length;
      bio.addEventListener('input', () => { counter.textContent = bio.value.length; $('#bio-error').textContent = ''; bio.removeAttribute('aria-invalid'); });
    }
    const heading = $('h1', root);
    heading.setAttribute('tabindex', '-1');
  }

  function goToOnboardingStep(step) {
    onboardingStep = step;
    if (step === ONBOARDING_STEPS) onboardingDoneMessage = say.onboardingDone();
    renderOnboarding();
    $('#onboarding-root h1').focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function setUpOnboarding() {
    $('#onboarding-root').addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-edit-step]');
      if (editButton) { goToOnboardingStep(Number(editButton.dataset.editStep)); return; }

      const button = event.target.closest('[data-onboard]');
      if (!button) return;
      const action = button.dataset.onboard;

      if (action === 'back') {
        readOnboardingStep(onboardingStep);
        goToOnboardingStep(onboardingStep - 1);
      } else if (action === 'skip') {
        goToOnboardingStep(onboardingStep + 1);
      } else if (action === 'next') {
        if (onboardingStep === 3) {
          const bio = $('#bio');
          if (containsContactInfo(bio.value)) {
            bio.setAttribute('aria-invalid', 'true');
            $('#bio-error').innerHTML = `${icon('info')} <span>This looks like contact information. Please remove it to keep your details private.</span>`;
            bio.focus();
            return;
          }
        }
        if (onboardingStep < ONBOARDING_STEPS) {
          readOnboardingStep(onboardingStep);
          goToOnboardingStep(onboardingStep + 1);
        } else {
          finishOnboarding();
        }
      }
    });
  }

  function finishOnboarding() {
    state.profile = {
      name: onboardingData.name,
      vibe: onboardingData.vibe,
      interests: onboardingData.interests.slice(),
      bio: onboardingData.bio
    };
    updateProfileButton();
    showToast('Profile preview ready. It lasts until you refresh the page.');
    goTo('discover');
  }

  /* =====================================================
     8. DISCOVER
     ===================================================== */
  const discover = { index: 0, liked: [], busy: false };

  function buildDiscoverShell() {
    $('#discover-root').innerHTML = `
      <p class="discover-count" id="discover-count"></p>
      <div id="discover-stage"></div>
      <div class="actions" id="discover-actions">
        <button type="button" class="btn btn-action btn-skip" data-discover="skip">${icon('x')} Skip</button>
        <button type="button" class="btn btn-action btn-like" data-discover="like">${icon('heart')} Like</button>
      </div>
      <p class="reaction" id="reaction" role="status" aria-live="polite"></p>`;

    $('#discover-root').addEventListener('click', (event) => {
      const button = event.target.closest('[data-discover]');
      if (button) reactToProfile(button.dataset.discover);
      const toggle = event.target.closest('.details-toggle');
      if (toggle) {
        const open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        $(`#${toggle.getAttribute('aria-controls')}`).hidden = open;
      }
      if (event.target.closest('[data-restart-discover]')) {
        discover.index = 0;
        discover.liked = [];
        $('#reaction').textContent = '';
        renderDiscover();
      }
    });
  }

  function renderDiscover() {
    const stage = $('#discover-stage');
    const actions = $('#discover-actions');
    const total = DATA.profiles.length;

    if (discover.index >= total) {
      actions.hidden = true;
      $('#discover-count').textContent = '';
      const likedNames = discover.liked.map((p) => p.name);
      stage.innerHTML = `
        <div class="empty-state">
          <h2>${escapeHTML(say.discoverEmpty())}</h2>
          <p>${likedNames.length
            ? `You liked ${escapeHTML(likedNames.join(', '))}. In a real VYBE they would never know yet, because this demo has no real people.`
            : 'You skipped everyone. That is allowed.'}</p>
          <div class="cta-row center-row">
            <button type="button" class="btn btn-primary" data-restart-discover>${icon('restart')} Start again</button>
            <a class="btn btn-ghost" href="#/games">Play a game</a>
          </div>
        </div>`;
      return;
    }

    actions.hidden = false;
    $('#discover-count').textContent = `Profile ${discover.index + 1} of ${total}`;
    const p = DATA.profiles[discover.index];
    stage.innerHTML = `
      <article class="profile-card is-entering" id="profile-card" aria-labelledby="pc-name">
        <div class="profile-photo">
          <img src="${avatarDataUri(p.avatar)}" alt="Illustrated placeholder avatar of ${p.name}" width="200" height="240">
          <span class="demo-badge">Demo profile</span>
        </div>
        <div class="profile-body">
          <h2 id="pc-name">${p.name}, ${p.age}</h2>
          <p class="meta">${icon('pin')} ${p.place}</p>
          <p class="bio">${p.bio}</p>
          ${chipsHTML(p.interests)}
          <button type="button" class="details-toggle" aria-expanded="false" aria-controls="pc-details">More about ${p.name} ${icon('chevron-down')}</button>
          <dl class="details" id="pc-details" hidden>
            <div><dt>Looking for</dt><dd>${p.looking}</dd></div>
            <div><dt>Fun fact</dt><dd>${p.funFact}</dd></div>
            <div><dt>Ideal first hangout</dt><dd>${p.firstHangout}</dd></div>
          </dl>
        </div>
      </article>`;
  }

  async function reactToProfile(kind) {
    if (discover.busy || discover.index >= DATA.profiles.length) return;
    discover.busy = true;
    const card = $('#profile-card');
    const profile = DATA.profiles[discover.index];

    if (kind === 'like') {
      discover.liked.push(profile);
      $('#reaction').textContent = say.likes();
    } else {
      $('#reaction').textContent = say.skips();
    }

    card.classList.add(kind === 'like' ? 'leave-like' : 'leave-skip');
    await wait(380);
    discover.index += 1;
    renderDiscover();
    discover.busy = false;
  }

  /* =====================================================
     9. QUIZ ENGINE, DELULU METER AND VYBE CHECK
     ===================================================== */

  /*
    One engine runs both quizzes.
    - questions: array of { q, answers: [{ text, ... }] }
    - buildResult(answers): turns the chosen answer indexes into result-card data
  */
  function createQuiz({ root, questions, buildResult }) {
    let index = 0;
    let answers = [];
    let locked = false;

    function start() {
      index = 0;
      answers = [];
      locked = false;
      renderQuestion(false);
    }

    function renderQuestion(moveFocus) {
      const question = questions[index];
      const total = questions.length;
      root.innerHTML = `
        <div class="quiz-card is-entering">
          <div class="quiz-head">
            <p class="quiz-count">Question ${index + 1} of ${total}</p>
            <div class="progress" role="progressbar" aria-label="Quiz progress" aria-valuemin="1" aria-valuemax="${total}" aria-valuenow="${index + 1}"><span style="width:${((index + 1) / total) * 100}%"></span></div>
          </div>
          <h2 class="quiz-question" id="${root.id}-question-${index}" tabindex="-1">${question.q}</h2>
          <div class="answers" role="group" aria-labelledby="${root.id}-question-${index}">
            ${question.answers.map((answer, i) => `
              <button type="button" class="answer-btn ${answers[index] === i ? 'is-selected' : ''}" data-answer="${i}" aria-pressed="${answers[index] === i}">${answer.text}</button>`).join('')}
          </div>
          <div class="quiz-nav">
            ${index > 0 ? `<button type="button" class="btn btn-ghost btn-sm" data-quiz-back>${icon('arrow-left')} Back</button>` : ''}
          </div>
        </div>`;
      if (moveFocus) $('.quiz-question', root).focus({ preventScroll: true });
    }

    async function choose(button) {
      if (locked) return;
      locked = true;
      answers[index] = Number(button.dataset.answer);
      $$('.answer-btn', root).forEach((b) => { b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false'); });
      button.classList.add('is-selected');
      button.setAttribute('aria-pressed', 'true');
      await wait(260);
      if (index < questions.length - 1) {
        index += 1;
        renderQuestion(true);
      } else {
        renderResultCard(root, buildResult(answers), start);
      }
      locked = false;
    }

    root.addEventListener('click', (event) => {
      const answerButton = event.target.closest('[data-answer]');
      if (answerButton) { choose(answerButton); return; }
      if (event.target.closest('[data-quiz-back]') && index > 0 && !locked) {
        index -= 1;
        renderQuestion(true);
      }
    });

    return { start };
  }

  /*
    Shows a result card. Used by both quizzes and by Ship or Skip's share panel.
    card: { tone, emoji, kicker, title, description, verdict, extraHTML, shareText, restartLabel }
  */
  function renderResultCard(root, card, onRestart) {
    root.innerHTML = `
      <article class="result-card tone-${card.tone} is-entering" aria-labelledby="${root.id}-result-title">
        <span class="result-emoji" aria-hidden="true">${card.emoji}</span>
        <p class="result-kicker">${card.kicker}</p>
        <h2 id="${root.id}-result-title" class="result-title" tabindex="-1">${card.title}</h2>
        ${card.extraHTML || ''}
        <p class="result-desc">${card.description}</p>
        <p class="result-verdict">${card.verdict}</p>
      </article>
      <div class="result-extras"></div>`;
    $('.result-extras', root).append(buildSharePanel(card.shareText));
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'btn btn-primary restart-btn';
    restart.innerHTML = `${icon('restart')} ${card.restartLabel || 'Take it again'}`;
    restart.addEventListener('click', onRestart);
    $('.result-extras', root).append(restart);
    $('.result-title', root).focus({ preventScroll: true });
  }

  /* ---------- DELULU Meter ---------- */
  const deluluQuiz = createQuiz({
    root: $('#delulu-root'),
    questions: DATA.deluluQuestions,
    buildResult(answers) {
      const score = answers.reduce((sum, answerIndex, q) => sum + DATA.deluluQuestions[q].answers[answerIndex].score, 0);
      const result = DATA.deluluResults.find((r) => score <= r.max);
      const segments = DATA.deluluResults.map((r, i) => `<span class="${i < result.level ? 'is-on' : ''}"></span>`).join('');
      return {
        tone: result.tone,
        emoji: result.emoji,
        kicker: `DELULU level ${result.level} of ${DATA.deluluResults.length}`,
        title: result.title,
        extraHTML: `<div class="meter" role="img" aria-label="DELULU level ${result.level} out of ${DATA.deluluResults.length}">${segments}</div>`,
        description: result.description,
        verdict: result.verdict,
        shareText: `I just discovered my DELULU level on VYBE 😂 Apparently I'm "${result.title}". Take the test and show me your result!`
      };
    }
  });

  /* ---------- VYBE Check ---------- */
  const vybeQuiz = createQuiz({
    root: $('#vibecheck-root'),
    questions: DATA.vybeQuestions,
    buildResult(answers) {
      const tally = {};
      answers.forEach((answerIndex, q) => {
        const type = DATA.vybeQuestions[q].answers[answerIndex].type;
        tally[type] = (tally[type] || 0) + 1;
      });
      // Highest score wins; ties go to whichever type comes first in vybeTieOrder.
      const winner = DATA.vybeTieOrder.reduce((best, type) => ((tally[type] || 0) > (tally[best] || 0) ? type : best), DATA.vybeTieOrder[0]);
      const result = DATA.vybeResults[winner];
      return {
        tone: result.tone,
        emoji: result.emoji,
        kicker: 'Your VYBE Check result',
        title: result.title,
        description: result.description,
        verdict: result.verdict,
        shareText: `I just took the VYBE Check and I'm ${result.title} ${result.emoji} Which one are you?`
      };
    }
  });

  /* =====================================================
     10. SHIP OR SKIP
     ===================================================== */

  // Small, fast text hash (FNV-1a with a final scramble) so results look evenly spread.
  function hashString(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 2246822507);
    hash ^= hash >>> 13;
    return hash >>> 0;
  }

  function normaliseName(name) {
    return name.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
  }

  /*
    Same pair, same result, in either order:
    the two names are sorted alphabetically before they are hashed.
  */
  function computeCompatibility(nameA, nameB) {
    const key = [normaliseName(nameA), normaliseName(nameB)].sort().join('|');
    const hash = hashString(key);
    const percent = hash % 101;
    const category = DATA.shipCategories.reduce((found, c) => (percent >= c.min ? c : found), DATA.shipCategories[0]);
    const line = category.lines[(hash >>> 8) % category.lines.length];
    return { percent, category, line };
  }

  function renderShipForm(prefill = { a: '', b: '' }, errorMessage = '') {
    const root = $('#ship-root');
    root.innerHTML = `
      <form class="ship-form" id="ship-form" novalidate>
        <div class="ship-inputs">
          <div class="field">
            <label for="ship-a">First name</label>
            <input id="ship-a" type="text" maxlength="24" autocomplete="off" aria-describedby="ship-error">
          </div>
          <span class="ship-plus" aria-hidden="true">+</span>
          <div class="field">
            <label for="ship-b">Second name</label>
            <input id="ship-b" type="text" maxlength="24" autocomplete="off" aria-describedby="ship-error">
          </div>
        </div>
        <p class="field-error" id="ship-error" aria-live="polite"></p>
        <button type="submit" class="btn btn-primary btn-lg btn-block">Reveal the result</button>
        <p class="fineprint">Entertainment only. This is not a real prediction of anything.</p>
      </form>`;
    const inputA = $('#ship-a');
    const inputB = $('#ship-b');
    inputA.value = prefill.a;
    inputB.value = prefill.b;
    if (errorMessage) $('#ship-error').innerHTML = `${icon('info')} <span>${errorMessage}</span>`;

    $('#ship-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const a = inputA.value.trim();
      const b = inputB.value.trim();
      if (!a || !b) {
        const missing = !a ? inputA : inputB;
        $('#ship-error').innerHTML = `${icon('info')} <span>Enter both names to see the result.</span>`;
        missing.setAttribute('aria-invalid', 'true');
        missing.focus();
        return;
      }
      runShip(a, b);
    });
  }

  async function runShip(nameA, nameB) {
    const root = $('#ship-root');
    root.innerHTML = `
      <div class="ship-loading" role="status">
        <div class="pulse-heart" aria-hidden="true">${icon('heart')}</div>
        <p id="ship-loading-text">${say.shipLoading()}</p>
      </div>`;
    const textEl = $('#ship-loading-text');
    const timer = setInterval(() => { textEl.textContent = say.shipLoading(); }, 900);
    await wait(2600);
    clearInterval(timer);
    renderShipResult(nameA, nameB);
  }

  function renderShipResult(nameA, nameB) {
    const root = $('#ship-root');
    const { percent, category, line } = computeCompatibility(nameA, nameB);
    const circumference = 2 * Math.PI * 52;

    root.innerHTML = `
      <article class="result-card tone-${category.tone} is-entering" aria-labelledby="ship-result-title">
        <p class="ship-names">${escapeHTML(nameA)} <span aria-hidden="true">+</span><span class="sr-only">and</span> ${escapeHTML(nameB)}</p>
        <div class="ring" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle class="ring-track" cx="60" cy="60" r="52"/>
            <circle class="ring-value" cx="60" cy="60" r="52" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}" data-target="${circumference * (1 - percent / 100)}" transform="rotate(-90 60 60)"/>
          </svg>
          <span class="ring-number">${percent}%</span>
        </div>
        <p class="result-kicker">Compatibility: ${percent}%</p>
        <h2 id="ship-result-title" class="result-title" tabindex="-1"><span aria-hidden="true">${category.emoji}</span> ${category.title}</h2>
        <p class="result-desc">${line}</p>
        <p class="result-verdict">For entertainment only. Not a real prediction.</p>
      </article>
      <div class="result-extras"></div>`;

    // Animate the ring after the first paint.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const ring = $('.ring-value', root);
      ring.style.strokeDashoffset = ring.dataset.target;
    }));

    const shareText = `${nameA} + ${nameB} = ${percent}% on VYBE: ${category.title} ${category.emoji} "${line}" (Just for fun!) Try your own pair:`;
    const extras = $('.result-extras', root);
    extras.append(buildSharePanel(shareText));
    const again = document.createElement('button');
    again.type = 'button';
    again.className = 'btn btn-primary restart-btn';
    again.innerHTML = `${icon('restart')} Try another pair`;
    again.addEventListener('click', () => renderShipForm());
    extras.append(again);
    $('.result-title', root).focus({ preventScroll: true });
  }

  /* =====================================================
     11. PROFILE PREVIEW, DIALOG AND START-UP
     ===================================================== */
  function renderProfile() {
    const root = $('#profile-root');
    if (!state.profile) {
      root.innerHTML = `
        <div class="empty-state">
          <h2>No profile preview yet</h2>
          <p>Create a quick demo profile to see how you would look on VYBE. It takes about a minute.</p>
          <div class="cta-row center-row">
            <a class="btn btn-primary" href="#/join">Create a preview</a>
            <a class="btn btn-ghost" href="#/discover">Explore as a guest</a>
          </div>
        </div>`;
      return;
    }
    root.innerHTML = `
      ${previewCardHTML(state.profile)}
      <p class="notice"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-info"></use></svg><span>This is a preview kept in memory. Refresh the page and it is gone. Saving real profiles needs a backend.</span></p>
      <div class="cta-row">
        <button type="button" class="btn btn-primary" id="edit-profile">Edit preview</button>
        <a class="btn btn-ghost" href="#/discover">Back to Discover</a>
      </div>`;
    $('#edit-profile').addEventListener('click', () => {
      onboardingData = { ...state.profile, interests: state.profile.interests.slice() };
      onboardingStep = 1;
      goTo('onboarding');
    });
  }

  function setUpDialog() {
    const dialog = $('#about-dialog');
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-open-about]')) {
        if (typeof dialog.showModal === 'function') dialog.showModal();
        else dialog.setAttribute('open', '');
      }
    });
    // Clicking the dark backdrop closes the dialog.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
  }

  function init() {
    renderHome();
    buildDiscoverShell();
    setUpJoinForm();
    setUpOnboarding();
    setUpDialog();
    updateProfileButton();

    $('#back-to-top').addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    });

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  init();
})();
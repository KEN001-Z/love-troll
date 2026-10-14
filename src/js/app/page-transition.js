const transition = (() => {
  'use strict';

  const storageKey = 'vybe-transition-destination';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const navigation = performance.getEntriesByType('navigation')[0];
  const screen = document.createElement('div');
  screen.className = 'vybe-transition-screen';
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.innerHTML = '<div class="vybe-transition-card"><span class="vybe-transition-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="12" fill="#7357E8" stroke="#211D2B" stroke-width="2.5"/><path d="M11 14l9 14 9-14" fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="10" r="3" fill="#FF6B61"/></svg></span><span class="vybe-transition-name">VYBE</span><span class="vybe-transition-message">Oya, we dey move…</span><span class="vybe-transition-loader" aria-hidden="true"><i></i><i></i><i></i></span></div>';

  let navigationTimer;
  let hideTimer;
  let removeTimer;

  function showScreen() {
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);
    if (!screen.isConnected) document.body.append(screen);
    screen.getBoundingClientRect();
    screen.classList.add('is-visible');
  }

  function hideScreenAfter(delay = 140) {
    window.clearTimeout(hideTimer);
    window.clearTimeout(removeTimer);
    hideTimer = window.setTimeout(() => {
      screen.classList.remove('is-visible');
      removeTimer = window.setTimeout(() => screen.remove(), reducedMotion.matches ? 0 : 260);
    }, delay);
  }

  function markDestination(destination) {
    try {
      window.sessionStorage.setItem(storageKey, `${destination.pathname}|${Date.now()}`);
    } catch (error) {
      console.warn('VYBE could not save the page transition state; showing the outgoing screen only.', error);
    }
  }

  function navigateWithTransition(destination, { replace = false } = {}) {
    const target = new URL(destination, window.location.href);
    if (target.origin !== window.location.origin ||
        !/\.html?$/i.test(target.pathname) ||
        target.pathname === window.location.pathname) {
      throw new Error('VYBE could not navigate to that page.');
    }

    markDestination(target);
    showScreen();
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => {
      if (replace) window.location.replace(target.href);
      else window.location.assign(target.href);
    }, reducedMotion.matches ? 100 : 220);
  }

  window.addEventListener('pageshow', event => {
    if (event.persisted) {
      showScreen();
      hideScreenAfter();
    }
  });

  let storedDestination;
  try {
    storedDestination = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('VYBE could not read the page transition state.', error);
  }

  const [destinationPath, startedAt] = (storedDestination || '').split('|');
  const destinationTime = Number(startedAt);
  const hasRecentDestination = destinationPath === window.location.pathname &&
    Number.isFinite(destinationTime) &&
    Date.now() - destinationTime >= 0 &&
    Date.now() - destinationTime < 10000;

  if (hasRecentDestination || navigation?.type === 'back_forward') {
    showScreen();
    hideScreenAfter(180);
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') || link.target && link.target !== '_self' ||
        link.relList.contains('external')) return;

    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin ||
        destination.pathname === window.location.pathname ||
        destination.hash && destination.pathname === window.location.pathname ||
        !/\.html?$/i.test(destination.pathname)) return;

    event.preventDefault();
    navigateWithTransition(destination);
  });

  return { navigateWithTransition };
})();

export const navigateWithTransition = transition.navigateWithTransition;

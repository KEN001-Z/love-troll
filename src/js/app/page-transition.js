(() => {
  'use strict';

  const storageKey = 'vybe-transition-destination';
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const screen = document.createElement('div');
  screen.className = 'vybe-transition-screen';
  screen.setAttribute('role', 'status');
  screen.setAttribute('aria-live', 'polite');
  screen.innerHTML = '<div class="vybe-transition-card"><span class="vybe-transition-mark" aria-hidden="true"><svg viewBox="0 0 40 40"><rect x="2" y="2" width="36" height="36" rx="12" fill="#7357E8" stroke="#211D2B" stroke-width="2.5"/><path d="M11 14l9 14 9-14" fill="none" stroke="#FFD166" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="31" cy="10" r="3" fill="#FF6B61"/></svg></span><span class="vybe-transition-name">VYBE</span><span class="vybe-transition-message">Oya, we dey move…</span><span class="vybe-transition-loader" aria-hidden="true"><i></i><i></i><i></i></span></div>';

  let navigationTimer;

  function showScreen() {
    document.body.append(screen);
    screen.classList.add('is-visible');
  }

  window.addEventListener('pageshow', event => {
    if (event.persisted) screen.remove();
  });

  let storedDestination;
  try {
    storedDestination = window.sessionStorage.getItem(storageKey);
    window.sessionStorage.removeItem(storageKey);
  } catch (error) {
    console.warn('VYBE could not read the page transition state.', error);
  }

  if (!reducedMotion.matches && storedDestination) {
    const [path, startedAt] = storedDestination.split('|');
    if (path === window.location.pathname && Date.now() - Number(startedAt) < 10000) {
      showScreen();
      window.setTimeout(() => screen.classList.remove('is-visible'), 80);
      window.setTimeout(() => screen.remove(), 360);
    }
  }

  document.addEventListener('click', event => {
    if (reducedMotion.matches || event.defaultPrevented || event.button !== 0 ||
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
    try {
      window.sessionStorage.setItem(storageKey, `${destination.pathname}|${Date.now()}`);
    } catch (error) {
      console.warn('VYBE could not save the page transition state; navigating without it.', error);
      window.location.assign(destination.href);
      return;
    }

    showScreen();
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => {
      window.location.assign(destination.href);
    }, 170);
  });
})();

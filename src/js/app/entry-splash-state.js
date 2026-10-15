(() => {
  'use strict';

  const path = window.location.pathname;
  const isLandingPage = path === '/' || /\/index\.html$/i.test(path);
  const isHomePage = /\/home\.html$/i.test(path);
  const isLoginPage = /\/login\.html$/i.test(path);
  const mobileViewport = window.matchMedia('(max-width: 760px)').matches;
  const installedApp = navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
  const pwaLaunch = installedApp || new URLSearchParams(window.location.search).get('source') === 'pwa';
  const navigation = performance.getEntriesByType('navigation')[0];

  let isPageTransition = navigation?.type === 'back_forward';
  let pendingLaunch = false;
  try {
    const transition = window.sessionStorage.getItem('vybe-transition-destination');
    const [destinationPath, startedAt] = (transition || '').split('|');
    const age = Date.now() - Number(startedAt);
    isPageTransition ||= destinationPath === path &&
      Number.isFinite(age) &&
      age >= 0 &&
      age < 10000;

    if (isLoginPage) {
      const pendingAt = Number(window.sessionStorage.getItem('vybe-mobile-entry-splash-pending'));
      pendingLaunch = Number.isFinite(pendingAt) && Date.now() >= pendingAt && Date.now() - pendingAt < 20000;
      if (pendingAt) window.sessionStorage.removeItem('vybe-mobile-entry-splash-pending');
    }
  } catch (error) {
    console.warn('VYBE could not check the mobile entry splash state.', error);
  }

  const shouldShowSplash = !isPageTransition && (
    isLoginPage
      ? mobileViewport && (pwaLaunch || pendingLaunch)
      : (isLandingPage || isHomePage) && pwaLaunch
  );

  if (shouldShowSplash) {
    document.documentElement.classList.add('show-mobile-entry-splash');
    if (isLandingPage || isHomePage) {
      try {
        window.sessionStorage.setItem('vybe-mobile-entry-splash-pending', String(Date.now()));
      } catch (error) {
        console.warn('VYBE could not preserve the mobile entry splash across sign-in.', error);
      }
    }
  }
})();

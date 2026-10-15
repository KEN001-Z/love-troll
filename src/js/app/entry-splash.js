const splash = document.querySelector('.mobile-entry-splash');

if (document.documentElement.classList.contains('show-mobile-entry-splash')) {
  if (!splash) {
    throw new Error('VYBE mobile entry splash markup is missing.');
  }

  splash.setAttribute('aria-hidden', 'false');
  const pageContent = [...document.body.children]
    .filter(element => element !== splash && element.tagName !== 'SCRIPT');
  const previousInertStates = pageContent.map(element => element.inert);
  pageContent.forEach(element => { element.inert = true; });

  const exitDuration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 650 : 1700;
  const needsSessionCheck = document.body.classList.contains('home-body');
  let exitDelayElapsed = false;
  let sessionCheckComplete = !needsSessionCheck ||
    document.documentElement.classList.contains('home-session-checked');
  let exiting = false;

  const exitSplash = () => {
    if (exiting || !exitDelayElapsed || !sessionCheckComplete) return;
    exiting = true;
    splash.classList.add('is-exiting');
    window.setTimeout(() => {
      document.documentElement.classList.remove('show-mobile-entry-splash');
      splash.remove();
      pageContent.forEach((element, index) => { element.inert = previousInertStates[index]; });
    }, 340);
  };

  if (needsSessionCheck) {
    window.addEventListener('vybe:home-session-checked', () => {
      sessionCheckComplete = true;
      exitSplash();
    }, { once: true });
  }

  window.setTimeout(() => {
    exitDelayElapsed = true;
    exitSplash();
  }, exitDuration);
}

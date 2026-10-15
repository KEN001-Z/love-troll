import '../../css/pwa-update.css';

const UPDATE_CHECK_INTERVAL_MS = 60_000;
const UPDATE_CHECK_TIMEOUT_MS = 8_000;

export function startAppUpdateChecks() {
  let updateAvailable = false;
  let checkInProgress = false;

  const dialog = document.createElement('dialog');
  dialog.className = 'vybes-update-dialog';
  dialog.setAttribute('aria-labelledby', 'vybes-update-title');
  dialog.setAttribute('aria-describedby', 'vybes-update-description');
  dialog.innerHTML = `
    <div class="vybes-update-card">
      <span class="vybes-update-icon" aria-hidden="true">✦</span>
      <p class="vybes-update-kicker">FRESH VYBES</p>
      <h2 id="vybes-update-title">VYBE has been updated!</h2>
      <p id="vybes-update-description">New improvements are ready. Refresh to get the latest version.</p>
      <div class="vybes-update-actions">
        <button class="vybes-update-later" type="button" data-update-later>Later</button>
        <button class="vybes-update-refresh" type="button" data-update-refresh>Refresh now</button>
      </div>
    </div>`;
  document.body.append(dialog);

  const refreshButton = dialog.querySelector('[data-update-refresh]');
  const laterButton = dialog.querySelector('[data-update-later]');

  function showUpdatePrompt() {
    updateAvailable = true;
    if (!dialog.open) dialog.showModal();
  }

  async function checkForUpdate() {
    if (updateAvailable || checkInProgress || document.visibilityState === 'hidden') return;

    checkInProgress = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), UPDATE_CHECK_TIMEOUT_MS);
    try {
      const response = await fetch(`/app-version.json?check=${Date.now()}`, {
        cache: 'no-store',
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`Version check returned HTTP ${response.status}.`);
      }
      const result = await response.json();
      if (!result || typeof result.version !== 'string' || !result.version) {
        throw new Error('Version check returned an invalid app version.');
      }
      if (result.version !== __VYBE_BUILD_ID__) showUpdatePrompt();
    } catch (error) {
      console.error('VYBE could not check whether a newer app version is available.', error);
    } finally {
      window.clearTimeout(timeout);
      checkInProgress = false;
    }
  }

  refreshButton.addEventListener('click', () => {
    window.location.reload();
  });
  laterButton.addEventListener('click', () => dialog.close());
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    dialog.close();
  });
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });

  if (!import.meta.env.DEV) {
    void checkForUpdate();
    window.setInterval(() => void checkForUpdate(), UPDATE_CHECK_INTERVAL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void checkForUpdate();
    });
  }

  return {
    isAvailable: () => updateAvailable,
    isChecking: () => checkInProgress
  };
}

import '../../css/network-status.css';

const CHECK_INTERVAL_MS = 30_000;
const CHECK_TIMEOUT_MS = 5_000;
const SLOW_REQUEST_MS = 1_800;
const ALERTED_SESSION_KEY = 'vybe-poor-network-alerted';
const isHomePage = window.location.pathname.endsWith('/home.html');

const dialog = document.createElement('dialog');
dialog.className = 'network-warning-dialog';
dialog.setAttribute('aria-labelledby', 'network-warning-title');
dialog.setAttribute('aria-describedby', 'network-warning-description');
dialog.innerHTML = `
  <div class="network-warning-card">
    <span class="network-warning-icon" aria-hidden="true">⌁</span>
    <p class="network-warning-eyebrow">CONNECTION CHECK</p>
    <h2 id="network-warning-title">Your internet seems slow</h2>
    <p id="network-warning-description">Some parts of VYBE may take longer to load. Check your connection and try again.</p>
    <div class="network-warning-actions">
      <button class="network-warning-dismiss" type="button" data-network-dismiss>Continue anyway</button>
      <button class="network-warning-retry" type="button" data-network-retry>Try again</button>
    </div>
  </div>`;
document.body.append(dialog);

const retryButton = dialog.querySelector('[data-network-retry]');
const toastRegion = document.createElement('div');
toastRegion.className = 'network-warning-toast-region';
toastRegion.setAttribute('role', 'status');
toastRegion.setAttribute('aria-live', 'polite');
toastRegion.setAttribute('aria-atomic', 'true');
document.body.append(toastRegion);

let currentStatus = null;
let checkInProgress = false;
let toastTimeout;

function hasSlowConnectionHints() {
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!connection) return false;

  return ['slow-2g', '2g'].includes(connection.effectiveType) ||
    (Number.isFinite(connection.rtt) && connection.rtt >= 1_200) ||
    (Number.isFinite(connection.downlink) && connection.downlink <= 0.5);
}

function wasAlertedThisSession() {
  try {
    return sessionStorage.getItem(ALERTED_SESSION_KEY) === 'true';
  } catch (error) {
    console.warn('VYBE could not read the network warning session state.', error);
    return false;
  }
}

function setAlertedThisSession(alerted) {
  try {
    if (alerted) {
      sessionStorage.setItem(ALERTED_SESSION_KEY, 'true');
    } else {
      sessionStorage.removeItem(ALERTED_SESSION_KEY);
    }
  } catch (error) {
    console.warn('VYBE could not save the network warning session state.', error);
  }
}

function showToast(message) {
  window.clearTimeout(toastTimeout);
  toastRegion.replaceChildren();

  const toast = document.createElement('div');
  toast.className = 'network-warning-toast';
  const text = document.createElement('span');
  text.textContent = message;
  const closeButton = document.createElement('button');
  closeButton.className = 'network-warning-toast-close';
  closeButton.type = 'button';
  closeButton.setAttribute('aria-label', 'Dismiss connection message');
  closeButton.textContent = '×';
  closeButton.addEventListener('click', () => toastRegion.replaceChildren());
  toast.append(text, closeButton);
  toastRegion.append(toast);

  toastTimeout = window.setTimeout(() => toastRegion.replaceChildren(), 7_000);
}

function showInitialWarning() {
  setAlertedThisSession(true);
  if (isHomePage) {
    showToast('Poor internet connection. Some things may take longer to load.');
  } else if (!dialog.open) {
    dialog.showModal();
  }
}

function updateStatus(isPoor) {
  if (isPoor === currentStatus) return;

  const wasPoor = currentStatus;
  currentStatus = isPoor;
  if (isPoor) {
    if (!wasAlertedThisSession()) {
      showInitialWarning();
    } else if (wasPoor === false) {
      showToast('Poor internet connection. Some things may take longer to load.');
    }
    return;
  }

  setAlertedThisSession(false);
  if (dialog.open) dialog.close();
  if (wasPoor) showToast('Your connection is back. You’re good to go.');
}

async function checkConnection() {
  if (checkInProgress || document.visibilityState === 'hidden') return;
  checkInProgress = true;

  if (!navigator.onLine || hasSlowConnectionHints()) {
    updateStatus(true);
    checkInProgress = false;
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  const startedAt = performance.now();
  try {
    await fetch(`/app-version.json?network-check=${Date.now()}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    updateStatus(performance.now() - startedAt >= SLOW_REQUEST_MS);
  } catch {
    updateStatus(true);
  } finally {
    window.clearTimeout(timeout);
    checkInProgress = false;
  }
}

dialog.querySelector('[data-network-dismiss]').addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  dialog.close();
});
retryButton.addEventListener('click', () => {
  retryButton.disabled = true;
  void checkConnection().finally(() => { retryButton.disabled = false; });
});

window.addEventListener('online', () => void checkConnection());
window.addEventListener('offline', () => updateStatus(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') void checkConnection();
});

const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
connection?.addEventListener('change', () => void checkConnection());

void checkConnection();
window.setInterval(() => void checkConnection(), CHECK_INTERVAL_MS);

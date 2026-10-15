import '../../css/pwa-install.css';
import { startAppUpdateChecks } from './pwa-update.js';

const DISMISSAL_KEY = 'vybes-install-snoozed-until';
const INSTALLED_KEY = 'vybes-install-completed';
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const AUTO_PROMPT_DELAY_MS = 5000;
const appUpdates = startAppUpdateChecks();
const pageStartedAt = Date.now();
const isInAppBrowser = /Instagram|FBAN|FBAV|FB_IAB|TikTok|Line\/|Snapchat/i.test(navigator.userAgent);
const ua = navigator.userAgent;
const autoPromptPaths = new Set([
  '/',
  '/index.html',
  '/home.html',
  '/vibe.html',
  '/people.html',
  '/community.html',
  '/messages.html',
  '/profile.html',
  '/crush.html'
]);
const isIOS = /iPad|iPhone|iPod/.test(ua) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafariIOS = isIOS && /Version\/[\d.]+.*Safari\//i.test(ua) &&
  !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA\/|Brave|YaBrowser/i.test(ua) && !isInAppBrowser;
const isAndroid = /Android/i.test(ua);
const isStandalone = () => navigator.standalone === true ||
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches;
let deferredInstallPrompt = null;
let autoPromptShown = false;
let storageWarningShown = false;
let currentDialogMode = 'info';

function storageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    warnStorage(error);
    return null;
  }
}

function storageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    warnStorage(error);
  }
}

function warnStorage(error) {
  if (storageWarningShown) return;
  storageWarningShown = true;
  console.warn('VYBES could not save the installation preference in this browser.', error);
}

function hasSnooze() {
  const until = Number(storageGet(DISMISSAL_KEY));
  return Number.isFinite(until) && until > Date.now();
}

function rememberDismissal() {
  storageSet(DISMISSAL_KEY, String(Date.now() + SNOOZE_MS));
}

function markInstalled() {
  storageSet(INSTALLED_KEY, 'true');
  storageSet(DISMISSAL_KEY, String(Number.MAX_SAFE_INTEGER));
  deferredInstallPrompt = null;
  installButton?.setAttribute('hidden', '');
}

function detectInAppBrowser() {
  return isInAppBrowser;
}

function browserGuidance() {
  if (detectInAppBrowser()) {
    return {
      title: 'Open VYBES in your browser',
      intro: 'This in-app browser does not offer a reliable home-screen install option.',
      steps: [
        'Open this page in Safari on iPhone or iPad, or in Chrome on Android.',
        'Use the browser’s Share or menu button and choose Add to Home Screen or Install app if it appears.'
      ],
      share: isIOS
    };
  }

  if (isIOS) {
    return {
      title: 'Get VYBES on your home screen 📲',
      intro: 'To add VYBES from this browser, open this page in Safari first.',
      steps: [
        'In Safari, tap the Share button at the bottom of the screen.',
        'Scroll the share sheet and select Add to Home Screen.',
        'Tap Add at the top to finish. VYBES will open in its own app window.'
      ],
      share: true
    };
  }

  if (isAndroid) {
    if (/SamsungBrowser/i.test(ua)) {
      return {
        title: 'Keep VYBES close',
        intro: 'Samsung Internet may offer a home-screen shortcut or an app install.',
        steps: [
          'Open the browser menu (☰ or ⋮).',
          'Choose Add page to, then Home screen. If Install app is shown instead, you can choose that.',
          'Confirm Add. If neither option appears, this browser may not offer app installation for VYBES.'
        ]
      };
    }
    if (/EdgA/i.test(ua)) {
      return {
        title: 'Keep VYBES close',
        intro: 'Check whether Microsoft Edge offers an install option for this page.',
        steps: [
          'Open the Edge menu (⋯).',
          'Choose Add to phone or Install app if that option is shown.',
          'Confirm the browser’s prompt. If there is no install option, try Chrome or Samsung Internet.'
        ]
      };
    }
    if (/Firefox/i.test(ua)) {
      return {
        title: 'Keep VYBES close',
        intro: 'Firefox may add a shortcut rather than install VYBES as a standalone app.',
        steps: [
          'Open the Firefox menu (⋮) and look for Add to Home screen.',
          'If you want the standalone app experience and that option is missing, open VYBES in Chrome or Samsung Internet and look for Install app or Add to Home screen.'
        ]
      };
    }
    if (/Chrome|Chromium/i.test(ua)) {
      return {
        title: 'Keep VYBES close',
        intro: 'Your browser may offer installation from its page menu.',
        steps: [
          'Open Chrome’s menu (⋮).',
          'Choose Install app or Add to Home screen if either option is shown.',
          'Confirm the browser’s prompt. If neither option appears, Chrome has not made installation available for this visit yet.'
        ]
      };
    }
    return {
      title: 'Keep VYBES close',
      intro: 'This browser has not shared a one-tap install option with VYBES.',
      steps: [
        'Open the browser menu and look for Install app or Add to Home screen.',
        'Only continue if your browser offers one of those options. Otherwise, try Chrome or Samsung Internet.'
      ]
    };
  }

  if (/Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR/i.test(ua) && /Macintosh/i.test(ua)) {
    return {
      title: 'Add VYBES to your Dock',
      intro: 'Recent Safari on macOS can add a website as a web app.',
      steps: [
        'In Safari, choose File > Add to Dock.',
        'Choose a name and select Add. If this option is not available, your Safari version does not support web apps.'
      ]
    };
  }
  if (/Edg/i.test(ua)) {
    return {
      title: 'Install VYBES on this device',
      intro: 'Check whether Microsoft Edge offers an install option for this page.',
      steps: [
        'Open the Edge menu (⋯) and choose Apps.',
        'Select Install this site as an app if it is shown.',
        'If there is no install option, Edge has not made installation available for this visit.'
      ]
    };
  }
  if (/Chrome|Chromium/i.test(ua)) {
    return {
      title: 'Install VYBES on this device',
      intro: 'Chrome may offer installation from the address bar or page menu.',
      steps: [
        'Look for the install icon in the address bar, or open Chrome’s menu (⋮).',
        'Choose Install VYBES or Install page as app if it is shown.',
        'If neither option appears, Chrome has not made installation available for this visit yet.'
      ]
    };
  }
  return {
    title: 'Install VYBES on this device',
    intro: 'This browser has not shared a one-tap install option with VYBES.',
    steps: [
      'Check the browser menu or address bar for Install VYBES or Install this site as an app.',
      'If no install option is shown, your browser may not support installing this web app. Chrome or Edge may offer it instead.'
    ]
  };
}

const dialog = document.createElement('dialog');
dialog.className = 'vybes-install-dialog';
dialog.setAttribute('aria-labelledby', 'vybes-install-title');
dialog.setAttribute('aria-describedby', 'vybes-install-description');
dialog.innerHTML = `
  <div class="vybes-install-card">
    <div class="vybes-install-topline">
      <span class="vybes-install-brand">
        <img src="/img/vybes-icon.svg" alt="" width="42" height="42">
        <span>VYBES</span>
      </span>
      <button class="vybes-install-close" type="button" data-install-close aria-label="Close installation help">×</button>
    </div>
    <p class="vybes-install-kicker" data-install-kicker>YOUR PEOPLE, ONE TAP AWAY</p>
    <h2 id="vybes-install-title" data-install-title>VYBES hits different when it’s on your home screen 👀</h2>
    <p id="vybes-install-description" class="vybes-install-description" data-install-description>Install VYBES for quicker access to your people, messages, matches and the latest gist.</p>
    <div class="vybes-install-guide" data-install-guide hidden>
      <div class="vybes-install-share" data-install-share hidden>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>
        <span>Safari Share button</span>
      </div>
      <ol class="vybes-install-steps" data-install-steps></ol>
    </div>
    <div class="vybes-install-actions">
      <button class="vybes-install-later" type="button" data-install-later>Maybe later</button>
      <button class="vybes-install-primary" type="button" data-install-primary>Install VYBES</button>
    </div>
    <p class="vybes-install-footnote">No pressure. You can keep using VYBES in your browser.</p>
  </div>`;
document.body.append(dialog);

const title = dialog.querySelector('[data-install-title]');
const description = dialog.querySelector('[data-install-description]');
const guide = dialog.querySelector('[data-install-guide]');
const shareTip = dialog.querySelector('[data-install-share]');
const steps = dialog.querySelector('[data-install-steps]');
const primaryButton = dialog.querySelector('[data-install-primary]');
const laterButton = dialog.querySelector('[data-install-later]');
const installButton = document.querySelector('[data-vybes-install-open]');
const closeButton = dialog.querySelector('[data-install-close]');

function closeDialog() {
  if (dialog.open) dialog.close();
}

function showGuide(info) {
  title.textContent = info.title;
  description.textContent = info.intro;
  guide.hidden = false;
  shareTip.hidden = !info.share;
  steps.replaceChildren(...info.steps.map(step => {
    const item = document.createElement('li');
    item.textContent = step;
    return item;
  }));
  primaryButton.textContent = 'Got it';
  currentDialogMode = 'guide';
}

function showInstallInvite() {
  title.textContent = 'VYBES hits different when it’s on your home screen 👀';
  description.textContent = 'Install VYBES for quicker access to your people, messages, matches and the latest gist.';
  guide.hidden = true;
  primaryButton.textContent = 'Install VYBES';
  currentDialogMode = 'native';
}

function openDialog() {
  if (isStandalone() || dialog.open) return;
  laterButton.hidden = false;
  if (deferredInstallPrompt) {
    showInstallInvite();
  } else if (isSafariIOS) {
    showGuide({
      title: 'Get VYBES on your home screen 📲',
      intro: 'A few quick taps and VYBES will be right there with your other apps.',
      steps: [
        'Tap the Share button in Safari.',
        'Select Add to Home Screen.',
        'Tap Add at the top to finish installing VYBES.'
      ],
      share: true
    });
  } else {
    showGuide(browserGuidance());
  }
  dialog.showModal();
}

function showInstallResult(message, installed = false) {
  title.textContent = installed ? 'You’re all set with VYBES ✨' : 'No worries at all';
  description.textContent = message;
  guide.hidden = true;
  laterButton.hidden = true;
  primaryButton.textContent = 'Got it';
  currentDialogMode = 'result';
  if (!dialog.open) dialog.showModal();
}

function maybeShowAutomaticPrompt() {
  if (autoPromptShown || isStandalone() || hasSnooze()) return;
  if (!autoPromptPaths.has(window.location.pathname)) return;
  if (appUpdates.isAvailable() || appUpdates.isChecking()) {
    window.setTimeout(maybeShowAutomaticPrompt, 500);
    return;
  }
  const delayRemaining = AUTO_PROMPT_DELAY_MS - (Date.now() - pageStartedAt);
  if (delayRemaining > 0) {
    window.setTimeout(maybeShowAutomaticPrompt, delayRemaining);
    return;
  }
  autoPromptShown = true;
  openDialog();
}

async function requestNativeInstall() {
  if (!deferredInstallPrompt) {
    showGuide(browserGuidance());
    return;
  }

  const installEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  primaryButton.disabled = true;
  try {
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    primaryButton.disabled = false;
    if (choice?.outcome === 'accepted') {
      rememberDismissal();
      title.textContent = 'One more step with your browser';
      description.textContent = 'Your browser accepted the request. Follow any final steps it shows to finish adding VYBES.';
      guide.hidden = true;
      laterButton.hidden = true;
      primaryButton.textContent = 'Done';
      currentDialogMode = 'result';
      return;
    }
    rememberDismissal();
    showInstallResult('VYBES is still here in your browser whenever you’re ready.');
  } catch (error) {
    primaryButton.disabled = false;
    console.error('VYBES could not open the browser installation prompt.', error);
    showInstallResult('Your browser could not open its install prompt just now. You can try again from your browser menu.');
  }
}

function dismissPrompt() {
  rememberDismissal();
  closeDialog();
}

primaryButton.addEventListener('click', () => {
  if (currentDialogMode === 'native') {
    void requestNativeInstall();
    return;
  }
  closeDialog();
});
laterButton.addEventListener('click', dismissPrompt);
closeButton.addEventListener('click', dismissPrompt);
dialog.addEventListener('cancel', event => {
  event.preventDefault();
  dismissPrompt();
});
dialog.addEventListener('click', event => {
  if (event.target === dialog) dismissPrompt();
});
installButton?.addEventListener('click', () => openDialog());

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (dialog.open && currentDialogMode === 'guide') {
    showInstallInvite();
  } else {
    maybeShowAutomaticPrompt();
  }
});
window.addEventListener('appinstalled', () => {
  markInstalled();
  if (dialog.open) {
    showInstallResult('VYBES has been added to your home screen. Open the app icon any time to jump back in.', true);
  }
});
window.addEventListener('pageshow', () => {
  if (isStandalone()) markInstalled();
});
window.matchMedia('(display-mode: standalone)').addEventListener?.('change', event => {
  if (event.matches) markInstalled();
});

if (isStandalone() || storageGet(INSTALLED_KEY) === 'true') {
  markInstalled();
} else {
  installButton?.removeAttribute('hidden');
  window.setTimeout(maybeShowAutomaticPrompt, AUTO_PROMPT_DELAY_MS);
}

if ('serviceWorker' in navigator) {
  if (!window.isSecureContext) {
    console.warn('VYBES push notifications and app installation require HTTPS (localhost is allowed for development).');
  } else {
    navigator.serviceWorker.register('/service-worker.js', { scope: '/', updateViaCache: 'none' })
      .catch(error => console.error('VYBES could not register its existing push-notification service worker.', error));
  }
}

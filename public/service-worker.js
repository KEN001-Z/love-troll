const APP_ICON = '/img/vybes-icon.svg';
const APP_BADGE = '/img/vybes-icon.svg';
const HOME_URL = new URL('/home.html', self.location.origin).href;
const ALLOWED_PAGES = new Set([
  '/home.html',
  '/messages.html',
  '/profile.html',
  '/people.html',
  '/community.html',
  '/crush.html',
  '/vibe.html',
  '/notification-settings.html'
]);

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  event.waitUntil(showPushNotification(event));
});

async function showPushNotification(event) {
  let payload = {};
  try {
    const parsed = event.data?.json();
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) payload = parsed;
  } catch {
    payload = {};
  }

  const title = safeText(payload.title, 90) || 'A little VYBES update';
  const body = safeText(payload.body, 180) || 'There’s new activity waiting for you on VYBES.';
  const target = safeDestination(payload.url);
  const timestamp = Number.isFinite(payload.timestamp) ? payload.timestamp : Date.now();
  const tag = /^[a-zA-Z0-9:_-]{1,100}$/.test(payload.tag || '')
    ? payload.tag
    : `vybes:${timestamp}`;

  await self.registration.showNotification(title, {
    body,
    icon: safeIcon(payload.icon),
    badge: APP_BADGE,
    tag,
    renotify: false,
    timestamp,
    silent: false,
    data: { url: target }
  });
}

function safeIcon(value) {
  if (typeof value !== 'string' || value.length > 2048) return APP_ICON;
  try {
    const icon = new URL(value);
    if (icon.protocol !== 'https:' || icon.username || icon.password) return APP_ICON;
    return icon.href;
  } catch {
    return APP_ICON;
  }
}

function safeText(value, limit) {
  return typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) : '';
}

function safeDestination(value) {
  if (typeof value !== 'string' || value.length > 2048) return HOME_URL;
  try {
    const target = new URL(value, self.location.origin);
    if (target.origin !== self.location.origin || !ALLOWED_PAGES.has(target.pathname)) return HOME_URL;
    return target.href;
  } catch {
    return HOME_URL;
  }
}

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(openDestination(event.notification.data?.url));
});

async function openDestination(value) {
  const target = safeDestination(value);
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    if (client.url === target) return client.focus();
  }

  const appClient = clients.find(client => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });
  if (appClient) {
    const navigated = await appClient.navigate(target);
    if (navigated) return navigated.focus();
  }
  return self.clients.openWindow(target);
}

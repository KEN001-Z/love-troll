import { getAuthenticatedUser, getSupabaseClient, signOutCurrentSession } from './supabase-client.js';

const status = document.querySelector('[data-community-status]');
const logoutButton = document.querySelector('[data-logout]');
let supabase;

function setStatus(message, state = 'error') {
  status.textContent = message;
  status.dataset.state = state;
  status.hidden = !message;
}

async function initialize() {
  try {
    supabase = getSupabaseClient();
    const { user, recovered } = await getAuthenticatedUser(supabase);
    if (!user) {
      window.location.replace(recovered ? 'login.html?session=expired' : 'login.html');
      return;
    }
  } catch (error) {
    setStatus(`We couldn’t open Community: ${error.message || 'Please try again.'}`);
  }

  logoutButton.addEventListener('click', async () => {
    logoutButton.disabled = true;
    try {
      const { warning } = await signOutCurrentSession(supabase);
      window.location.assign(warning ? 'index.html?logout=unconfirmed' : 'index.html');
    } catch (error) {
      setStatus(`We couldn’t log you out: ${error.message || 'Please try again.'}`);
      logoutButton.disabled = false;
    }
  });
}

initialize();

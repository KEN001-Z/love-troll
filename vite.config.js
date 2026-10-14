import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = name => fileURLToPath(new URL(name, import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        index: page('./index.html'),
        login: page('./login.html'),
        signup: page('./signup.html'),
        reset: page('./reset.html'),
        onboarding: page('./onboarding.html'),
        home: page('./home.html'),
        vibe: page('./vibe.html'),
        people: page('./people.html'),
        crush: page('./crush.html'),
        community: page('./community.html'),
        messages: page('./messages.html'),
        profile: page('./profile.html')
      }
    }
  }
});

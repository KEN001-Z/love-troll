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
        profile: page('./profile.html')
      }
    }
  }
});

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const page = name => fileURLToPath(new URL(name, import.meta.url));
const appBuildId = new Date().toISOString();

export default defineConfig({
  define: {
    __VYBE_BUILD_ID__: JSON.stringify(appBuildId)
  },
  plugins: [{
    name: 'vybe-app-version',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'app-version.json',
        source: JSON.stringify({ version: appBuildId })
      });
    }
  }],
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

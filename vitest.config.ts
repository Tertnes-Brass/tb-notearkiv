import { defineConfig } from 'vitest/config'

// Egen Vitest-konfig. Cloudflare Vite-pluginen i vite.config er ikke kompatibel
// med Vitest sitt oppsett, så enhetstestene (ren TS, ingen Worker-runtime)
// kjøres i node uten app-pluginene.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})

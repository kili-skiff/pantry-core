/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // WSL2 + Windows drive (/mnt/c/...): native filesystem events arrive
      // unreliably there, so poll actively instead of relying on them.
      usePolling: true,
    },
  },
  test: {
    environment: 'jsdom',
    // jsdom only wires up localStorage for a real origin, not the default
    // about:blank - App.tsx reads localStorage on mount for the theme.
    environmentOptions: { jsdom: { url: 'http://localhost' } },
    setupFiles: './src/setupTests.ts',
  },
})

/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      // WSL2 + Windows-Laufwerk (/mnt/c/...): native Dateisystem-Events
      // kommen unzuverlässig an, deshalb aktiv pollen statt darauf zu warten.
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

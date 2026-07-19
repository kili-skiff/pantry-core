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
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'


// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

// Proxy toutes les requêtes /api vers le backend Node.js (port 3000)
  server: {
    // Les mocks MSW importent les fixtures partagées (../fixtures), hors du dossier frontend
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      // Routes IA montées hors de /api côté backend (src/app.js)
      '/search': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/recommendations': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/events': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})

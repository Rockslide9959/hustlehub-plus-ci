import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Forward any request starting with /api to the Express backend,
      // so the browser never makes cross-origin (CORS) requests in development.
      '/api': {
        target: 'https://localhost:4000',
        changeOrigin: true,
        // The API uses a self-signed development certificate, so the proxy
        // must accept it. The connection is still encrypted.
        // Never use secure: false in production.
        secure: false,
      },
    },
  },
})
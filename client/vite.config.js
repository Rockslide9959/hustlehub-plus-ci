import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Security headers for the production preview server (npm run preview, which
// the Playwright tests use). Same policy as client/nginx.conf, which serves the
// app in Docker. Not applied to the dev server (npm run dev): Vite's hot reload
// injects inline scripts there, which a strict policy would block.
const securityHeaders = {
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    headers: securityHeaders,
  },
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
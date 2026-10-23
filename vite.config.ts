import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Where the API server listens in development (see server/ and .env.example).
const apiTarget = process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;

export default defineConfig({
  // Sub-path for static hosting, e.g. BASE_PATH=/baktana-english/ on GitHub Pages.
  base: process.env.BASE_PATH ?? '/',
  plugins: [react()],
  server: {
    // The web app calls relative /api URLs; in dev they go to the Express server.
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    // The server runs its own tests (npm --prefix server test).
    exclude: ['**/node_modules/**', '**/dist/**', 'server/**', 'tools/**', '.claude/**', 'e2e/**'],
  },
});

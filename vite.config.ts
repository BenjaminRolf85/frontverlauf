/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

// "npm run dev:https" startet einen HTTPS-Server im lokalen Netz (WebXR braucht HTTPS).
// "npm run dev:https" starts an HTTPS server on the local network (WebXR requires HTTPS).
export default defineConfig(({ mode }) => ({
  base: './',
  plugins: mode === 'https' ? [basicSsl()] : [],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));

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
    // Nur auf dem Prototyp-Zweig: die Vergleichsseiten der drei Modellvorschlaege mitbauen, damit die Vorschau sie zeigt
    // prototype branch only: also build the comparison pages of the three model proposals so the preview serves them
    rollupOptions: {
      input: {
        main: 'index.html',
        proto: 'preview/proto.html',
        protoA: 'preview/proto-a.html',
        protoB: 'preview/proto-b.html',
        protoC: 'preview/proto-c.html',
      },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
}));

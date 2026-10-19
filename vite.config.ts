/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Shown in Settings → This deployment, so a release can be checked against the merged commit.
  define: {
    __APP_COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)),
    // True only in Vercel builds (Vercel sets VERCEL=1); gates Vercel Analytics.
    __ON_VERCEL__: JSON.stringify(process.env.VERCEL === '1'),
  },
  server: { port: 5173, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/@supabase/')) return 'supabase'
          if (id.includes('node_modules/react') || id.includes('node_modules/@remix-run/')) return 'react-vendor'
        },
      },
    },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})


import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET || 'http://127.0.0.1:4000'

  return {
    plugins: [react()],
    server: {
      host: true,
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
          rewrite: (requestPath) => requestPath.replace(/^\/api/, ''),
        },
        // Do not proxy bare `/admin` — that is the React Router path; refreshing must hit the SPA.
        // Only proxy this API route (backend: POST /admin/bulk-sync-curriculum).
        '/admin/bulk-sync-curriculum': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/uploads': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/auth': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/profiles': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/permit-activity': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/support-contacts': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/support-requests': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/system-settings': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/admin-activity-logs': {
          target: devProxyTarget,
          changeOrigin: true,
        },
        '/profiles-trash': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/xlsx')) {
              return 'xlsx'
            }

            return undefined
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: true,
      globals: true,
      include: ['src/**/*.test.{ts,tsx}'],
      exclude: ['node_modules/**', 'e2e/**', 'playwright.config.ts'],
      define: {
        'import.meta.env': JSON.stringify({
          DEV: true,
          VITE_API_BASE_URL: '',
          MODE: 'test',
          BASE_URL: '/',
          PROD: false,
        }),
      },
    },
  }
})

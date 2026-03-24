
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
    },
  }
})
  
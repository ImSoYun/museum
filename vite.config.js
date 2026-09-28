import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  plugins: [react()],

  // GitHub Pages
  base: '/museum/',

  server: {
    host: true,

    port: Number(process.env.PORT) || 5173,

    watch: {
      usePolling: true,
    },

    proxy: {
      '/api': {
        target:
          process.env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',

    exclude: [
      ...configDefaults.exclude,
      'e2e/**',
      'src/pages/results/serverOutputKinds.test.js',
    ],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**'],
    },
  },
})
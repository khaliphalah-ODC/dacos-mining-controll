import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath } from 'node:url'
export default defineConfig({
  plugins: [vue()],
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['backend/tests/**/*.test.js', 'frontend/tests/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
})

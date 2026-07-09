import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '~': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    // build/ содержит устаревшие компиляты тестов из dev-сборки: их запуск
    // даёт ложные падения при фильтрации по пути.
    exclude: ['**/node_modules/**', '**/build/**'],
  },
})

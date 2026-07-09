import path from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Renderer-модули транзитивно импортируют .vue (например, useSonner →
  // Sonner.vue): без vue-плагина такие тесты падают на import analysis.
  plugins: [vue()],
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

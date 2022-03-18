import path from 'path'
import vuePlugin from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'
/**
 * https://vitejs.dev/config
 */
export default defineConfig({
  root: path.resolve(__dirname, '../../src/renderer'),
  publicDir: 'public',
  server: {
    port: 8080,
    open: false
  },
  build: {
    outDir: path.resolve(__dirname, '../renderer'),
    emptyOutDir: true
  },
  plugins: [vuePlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../src/renderer')
    }
  }
})

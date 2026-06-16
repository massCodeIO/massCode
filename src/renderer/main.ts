import { createApp } from 'vue'
import VueVirtualScroller from 'vue-virtual-scroller'
import App from './App.vue'
import { router } from './router'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import './styles.css'

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[]
  }
}

// Excalidraw fonts are copied to the renderer build root (see
// vite.config.mjs). Set globally before any chunk loads Excalidraw —
// both the drawings space and note embeds. An absolute URL is required:
// relative paths are resolved against window.location.origin, which is
// unusable for file:// in production.
window.EXCALIDRAW_ASSET_PATH = new URL('./', window.location.href).toString()

createApp(App).use(router).use(VueVirtualScroller).mount('#app')

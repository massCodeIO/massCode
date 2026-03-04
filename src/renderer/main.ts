import { createApp } from 'vue'
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar'
import VueVirtualScroller from 'vue-virtual-scroller'
import App from './App.vue'
import { router } from './router'
import './styles.css'
import '@/assets/css/vendor.css'
import 'vue3-perfect-scrollbar/style.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

createApp(App)
  .use(router)
  .use(PerfectScrollbarPlugin)
  .use(VueVirtualScroller)
  .mount('#app')

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import PerfectScrollbar from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/dist/vue3-perfect-scrollbar.css'
import 'vercel-toast/dist/vercel-toast.css'
import './assets/scss/main.scss'
import FloatingVue from 'floating-vue'
import 'floating-vue/dist/style.css'
import '@/components/ui/folder-icons/icons'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PerfectScrollbar)
  .use(FloatingVue)
  .mount('#app')

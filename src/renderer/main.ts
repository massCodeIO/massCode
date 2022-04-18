import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import PerfectScrollbar from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/dist/vue3-perfect-scrollbar.css'
import 'vercel-toast/dist/vercel-toast.css'
import './assets/scss/main.scss'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PerfectScrollbar)
  .mount('#app')

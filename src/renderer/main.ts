import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/scss/main.scss'
import PerfectScrollbar from 'vue3-perfect-scrollbar'
import 'vue3-perfect-scrollbar/dist/vue3-perfect-scrollbar.css'

createApp(App)
  .use(createPinia())
  .use(router)
  .use(PerfectScrollbar)
  .mount('#app')

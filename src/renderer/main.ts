import { createApp } from 'vue'
import { PerfectScrollbarPlugin } from 'vue3-perfect-scrollbar'
import App from './App.vue'
import { router } from './router'
import './styles.css'
import '@/assets/css/vendor.css'
import 'vue3-perfect-scrollbar/style.css'

createApp(App).use(router).use(PerfectScrollbarPlugin).mount('#app')

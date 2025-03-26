import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import './styles.css'
import '@/assets/css/vendor.css'

createApp(App).use(router).mount('#app')

import { createApp } from 'vue'
import router from './router'
import App from './App.vue'
import './assets/scss/main.scss'

createApp(App).use(router).mount('#app')

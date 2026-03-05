import { createApp } from 'vue'
import VueVirtualScroller from 'vue-virtual-scroller'
import App from './App.vue'
import { router } from './router'
import './styles.css'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

createApp(App).use(router).use(VueVirtualScroller).mount('#app')

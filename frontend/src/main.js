import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router.js'
import App from './App.vue'
import './styles.css'
import './stitch.css'
createApp(App).use(createPinia()).use(router).mount('#app')

import './reference-design.css'
import './reference-responsive.css'

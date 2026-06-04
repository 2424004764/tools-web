import { createApp } from 'vue'
import App from './App.vue'
//vite-plugin-svg-icons
import 'virtual:svg-icons-register'
//router
import router from './router'
//styles
import './styles/tailwind.css'
import './styles/loading.css'
//pinia
import pinia from './store'
import { initializeAIProviders } from './spi/init'

const app = createApp(App)
app.use(pinia)
app.use(router)
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

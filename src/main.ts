import { createApp } from 'vue'
import App from './App.vue'
import ElementPlus from 'element-plus';
//@ts-ignore忽略当前文件ts类型的检测否则有红色提示(打包会失败)
//入口文件main.ts全局安装element-plus,element-plus默认支持语言英语设置为中文
import zhCn from 'element-plus/dist/locale/zh-cn.mjs'
//vite-plugin-svg-icons
import 'virtual:svg-icons-register'
//router
import router from './router'
//styles
import './styles/tailwind.css'
import './styles/loading.css'
//element-plus css
import 'element-plus/dist/index.css'
//pinia
import pinia from './store'
//v-md-editor
import { setupMdEditor } from './plugins/v-md-editor'
//default-passive-events
import 'default-passive-events'
// v-viewer
import 'viewerjs/dist/viewer.css'
import VueViewer from 'v-viewer'
import { initializeAIProviders } from './spi/init'

const app = createApp(App)
//安装仓库
app.use(pinia)
//安装路由
app.use(router)
//安装element-plus插件
app.use(ElementPlus, {
  locale: zhCn,//element-plus国际化配置
})
//安装v-md-editor
setupMdEditor(app)
// 安装 v-viewer
app.use(VueViewer)
//挂载应用
app.mount('#app')

// 延迟初始化AI提供者（不阻塞应用启动）
setTimeout(() => {
  initializeAIProviders()
}, 1000)

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
//element-plus css
import 'element-plus/dist/index.css'
//pinia
import pinia from './store'
//v-md-editor
import { setupMdEditor } from './plugins/v-md-editor'
//default-passive-events
import 'default-passive-events'
import { initializeAIProviders } from './spi/init'

// 初始化AI提供者
initializeAIProviders()

const app = createApp(App)
//安装仓库
app.use(pinia)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn
})
// 新增：放在 app.use(router) 之后、app.mount 之前
router.afterEach((to) => {
  const base = (import.meta.env.VITE_SITE_URL as string) || window.location.origin;
  const href = `${base.replace(/\/$/, '')}${to.fullPath}`;
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  if (link.href !== href) link.setAttribute('href', href);

  // 新增：与 canonical 一起设置
  let meta = document.querySelector('meta[property="og:url"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute('property', 'og:url');
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', href); // href 为该页完整绝对地址
});
setupMdEditor(app)
app.mount('#app')

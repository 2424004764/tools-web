/// <reference types="vite/client" />
/// <reference types="unplugin-icons/types/vue3" />

// 让 .vue 文件可以解析为 Vue 组件（vue-tsc 需要）
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// unplugin-icons 自动导入的图标模块（~icons/<collection>/<icon>）
declare module '~icons/*' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

// build 时由 vite.config.ts 的 define 注入。
// dev 模式为空串；prod 模式为 UTC ISO 与本地 YYYY-MM-DD HH:mm:ss。
declare const __BUILD_TIME__: string
declare const __BUILD_TIME_LOCAL__: string
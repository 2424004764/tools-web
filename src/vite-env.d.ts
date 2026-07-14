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
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import {seoperender} from "./ssr.config";

// https://vitejs.dev/config/
export default defineConfig(({command, mode}) => {
  let env = loadEnv(mode, process.cwd())
  return {
    define: {  
      'process.env.NODE_ENV': JSON.stringify('production')  
    },
    plugins: [
      vue(),
      createSvgIconsPlugin({
        iconDirs: [path.resolve(process.cwd(), 'src/assets/icons')],
        symbolId: 'icon-[dir]-[name]',
      }),
      seoperender()
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        'v-code-diff': path.resolve(__dirname, 'node_modules/v-code-diff/src/CodeDiff.vue'),
      }
    },
    // 新增构建优化配置
    build: {
      target: 'es2015',
      cssCodeSplit: true,
      sourcemap: false,
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
      rollupOptions: {
        output: {
          // 手动分包，优化加载性能
          manualChunks: {
            // 将 Vue 相关库打包到一个 chunk
            vue: ['vue', 'vue-router', 'pinia'],
            // Element Plus 单独打包
            'element-plus': ['element-plus'],
            // 编辑器相关库
            editors: ['@wangeditor/editor', '@wangeditor/editor-for-vue', '@kangc/v-md-editor'],
            // 图表库
            charts: ['echarts'],
            // 工具库
            utils: ['lodash', 'axios', 'uuid'],
            // 代码相关库
            codemirror: ['codemirror', '@codemirror/commands', '@codemirror/lang-javascript', '@codemirror/lang-json'],
            // 图片处理库
            image: ['html2canvas', 'compressorjs', 'tui-image-editor'],
          },
          // 为 chunk 文件名添加 hash
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.\w+$/, '')
            : 'chunk'
            return `js/${facadeModuleId}-[hash].js`
          }
        }
      },
      // 设置 chunk 大小警告限制
      chunkSizeWarningLimit: 1000,
    },
    server: {
      host: env.VITE_HOST,
      proxy: {
        [env.VITE_APP_BASE_API] : {
          target: env.VITE_SERVE,
          changeOrigin: true,
        },
        '/api/pollinations': {
          target: 'https://image.pollinations.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/pollinations/, ''),
          headers: {
            Authorization: 'Bearer NpgaKlHjioTlyo2B'
          }
        }
      }
    }
  }
})

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'
import AutoImport from 'unplugin-auto-import/vite'
import viteCompression from 'vite-plugin-compression'

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
      Components({
        resolvers: [ElementPlusResolver()],
        dts: 'src/types/components.d.ts',
      }),
      ElementPlus({}),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: 'src/types/auto-imports.d.ts',
      }),
      viteCompression({
        algorithm: 'brotliCompress',
        threshold: 10240,
        ext: '.br',
      }),
      viteCompression({
        algorithm: 'gzip',
        threshold: 10240,
        ext: '.gz',
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        'v-code-diff': path.resolve(__dirname, 'node_modules/v-code-diff/dist/v3/index.es.js'),
      }
    },
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
          manualChunks: {
            vue: ['vue', 'vue-router', 'pinia'],
            editors: ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
            charts: ['echarts'],
            utils: ['lodash', 'axios', 'uuid'],
            codemirror: ['codemirror', '@codemirror/commands', '@codemirror/lang-javascript', '@codemirror/lang-json'],
          },
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop().replace(/\.\w+$/, '')
            : 'chunk'
            return `js/${facadeModuleId}-[hash].js`
          }
        }
      },
      chunkSizeWarningLimit: 1000,
    },
    server: {
      host: env.VITE_HOST,
      proxy: {
        [env.VITE_APP_BASE_API] : {
          target: env.VITE_SERVE,
          changeOrigin: true,
        },
        '/api/links': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/letters': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/letter': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/s/': {
          target: 'http://127.0.0.1:8788',
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
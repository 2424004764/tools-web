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
  const isProd = mode === 'production'

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode)
    },
    // 编译优化
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    // 持久化缓存
    cacheDir: 'node_modules/.vite',

    plugins: [
      vue({
        template: {
          compilerOptions: {
            whitespace: 'condense', // 压缩模板空格
          }
        }
      }),
      createSvgIconsPlugin({
        iconDirs: [path.resolve(process.cwd(), 'src/assets/icons')],
        symbolId: 'icon-[dir]-[name]',
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'sass' })],
        dts: false, // 生产环境禁用 dts 生成
      }),
      ElementPlus({}),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: false, // 生产环境禁用 dts 生成
      }),
      // 仅生产环境压缩
      ...(isProd ? [
        viteCompression({
          algorithm: 'brotliCompress',
          threshold: 5120, // 5KB 以上才压缩
          ext: '.br',
          deleteOriginFile: false,
        }),
        viteCompression({
          algorithm: 'gzip',
          threshold: 5120,
          ext: '.gz',
          deleteOriginFile: false,
        }),
      ] : []),
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
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // 动态分包策略
            if (id.includes('node_modules')) {
              if (id.includes('element-plus')) return 'element-plus'
              if (id.includes('vue') || id.includes('pinia') || id.includes('router')) return 'vue'
              if (id.includes('@wangeditor')) return 'editor'
              if (id.includes('echarts')) return 'charts'
              if (id.includes('codemirror') || id.includes('@codemirror')) return 'codemirror'
              if (id.includes('xlsx') || id.includes('jszip')) return 'excel'
              if (id.includes('three')) return 'three'
              if (id.includes('pdfjs')) return 'pdf'
              if (id.includes('lodash') || id.includes('axios') || id.includes('crypto')) return 'utils'
              return 'vendor'
            }
          },
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            if (assetInfo.name.endsWith('.css')) return 'css/[name]-[hash][extname]'
            return 'assets/[name]-[hash][extname]'
          },
        }
      },
      chunkSizeWarningLimit: 800,
    },
    server: {
      host: env.VITE_HOST,
      // 预热常用模块
      warmup: {
        clientFiles: ['./src/main.ts', './src/App.vue', './src/router/index.ts'],
      },
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
        '/api/send-verification-code': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/email-register': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/email-login': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/email-password-login': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/reset-password': {
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
    },
    // 依赖优化
    optimizeDeps: {
      include: [
        'vue',
        'vue-router',
        'pinia',
        'axios',
        'element-plus',
        'lodash',
      ],
      exclude: ['@wangeditor/editor', 'echarts', 'three', 'pdfjs-dist'],
    },
  }
})
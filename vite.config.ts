import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import { VitePWA } from 'vite-plugin-pwa'
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
      seoperender(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico'],
        devOptions: {
          enabled: true,
          type: 'module',
        },
        manifest: {
          name: '开发者工具箱 - 开源免费的在线工具站',
          short_name: '一方工具箱',
          description: '一方工具箱是一个完全开源免费的在线工具站，提供80+种实用工具。开发运维：MD5加密、JSON格式化、正则测试、UUID生成器、时间戳转换、Base64编解码、URL编解码、JWT解析、Cron表达式生成器、HTTP状态码查询、哈希校验、Cookie解析、密码生成器、MySQL转Go结构体等；文本处理：文本对比、Markdown编辑器、字数统计、文本去重、字符串去空格等；教育学术：单位换算、进制转换、摩斯电码、ASCII码表、算法可视化、3D数学方程式、土地亩数计算器等；图片处理：二维码生成识别、PDF转图片、图片压缩分割、Base64图片转换、闲鱼海报制作等；数据图表：柱状图、折线图、饼图、散点图在线制作；趣味游戏：贪吃蛇、俄罗斯方块、2048、扫雷、数独、AI五子棋等；AI工具：AI绘画、AI翻译、AI起名、AI对话、AI面试、AI小学作文、AI提示词等。所有工具完全免费使用，无需注册。',
          theme_color: '#667eea',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/',
          lang: 'zh-CN',
          icons: [
            { src: '/logo192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
            { src: '/logo512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          ],
          categories: ['productivity', 'utilities', 'developer'],
          shortcuts: [
            { name: 'MD5加密', short_name: 'MD5', description: 'MD5在线加密解密工具', url: '/md5', icons: [{ src: '/logo192.png', sizes: '192x192' }] },
            { name: 'JSON格式化', short_name: 'JSON', description: 'JSON在线格式化工具', url: '/json', icons: [{ src: '/logo192.png', sizes: '192x192' }] },
            { name: '二维码生成', short_name: '二维码', description: '免费在线二维码生成器', url: '/qrcode', icons: [{ src: '/logo192.png', sizes: '192x192' }] },
            { name: 'AI绘画', short_name: 'AI画', description: 'AI文字转图片生成工具', url: '/ai-text-to-image', icons: [{ src: '/logo192.png', sizes: '192x192' }] },
            { name: '闲鱼海报', short_name: '海报', description: '闲鱼技能海报生成器', url: '/skill-poster', icons: [{ src: '/logo192.png', sizes: '192x192' }] },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,woff,ttf}'],
          runtimeCaching: [
            {
              urlPattern: /\/api\//,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'api-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 86400 },
                networkTimeoutSeconds: 10,
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        'v-code-diff': path.resolve(__dirname, 'node_modules/v-code-diff/dist/v3/index.es.js'),
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
            // 图片处理库（按需加载，不打包到主chunk）
            // image: ['html2canvas', 'compressorjs', 'tui-image-editor'],
            // PDF处理库（按需加载）
            // pdf: ['pdfjs-dist'],
            // 3D库（按需加载）
            // three: ['three'],
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
        '/api/links': {
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

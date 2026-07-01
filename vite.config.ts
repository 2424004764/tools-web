import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import { execSync } from 'node:child_process'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'
import AutoImport from 'unplugin-auto-import/vite'
import viteCompression from 'vite-plugin-compression'

/**
 * 把 Vite 自动注入的同步 <link rel="stylesheet"> 改成非阻塞的 preload 模式，
 * 让主 CSS 与首屏 HTML 并行下载，不阻塞渲染。
 * noscript 用户仍走原始 stylesheet。
 *
 * 工作机制：
 *   1. Vite 生成 index.html，自动注入 <link rel="stylesheet" href="/css/index-*.css">
 *   2. 我们把这条 link 直接换成 <link rel="preload" as="style" onload="...">，
 *      onload 内把 rel 改为 stylesheet 让 CSS 生效
 *   3. 附一条 noscript fallback 给无 JS 用户
 */
function cssPreloadInject(): Plugin {
  return {
    name: 'tools-css-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html
        const cssAsset = Object.values(ctx.bundle).find(
          (a: any) => a.type === 'asset' && a.fileName.startsWith('css/index-') && a.fileName.endsWith('.css')
        ) as any
        if (!cssAsset) return html
        const cssPath = '/' + cssAsset.fileName.replace(/^public\//, '')
        // 找到 Vite 注入的同步 stylesheet，替换为非阻塞 preload
        const syncLinkRe = new RegExp(
          `<link\\s+rel="stylesheet"\\s+href="${cssPath.replace(/[/]/g, '\\/')}">`
        )
        const replacement = `<link rel="preload" href="${cssPath}" as="style" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${cssPath}"></noscript>`
        if (syncLinkRe.test(html)) {
          return html.replace(syncLinkRe, replacement)
        }
        return html
      },
    },
  }
}

/**
 * dev 模式下监听 logo 文件和 tools.ts，变化时自动重跑精灵图构建脚本，
 * 并触发浏览器 full-reload 让首页重新拉取 sprite 和坐标 JSON。
 */
function spriteWatcher(): Plugin {
  return {
    name: 'tools-sprite-watcher',
    apply: 'serve',
    configureServer(server) {
      let timer: NodeJS.Timeout | null = null
      let isRebuilding = false

      const trigger = (file: string) => {
        const isLogo = /[\\/]images[\\/]logo[\\/][^\\/]+\.(png|jpe?g|svg)$/i.test(file)
        const isToolsTs = /[\\/]src[\\/]components[\\/]Tools[\\/]tools\.ts$/.test(file)
        if (!isLogo && !isToolsTs) return

        if (timer) clearTimeout(timer)
        timer = setTimeout(async () => {
          if (isRebuilding) return
          isRebuilding = true
          try {
            console.log(`[sprite-watcher] ${path.basename(file)} 变更，重建精灵图…`)
            execSync('node scripts/build-sprite.mjs', { stdio: 'pipe', cwd: process.cwd() })
            console.log('[sprite-watcher] ✓ 完成，刷新浏览器')
            server.ws.send({ type: 'full-reload' })
          } catch (err: any) {
            console.error('[sprite-watcher] ✗ 重建失败：', err?.message || err)
          } finally {
            isRebuilding = false
          }
        }, 200)  // 200ms 防抖，连续改动只触发一次
      }

      server.watcher.on('add', trigger)
      server.watcher.on('change', trigger)
      server.watcher.on('unlink', trigger)
    },
  }
}

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
      cssPreloadInject(),
      spriteWatcher(),
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
          manualChunks: {
            'vue-vendor': ['vue', 'vue-router', 'pinia', 'element-plus', '@element-plus/icons-vue'],
            'editor': ['@wangeditor/editor', '@wangeditor/editor-for-vue'],
            'charts': ['echarts'],
            'codemirror': ['codemirror', '@codemirror/commands', '@codemirror/lang-javascript', '@codemirror/lang-json'],
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
        '/api/agnes-chat': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/agnes-video': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/agnes-video-status': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/agnes-image-generations': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/agnes/chat': {
          target: 'https://agnes-ai.com/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/agnes\/chat/, '/chat'),
          secure: false
        },
        '/api/agnes/videos': {
          target: 'https://agnes-ai.com/api/v1',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/agnes\/videos/, '/videos'),
          secure: false
        },
        '/api/agnes': {
          target: 'https://agnes-ai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/agnes/, '/api/v1'),
          secure: false
        },
        '/api/pollinations': {
          target: 'https://image.pollinations.ai',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/pollinations/, ''),
          headers: {
            Authorization: 'Bearer NpgaKlHjioTlyo2B'
          }
        },
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
        '/api/ai-apps': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/favorite-apps': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-providers': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-models': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-proxy': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/open-providers': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/s/': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
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
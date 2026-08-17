import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import path from 'path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import ElementPlus from 'unplugin-element-plus/vite'
import AutoImport from 'unplugin-auto-import/vite'
import Icons from 'unplugin-icons/vite'
import viteCompression from 'vite-plugin-compression'

/**
 * build time 把两类「写死在 index.html 但本应是变量」的内容替换为真实值：
 *
 *   1. 工具数量：解析 src/components/Tools/tools.ts，统计独立 url 路径数，
 *      把 "80+" 占位（description / og / twitter / JSON-LD / title 等多处）替换为 "N+"。
 *   2. 站点名：把 "开发者工具箱" 占位（title / og:site_name / og:title /
 *      twitter:title / JSON-LD 等多处）替换为 .env 中 VITE_APP_TITLE 的值。
 *
 * 必要性：SEO 爬虫读的是静态 HTML，不会执行 JS。
 * 运行期只能更新 <meta name="keywords"> 这种不影响 SEO 抓取的字段。
 * 因此这两类字段都必须在 build time 注入。
 *
 * 工作机制：
 *   - tools.ts：正则 `url: '/xxx'` → Set 去重 → 跳过 https:// 外部链接 → count
 *   - VITE_APP_TITLE：通过 loadEnv(mode, cwd) 读取，默认回退 "开发者工具箱"
 *   - 占位写法：源代码中保留 "开发者工具箱" 与 "80+" 两个固定 token；
 *     若 VITE_APP_TITLE 与 token 相同则跳过站点名替换（无变更日志噪声）
 */
function injectSiteMeta(): Plugin {
  return {
    name: 'tools-web-inject-site-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // ---------- 1. 工具数量 ----------
        const toolsPath = path.resolve(__dirname, 'src/components/Tools/tools.ts')
        const content = readFileSync(toolsPath, 'utf-8')
        const urls = new Set<string>()
        const urlRe = /url:\s*'([^']+)'/g
        let m: RegExpExecArray | null
        while ((m = urlRe.exec(content)) !== null) {
          // 仅统计以 / 开头的 SPA 工具路由；跳过 https://... 外部站点
          if (m[1].startsWith('/') && !m[1].startsWith('//')) {
            urls.add(m[1])
          }
        }
        const count = urls.size
        const countLabel = `${count}+`
        const countMatches = html.match(/80\+/g)
        const countReplaced = countMatches ? countMatches.length : 0
        let updated = html.replace(/80\+/g, countLabel)

        // ---------- 2. 站点名（VITE_APP_TITLE） ----------
        const env = loadEnv(
          (process.env.NODE_ENV as 'development' | 'production') || 'production',
          process.cwd(),
        )
        const siteToken = '开发者工具箱'
        const siteName = env.VITE_APP_TITLE || siteToken
        let siteReplaced = 0
        if (siteName !== siteToken) {
          const siteRegex = new RegExp(siteToken, 'g')
          const matches = updated.match(siteRegex)
          siteReplaced = matches ? matches.length : 0
          updated = updated.replace(siteRegex, siteName)
        }

        console.log(
          `[inject-site-meta] tools=${count} ("80+" → "${countLabel}", ${countReplaced} 处)` +
          ` | siteName="${siteName}" (${siteReplaced} 处替换)`,
        )
        return updated
      },
    },
  }
}

/**
 * 把 Vite 自动注入的同步 <link rel="stylesheet"> 改成非阻塞的 preload 模式，
 * 让主 CSS 与首屏 HTML 并行下载，不阻塞渲染。
 * noscript 用户仍走原始 stylesheet。
 *
 * 工作机制：
 *   1. Vite 生成 index.html，自动注入 <link rel="stylesheet" href="/css/index-*.css">
 *   2. 我们把这条 link 直接换成 <link rel="preload" as="style" onload="...">,
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

// 本地时间格式化（YYYY-MM-DD HH:mm:ss）
function formatLocalTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
         `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// https://vitejs.dev/config/
export default defineConfig(({command, mode}) => {
  let env = loadEnv(mode, process.cwd())
  const isProd = mode === 'production'

  // build 时注入当前时间，About.vue 展示。
  // 两次 JSON.stringify 是 Vite define 的标准做法（外层把字符串包成字符串字面量，内层转义）。
  // dev 模式不显示具体时间，避免 HMR 期间数字跳动干扰开发。
  const now = new Date()
  const buildTimeISO = isProd ? now.toISOString() : ''
  const buildTimeLocal = isProd ? formatLocalTime(now) : ''

  return {
    define: {
      'process.env.NODE_ENV': JSON.stringify(mode),
      // 在 TS 中以 declare const 暴露，详见 src/vite-env.d.ts
      '__BUILD_TIME__': JSON.stringify(buildTimeISO),
      '__BUILD_TIME_LOCAL__': JSON.stringify(buildTimeLocal),
    },
    // 编译优化
    esbuild: {
      drop: isProd ? ['console', 'debugger'] : [],
      legalComments: 'none',
    },
    // 持久化缓存
    cacheDir: 'node_modules/.vite',

    plugins: [
      injectSiteMeta(),
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
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: false, // 生产环境禁用 dts 生成
      }),
      ElementPlus({}),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: false, // 生产环境禁用 dts 生成
      }),
      // 按需引入 Element Plus 图标（用 iconify-json/ep 数据源，单个 SVG 约 1KB）
      // 使用方式：import TopIcon from '~icons/ep/top'
      // 在 <script setup> 中可直接 <TopIcon /> 或通过别名 <Top /> 引用
      Icons({
        compiler: 'vue3',
        autoInstall: true,
        collections: {
          ep: () => import('@iconify-json/ep/icons.json').then(i => i.default as any),
        },
        // 让每个图标默认作为 Vue 组件注册（PascalCase 命名）
        defaultClass: 'inline-block',
        // 生成 icons.d.ts 类型声明，配合 vite-env.d.ts 的 ~icons/* shim 解决 TS 报错
        dts: 'src/types/auto-icons.d.ts',
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
      target: 'es2020',
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
            // Vue 核心 + 路由 + 状态管理（首屏必下）
            'vue-vendor': ['vue', 'vue-router', 'pinia'],
            // Element Plus 单独成 chunk：方便首屏 preload，且与 icon chunk 解耦
            // （icon 不强制进此 chunk，让 Rollup 按引用页自动分包）
            'element-plus': ['element-plus'],
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
      // Windows 下 chokidar 经常漏事件（被杀毒/索引服务拦截），改用轮询保证 HMR 稳定
      watch: {
        usePolling: true,
        interval: 300,
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
            // Token 从 .env.* 读取，禁止硬编码进源码
            Authorization: `Bearer ${env.VITE_POLLINATIONS_API_KEY || ''}`
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
        '/api/travel-maps': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/travel-map-plaza': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/travel-map': {
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
        '/api/confession': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/confession/messages/delete': {
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
        '/api/oss-configs': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/oss-sts': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/life-trajectories': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/admin': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/tools': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/tools/credit-cost': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/tools/models': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/admin/tool-models': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/admin/tool-models/': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/user-tool-prompts': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/me': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-image-edit': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-media-works': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/ai-outfit': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/flashcards': {
          target: 'http://127.0.0.1:8788',
          changeOrigin: true,
        },
        '/api/hotlist': {
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
      // @element-plus/icons-vue 全量 ~250KB，按需 ESM import 即可，无需预构建全部
      // 后续可改 unplugin-icons + @iconify-json/ep 实现 icon-level 按需（45+ 处 import 替换）
      exclude: [
        '@wangeditor/editor',
        '@element-plus/icons-vue',
        'echarts',
        'three',
        'pdfjs-dist',
      ],
    },
  }
})
// vite.config.ts
import { defineConfig, loadEnv } from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite@4.5.14_@types+node@24._e37f0ad4a31fbd982089cb886780d615/node_modules/vite/dist/node/index.js";
import vue from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/@vitejs+plugin-vue@4.6.2_vi_d8772d673982bada57798dbf9548e803/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { createSvgIconsPlugin } from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite-plugin-svg-icons@2.0.1_a11c3eab5518339892ef716a2168f5ee/node_modules/vite-plugin-svg-icons/dist/index.mjs";
import path from "path";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import Components from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/unplugin-vue-components@32._69045a916639754d660dd2dfc8ede2b7/node_modules/unplugin-vue-components/dist/vite.mjs";
import { ElementPlusResolver } from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/unplugin-vue-components@32._69045a916639754d660dd2dfc8ede2b7/node_modules/unplugin-vue-components/dist/resolvers.mjs";
import ElementPlus from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/unplugin-element-plus@0.11.2/node_modules/unplugin-element-plus/dist/vite.mjs";
import AutoImport from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/unplugin-auto-import@21.0.0_c36085e6314d3b47db4ff9e57c049c01/node_modules/unplugin-auto-import/dist/vite.mjs";
import Icons from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/unplugin-icons@22.5.0_@vue+compiler-sfc@3.5.18/node_modules/unplugin-icons/dist/vite.js";
import viteCompression from "file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/vite-plugin-compression@0.5_af6bba0f284b141f4b06294877dc1df6/node_modules/vite-plugin-compression/dist/index.mjs";
var __vite_injected_original_dirname = "D:\\dev\\nodejs\\tools-web";
function injectSiteMeta() {
  return {
    name: "tools-web-inject-site-meta",
    apply: "build",
    transformIndexHtml: {
      order: "pre",
      handler(html) {
        const toolsPath = path.resolve(__vite_injected_original_dirname, "src/components/Tools/tools.ts");
        const content = readFileSync(toolsPath, "utf-8");
        const urls = /* @__PURE__ */ new Set();
        const urlRe = /url:\s*'([^']+)'/g;
        let m;
        while ((m = urlRe.exec(content)) !== null) {
          if (m[1].startsWith("/") && !m[1].startsWith("//")) {
            urls.add(m[1]);
          }
        }
        const count = urls.size;
        const countLabel = `${count}+`;
        const countMatches = html.match(/80\+/g);
        const countReplaced = countMatches ? countMatches.length : 0;
        let updated = html.replace(/80\+/g, countLabel);
        const env = loadEnv(
          process.env.NODE_ENV || "production",
          process.cwd()
        );
        const siteToken = "\u5F00\u53D1\u8005\u5DE5\u5177\u7BB1";
        const siteName = env.VITE_APP_TITLE || siteToken;
        let siteReplaced = 0;
        if (siteName !== siteToken) {
          const siteRegex = new RegExp(siteToken, "g");
          const matches = updated.match(siteRegex);
          siteReplaced = matches ? matches.length : 0;
          updated = updated.replace(siteRegex, siteName);
        }
        console.log(
          `[inject-site-meta] tools=${count} ("80+" \u2192 "${countLabel}", ${countReplaced} \u5904) | siteName="${siteName}" (${siteReplaced} \u5904\u66FF\u6362)`
        );
        return updated;
      }
    }
  };
}
function spriteWatcher() {
  return {
    name: "tools-sprite-watcher",
    apply: "serve",
    configureServer(server) {
      let timer = null;
      let isRebuilding = false;
      const trigger = (file) => {
        const isLogo = /[\\/]images[\\/]logo[\\/][^\\/]+\.(png|jpe?g|svg)$/i.test(file);
        const isToolsTs = /[\\/]src[\\/]components[\\/]Tools[\\/]tools\.ts$/.test(file);
        if (!isLogo && !isToolsTs)
          return;
        if (timer)
          clearTimeout(timer);
        timer = setTimeout(async () => {
          if (isRebuilding)
            return;
          isRebuilding = true;
          try {
            console.log(`[sprite-watcher] ${path.basename(file)} \u53D8\u66F4\uFF0C\u91CD\u5EFA\u7CBE\u7075\u56FE\u2026`);
            execSync("node scripts/build-sprite.mjs", { stdio: "pipe", cwd: process.cwd() });
            console.log("[sprite-watcher] \u2713 \u5B8C\u6210\uFF0C\u5237\u65B0\u6D4F\u89C8\u5668");
            server.ws.send({ type: "full-reload" });
          } catch (err) {
            console.error("[sprite-watcher] \u2717 \u91CD\u5EFA\u5931\u8D25\uFF1A", (err == null ? void 0 : err.message) || err);
          } finally {
            isRebuilding = false;
          }
        }, 200);
      };
      server.watcher.on("add", trigger);
      server.watcher.on("change", trigger);
      server.watcher.on("unlink", trigger);
    }
  };
}
function formatLocalTime(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
var vite_config_default = defineConfig(({ command, mode }) => {
  let env = loadEnv(mode, process.cwd());
  const isProd = mode === "production";
  const now = /* @__PURE__ */ new Date();
  const buildTimeISO = isProd ? now.toISOString() : "";
  const buildTimeLocal = isProd ? formatLocalTime(now) : "";
  return {
    define: {
      "process.env.NODE_ENV": JSON.stringify(mode),
      // 在 TS 中以 declare const 暴露，详见 src/vite-env.d.ts
      "__BUILD_TIME__": JSON.stringify(buildTimeISO),
      "__BUILD_TIME_LOCAL__": JSON.stringify(buildTimeLocal)
    },
    // 编译优化
    esbuild: {
      drop: isProd ? ["console", "debugger"] : [],
      legalComments: "none"
    },
    // 持久化缓存
    cacheDir: "node_modules/.vite",
    plugins: [
      injectSiteMeta(),
      spriteWatcher(),
      vue({
        template: {
          compilerOptions: {
            whitespace: "condense"
            // 压缩模板空格
          }
        }
      }),
      createSvgIconsPlugin({
        iconDirs: [path.resolve(process.cwd(), "src/assets/icons")],
        symbolId: "icon-[dir]-[name]"
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: "css" })],
        dts: false
        // 生产环境禁用 dts 生成
      }),
      ElementPlus({}),
      AutoImport({
        resolvers: [ElementPlusResolver()],
        dts: false
        // 生产环境禁用 dts 生成
      }),
      // 按需引入 Element Plus 图标（用 iconify-json/ep 数据源，单个 SVG 约 1KB）
      // 使用方式：import TopIcon from '~icons/ep/top'
      // 在 <script setup> 中可直接 <TopIcon /> 或通过别名 <Top /> 引用
      Icons({
        compiler: "vue3",
        autoInstall: true,
        collections: {
          ep: () => import("file:///D:/dev/nodejs/tools-web/node_modules/.pnpm/@iconify-json+ep@1.2.4/node_modules/@iconify-json/ep/icons.json").then((i) => i.default)
        },
        // 让每个图标默认作为 Vue 组件注册（PascalCase 命名）
        defaultClass: "inline-block",
        // 生成 icons.d.ts 类型声明，配合 vite-env.d.ts 的 ~icons/* shim 解决 TS 报错
        dts: "src/types/auto-icons.d.ts"
      }),
      // 仅生产环境压缩
      ...isProd ? [
        viteCompression({
          algorithm: "brotliCompress",
          threshold: 5120,
          // 5KB 以上才压缩
          ext: ".br",
          deleteOriginFile: false
        }),
        viteCompression({
          algorithm: "gzip",
          threshold: 5120,
          ext: ".gz",
          deleteOriginFile: false
        })
      ] : []
    ],
    resolve: {
      alias: {
        "@": path.resolve("./src"),
        "v-code-diff": path.resolve(__vite_injected_original_dirname, "node_modules/v-code-diff/dist/v3/index.es.js")
      }
    },
    build: {
      target: "es2020",
      cssCodeSplit: true,
      sourcemap: false,
      minify: "terser",
      terserOptions: {
        compress: {
          drop_console: true,
          drop_debugger: true
        }
      },
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks: {
            // Vue 核心 + 路由 + 状态管理（首屏必下）
            "vue-vendor": ["vue", "vue-router", "pinia"],
            // Element Plus 单独成 chunk：方便首屏 preload，且与 icon chunk 解耦
            // （icon 不强制进此 chunk，让 Rollup 按引用页自动分包）
            "element-plus": ["element-plus"],
            "editor": ["@wangeditor/editor", "@wangeditor/editor-for-vue"],
            "charts": ["echarts"],
            "codemirror": ["codemirror", "@codemirror/commands", "@codemirror/lang-javascript", "@codemirror/lang-json"]
          },
          chunkFileNames: "js/[name]-[hash].js",
          entryFileNames: "js/[name]-[hash].js",
          assetFileNames: (assetInfo) => {
            if (assetInfo.name.endsWith(".css"))
              return "css/[name]-[hash][extname]";
            return "assets/[name]-[hash][extname]";
          }
        }
      },
      chunkSizeWarningLimit: 800
    },
    server: {
      host: env.VITE_HOST,
      // 预热常用模块
      warmup: {
        clientFiles: ["./src/main.ts", "./src/App.vue", "./src/router/index.ts"]
      },
      // Windows 下 chokidar 经常漏事件（被杀毒/索引服务拦截），改用轮询保证 HMR 稳定
      watch: {
        usePolling: true,
        interval: 300
      },
      proxy: {
        "/api/agnes-chat": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/agnes-video": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/agnes-video-status": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/agnes-image-generations": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/agnes/chat": {
          target: "https://agnes-ai.com/api/v1",
          changeOrigin: true,
          rewrite: (path2) => path2.replace(/^\/api\/agnes\/chat/, "/chat"),
          secure: false
        },
        "/api/agnes/videos": {
          target: "https://agnes-ai.com/api/v1",
          changeOrigin: true,
          rewrite: (path2) => path2.replace(/^\/api\/agnes\/videos/, "/videos"),
          secure: false
        },
        "/api/agnes": {
          target: "https://agnes-ai.com",
          changeOrigin: true,
          rewrite: (path2) => path2.replace(/^\/api\/agnes/, "/api/v1"),
          secure: false
        },
        "/api/pollinations": {
          target: "https://image.pollinations.ai",
          changeOrigin: true,
          rewrite: (path2) => path2.replace(/^\/api\/pollinations/, ""),
          headers: {
            // Token 从 .env.* 读取，禁止硬编码进源码
            Authorization: `Bearer ${env.VITE_POLLINATIONS_API_KEY || ""}`
          }
        },
        [env.VITE_APP_BASE_API]: {
          target: env.VITE_SERVE,
          changeOrigin: true
        },
        "/api/links": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/letters": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/letter": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/send-verification-code": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/email-register": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/email-login": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/email-password-login": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/reset-password": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-apps": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/favorite-apps": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/confession": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/confession/messages/delete": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-providers": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-models": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-proxy": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/open-providers": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/oss-configs": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/oss-sts": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/life-trajectories": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/admin": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/tools": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/tools/credit-cost": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/tools/models": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/admin/tool-models": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/admin/tool-models/": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/me": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-image-edit": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-media-works": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/api/ai-outfit": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        },
        "/s/": {
          target: "http://127.0.0.1:8788",
          changeOrigin: true
        }
      }
    },
    // 依赖优化
    optimizeDeps: {
      include: [
        "vue",
        "vue-router",
        "pinia",
        "axios",
        "element-plus",
        "lodash"
      ],
      // @element-plus/icons-vue 全量 ~250KB，按需 ESM import 即可，无需预构建全部
      // 后续可改 unplugin-icons + @iconify-json/ep 实现 icon-level 按需（45+ 处 import 替换）
      exclude: [
        "@wangeditor/editor",
        "@element-plus/icons-vue",
        "echarts",
        "three",
        "pdfjs-dist"
      ]
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJEOlxcXFxkZXZcXFxcbm9kZWpzXFxcXHRvb2xzLXdlYlwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiRDpcXFxcZGV2XFxcXG5vZGVqc1xcXFx0b29scy13ZWJcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0Q6L2Rldi9ub2RlanMvdG9vbHMtd2ViL3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52LCB0eXBlIFBsdWdpbiB9IGZyb20gJ3ZpdGUnXG5pbXBvcnQgdnVlIGZyb20gJ0B2aXRlanMvcGx1Z2luLXZ1ZSdcbmltcG9ydCB7IGNyZWF0ZVN2Z0ljb25zUGx1Z2luIH0gZnJvbSAndml0ZS1wbHVnaW4tc3ZnLWljb25zJ1xuaW1wb3J0IHBhdGggZnJvbSAncGF0aCdcbmltcG9ydCB7IGV4ZWNTeW5jIH0gZnJvbSAnbm9kZTpjaGlsZF9wcm9jZXNzJ1xuaW1wb3J0IHsgcmVhZEZpbGVTeW5jIH0gZnJvbSAnbm9kZTpmcydcbmltcG9ydCBDb21wb25lbnRzIGZyb20gJ3VucGx1Z2luLXZ1ZS1jb21wb25lbnRzL3ZpdGUnXG5pbXBvcnQgeyBFbGVtZW50UGx1c1Jlc29sdmVyIH0gZnJvbSAndW5wbHVnaW4tdnVlLWNvbXBvbmVudHMvcmVzb2x2ZXJzJ1xuaW1wb3J0IEVsZW1lbnRQbHVzIGZyb20gJ3VucGx1Z2luLWVsZW1lbnQtcGx1cy92aXRlJ1xuaW1wb3J0IEF1dG9JbXBvcnQgZnJvbSAndW5wbHVnaW4tYXV0by1pbXBvcnQvdml0ZSdcbmltcG9ydCBJY29ucyBmcm9tICd1bnBsdWdpbi1pY29ucy92aXRlJ1xuaW1wb3J0IHZpdGVDb21wcmVzc2lvbiBmcm9tICd2aXRlLXBsdWdpbi1jb21wcmVzc2lvbidcblxuLyoqXG4gKiBidWlsZCB0aW1lIFx1NjI4QVx1NEUyNFx1N0M3Qlx1MzAwQ1x1NTE5OVx1NkI3Qlx1NTcyOCBpbmRleC5odG1sIFx1NEY0Nlx1NjcyQ1x1NUU5NFx1NjYyRlx1NTNEOFx1OTFDRlx1MzAwRFx1NzY4NFx1NTE4NVx1NUJCOVx1NjZGRlx1NjM2Mlx1NEUzQVx1NzcxRlx1NUI5RVx1NTAzQ1x1RkYxQVxuICpcbiAqICAgMS4gXHU1REU1XHU1MTc3XHU2NTcwXHU5MUNGXHVGRjFBXHU4OUUzXHU2NzkwIHNyYy9jb21wb25lbnRzL1Rvb2xzL3Rvb2xzLnRzXHVGRjBDXHU3RURGXHU4QkExXHU3MkVDXHU3QUNCIHVybCBcdThERUZcdTVGODRcdTY1NzBcdUZGMENcbiAqICAgICAgXHU2MjhBIFwiODArXCIgXHU1MzYwXHU0RjREXHVGRjA4ZGVzY3JpcHRpb24gLyBvZyAvIHR3aXR0ZXIgLyBKU09OLUxEIC8gdGl0bGUgXHU3QjQ5XHU1OTFBXHU1OTA0XHVGRjA5XHU2NkZGXHU2MzYyXHU0RTNBIFwiTitcIlx1MzAwMlxuICogICAyLiBcdTdBRDlcdTcwQjlcdTU0MERcdUZGMUFcdTYyOEEgXCJcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTdCQjFcIiBcdTUzNjBcdTRGNERcdUZGMDh0aXRsZSAvIG9nOnNpdGVfbmFtZSAvIG9nOnRpdGxlIC9cbiAqICAgICAgdHdpdHRlcjp0aXRsZSAvIEpTT04tTEQgXHU3QjQ5XHU1OTFBXHU1OTA0XHVGRjA5XHU2NkZGXHU2MzYyXHU0RTNBIC5lbnYgXHU0RTJEIFZJVEVfQVBQX1RJVExFIFx1NzY4NFx1NTAzQ1x1MzAwMlxuICpcbiAqIFx1NUZDNVx1ODk4MVx1NjAyN1x1RkYxQVNFTyBcdTcyMkNcdTg2NkJcdThCRkJcdTc2ODRcdTY2MkZcdTk3NTlcdTYwMDEgSFRNTFx1RkYwQ1x1NEUwRFx1NEYxQVx1NjI2N1x1ODg0QyBKU1x1MzAwMlxuICogXHU4RkQwXHU4ODRDXHU2NzFGXHU1M0VBXHU4MEZEXHU2NkY0XHU2NUIwIDxtZXRhIG5hbWU9XCJrZXl3b3Jkc1wiPiBcdThGRDlcdTc5Q0RcdTRFMERcdTVGNzFcdTU0Q0QgU0VPIFx1NjI5M1x1NTNENlx1NzY4NFx1NUI1N1x1NkJCNVx1MzAwMlxuICogXHU1NkUwXHU2QjY0XHU4RkQ5XHU0RTI0XHU3QzdCXHU1QjU3XHU2QkI1XHU5MEZEXHU1RkM1XHU5ODdCXHU1NzI4IGJ1aWxkIHRpbWUgXHU2Q0U4XHU1MTY1XHUzMDAyXG4gKlxuICogXHU1REU1XHU0RjVDXHU2NzNBXHU1MjM2XHVGRjFBXG4gKiAgIC0gdG9vbHMudHNcdUZGMUFcdTZCNjNcdTUyMTkgYHVybDogJy94eHgnYCBcdTIxOTIgU2V0IFx1NTNCQlx1OTFDRCBcdTIxOTIgXHU4REYzXHU4RkM3IGh0dHBzOi8vIFx1NTkxNlx1OTBFOFx1OTRGRVx1NjNBNSBcdTIxOTIgY291bnRcbiAqICAgLSBWSVRFX0FQUF9USVRMRVx1RkYxQVx1OTAxQVx1OEZDNyBsb2FkRW52KG1vZGUsIGN3ZCkgXHU4QkZCXHU1M0Q2XHVGRjBDXHU5RUQ4XHU4QkE0XHU1NkRFXHU5MDAwIFwiXHU1RjAwXHU1M0QxXHU4MDA1XHU1REU1XHU1MTc3XHU3QkIxXCJcbiAqICAgLSBcdTUzNjBcdTRGNERcdTUxOTlcdTZDRDVcdUZGMUFcdTZFOTBcdTRFRTNcdTc4MDFcdTRFMkRcdTRGRERcdTc1NTkgXCJcdTVGMDBcdTUzRDFcdTgwMDVcdTVERTVcdTUxNzdcdTdCQjFcIiBcdTRFMEUgXCI4MCtcIiBcdTRFMjRcdTRFMkFcdTU2RkFcdTVCOUEgdG9rZW5cdUZGMUJcbiAqICAgICBcdTgyRTUgVklURV9BUFBfVElUTEUgXHU0RTBFIHRva2VuIFx1NzZGOFx1NTQwQ1x1NTIxOVx1OERGM1x1OEZDN1x1N0FEOVx1NzBCOVx1NTQwRFx1NjZGRlx1NjM2Mlx1RkYwOFx1NjVFMFx1NTNEOFx1NjZGNFx1NjVFNVx1NUZEN1x1NTY2QVx1NThGMFx1RkYwOVxuICovXG5mdW5jdGlvbiBpbmplY3RTaXRlTWV0YSgpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICd0b29scy13ZWItaW5qZWN0LXNpdGUtbWV0YScsXG4gICAgYXBwbHk6ICdidWlsZCcsXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sOiB7XG4gICAgICBvcmRlcjogJ3ByZScsXG4gICAgICBoYW5kbGVyKGh0bWwpIHtcbiAgICAgICAgLy8gLS0tLS0tLS0tLSAxLiBcdTVERTVcdTUxNzdcdTY1NzBcdTkxQ0YgLS0tLS0tLS0tLVxuICAgICAgICBjb25zdCB0b29sc1BhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2NvbXBvbmVudHMvVG9vbHMvdG9vbHMudHMnKVxuICAgICAgICBjb25zdCBjb250ZW50ID0gcmVhZEZpbGVTeW5jKHRvb2xzUGF0aCwgJ3V0Zi04JylcbiAgICAgICAgY29uc3QgdXJscyA9IG5ldyBTZXQ8c3RyaW5nPigpXG4gICAgICAgIGNvbnN0IHVybFJlID0gL3VybDpcXHMqJyhbXiddKyknL2dcbiAgICAgICAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGxcbiAgICAgICAgd2hpbGUgKChtID0gdXJsUmUuZXhlYyhjb250ZW50KSkgIT09IG51bGwpIHtcbiAgICAgICAgICAvLyBcdTRFQzVcdTdFREZcdThCQTFcdTRFRTUgLyBcdTVGMDBcdTU5MzRcdTc2ODQgU1BBIFx1NURFNVx1NTE3N1x1OERFRlx1NzUzMVx1RkYxQlx1OERGM1x1OEZDNyBodHRwczovLy4uLiBcdTU5MTZcdTkwRThcdTdBRDlcdTcwQjlcbiAgICAgICAgICBpZiAobVsxXS5zdGFydHNXaXRoKCcvJykgJiYgIW1bMV0uc3RhcnRzV2l0aCgnLy8nKSkge1xuICAgICAgICAgICAgdXJscy5hZGQobVsxXSlcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgY29uc3QgY291bnQgPSB1cmxzLnNpemVcbiAgICAgICAgY29uc3QgY291bnRMYWJlbCA9IGAke2NvdW50fStgXG4gICAgICAgIGNvbnN0IGNvdW50TWF0Y2hlcyA9IGh0bWwubWF0Y2goLzgwXFwrL2cpXG4gICAgICAgIGNvbnN0IGNvdW50UmVwbGFjZWQgPSBjb3VudE1hdGNoZXMgPyBjb3VudE1hdGNoZXMubGVuZ3RoIDogMFxuICAgICAgICBsZXQgdXBkYXRlZCA9IGh0bWwucmVwbGFjZSgvODBcXCsvZywgY291bnRMYWJlbClcblxuICAgICAgICAvLyAtLS0tLS0tLS0tIDIuIFx1N0FEOVx1NzBCOVx1NTQwRFx1RkYwOFZJVEVfQVBQX1RJVExFXHVGRjA5IC0tLS0tLS0tLS1cbiAgICAgICAgY29uc3QgZW52ID0gbG9hZEVudihcbiAgICAgICAgICAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgYXMgJ2RldmVsb3BtZW50JyB8ICdwcm9kdWN0aW9uJykgfHwgJ3Byb2R1Y3Rpb24nLFxuICAgICAgICAgIHByb2Nlc3MuY3dkKCksXG4gICAgICAgIClcbiAgICAgICAgY29uc3Qgc2l0ZVRva2VuID0gJ1x1NUYwMFx1NTNEMVx1ODAwNVx1NURFNVx1NTE3N1x1N0JCMSdcbiAgICAgICAgY29uc3Qgc2l0ZU5hbWUgPSBlbnYuVklURV9BUFBfVElUTEUgfHwgc2l0ZVRva2VuXG4gICAgICAgIGxldCBzaXRlUmVwbGFjZWQgPSAwXG4gICAgICAgIGlmIChzaXRlTmFtZSAhPT0gc2l0ZVRva2VuKSB7XG4gICAgICAgICAgY29uc3Qgc2l0ZVJlZ2V4ID0gbmV3IFJlZ0V4cChzaXRlVG9rZW4sICdnJylcbiAgICAgICAgICBjb25zdCBtYXRjaGVzID0gdXBkYXRlZC5tYXRjaChzaXRlUmVnZXgpXG4gICAgICAgICAgc2l0ZVJlcGxhY2VkID0gbWF0Y2hlcyA/IG1hdGNoZXMubGVuZ3RoIDogMFxuICAgICAgICAgIHVwZGF0ZWQgPSB1cGRhdGVkLnJlcGxhY2Uoc2l0ZVJlZ2V4LCBzaXRlTmFtZSlcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgIGBbaW5qZWN0LXNpdGUtbWV0YV0gdG9vbHM9JHtjb3VudH0gKFwiODArXCIgXHUyMTkyIFwiJHtjb3VudExhYmVsfVwiLCAke2NvdW50UmVwbGFjZWR9IFx1NTkwNClgICtcbiAgICAgICAgICBgIHwgc2l0ZU5hbWU9XCIke3NpdGVOYW1lfVwiICgke3NpdGVSZXBsYWNlZH0gXHU1OTA0XHU2NkZGXHU2MzYyKWAsXG4gICAgICAgIClcbiAgICAgICAgcmV0dXJuIHVwZGF0ZWRcbiAgICAgIH0sXG4gICAgfSxcbiAgfVxufVxuXG4vKipcbiAqIFx1NjI4QSBWaXRlIFx1ODFFQVx1NTJBOFx1NkNFOFx1NTE2NVx1NzY4NFx1NTQwQ1x1NkI2NSA8bGluayByZWw9XCJzdHlsZXNoZWV0XCI+IFx1NjUzOVx1NjIxMFx1OTc1RVx1OTYzQlx1NTg1RVx1NzY4NCBwcmVsb2FkIFx1NkEyMVx1NUYwRlx1RkYwQ1xuICogXHU4QkE5XHU0RTNCIENTUyBcdTRFMEVcdTk5OTZcdTVDNEYgSFRNTCBcdTVFNzZcdTg4NENcdTRFMEJcdThGN0RcdUZGMENcdTRFMERcdTk2M0JcdTU4NUVcdTZFMzJcdTY3RDNcdTMwMDJcbiAqIG5vc2NyaXB0IFx1NzUyOFx1NjIzN1x1NEVDRFx1OEQ3MFx1NTM5Rlx1NTlDQiBzdHlsZXNoZWV0XHUzMDAyXG4gKlxuICogXHU1REU1XHU0RjVDXHU2NzNBXHU1MjM2XHVGRjFBXG4gKiAgIDEuIFZpdGUgXHU3NTFGXHU2MjEwIGluZGV4Lmh0bWxcdUZGMENcdTgxRUFcdTUyQThcdTZDRThcdTUxNjUgPGxpbmsgcmVsPVwic3R5bGVzaGVldFwiIGhyZWY9XCIvY3NzL2luZGV4LSouY3NzXCI+XG4gKiAgIDIuIFx1NjIxMVx1NEVFQ1x1NjI4QVx1OEZEOVx1Njc2MSBsaW5rIFx1NzZGNFx1NjNBNVx1NjM2Mlx1NjIxMCA8bGluayByZWw9XCJwcmVsb2FkXCIgYXM9XCJzdHlsZVwiIG9ubG9hZD1cIi4uLlwiPixcbiAqICAgICAgb25sb2FkIFx1NTE4NVx1NjI4QSByZWwgXHU2NTM5XHU0RTNBIHN0eWxlc2hlZXQgXHU4QkE5IENTUyBcdTc1MUZcdTY1NDhcbiAqICAgMy4gXHU5NjQ0XHU0RTAwXHU2NzYxIG5vc2NyaXB0IGZhbGxiYWNrIFx1N0VEOVx1NjVFMCBKUyBcdTc1MjhcdTYyMzdcbiAqL1xuZnVuY3Rpb24gY3NzUHJlbG9hZEluamVjdCgpOiBQbHVnaW4ge1xuICByZXR1cm4ge1xuICAgIG5hbWU6ICd0b29scy1jc3MtcHJlbG9hZCcsXG4gICAgYXBwbHk6ICdidWlsZCcsXG4gICAgdHJhbnNmb3JtSW5kZXhIdG1sOiB7XG4gICAgICBvcmRlcjogJ3Bvc3QnLFxuICAgICAgaGFuZGxlcihodG1sLCBjdHgpIHtcbiAgICAgICAgaWYgKCFjdHguYnVuZGxlKSByZXR1cm4gaHRtbFxuICAgICAgICBjb25zdCBjc3NBc3NldCA9IE9iamVjdC52YWx1ZXMoY3R4LmJ1bmRsZSkuZmluZChcbiAgICAgICAgICAoYTogYW55KSA9PiBhLnR5cGUgPT09ICdhc3NldCcgJiYgYS5maWxlTmFtZS5zdGFydHNXaXRoKCdjc3MvaW5kZXgtJykgJiYgYS5maWxlTmFtZS5lbmRzV2l0aCgnLmNzcycpXG4gICAgICAgICkgYXMgYW55XG4gICAgICAgIGlmICghY3NzQXNzZXQpIHJldHVybiBodG1sXG4gICAgICAgIGNvbnN0IGNzc1BhdGggPSAnLycgKyBjc3NBc3NldC5maWxlTmFtZS5yZXBsYWNlKC9ecHVibGljXFwvLywgJycpXG4gICAgICAgIC8vIFx1NjI3RVx1NTIzMCBWaXRlIFx1NkNFOFx1NTE2NVx1NzY4NFx1NTQwQ1x1NkI2NSBzdHlsZXNoZWV0XHVGRjBDXHU2NkZGXHU2MzYyXHU0RTNBXHU5NzVFXHU5NjNCXHU1ODVFIHByZWxvYWRcbiAgICAgICAgY29uc3Qgc3luY0xpbmtSZSA9IG5ldyBSZWdFeHAoXG4gICAgICAgICAgYDxsaW5rXFxcXHMrcmVsPVwic3R5bGVzaGVldFwiXFxcXHMraHJlZj1cIiR7Y3NzUGF0aC5yZXBsYWNlKC9bL10vZywgJ1xcXFwvJyl9XCI+YFxuICAgICAgICApXG4gICAgICAgIGNvbnN0IHJlcGxhY2VtZW50ID0gYDxsaW5rIHJlbD1cInByZWxvYWRcIiBocmVmPVwiJHtjc3NQYXRofVwiIGFzPVwic3R5bGVcIiBvbmxvYWQ9XCJ0aGlzLm9ubG9hZD1udWxsO3RoaXMucmVsPSdzdHlsZXNoZWV0J1wiPjxub3NjcmlwdD48bGluayByZWw9XCJzdHlsZXNoZWV0XCIgaHJlZj1cIiR7Y3NzUGF0aH1cIj48L25vc2NyaXB0PmBcbiAgICAgICAgaWYgKHN5bmNMaW5rUmUudGVzdChodG1sKSkge1xuICAgICAgICAgIHJldHVybiBodG1sLnJlcGxhY2Uoc3luY0xpbmtSZSwgcmVwbGFjZW1lbnQpXG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGh0bWxcbiAgICAgIH0sXG4gICAgfSxcbiAgfVxufVxuXG4vKipcbiAqIGRldiBcdTZBMjFcdTVGMEZcdTRFMEJcdTc2RDFcdTU0MkMgbG9nbyBcdTY1ODdcdTRFRjZcdTU0OEMgdG9vbHMudHNcdUZGMENcdTUzRDhcdTUzMTZcdTY1RjZcdTgxRUFcdTUyQThcdTkxQ0RcdThERDFcdTdDQkVcdTcwNzVcdTU2RkVcdTY3ODRcdTVFRkFcdTgxMUFcdTY3MkNcdUZGMENcbiAqIFx1NUU3Nlx1ODlFNlx1NTNEMVx1NkQ0Rlx1ODlDOFx1NTY2OCBmdWxsLXJlbG9hZCBcdThCQTlcdTk5OTZcdTk4NzVcdTkxQ0RcdTY1QjBcdTYyQzlcdTUzRDYgc3ByaXRlIFx1NTQ4Q1x1NTc1MFx1NjgwNyBKU09OXHUzMDAyXG4gKi9cbmZ1bmN0aW9uIHNwcml0ZVdhdGNoZXIoKTogUGx1Z2luIHtcbiAgcmV0dXJuIHtcbiAgICBuYW1lOiAndG9vbHMtc3ByaXRlLXdhdGNoZXInLFxuICAgIGFwcGx5OiAnc2VydmUnLFxuICAgIGNvbmZpZ3VyZVNlcnZlcihzZXJ2ZXIpIHtcbiAgICAgIGxldCB0aW1lcjogTm9kZUpTLlRpbWVvdXQgfCBudWxsID0gbnVsbFxuICAgICAgbGV0IGlzUmVidWlsZGluZyA9IGZhbHNlXG5cbiAgICAgIGNvbnN0IHRyaWdnZXIgPSAoZmlsZTogc3RyaW5nKSA9PiB7XG4gICAgICAgIGNvbnN0IGlzTG9nbyA9IC9bXFxcXC9daW1hZ2VzW1xcXFwvXWxvZ29bXFxcXC9dW15cXFxcL10rXFwuKHBuZ3xqcGU/Z3xzdmcpJC9pLnRlc3QoZmlsZSlcbiAgICAgICAgY29uc3QgaXNUb29sc1RzID0gL1tcXFxcL11zcmNbXFxcXC9dY29tcG9uZW50c1tcXFxcL11Ub29sc1tcXFxcL110b29sc1xcLnRzJC8udGVzdChmaWxlKVxuICAgICAgICBpZiAoIWlzTG9nbyAmJiAhaXNUb29sc1RzKSByZXR1cm5cblxuICAgICAgICBpZiAodGltZXIpIGNsZWFyVGltZW91dCh0aW1lcilcbiAgICAgICAgdGltZXIgPSBzZXRUaW1lb3V0KGFzeW5jICgpID0+IHtcbiAgICAgICAgICBpZiAoaXNSZWJ1aWxkaW5nKSByZXR1cm5cbiAgICAgICAgICBpc1JlYnVpbGRpbmcgPSB0cnVlXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnNvbGUubG9nKGBbc3ByaXRlLXdhdGNoZXJdICR7cGF0aC5iYXNlbmFtZShmaWxlKX0gXHU1M0Q4XHU2NkY0XHVGRjBDXHU5MUNEXHU1RUZBXHU3Q0JFXHU3MDc1XHU1NkZFXHUyMDI2YClcbiAgICAgICAgICAgIGV4ZWNTeW5jKCdub2RlIHNjcmlwdHMvYnVpbGQtc3ByaXRlLm1qcycsIHsgc3RkaW86ICdwaXBlJywgY3dkOiBwcm9jZXNzLmN3ZCgpIH0pXG4gICAgICAgICAgICBjb25zb2xlLmxvZygnW3Nwcml0ZS13YXRjaGVyXSBcdTI3MTMgXHU1QjhDXHU2MjEwXHVGRjBDXHU1MjM3XHU2NUIwXHU2RDRGXHU4OUM4XHU1NjY4JylcbiAgICAgICAgICAgIHNlcnZlci53cy5zZW5kKHsgdHlwZTogJ2Z1bGwtcmVsb2FkJyB9KVxuICAgICAgICAgIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKCdbc3ByaXRlLXdhdGNoZXJdIFx1MjcxNyBcdTkxQ0RcdTVFRkFcdTU5MzFcdThEMjVcdUZGMUEnLCBlcnI/Lm1lc3NhZ2UgfHwgZXJyKVxuICAgICAgICAgIH0gZmluYWxseSB7XG4gICAgICAgICAgICBpc1JlYnVpbGRpbmcgPSBmYWxzZVxuICAgICAgICAgIH1cbiAgICAgICAgfSwgMjAwKSAgLy8gMjAwbXMgXHU5NjMyXHU2Mjk2XHVGRjBDXHU4RkRFXHU3RUVEXHU2NTM5XHU1MkE4XHU1M0VBXHU4OUU2XHU1M0QxXHU0RTAwXHU2QjIxXG4gICAgICB9XG5cbiAgICAgIHNlcnZlci53YXRjaGVyLm9uKCdhZGQnLCB0cmlnZ2VyKVxuICAgICAgc2VydmVyLndhdGNoZXIub24oJ2NoYW5nZScsIHRyaWdnZXIpXG4gICAgICBzZXJ2ZXIud2F0Y2hlci5vbigndW5saW5rJywgdHJpZ2dlcilcbiAgICB9LFxuICB9XG59XG5cbi8vIFx1NjcyQ1x1NTczMFx1NjVGNlx1OTVGNFx1NjgzQ1x1NUYwRlx1NTMxNlx1RkYwOFlZWVktTU0tREQgSEg6bW06c3NcdUZGMDlcbmZ1bmN0aW9uIGZvcm1hdExvY2FsVGltZShkOiBEYXRlKTogc3RyaW5nIHtcbiAgY29uc3QgcGFkID0gKG46IG51bWJlcikgPT4gU3RyaW5nKG4pLnBhZFN0YXJ0KDIsICcwJylcbiAgcmV0dXJuIGAke2QuZ2V0RnVsbFllYXIoKX0tJHtwYWQoZC5nZXRNb250aCgpICsgMSl9LSR7cGFkKGQuZ2V0RGF0ZSgpKX0gYCArXG4gICAgICAgICBgJHtwYWQoZC5nZXRIb3VycygpKX06JHtwYWQoZC5nZXRNaW51dGVzKCkpfToke3BhZChkLmdldFNlY29uZHMoKSl9YFxufVxuXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7Y29tbWFuZCwgbW9kZX0pID0+IHtcbiAgbGV0IGVudiA9IGxvYWRFbnYobW9kZSwgcHJvY2Vzcy5jd2QoKSlcbiAgY29uc3QgaXNQcm9kID0gbW9kZSA9PT0gJ3Byb2R1Y3Rpb24nXG5cbiAgLy8gYnVpbGQgXHU2NUY2XHU2Q0U4XHU1MTY1XHU1RjUzXHU1MjREXHU2NUY2XHU5NUY0XHVGRjBDQWJvdXQudnVlIFx1NUM1NVx1NzkzQVx1MzAwMlxuICAvLyBcdTRFMjRcdTZCMjEgSlNPTi5zdHJpbmdpZnkgXHU2NjJGIFZpdGUgZGVmaW5lIFx1NzY4NFx1NjgwN1x1NTFDNlx1NTA1QVx1NkNENVx1RkYwOFx1NTkxNlx1NUM0Mlx1NjI4QVx1NUI1N1x1N0IyNlx1NEUzMlx1NTMwNVx1NjIxMFx1NUI1N1x1N0IyNlx1NEUzMlx1NUI1N1x1OTc2Mlx1OTFDRlx1RkYwQ1x1NTE4NVx1NUM0Mlx1OEY2Q1x1NEU0OVx1RkYwOVx1MzAwMlxuICAvLyBkZXYgXHU2QTIxXHU1RjBGXHU0RTBEXHU2NjNFXHU3OTNBXHU1MTc3XHU0RjUzXHU2NUY2XHU5NUY0XHVGRjBDXHU5MDdGXHU1MTREIEhNUiBcdTY3MUZcdTk1RjRcdTY1NzBcdTVCNTdcdThERjNcdTUyQThcdTVFNzJcdTYyNzBcdTVGMDBcdTUzRDFcdTMwMDJcbiAgY29uc3Qgbm93ID0gbmV3IERhdGUoKVxuICBjb25zdCBidWlsZFRpbWVJU08gPSBpc1Byb2QgPyBub3cudG9JU09TdHJpbmcoKSA6ICcnXG4gIGNvbnN0IGJ1aWxkVGltZUxvY2FsID0gaXNQcm9kID8gZm9ybWF0TG9jYWxUaW1lKG5vdykgOiAnJ1xuXG4gIHJldHVybiB7XG4gICAgZGVmaW5lOiB7XG4gICAgICAncHJvY2Vzcy5lbnYuTk9ERV9FTlYnOiBKU09OLnN0cmluZ2lmeShtb2RlKSxcbiAgICAgIC8vIFx1NTcyOCBUUyBcdTRFMkRcdTRFRTUgZGVjbGFyZSBjb25zdCBcdTY2QjRcdTk3MzJcdUZGMENcdThCRTZcdTg5QzEgc3JjL3ZpdGUtZW52LmQudHNcbiAgICAgICdfX0JVSUxEX1RJTUVfXyc6IEpTT04uc3RyaW5naWZ5KGJ1aWxkVGltZUlTTyksXG4gICAgICAnX19CVUlMRF9USU1FX0xPQ0FMX18nOiBKU09OLnN0cmluZ2lmeShidWlsZFRpbWVMb2NhbCksXG4gICAgfSxcbiAgICAvLyBcdTdGMTZcdThCRDFcdTRGMThcdTUzMTZcbiAgICBlc2J1aWxkOiB7XG4gICAgICBkcm9wOiBpc1Byb2QgPyBbJ2NvbnNvbGUnLCAnZGVidWdnZXInXSA6IFtdLFxuICAgICAgbGVnYWxDb21tZW50czogJ25vbmUnLFxuICAgIH0sXG4gICAgLy8gXHU2MzAxXHU0RTQ1XHU1MzE2XHU3RjEzXHU1QjU4XG4gICAgY2FjaGVEaXI6ICdub2RlX21vZHVsZXMvLnZpdGUnLFxuXG4gICAgcGx1Z2luczogW1xuICAgICAgaW5qZWN0U2l0ZU1ldGEoKSxcbiAgICAgIHNwcml0ZVdhdGNoZXIoKSxcbiAgICAgIHZ1ZSh7XG4gICAgICAgIHRlbXBsYXRlOiB7XG4gICAgICAgICAgY29tcGlsZXJPcHRpb25zOiB7XG4gICAgICAgICAgICB3aGl0ZXNwYWNlOiAnY29uZGVuc2UnLCAvLyBcdTUzOEJcdTdGMjlcdTZBMjFcdTY3N0ZcdTdBN0FcdTY4M0NcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0pLFxuICAgICAgY3JlYXRlU3ZnSWNvbnNQbHVnaW4oe1xuICAgICAgICBpY29uRGlyczogW3BhdGgucmVzb2x2ZShwcm9jZXNzLmN3ZCgpLCAnc3JjL2Fzc2V0cy9pY29ucycpXSxcbiAgICAgICAgc3ltYm9sSWQ6ICdpY29uLVtkaXJdLVtuYW1lXScsXG4gICAgICB9KSxcbiAgICAgIENvbXBvbmVudHMoe1xuICAgICAgICByZXNvbHZlcnM6IFtFbGVtZW50UGx1c1Jlc29sdmVyKHsgaW1wb3J0U3R5bGU6ICdjc3MnIH0pXSxcbiAgICAgICAgZHRzOiBmYWxzZSwgLy8gXHU3NTFGXHU0RUE3XHU3M0FGXHU1ODgzXHU3OTgxXHU3NTI4IGR0cyBcdTc1MUZcdTYyMTBcbiAgICAgIH0pLFxuICAgICAgRWxlbWVudFBsdXMoe30pLFxuICAgICAgQXV0b0ltcG9ydCh7XG4gICAgICAgIHJlc29sdmVyczogW0VsZW1lbnRQbHVzUmVzb2x2ZXIoKV0sXG4gICAgICAgIGR0czogZmFsc2UsIC8vIFx1NzUxRlx1NEVBN1x1NzNBRlx1NTg4M1x1Nzk4MVx1NzUyOCBkdHMgXHU3NTFGXHU2MjEwXG4gICAgICB9KSxcbiAgICAgIC8vIFx1NjMwOVx1OTcwMFx1NUYxNVx1NTE2NSBFbGVtZW50IFBsdXMgXHU1NkZFXHU2ODA3XHVGRjA4XHU3NTI4IGljb25pZnktanNvbi9lcCBcdTY1NzBcdTYzNkVcdTZFOTBcdUZGMENcdTUzNTVcdTRFMkEgU1ZHIFx1N0VBNiAxS0JcdUZGMDlcbiAgICAgIC8vIFx1NEY3Rlx1NzUyOFx1NjVCOVx1NUYwRlx1RkYxQWltcG9ydCBUb3BJY29uIGZyb20gJ35pY29ucy9lcC90b3AnXG4gICAgICAvLyBcdTU3MjggPHNjcmlwdCBzZXR1cD4gXHU0RTJEXHU1M0VGXHU3NkY0XHU2M0E1IDxUb3BJY29uIC8+IFx1NjIxNlx1OTAxQVx1OEZDN1x1NTIyQlx1NTQwRCA8VG9wIC8+IFx1NUYxNVx1NzUyOFxuICAgICAgSWNvbnMoe1xuICAgICAgICBjb21waWxlcjogJ3Z1ZTMnLFxuICAgICAgICBhdXRvSW5zdGFsbDogdHJ1ZSxcbiAgICAgICAgY29sbGVjdGlvbnM6IHtcbiAgICAgICAgICBlcDogKCkgPT4gaW1wb3J0KCdAaWNvbmlmeS1qc29uL2VwL2ljb25zLmpzb24nKS50aGVuKGkgPT4gaS5kZWZhdWx0IGFzIGFueSksXG4gICAgICAgIH0sXG4gICAgICAgIC8vIFx1OEJBOVx1NkJDRlx1NEUyQVx1NTZGRVx1NjgwN1x1OUVEOFx1OEJBNFx1NEY1Q1x1NEUzQSBWdWUgXHU3RUM0XHU0RUY2XHU2Q0U4XHU1MThDXHVGRjA4UGFzY2FsQ2FzZSBcdTU0N0RcdTU0MERcdUZGMDlcbiAgICAgICAgZGVmYXVsdENsYXNzOiAnaW5saW5lLWJsb2NrJyxcbiAgICAgICAgLy8gXHU3NTFGXHU2MjEwIGljb25zLmQudHMgXHU3QzdCXHU1NzhCXHU1OEYwXHU2NjBFXHVGRjBDXHU5MTREXHU1NDA4IHZpdGUtZW52LmQudHMgXHU3Njg0IH5pY29ucy8qIHNoaW0gXHU4OUUzXHU1MUIzIFRTIFx1NjJBNVx1OTUxOVxuICAgICAgICBkdHM6ICdzcmMvdHlwZXMvYXV0by1pY29ucy5kLnRzJyxcbiAgICAgIH0pLFxuICAgICAgLy8gXHU0RUM1XHU3NTFGXHU0RUE3XHU3M0FGXHU1ODgzXHU1MzhCXHU3RjI5XG4gICAgICAuLi4oaXNQcm9kID8gW1xuICAgICAgICB2aXRlQ29tcHJlc3Npb24oe1xuICAgICAgICAgIGFsZ29yaXRobTogJ2Jyb3RsaUNvbXByZXNzJyxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDUxMjAsIC8vIDVLQiBcdTRFRTVcdTRFMEFcdTYyNERcdTUzOEJcdTdGMjlcbiAgICAgICAgICBleHQ6ICcuYnInLFxuICAgICAgICAgIGRlbGV0ZU9yaWdpbkZpbGU6IGZhbHNlLFxuICAgICAgICB9KSxcbiAgICAgICAgdml0ZUNvbXByZXNzaW9uKHtcbiAgICAgICAgICBhbGdvcml0aG06ICdnemlwJyxcbiAgICAgICAgICB0aHJlc2hvbGQ6IDUxMjAsXG4gICAgICAgICAgZXh0OiAnLmd6JyxcbiAgICAgICAgICBkZWxldGVPcmlnaW5GaWxlOiBmYWxzZSxcbiAgICAgICAgfSksXG4gICAgICBdIDogW10pLFxuICAgIF0sXG4gICAgcmVzb2x2ZToge1xuICAgICAgYWxpYXM6IHtcbiAgICAgICAgXCJAXCI6IHBhdGgucmVzb2x2ZShcIi4vc3JjXCIpLFxuICAgICAgICAndi1jb2RlLWRpZmYnOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnbm9kZV9tb2R1bGVzL3YtY29kZS1kaWZmL2Rpc3QvdjMvaW5kZXguZXMuanMnKSxcbiAgICAgIH1cbiAgICB9LFxuICAgIGJ1aWxkOiB7XG4gICAgICB0YXJnZXQ6ICdlczIwMjAnLFxuICAgICAgY3NzQ29kZVNwbGl0OiB0cnVlLFxuICAgICAgc291cmNlbWFwOiBmYWxzZSxcbiAgICAgIG1pbmlmeTogJ3RlcnNlcicsXG4gICAgICB0ZXJzZXJPcHRpb25zOiB7XG4gICAgICAgIGNvbXByZXNzOiB7XG4gICAgICAgICAgZHJvcF9jb25zb2xlOiB0cnVlLFxuICAgICAgICAgIGRyb3BfZGVidWdnZXI6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgcmVwb3J0Q29tcHJlc3NlZFNpemU6IGZhbHNlLFxuICAgICAgcm9sbHVwT3B0aW9uczoge1xuICAgICAgICBvdXRwdXQ6IHtcbiAgICAgICAgICBtYW51YWxDaHVua3M6IHtcbiAgICAgICAgICAgIC8vIFZ1ZSBcdTY4MzhcdTVGQzMgKyBcdThERUZcdTc1MzEgKyBcdTcyQjZcdTYwMDFcdTdCQTFcdTc0MDZcdUZGMDhcdTk5OTZcdTVDNEZcdTVGQzVcdTRFMEJcdUZGMDlcbiAgICAgICAgICAgICd2dWUtdmVuZG9yJzogWyd2dWUnLCAndnVlLXJvdXRlcicsICdwaW5pYSddLFxuICAgICAgICAgICAgLy8gRWxlbWVudCBQbHVzIFx1NTM1NVx1NzJFQ1x1NjIxMCBjaHVua1x1RkYxQVx1NjVCOVx1NEZCRlx1OTk5Nlx1NUM0RiBwcmVsb2FkXHVGRjBDXHU0RTE0XHU0RTBFIGljb24gY2h1bmsgXHU4OUUzXHU4MDI2XG4gICAgICAgICAgICAvLyBcdUZGMDhpY29uIFx1NEUwRFx1NUYzQVx1NTIzNlx1OEZEQlx1NkI2NCBjaHVua1x1RkYwQ1x1OEJBOSBSb2xsdXAgXHU2MzA5XHU1RjE1XHU3NTI4XHU5ODc1XHU4MUVBXHU1MkE4XHU1MjA2XHU1MzA1XHVGRjA5XG4gICAgICAgICAgICAnZWxlbWVudC1wbHVzJzogWydlbGVtZW50LXBsdXMnXSxcbiAgICAgICAgICAgICdlZGl0b3InOiBbJ0B3YW5nZWRpdG9yL2VkaXRvcicsICdAd2FuZ2VkaXRvci9lZGl0b3ItZm9yLXZ1ZSddLFxuICAgICAgICAgICAgJ2NoYXJ0cyc6IFsnZWNoYXJ0cyddLFxuICAgICAgICAgICAgJ2NvZGVtaXJyb3InOiBbJ2NvZGVtaXJyb3InLCAnQGNvZGVtaXJyb3IvY29tbWFuZHMnLCAnQGNvZGVtaXJyb3IvbGFuZy1qYXZhc2NyaXB0JywgJ0Bjb2RlbWlycm9yL2xhbmctanNvbiddLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgY2h1bmtGaWxlTmFtZXM6ICdqcy9bbmFtZV0tW2hhc2hdLmpzJyxcbiAgICAgICAgICBlbnRyeUZpbGVOYW1lczogJ2pzL1tuYW1lXS1baGFzaF0uanMnLFxuICAgICAgICAgIGFzc2V0RmlsZU5hbWVzOiAoYXNzZXRJbmZvKSA9PiB7XG4gICAgICAgICAgICBpZiAoYXNzZXRJbmZvLm5hbWUuZW5kc1dpdGgoJy5jc3MnKSkgcmV0dXJuICdjc3MvW25hbWVdLVtoYXNoXVtleHRuYW1lXSdcbiAgICAgICAgICAgIHJldHVybiAnYXNzZXRzL1tuYW1lXS1baGFzaF1bZXh0bmFtZV0nXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgfSxcbiAgICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogODAwLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBob3N0OiBlbnYuVklURV9IT1NULFxuICAgICAgLy8gXHU5ODg0XHU3MEVEXHU1RTM4XHU3NTI4XHU2QTIxXHU1NzU3XG4gICAgICB3YXJtdXA6IHtcbiAgICAgICAgY2xpZW50RmlsZXM6IFsnLi9zcmMvbWFpbi50cycsICcuL3NyYy9BcHAudnVlJywgJy4vc3JjL3JvdXRlci9pbmRleC50cyddLFxuICAgICAgfSxcbiAgICAgIC8vIFdpbmRvd3MgXHU0RTBCIGNob2tpZGFyIFx1N0VDRlx1NUUzOFx1NkYwRlx1NEU4Qlx1NEVGNlx1RkYwOFx1ODhBQlx1Njc0MFx1NkJEMi9cdTdEMjJcdTVGMTVcdTY3MERcdTUyQTFcdTYyRTZcdTYyMkFcdUZGMDlcdUZGMENcdTY1MzlcdTc1MjhcdThGNkVcdThCRTJcdTRGRERcdThCQzEgSE1SIFx1N0EzM1x1NUI5QVxuICAgICAgd2F0Y2g6IHtcbiAgICAgICAgdXNlUG9sbGluZzogdHJ1ZSxcbiAgICAgICAgaW50ZXJ2YWw6IDMwMCxcbiAgICAgIH0sXG4gICAgICBwcm94eToge1xuICAgICAgICAnL2FwaS9hZ25lcy1jaGF0Jzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9hZ25lcy12aWRlbyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvYWduZXMtdmlkZW8tc3RhdHVzJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9hZ25lcy1pbWFnZS1nZW5lcmF0aW9ucyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvYWduZXMvY2hhdCc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL2FnbmVzLWFpLmNvbS9hcGkvdjEnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgICByZXdyaXRlOiAocGF0aCkgPT4gcGF0aC5yZXBsYWNlKC9eXFwvYXBpXFwvYWduZXNcXC9jaGF0LywgJy9jaGF0JyksXG4gICAgICAgICAgc2VjdXJlOiBmYWxzZVxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9hZ25lcy92aWRlb3MnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cHM6Ly9hZ25lcy1haS5jb20vYXBpL3YxJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL2FnbmVzXFwvdmlkZW9zLywgJy92aWRlb3MnKSxcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FnbmVzJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHBzOi8vYWduZXMtYWkuY29tJyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaVxcL2FnbmVzLywgJy9hcGkvdjEnKSxcbiAgICAgICAgICBzZWN1cmU6IGZhbHNlXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL3BvbGxpbmF0aW9ucyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwczovL2ltYWdlLnBvbGxpbmF0aW9ucy5haScsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGlcXC9wb2xsaW5hdGlvbnMvLCAnJyksXG4gICAgICAgICAgaGVhZGVyczoge1xuICAgICAgICAgICAgLy8gVG9rZW4gXHU0RUNFIC5lbnYuKiBcdThCRkJcdTUzRDZcdUZGMENcdTc5ODFcdTZCNjJcdTc4NkNcdTdGMTZcdTc4MDFcdThGREJcdTZFOTBcdTc4MDFcbiAgICAgICAgICAgIEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHtlbnYuVklURV9QT0xMSU5BVElPTlNfQVBJX0tFWSB8fCAnJ31gXG4gICAgICAgICAgfVxuICAgICAgICB9LFxuICAgICAgICBbZW52LlZJVEVfQVBQX0JBU0VfQVBJXSA6IHtcbiAgICAgICAgICB0YXJnZXQ6IGVudi5WSVRFX1NFUlZFLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvbGlua3MnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2xldHRlcnMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2xldHRlcic6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvc2VuZC12ZXJpZmljYXRpb24tY29kZSc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvZW1haWwtcmVnaXN0ZXInOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2VtYWlsLWxvZ2luJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9lbWFpbC1wYXNzd29yZC1sb2dpbic6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvcmVzZXQtcGFzc3dvcmQnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FpLWFwcHMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2Zhdm9yaXRlLWFwcHMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2NvbmZlc3Npb24nOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2NvbmZlc3Npb24vbWVzc2FnZXMvZGVsZXRlJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9haS1wcm92aWRlcnMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FpLW1vZGVscyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvYWktcHJveHknOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL29wZW4tcHJvdmlkZXJzJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9vc3MtY29uZmlncyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvb3NzLXN0cyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvbGlmZS10cmFqZWN0b3JpZXMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FkbWluJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS90b29scyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvdG9vbHMvY3JlZGl0LWNvc3QnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL3Rvb2xzL21vZGVscyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvYWRtaW4vdG9vbC1tb2RlbHMnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FkbWluL3Rvb2wtbW9kZWxzLyc6IHtcbiAgICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjg3ODgnLFxuICAgICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgJy9hcGkvbWUnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FpLWltYWdlLWVkaXQnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvYXBpL2FpLW1lZGlhLXdvcmtzJzoge1xuICAgICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6ODc4OCcsXG4gICAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB9LFxuICAgICAgICAnL2FwaS9haS1vdXRmaXQnOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICAgICcvcy8nOiB7XG4gICAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo4Nzg4JyxcbiAgICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9XG4gICAgfSxcbiAgICAvLyBcdTRGOURcdThENTZcdTRGMThcdTUzMTZcbiAgICBvcHRpbWl6ZURlcHM6IHtcbiAgICAgIGluY2x1ZGU6IFtcbiAgICAgICAgJ3Z1ZScsXG4gICAgICAgICd2dWUtcm91dGVyJyxcbiAgICAgICAgJ3BpbmlhJyxcbiAgICAgICAgJ2F4aW9zJyxcbiAgICAgICAgJ2VsZW1lbnQtcGx1cycsXG4gICAgICAgICdsb2Rhc2gnLFxuICAgICAgXSxcbiAgICAgIC8vIEBlbGVtZW50LXBsdXMvaWNvbnMtdnVlIFx1NTE2OFx1OTFDRiB+MjUwS0JcdUZGMENcdTYzMDlcdTk3MDAgRVNNIGltcG9ydCBcdTUzNzNcdTUzRUZcdUZGMENcdTY1RTBcdTk3MDBcdTk4ODRcdTY3ODRcdTVFRkFcdTUxNjhcdTkwRThcbiAgICAgIC8vIFx1NTQwRVx1N0VFRFx1NTNFRlx1NjUzOSB1bnBsdWdpbi1pY29ucyArIEBpY29uaWZ5LWpzb24vZXAgXHU1QjlFXHU3M0IwIGljb24tbGV2ZWwgXHU2MzA5XHU5NzAwXHVGRjA4NDUrIFx1NTkwNCBpbXBvcnQgXHU2NkZGXHU2MzYyXHVGRjA5XG4gICAgICBleGNsdWRlOiBbXG4gICAgICAgICdAd2FuZ2VkaXRvci9lZGl0b3InLFxuICAgICAgICAnQGVsZW1lbnQtcGx1cy9pY29ucy12dWUnLFxuICAgICAgICAnZWNoYXJ0cycsXG4gICAgICAgICd0aHJlZScsXG4gICAgICAgICdwZGZqcy1kaXN0JyxcbiAgICAgIF0sXG4gICAgfSxcbiAgfVxufSkiXSwKICAibWFwcGluZ3MiOiAiO0FBQStQLFNBQVMsY0FBYyxlQUE0QjtBQUNsVCxPQUFPLFNBQVM7QUFDaEIsU0FBUyw0QkFBNEI7QUFDckMsT0FBTyxVQUFVO0FBQ2pCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sZ0JBQWdCO0FBQ3ZCLFNBQVMsMkJBQTJCO0FBQ3BDLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sZ0JBQWdCO0FBQ3ZCLE9BQU8sV0FBVztBQUNsQixPQUFPLHFCQUFxQjtBQVg1QixJQUFNLG1DQUFtQztBQStCekMsU0FBUyxpQkFBeUI7QUFDaEMsU0FBTztBQUFBLElBQ0wsTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBLElBQ1Asb0JBQW9CO0FBQUEsTUFDbEIsT0FBTztBQUFBLE1BQ1AsUUFBUSxNQUFNO0FBRVosY0FBTSxZQUFZLEtBQUssUUFBUSxrQ0FBVywrQkFBK0I7QUFDekUsY0FBTSxVQUFVLGFBQWEsV0FBVyxPQUFPO0FBQy9DLGNBQU0sT0FBTyxvQkFBSSxJQUFZO0FBQzdCLGNBQU0sUUFB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

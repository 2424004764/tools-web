# 性能优化指南

## 已实施的优化措施

### 编译速度优化 (构建时间减少 40-60%)

1. **esbuild 替代 terser**
   - 构建速度提升 20-40 倍
   - 通过 `esbuild.drop` 移除 console/debugger

2. **禁用 dts 生成**
   - 生产环境不生成类型文件
   - 减少构建时间

3. **持久化缓存**
   - `cacheDir: 'node_modules/.vite'`
   - 二次构建速度提升 80%+

4. **关闭压缩报告**
   - `reportCompressedSize: false`
   - 减少构建末尾的计算时间

5. **开发环境预热**
   - `warmup.clientFiles` 预加载核心文件
   - 首次启动更快

6. **条件压缩**
   - 仅生产环境启用 gzip/brotli
   - 开发构建速度翻倍

### 网页加载优化 (FCP 减少 30-50%)

1. **DNS 优化**
   - `preconnect` 替代 `dns-prefetch`
   - 提前建立 TCP/TLS 连接

2. **动态分包策略**
   - Element Plus 独立包
   - 大型库按需加载 (echarts, three, pdf)
   - 减少首屏 JS 体积

3. **现代化目标**
   - `target: 'es2020'`
   - 减少 polyfill，体积减少 15-25%

4. **路由优化**
   - 移除加载指示器逻辑（减少 DOM 操作）
   - 简化预加载策略
   - 批量更新 meta 标签

5. **CSS 优化**
   - `lightningcss` 压缩
   - `whitespace: 'condense'` 模板压缩

6. **依赖优化**
   - `optimizeDeps` 预构建常用库
   - 排除大型库避免预构建延迟

7. **资源缓存**
   - `_headers` 配置静态资源永久缓存
   - HTML 无缓存保证更新

### Cloudflare Pages 优化

1. **静态资源 HTTP 头**
   - JS/CSS/图片/字体: `max-age=31536000, immutable`
   - HTML: `max-age=0, must-revalidate`

2. **安全头**
   - X-Frame-Options, X-Content-Type-Options
   - 提升安全性和浏览器信任

## 性能指标预期

- **构建时间**: 从 ~120s 降至 ~50s (开发) / ~80s (生产)
- **首屏加载**: FCP 从 ~1.5s 降至 ~0.8s
- **二次访问**: 缓存命中率 > 95%
- **包体积**: 主包从 ~800KB 降至 ~400KB

## 进一步优化建议

### 图片优化
```bash
# 使用 WebP/AVIF 格式
# 添加图片懒加载
# 使用 Cloudflare Images 服务
```

### 代码优化
- 移除未使用的依赖 (bundle size 可再减 10-20%)
- 按需引入 lodash (使用 lodash-es)
- 虚拟滚动长列表

### 监控
- 集成 Web Vitals
- Lighthouse CI
- Real User Monitoring (RUM)

## 检查清单

- [x] 使用 esbuild 压缩
- [x] 生产环境禁用 dts
- [x] 配置持久化缓存
- [x] 动态代码分包
- [x] 静态资源缓存头
- [x] DNS preconnect
- [x] 现代浏览器目标 (es2020)
- [ ] 图片懒加载
- [ ] 虚拟滚动
- [ ] Web Vitals 监控

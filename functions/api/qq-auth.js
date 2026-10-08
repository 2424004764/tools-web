// QQ OAuth 回调的 /api/ 路径入口：处理器复用根级 /qq-auth。
// 单独暴露这个路径是因为 Service Worker 的 navigateFallback denylist
// 从第一版起就放行 /^\/api\//，OAuth 回调页导航到这里不会被旧 SW 拦成 SPA 壳。
export { onRequest } from '../qq-auth.js';

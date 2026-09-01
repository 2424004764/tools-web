// /api/admin/error-logs/{id} —— Pages 文件路由只把 index.js 映射到目录本身（/api/admin/error-logs），
// 子路径需要本文件转发到同一个处理器（与 travel-maps/[id].js、redeem-code-batches/[batchId].js 同款写法）。
// 实际逻辑在 index.js：PATCH 标记/撤销「已处理」；GET/DELETE 命中子路径时由 index.js 返回相应错误。
export { onRequest } from './index.js'

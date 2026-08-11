// /api/travel-maps/{id} —— Pages 文件路由只把 travel-maps.js 映射到精确路径，
// 子路径需要本文件转发到同一个处理器（与 notes/[id].js、bookmarks/[id].js 同款写法）
export { onRequest, onRequestOptions } from '../travel-maps.js'

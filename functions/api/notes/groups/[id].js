// /api/notes/groups/{id} 单分组路径 - 委托给 notes.js 统一 dispatch（path 提取后为 '/groups/{id}'）
export { onRequest, onRequestOptions } from '../../notes.js'
// /api/notes/groups 精确路径 - 委托给 notes.js 统一 dispatch（path 提取后为 '/groups'）
export { onRequest, onRequestOptions } from '../../notes.js'
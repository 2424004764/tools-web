// 分类工具「按使用热度排序」
//
// 设计：
//   - 点击量只参与服务端排序（/api/tools/hot 按 tool_usage_records 聚合降序），
//     次数本身不返回给前端，前端只消费返回顺序
//   - 全站共享一次请求（模块级缓存 Promise），首页多个分类 / 分类页复用同一份热度序
//   - 未开启热度排序的分类不受影响；热度结果里没有的工具（如请求后新上架）
//     稳定排在末尾并保持原相对顺序

import { ref } from 'vue'
import { functionsRequest } from '@/utils/functionsRequest'
import type { ToolCate, ToolsInfo } from '@/components/Tools/tools.type'

interface HotToolsResponse {
  categories?: ToolCate[]
  fallback?: boolean
}

// cateId → 该分类按热度降序的工具 url 列表
const hotOrderMap = ref<Map<number, string[]>>(new Map())
const hotCateIds = ref<Set<number>>(new Set())
const hotLoading = ref(false)

let hotOrderPromise: Promise<Map<number, string[]>> | null = null

function ensureHotOrder(): Promise<Map<number, string[]>> {
  if (!hotOrderPromise) {
    hotLoading.value = true
    hotOrderPromise = functionsRequest
      .get<HotToolsResponse>('/api/tools/hot')
      .then((res) => {
        const map = new Map<number, string[]>()
        for (const cate of res.data?.categories || []) {
          map.set(cate.id, (cate.list || []).map((t) => t.url))
        }
        hotOrderMap.value = map
        return map
      })
      .catch((err) => {
        console.warn('[useHotSort] 热度排序加载失败：', err?.message || err)
        // 置空允许下次点击重试
        hotOrderPromise = null
        throw err
      })
      .finally(() => {
        hotLoading.value = false
      })
  }
  return hotOrderPromise
}

export function useHotSort() {
  const isHot = (cateId: number) => hotCateIds.value.has(cateId)

  /** 切换某分类的排序方式：默认序 ↔ 热度序（再次点击恢复默认） */
  const toggleHot = async (cateId: number) => {
    if (hotCateIds.value.has(cateId)) {
      const next = new Set(hotCateIds.value)
      next.delete(cateId)
      hotCateIds.value = next
      return
    }
    try {
      await ensureHotOrder()
      const next = new Set(hotCateIds.value)
      next.add(cateId)
      hotCateIds.value = next
    } catch {
      // 失败提示由 functionsRequest 拦截器统一弹出，这里保持默认排序即可
    }
  }

  /** 返回该分类应展示的列表：未开启热度序时原样返回 */
  const applyHotSort = (cateId: number, list: ToolsInfo[]): ToolsInfo[] => {
    const items = list || []
    if (!hotCateIds.value.has(cateId)) return items
    const order = hotOrderMap.value.get(cateId)
    if (!order || order.length === 0) return items
    const rank = new Map(order.map((url, i) => [url, i]))
    return items
      .map((item, i) => ({ item, key: rank.get(item.url) ?? order.length + i }))
      .sort((a, b) => a.key - b.key)
      .map((entry) => entry.item)
  }

  return { hotLoading, isHot, toggleHot, applyHotSort }
}

//创建tools相关的小工具
import { defineStore } from 'pinia'
import { getTools, getToolsCate } from '@/components/Tools/tools.ts'
import { getIp } from '@/api/ip'
import type { ToolsReqData, ToolsInfo, ToolCate } from '@/components/Tools/tools.type.ts'
import type { IpReqData, IpInfo } from '@/api/ip/type'
import type { WebInfo, WebInfoReqData } from '@/api/webinfo/type'
import { fetchWebInfo } from '@/api/webinfo'
import { functionsRequest } from '@/utils/functionsRequest'

// /api/tools 返回结构
interface PublicToolsResponse {
  data: ToolsInfo[]
  categories?: ToolCate[]
  /** 已停用（工具自身或所属分类关闭）的工具 url 列表，供路由守卫拦截直达链接 */
  disabled?: string[]
  fallback?: boolean
}

// loadToolsFromApi 的在途去重：路由守卫与首页/博客页可能并发触发加载，
// 避免同一个 /api/tools 请求发多份
let _toolsLoading: Promise<void> | null = null

// 工具路径归一（去尾斜杠 + 小写）：DB 里 url 形如 '/xxx/'，路由 to.path 是 '/xxx'
function normalizeToolPath(p: string): string {
  return p.replace(/\/+$/, '').toLowerCase()
}

export const useToolsStore = defineStore('tools', {
  //用来存放变量
  state: () => ({
    list: [] as ToolsInfo[],
    toolInfo: {} as ToolsInfo,
    cates: [] as ToolCate[],
    // 分类/工具列表是否正在请求中（供首页等内容区渲染骨架屏，避免加载期间空白）
    catesLoading: false,
    recommends: [] as ToolsInfo[],
    ipData: {} as IpInfo,
    webInfo: {} as WebInfo,
    collect: [] as ToolsInfo[],
    collectIds: [] as number[],
    // 后台「工具开关」已停用的工具 url（工具自身 is_enabled=0 或所属分类停用），
    // 供路由守卫把直达链接跳 404；仅 authoritative=true 时有效
    disabledUrls: [] as string[],
    // list/cates 是否来自 /api/tools 的权威数据。fallback 本地 tools.ts 清单
    // 不知道后台开关状态，此时守卫放行（fail-open），深链由服务端中间件兜底拦截
    authoritative: false,
  }),
  //方法
  actions: {
    /**
     * 从公开 API /api/tools 拉取启用中的工具。
     * 若 API 返回 fallback=true（迁移未跑）或网络失败，回退到本地 tools.ts。
     * 同时把扁平列表写入 state.list（供搜索等场景）。
     * 并发调用共享在途请求（路由守卫与首页可能同时触发）。
     */
    async loadToolsFromApi(): Promise<void> {
      if (!_toolsLoading) {
        _toolsLoading = this._fetchTools().finally(() => {
          _toolsLoading = null
        })
      }
      return _toolsLoading
    },

    /** loadToolsFromApi 的实际实现（勿直接调用，走外层的在途去重） */
    async _fetchTools(): Promise<void> {
      this.catesLoading = true
      try {
        const res = await functionsRequest.get<PublicToolsResponse>('/api/tools')
        const payload = res.data
        if (payload?.fallback || !payload?.data || payload.data.length === 0) {
          // 未迁移或表为空，用本地数据
          await this.loadFromLocal()
          return
        }
        // categories 与 cates 形状需对齐 ToolsInfo 中的 url 已是带 / 的路径
        const cates: ToolCate[] = payload.categories?.length
          ? payload.categories
          : this._groupToCates(payload.data)
        this.cates = cates
        this.list = payload.data
        this.disabledUrls = Array.isArray(payload.disabled) ? payload.disabled : []
        this.authoritative = true
      } catch (err) {
        console.warn('[useToolsStore] /api/tools 加载失败，回退到 tools.ts:', err)
        await this.loadFromLocal()
      } finally {
        this.catesLoading = false
      }
    },

    /** 从本地 tools.ts 加载（fallback 路径） */
    async loadFromLocal(): Promise<void> {
      const cates = await getToolsCate()
      this.cates = cates as any
      this.list = this._flattenCates(cates as any)
      // 本地清单不含后台开关状态，重置标记让路由守卫放行（服务端中间件兜底）
      this.authoritative = false
      this.disabledUrls = []
    },

    /**
     * 该路径是否为后台已停用的工具页（后台关了，前台直达要跳 404）。
     * 仅在 authoritative=true（数据来自 /api/tools）时判定，其余情况一律放行。
     * path 传路由的 to.path（'/userinfo/todos' 或 '/userinfo/todos/' 均可）。
     */
    isToolDisabled(path: string): boolean {
      if (!this.authoritative || this.disabledUrls.length === 0) return false
      const norm = normalizeToolPath(path)
      if (!norm) return false
      return this.disabledUrls.some((u) => normalizeToolPath(u) === norm)
    },

    /** 把 ToolsInfo[] 按 cateId 折叠为 ToolCate[] */
    _groupToCates(items: ToolsInfo[]): ToolCate[] {
      const map = new Map<number, ToolCate>()
      for (const item of items) {
        const cid = item.cateId ?? 0
        if (!map.has(cid)) {
          map.set(cid, {
            id: cid,
            title: item.cate || '其他',
            img: '',
            desc: '',
            url: '',
            cate: item.cate || '其他',
            list: [],
          })
        }
        map.get(cid)!.list.push(item)
      }
      return Array.from(map.values())
    },

    /** 把 ToolCate[] 扁平为 ToolsInfo[] */
    _flattenCates(cates: ToolCate[]): ToolsInfo[] {
      const list: ToolsInfo[] = []
      for (const c of cates) {
        for (const t of c.list) list.push(t)
      }
      return list
    },

    /**
     * 兼容旧调用：返回扁平工具列表。
     * 优先用 state.list（API 数据），否则回退到 tools.ts 的同步 getTools。
     */
    async getTools(data: ToolsReqData): Promise<ToolsInfo[]> {
      // 若 store 已有数据，按入参过滤
      if (this.list.length > 0) {
        return this._filterTools(this.list, data)
      }
      // 否则先尝试拉 API
      await this.loadToolsFromApi()
      if (this.list.length > 0) {
        return this._filterTools(this.list, data)
      }
      // 最后兜底
      return getTools(data)
    },

    async getToolInfo(data: ToolsReqData) {
      const result = await this.getTools(data)
      this.toolInfo = result[0] || ({} as ToolsInfo)
      return this.toolInfo
    },

    /**
     * 兼容旧调用：填充分类列表。
     * 优先用 state.cates，否则拉 API / 回退到 tools.ts。
     */
    async getToolCate(): Promise<ToolCate[]> {
      if (this.cates.length > 0) return this.cates
      await this.loadToolsFromApi()
      if (this.cates.length > 0) return this.cates
      const cates = await getToolsCate()
      this.cates = cates as any
      return this.cates
    },

    _filterTools(source: ToolsInfo[], data: ToolsReqData): ToolsInfo[] {
      const { cateId, title } = data
      let list = source
      if (title) {
        const search = title.toLowerCase()
        list = list.filter((item) => {
          const t = (item.title || '').toLowerCase()
          const d = (item.desc || '').toLowerCase()
          const u = (item.url || '').toLowerCase()
          return t.includes(search) || d.includes(search) || u.includes(search)
        })
      }
      if (cateId && cateId > 0) {
        list = list.filter((item) => item.cateId === cateId)
      }
      return list
    },

    //获取ip
    async getIp(data: IpReqData) {
      const result: any = await getIp(data)
      if (result.code == 200) {
        this.ipData = result.data
        return result.message
      } else {
        return Promise.reject(new Error(result.message))
      }
    },

    //获取网站信息
    async getWebInfo(data: WebInfoReqData) {
      const result: any = await fetchWebInfo(data)
      if (result.code == 200) {
        this.webInfo = result.data
        return result.message
      } else {
        return Promise.reject(new Error(result.message))
      }
    },
  },
})
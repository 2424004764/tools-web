// 提示词模板变量：识别 {{xxx}} 占位符 → 生成填写表单数据 → 提交前替换为用户填写的值。
// 变量名支持英文/数字/下划线/连字符/中文，如 {{topic}}、{{ orientation }}、{{主体}}；
// 同名变量只出一行表单；填写值按变量名缓存到 localStorage，刷新页面后自动恢复。
// 另提供 highlightHtml：把 {{var}} 渲染成「填写值 + 彩色标记」的 HTML（给 textarea
// 下的高亮背板用，v-html 注入；所有动态内容先经 HTML 转义）。
import { reactive, computed, watch } from 'vue'
import type { Ref } from 'vue'

/** 单个模板变量：name 为占位符里的原始名，label 为表单展示名（优先中文映射），token 为原始占位符字面量 */
export interface PromptVarColor {
  bg: string
  text: string
}

export interface PromptVar {
  name: string
  label: string
  token: string
  /** 该变量的标识色：同一变量在表单和高亮里永远同色 */
  color: PromptVarColor
}

// 常见变量名的中文展示映射；未收录的变量直接展示原始名
const VAR_LABEL_MAP: Record<string, string> = {
  topic: '主体',
  subject: '主体',
  theme: '主题',
  orientation: '版式方向',
  layout: '版式',
  style: '风格',
  scene: '场景',
  background: '背景',
  color: '颜色',
  mood: '氛围',
  text: '文字内容',
  title: '标题',
  name: '名称',
  count: '数量',
  language: '语言',
}

// 高亮配色板：按变量出现顺序循环取色。同一变量只取一次色，所以同名变量永远同色；
// 不同变量相邻取不同色，最多 8 个变量后才重复。
const VAR_COLOR_PALETTE: PromptVarColor[] = [
  { bg: '#dbeafe', text: '#1d4ed8' }, // 蓝
  { bg: '#dcfce7', text: '#15803d' }, // 绿
  { bg: '#ffedd5', text: '#c2410c' }, // 橙
  { bg: '#f3e8ff', text: '#7e22ce' }, // 紫
  { bg: '#cffafe', text: '#0e7490' }, // 青
  { bg: '#fce7f3', text: '#be185d' }, // 粉
  { bg: '#fef3c7', text: '#a16207' }, // 黄
  { bg: '#e0e7ff', text: '#4338ca' }, // 靛
]

const VAR_RE = /\{\{\s*([\w\u4e00-\u9fa5-]+)\s*\}\}/g

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function usePromptVars(prompt: Ref<string>, cacheKey: string) {
  // 变量名 → 用户填写值。键随提示词里的变量动态增删，Vue3 reactive proxy 对新增键天然响应
  const values = reactive<Record<string, string>>({})

  // 恢复上次填写的值（和提示词缓存配套：刷新后模板恢复了，填写值也恢复）
  try {
    const cached = localStorage.getItem(cacheKey)
    if (cached) {
      const obj = JSON.parse(cached) as Record<string, unknown>
      for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string') values[k] = v
      }
    }
  } catch {
    // localStorage 不可用（隐私模式等）或 JSON 异常，静默忽略
  }

  watch(
    values,
    () => {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(values))
      } catch {
        // 静默忽略
      }
    },
  )

  // 解析当前提示词里的变量（去重 + 按出现顺序，颜色按顺序从配色板取）
  const vars = computed<PromptVar[]>(() => {
    const seen = new Set<string>()
    const list: PromptVar[] = []
    VAR_RE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = VAR_RE.exec(prompt.value)) !== null) {
      const name = m[1]
      if (seen.has(name)) continue
      seen.add(name)
      list.push({
        name,
        label: VAR_LABEL_MAP[name.toLowerCase()] || name,
        token: '{{' + name + '}}',
        color: VAR_COLOR_PALETTE[list.length % VAR_COLOR_PALETTE.length],
      })
    }
    return list
  })

  // 还没填的变量：触发生成时用于拦截提示 + 表单红框
  const unfilledVars = computed(() =>
    vars.value.filter((v) => !(values[v.name] || '').trim()),
  )

  // 把模板里的 {{var}} 替换为填写值；没填的原样保留（生成入口会拦住未填齐的情况）
  const resolve = (text: string) =>
    text.replace(VAR_RE, (raw, name: string) => {
      const v = (values[name] || '').trim()
      return v ? v : raw
    })

  // 提示词高亮 HTML：{{var}} 处显示已填的值并按变量着色，未填的保留原占位符并标红。
  // 仅供 v-html 背板层使用：先整体转义原文，再替换成 mark 标签，填写值单独转义后再插入。
  const highlightHtml = computed(() => {
    if (!vars.value.length) return ''
    const colorMap = new Map(vars.value.map((v) => [v.name, v.color]))
    return escapeHtml(prompt.value).replace(VAR_RE, (raw, name: string) => {
      const val = (values[name] || '').trim()
      if (!val) return `<mark class="ph-mark ph-mark--empty">${raw}</mark>`
      const c = colorMap.get(name) || VAR_COLOR_PALETTE[0]
      return `<mark class="ph-mark" style="background-color:${c.bg};color:${c.text}">${escapeHtml(val)}</mark>`
    })
  })

  return { vars, values, unfilledVars, resolve, highlightHtml }
}

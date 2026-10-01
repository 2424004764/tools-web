// AI 帮我找工具：把用户自然语言需求 + 全站工具目录交给 Agnes（免费 AI），
// 让模型返回最匹配的工具与推荐理由。前端只做目录拼装与 JSON 解析，不经过后端新接口。
import { ref } from 'vue'
import type { ToolsInfo } from '@/components/Tools/tools.type'
import { useToolsStore } from '@/store/modules/tools'
import { aiManager, type ChatMessage } from '@/spi'

export interface AiToolMatch {
  tool: ToolsInfo
  reason: string
}

export interface AiFindResult {
  summary: string
  matches: AiToolMatch[]
}

const MAX_MATCHES = 5
const MAX_DESC_CHARS = 60

// 从模型输出里抠出第一个完整 JSON 对象（容忍 ```json 围栏与前后废话）
function extractJson(text: string): { summary?: string; tools?: Array<{ url?: string; reason?: string }> } | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fenced ? fenced[1] : text
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    return JSON.parse(raw.slice(start, end + 1))
  } catch {
    return null
  }
}

export function useAiToolFinder() {
  const aiFinding = ref(false)

  /**
   * 根据自然语言需求找工具。
   * 目录来自 toolsStore（API 优先、tools.ts 兜底），无需登录即可调用。
   */
  async function aiFindTools(query: string): Promise<AiFindResult> {
    const trimmed = query.trim()
    if (!trimmed) return { summary: '请先描述你的需求', matches: [] }

    const toolsStore = useToolsStore()
    const cates = await toolsStore.getToolCate()

    // 拼装候选目录并建 url → 工具 的索引（AI 只允许从这个池子里选）
    const urlIndex = new Map<string, ToolsInfo>()
    const catalogLines: string[] = []
    for (const cate of cates) {
      for (const tool of cate.list || []) {
        if (!tool.url) continue
        urlIndex.set(tool.url, tool)
        catalogLines.push(
          `${tool.title}｜${tool.cate}｜${String(tool.desc || '').slice(0, MAX_DESC_CHARS)}｜${tool.url}`,
        )
      }
    }

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: [
          '你是「开发者工具箱」网站的找工具助手，根据用户需求从候选工具中挑出最合适的。',
          '候选工具每行格式：名称｜分类｜描述｜路径。',
          '要求：',
          `1. 只能从候选列表中选择，最多推荐 ${MAX_MATCHES} 个，按匹配程度从高到低排序。`,
          '2. reason 用一句话（不超过 20 字）说明为什么适合。',
          '3. summary 用一句话回应用户（不超过 30 字）。',
          '4. 没有合适的工具时返回空的 tools 数组，并在 summary 里说明。',
          '5. 严格只输出 JSON，格式：{"summary":"...","tools":[{"url":"路径","reason":"..."}]}，不要输出任何其他内容。',
        ].join('\n'),
      },
      {
        role: 'user',
        content: `用户需求：${trimmed}\n\n候选工具：\n${catalogLines.join('\n')}`,
      },
    ]

    const provider = aiManager.getProvider('agnes')
    if (!provider?.chat) {
      throw new Error('AI 服务不可用')
    }

    aiFinding.value = true
    try {
      const resp = await provider.chat(messages, { temperature: 0.2, maxTokens: 600 })
      const parsed = extractJson(resp.content || '')
      const rawList = Array.isArray(parsed?.tools) ? parsed.tools : []

      const matches: AiToolMatch[] = []
      const seen = new Set<string>()
      for (const item of rawList) {
        const url = String(item?.url || '')
        const tool = urlIndex.get(url)
        if (!tool || seen.has(url)) continue
        seen.add(url)
        matches.push({ tool, reason: String(item?.reason || '').slice(0, 60) })
        if (matches.length >= MAX_MATCHES) break
      }

      let summary = String(parsed?.summary || '').slice(0, 80)
      if (!summary) {
        summary = matches.length ? '为你找到这些工具：' : '没找到合适的工具，换个说法试试？'
      }
      return { summary, matches }
    } finally {
      aiFinding.value = false
    }
  }

  return { aiFinding, aiFindTools }
}

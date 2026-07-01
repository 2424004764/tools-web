// 用户当前选择的模型 composable
// 管理 chat/image/video 三类模型的当前选择
// 持久化到 localStorage，跨刷新保留

import { ref, computed, onMounted } from 'vue'
import { invalidateModelCache, type ModelConfig } from '../model-cache'

const STORAGE_KEY = 'tools_web_selected_models_v1'
const LEGACY_API_KEY = 'agnes_api_key'

interface SelectedModels {
  chat?: string         // model_key, e.g. 'agnes/agnes-2.0-flash'
  image?: string        // e.g. 'agnes/agnes-image-2.1-flash'
  image_edit?: string
  video?: string        // e.g. 'agnes/agnes-video-v2.0'
}

// 默认模型（seed 配置的）
const DEFAULTS: SelectedModels = {
  chat: 'agnes/agnes-2.0-flash',
  image: 'agnes/agnes-image-2.1-flash',
  video: 'agnes/agnes-video-v2.0',
}

const state = {
  selected: ref<SelectedModels>({ ...DEFAULTS }),
  needsMigration: ref(false),
  legacyKey: ref(''),
}

export function useUserModels() {
  onMounted(() => {
    loadFromStorage()
    detectLegacyKey()
  })

  // 当前选中的 chat 模型
  const chatModel = computed(() => state.selected.value.chat || DEFAULTS.chat!)
  // 当前选中的 image 模型
  const imageModel = computed(() => state.selected.value.image || DEFAULTS.image!)
  // 当前选中的 video 模型
  const videoModel = computed(() => state.selected.value.video || DEFAULTS.video!)

  /**
   * 设置指定类型模型的当前选择
   */
  function setSelected(type: keyof SelectedModels, modelKey: string) {
    state.selected.value = { ...state.selected.value, [type]: modelKey }
    saveToStorage()
  }

  /**
   * 加载所有可用模型
   */
  async function loadAvailableModels(): Promise<ModelConfig[]> {
    try {
      const res = await fetch('/api/ai-models')
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        return json.data.map((m: any) => ({
          ...m,
          capabilities: safeParseArr(m.capabilities),
          endpoints: safeParseObj(m.endpoints),
          input_template: safeParseObj(m.input_template),
          output_paths: safeParseObj(m.output_paths),
        }))
      }
      return []
    } catch (err) {
      console.error('loadAvailableModels error:', err)
      return []
    }
  }

  /**
   * 按 capability 过滤可用模型
   */
  async function loadModelsByCapability(capability: string): Promise<ModelConfig[]> {
    const all = await loadAvailableModels()
    return all.filter(m => m.capabilities?.includes(capability))
  }

  /**
   * 确认迁移旧 localStorage 中的 API Key 到私有厂商
   */
  async function migrateLegacyKey(): Promise<{ ok: boolean; message: string }> {
    if (!state.legacyKey.value) {
      return { ok: false, message: '没有需要迁移的旧配置' }
    }

    try {
      // 1. 创建私有厂商
      const provRes = await fetch('/api/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: '我的 Agnes',
          slug: 'my-agnes',
          base_url: 'https://apihub.agnes-ai.com/v1',
          api_key: state.legacyKey.value,
          is_public: 0,
          description: '从旧版 localStorage 迁移的私有厂商',
          icon: '🔑',
        })
      })
      const provJson = await provRes.json()
      if (!provJson.success) {
        return { ok: false, message: '创建厂商失败: ' + provJson.error }
      }

      const providerId = provJson.data.id

      // 2. 创建对应的私有模型（复用 seed 的同款配置）
      const modelTemplates = [
        {
          name: '我的 Chat 2.0 Flash',
          model_key: 'my-agnes/chat-flash',
          model_id: 'agnes-2.0-flash',
          capabilities: ['chat', 'chat_stream'],
        },
        {
          name: '我的 Video v2.0',
          model_key: 'my-agnes/video',
          model_id: 'agnes-video-v2.0',
          capabilities: ['video_submit', 'video_poll'],
        },
        {
          name: '我的 Image 2.1 Flash',
          model_key: 'my-agnes/image',
          model_id: 'agnes-image-2.1-flash',
          capabilities: ['image_generation', 'image_edit'],
        },
      ]

      const inputTemplate = {
        chat: { model: { '$ref': 'model_id' }, messages: { '$ref': 'messages' }, stream: { '$const': false }, temperature: { '$ref': 'temperature' } },
        chat_stream: { model: { '$ref': 'model_id' }, messages: { '$ref': 'messages' }, stream: { '$const': true }, temperature: { '$ref': 'temperature' } },
        video_submit: { model: { '$ref': 'model_id' }, prompt: { '$ref': 'prompt' }, num_frames: { '$ref': 'frames' }, frame_rate: { '$const': 24 }, width: { '$ref': 'width' }, height: { '$ref': 'height' }, extra_body: { image: { '$ref': 'images', '$omitIfEmpty': true } } },
        video_poll: null,
        image_generation: { model: { '$ref': 'model_id' }, prompt: { '$ref': 'prompt' }, size: { '$fn': 'join', args: ['width', 'height', 'x'] }, extra_body: { response_format: { '$const': 'url' } } },
        image_edit: { model: { '$ref': 'model_id' }, prompt: { '$ref': 'prompt' }, size: { '$fn': 'join', args: ['width', 'height', 'x'] }, extra_body: { image: { '$fn': 'wrap', args: ['source_image'] }, response_format: { '$const': 'url' } } },
      }

      const endpoints = {
        chat: { path: '/chat/completions', method: 'POST' },
        chat_stream: { path: '/chat/completions', method: 'POST' },
        video_submit: { path: '/videos', method: 'POST' },
        video_poll: { path: '/agnesapi', method: 'GET', query: 'video_id={video_id}' },
        image_generation: { path: '/images/generations', method: 'POST' },
        image_edit: { path: '/images/generations', method: 'POST' },
      }

      const outputPaths = {
        chat: { content: '$.choices[0].message.content' },
        chat_stream: { delta: '$.choices[0].delta.content' },
        video_submit: { video_id: '$.video_id' },
        video_poll: { status: '$.status', url: '$.video_url', remix_id: '$.remixed_from_video_id' },
        image_generation: { url: '$.data[0].url' },
        image_edit: { url: '$.data[0].url' },
      }

      for (const tpl of modelTemplates) {
        const templateSubset: Record<string, any> = {}
        tpl.capabilities.forEach(cap => {
          if (inputTemplate[cap as keyof typeof inputTemplate]) {
            templateSubset[cap] = inputTemplate[cap as keyof typeof inputTemplate]
          }
        })
        const endpointSubset: Record<string, any> = {}
        const outputSubset: Record<string, any> = {}
        tpl.capabilities.forEach(cap => {
          if (endpoints[cap as keyof typeof endpoints]) endpointSubset[cap] = endpoints[cap as keyof typeof endpoints]
          if (outputPaths[cap as keyof typeof outputPaths]) outputSubset[cap] = outputPaths[cap as keyof typeof outputPaths]
        })

        await fetch('/api/ai-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            provider_id: providerId,
            name: tpl.name,
            model_key: tpl.model_key,
            model_id: tpl.model_id,
            capabilities: tpl.capabilities,
            endpoints: endpointSubset,
            input_template: templateSubset,
            output_paths: outputSubset,
            description: '从旧版迁移的模型',
          })
        })
      }

      // 3. 自动切换到新模型
      state.selected.value = {
        chat: 'my-agnes/chat-flash',
        video: 'my-agnes/video',
        image: 'my-agnes/image',
      }
      saveToStorage()

      // 4. 清掉旧 localStorage
      localStorage.removeItem(LEGACY_API_KEY)
      state.needsMigration.value = false
      state.legacyKey.value = ''
      invalidateModelCache()

      return { ok: true, message: '迁移成功！已自动切换到「我的 Agnes」' }
    } catch (err: any) {
      return { ok: false, message: '迁移失败: ' + (err.message || '未知错误') }
    }
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw)
        state.selected.value = { ...DEFAULTS, ...parsed }
      }
    } catch {
      // ignore
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.selected.value))
    } catch {
      // ignore
    }
  }

  function detectLegacyKey() {
    const legacy = localStorage.getItem(LEGACY_API_KEY)
    if (legacy && legacy.trim()) {
      state.legacyKey.value = legacy.trim()
      state.needsMigration.value = true
    }
  }

  return {
    chatModel,
    imageModel,
    videoModel,
    setSelected,
    loadAvailableModels,
    loadModelsByCapability,
    needsMigration: computed(() => state.needsMigration.value),
    legacyKey: computed(() => state.legacyKey.value),
    migrateLegacyKey,
  }
}

function safeParseArr(s: any): string[] {
  if (Array.isArray(s)) return s
  if (typeof s === 'string') { try { return JSON.parse(s) } catch { return [] } }
  return []
}

function safeParseObj(s: any): Record<string, any> {
  if (s && typeof s === 'object' && !Array.isArray(s)) return s
  if (typeof s === 'string') { try { return JSON.parse(s) } catch { return {} } }
  return {}
}
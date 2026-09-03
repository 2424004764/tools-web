// 保存到「我的 AI 创作」画廊：生成完成一张就自动保存一张，无需手动、无总开关。
//   - 每张成功即调用 autoSaveSlot(slot)，并发生成的多张可并行各自保存
//   - 单张保存：init(拿到 group_id + 上传 URL) → 拉 blob（recordId 代理，绕 CORS）
//     → 上传 R2 → confirm 写入 D1
//   - 每格 saveStatus：idle → saving → saved / failed（失败可点「重试保存」）
//   - 已 saved / 正在 saving 的 slot 自动跳过（幂等 + 防并发重复）
//   - 只保存「勾选」的图（saveChecked）
import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import { fetchMyGenerationRecordImage } from '@/api/me'
import {
  initAiCreationSave,
  confirmAiCreationSave,
  uploadImageBlobToR2,
} from '@/api/ai-creations'
import type { ResultSlot } from './useSlotVisuals'

export function useSaveToCreations(opts: {
  results: ResultSlot[]
  prompt: Ref<string>
  selectedPromptId: Ref<string | null>
  selectedModel: Ref<string>
}) {
  const { results, prompt, selectedPromptId, selectedModel } = opts

  // 保存成功后记录对应 group_id + 成功张数；切换新一轮生成时清空
  const savedGroupIds = ref<number | null>(null)
  const savedImageCount = ref(0)
  // 正在保存的 slot id 集合：允许不同图并行保存，但同一张不能重复触发
  const savingSlotIds = new Set<string>()

  // 全部成功 slot（勾选框显示用）
  const successfulResults = computed(() =>
    results.filter((r) => r.status === 'success' && r.url),
  )

  /** 新一轮生成开始时：清掉已保存标记 + 重置每格的保存状态为 idle */
  const clearSavedFlags = () => {
    savedGroupIds.value = null
    savedImageCount.value = 0
    savingSlotIds.clear()
    for (const slot of results) {
      if (slot.status === 'success') slot.saveStatus = 'idle'
    }
  }

  // 单张取 blob：优先走后端生成记录代理（同源、绕过 CORS、支持 data: base64 图）
  const fetchSlotBlob = async (slot: ResultSlot): Promise<Blob> => {
    if (slot.recordId) {
      const got = await fetchMyGenerationRecordImage(slot.recordId)
      return got.blob
    }
    const res = await fetch(slot.url)
    if (!res.ok) throw new Error(`fetch upstream 失败: HTTP ${res.status}`)
    return await res.blob()
  }

  /**
   * 保存单张图（生成成功 / 重试共用）。
   * 幂等：已 saved 或正在 saving 的 slot 直接返回，避免并发重复保存同一张。
   * 每张独立 init（同一 prompt_id 会自动复用同一 group）。
   */
  const autoSaveSlot = async (slot: ResultSlot) => {
    if (!slot.url) return
    if (slot.saveChecked === false) return // 用户没勾选这张
    if (slot.saveStatus === 'saved' || slot.saveStatus === 'saving') return
    if (savingSlotIds.has(slot.id)) return

    const promptId = selectedPromptId.value
    const promptTextStr = prompt.value || ''

    slot.saveStatus = 'saving'
    savingSlotIds.add(slot.id)
    try {
      const init = await initAiCreationSave({
        prompt_id: promptId || undefined,
        scene: 'ai-image-edit',
        category: 'AI图片',
        ...(selectedModel.value ? { model_name: selectedModel.value } : {}),
        ...(promptTextStr.trim() ? { title: promptTextStr.trim().slice(0, 100) } : {}),
        images: [{ upstream_url: slot.url, prompt: promptTextStr || '(空提示词)' }],
      })

      const planItem = init.plan[0]
      const blob = await fetchSlotBlob(slot)
      await uploadImageBlobToR2(planItem.upload_url, blob, planItem.content_type)
      const confirm = await confirmAiCreationSave({
        group_id: init.group_id,
        images: [{
          r2_key: planItem.r2_key,
          public_url: planItem.public_url,
          prompt: promptTextStr || '(空提示词)',
          file_size: blob.size,
        }],
      })

      slot.saveStatus = 'saved'
      savedGroupIds.value = init.group_id
      // 每张可能独立成组，数量要累加而不是覆盖（右上角“已保存 N 张”）
      savedImageCount.value += confirm.inserted
    } catch (e: any) {
      slot.saveStatus = 'failed'
      console.error('[save-to-creations] save failed:', e)
      // 单张失败只标记，不打断其它并行保存；页面格子显示「保存失败·重试」
    } finally {
      savingSlotIds.delete(slot.id)
    }
  }

  return {
    savedGroupIds,
    savedImageCount,
    successfulResults,
    autoSaveSlot,
    clearSavedFlags,
  }
}
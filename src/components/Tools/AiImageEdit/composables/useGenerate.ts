// 并发生成：余额预检/乐观扣费/权威对齐、N 路并发请求、单格失败重试、批次计时、生成按钮动画。
// 依赖几乎覆盖全组件，统一通过 opts 显式注入（results / 各 ref / useSlotVisuals 句柄 / clearSavedFlags）。
import { ref, computed, watch } from 'vue'
import type { Ref, ComputedRef } from 'vue'
import { ElMessage } from 'element-plus'
import { functionsRequest } from '@/utils/functionsRequest'
import type { PublicToolModel } from '@/api/tool-models'
import type { ResultSlot } from './useSlotVisuals'

/** userStore 的最小接口（只需要生成用到的余额能力） */
interface BalanceStore {
  credits: { balance: number }
  setBalance(balance: number): void
  fetchCredits(force?: boolean): Promise<unknown>
}

export function useGenerate(opts: {
  results: ResultSlot[]
  isBatchLoading: Ref<boolean>
  prompt: Ref<string>
  promptTouched: Ref<boolean>
  modelLoaded: Ref<boolean>
  modelList: Ref<PublicToolModel[]>
  selectedModel: Ref<string>
  selectedSize: Ref<string>
  selectedConcurrency: Ref<number>
  currentModelCost: ComputedRef<number>
  imageFiles: Ref<File[]>
  userStore: BalanceStore
  slotVisuals: {
    createPendingSlot: () => ResultSlot
    startSlotTimer: (slot: ResultSlot) => void
    stopSlotTimer: (slot: ResultSlot) => void
    stopAllSlotVisuals: () => void
  }
  /** useSaveToCreations 返回的 clearSavedFlags：新一轮生成时重置保存按钮 */
  clearSavedFlags: () => void
  /** 单张生成成功时回调（用于「生成完一张就自动保存一张」） */
  onSlotSuccess?: (slot: ResultSlot) => void
}) {
  const {
    results, isBatchLoading, prompt, promptTouched,
    modelLoaded, modelList, selectedModel, selectedSize, selectedConcurrency,
    currentModelCost, imageFiles, userStore, slotVisuals, clearSavedFlags, onSlotSuccess,
  } = opts

  // ============ 生成按钮渐变动画 ============
  const btnRef = ref<HTMLButtonElement | null>(null)
  let btnAnimId = 0
  let btnPhase = 0

  const startBtnAnim = () => {
    if (!btnRef.value) return
    const btn = btnRef.value
    const colors = [
      [0x63, 0x66, 0xf1], // indigo
      [0xa8, 0x55, 0xf7], // purple
      [0xec, 0x48, 0x99], // pink
      [0xa8, 0x55, 0xf7], // purple
      [0x63, 0x66, 0xf1], // indigo
    ]
    const step = () => {
      btnPhase = (btnPhase + 0.004) % 1
      // 沿 colors 数组循环插值
      const t = btnPhase * (colors.length - 1)
      const i = Math.floor(t)
      const f = t - i
      const c0 = colors[i]
      const c1 = colors[Math.min(i + 1, colors.length - 1)]
      const r = Math.round(c0[0] + (c1[0] - c0[0]) * f)
      const g = Math.round(c0[1] + (c1[1] - c0[1]) * f)
      const b = Math.round(c0[2] + (c1[2] - c0[2]) * f)
      btn.style.background = `linear-gradient(90deg, rgb(${r},${g},${b}), rgb(${Math.round(c0[0])},${Math.round(c0[1])},${Math.round(c0[2])}))`
      btnAnimId = requestAnimationFrame(step)
    }
    step()
  }

  const stopBtnAnim = () => {
    if (btnAnimId) { cancelAnimationFrame(btnAnimId); btnAnimId = 0 }
    if (btnRef.value) {
      btnRef.value.style.background = ''
    }
  }

  // 批次级 isBatchLoading 切换时驱动按钮动画；每格的 loading 由 slot-pending 自己的 spinner 渲染
  watch(isBatchLoading, (val) => {
    if (val) {
      setTimeout(() => startBtnAnim(), 50)
    } else {
      stopBtnAnim()
    }
  })

  // ============ 本次生成总耗时（用于「生成结果」标题后展示）============
  // resetResults 时记录 startTime，所有 slot 全部 success/failed 时记录 endTime；
  // 区间内如果还有重试（retrySlot），endTime 会被刷新。
  const batchStartAt = ref<number | null>(null)
  const batchEndAt = ref<number | null>(null)

  const totalElapsedMs = computed(() => {
    if (batchStartAt.value == null) return 0
    const end = batchEndAt.value ?? Date.now()
    return Math.max(0, end - batchStartAt.value)
  })

  // 把秒级毫秒数格式化为「N秒」或「N分M秒」
  const formatBatchDuration = (ms: number): string => {
    const totalSec = Math.round(ms / 1000)
    if (totalSec < 60) return `${totalSec}秒`
    const m = Math.floor(totalSec / 60)
    const s = totalSec % 60
    return s === 0 ? `${m}分` : `${m}分${s}秒`
  }

  // 全部 slot 收尾（success 或 failed）时调用，把 batchEndAt 设为当前时间
  // 仍在 pending 中则不更新（生成还没结束，计时器继续走）。
  const finalizeBatchIfDone = () => {
    if (batchStartAt.value == null) return
    const allDone = results.every((s) => s.status !== 'pending')
    if (allDone) batchEndAt.value = Date.now()
  }

  // 余额不足提示词（输入即时反馈）
  const concurrencyHint = computed(() => {
    const cost = currentModelCost.value
    if (cost === 0) return ''
    const total = cost * selectedConcurrency.value
    if (userStore.credits.balance < total) {
      return `积分余额不足：本次需 ${total} 积分（${cost} × ${selectedConcurrency.value}），当前 ${userStore.credits.balance}`
    }
    return ''
  })

  // 是否可以生成：批次不在加载、模型就绪、提示词必填、余额足够 N×cost
  const canGenerate = computed(() => {
    if (isBatchLoading.value) return false
    if (!modelLoaded.value || modelList.value.length === 0 || !selectedModel.value) return false
    if (prompt.value.trim().length === 0) return false
    const cost = currentModelCost.value
    if (cost > 0 && userStore.credits.balance < cost * selectedConcurrency.value) return false
    return true
  })

  // 重置结果数组为 N 个 pending slot（清空旧的 + 启动新计时器）
  const resetResults = (n: number) => {
    slotVisuals.stopAllSlotVisuals()
    results.splice(0, results.length, ...Array.from({ length: n }, slotVisuals.createPendingSlot))
    // 新一轮生成开始：清空"已保存"标记，让保存按钮重新可点
    clearSavedFlags()
    for (const slot of results) slotVisuals.startSlotTimer(slot)
  }

  // 构建一次请求的 FormData（每次新建避免共享问题）
  const buildFormData = () => {
    const fd = new FormData()
    fd.append('model', selectedModel.value)
    fd.append('size', selectedSize.value)
    if (prompt.value.trim()) {
      fd.append('prompt', prompt.value.trim())
    }
    // 多图：每张都用同一个字段名 'images'，后端用 formData.getAll('images') 读取
    for (const file of imageFiles.value) {
      fd.append('images', file)
    }
    return fd
  }

  // 单个 slot 的请求：成功/失败都直接改 slot 状态 + 停计时器，返回 balanceAfter 供调用方做最终余额对齐
  const fireOneRequest = async (
    slot: ResultSlot,
    fd: FormData,
    idempotencyKey: string,
  ): Promise<{ ok: boolean; balanceAfter?: number }> => {
    try {
      const res = await functionsRequest.post('/api/ai-image-edit', fd, {
        // AI 生图偶尔跑到 3-5 分钟，覆盖默认 30s 超时到 11 分钟（后端 10 分钟 + 1 分钟缓冲）
        timeout: 660000,
        headers: { 'Idempotency-Key': idempotencyKey },
      })
      const data = res.data
      if (!data.ok) {
        slot.status = 'failed'
        slot.errorMsg = data.error || '生成失败'
        slotVisuals.stopSlotTimer(slot)
        // 用服务端返回的 balance 覆盖显示（这是数据库真实值）
        const bal = typeof data.balance === 'number' ? data.balance : undefined
        return { ok: false, balanceAfter: bal }
      }
      slot.status = 'success'
      slot.url = data.data?.url || ''
      slot.recordId = data.data?.recordId || ''
      slotVisuals.stopSlotTimer(slot)
      // 生成完这一张就立刻让父组件去自动保存（不等整批收尾）
      onSlotSuccess?.(slot)
      return {
        ok: true,
        balanceAfter: typeof data.data?.balanceAfter === 'number' ? data.data.balanceAfter : undefined,
      }
    } catch (error: any) {
      console.error('生成图片失败:', error)
      slot.status = 'failed'
      slot.errorMsg =
        error?.response?.data?.error || error?.message || '网络请求失败，请稍后重试'
      slotVisuals.stopSlotTimer(slot)
      const errBalance = error?.response?.data?.balance
      return { ok: false, balanceAfter: typeof errBalance === 'number' ? errBalance : undefined }
    }
  }

  // 调用后端 API：N 路并发，每路独立扣费/独立计时/独立成功失败
  const generateImage = async () => {
    if (!canGenerate.value) {
      promptTouched.value = true
      if (!modelLoaded.value) {
        ElMessage.warning('模型列表加载中，请稍候')
      } else if (modelList.value.length === 0 || !selectedModel.value) {
        ElMessage.error('暂无可用模型，请联系管理员配置')
      } else if (concurrencyHint.value) {
        ElMessage.error(concurrencyHint.value)
      } else {
        ElMessage.warning('请先输入提示词')
      }
      return
    }

    const n = selectedConcurrency.value
    const costPerRequest = currentModelCost.value
    const totalCost = costPerRequest * n
    const balanceBefore = userStore.credits.balance

    // 重置结果区为 N 个 pending slot（旧的 slot 计时器会被 stopAllSlotTimers 清掉）
    resetResults(n)
    isBatchLoading.value = true
    // 记录批次起止时间：startTime 在这里锁定，endTime 等最后一个 slot 收尾时由 finalizeBatchIfDone 写入
    batchStartAt.value = Date.now()
    batchEndAt.value = null

    // 乐观扣费：服务端在调上游前就已经扣费，前端立即把余额减掉，
    // 这样在 30~90s 的生成期间徽章和弹窗能保持与服务端一致。
    // 失败路径（部分或全部）会在 Promise.allSettled 完成后用服务端权威值对齐。
    if (totalCost > 0) {
      userStore.setBalance(balanceBefore - totalCost)
    }

    // N 路独立请求：每路一个 FormData、一个 Idempotency-Key、一个 Promise
    const tasks = results.map((slot) => {
      const idempotencyKey = crypto.randomUUID()
      const fd = buildFormData()
      return fireOneRequest(slot, fd, idempotencyKey)
    })

    const outcomes = await Promise.allSettled(tasks)

    // 统计成功/失败，并从任一成功响应里取服务端权威 balanceAfter
    // （成功响应的 balanceAfter 已扣完且失败的 reverse 已生效，是批次最终值）
    let serverBalance: number | null = null
    let successCount = 0
    let failedCount = 0
    for (let i = 0; i < outcomes.length; i++) {
      const o = outcomes[i]
      if (o.status === 'fulfilled' && o.value.ok) {
        successCount++
        if (typeof o.value.balanceAfter === 'number' && serverBalance === null) {
          serverBalance = o.value.balanceAfter
        }
      } else {
        failedCount++
        // 失败响应也可能带，服务端 reverse 后 balance 已回退
        if (o.status === 'fulfilled' && typeof o.value.balanceAfter === 'number' && serverBalance === null) {
          serverBalance = o.value.balanceAfter
        }
      }
    }

    // 应用余额：成功路径下 serverBalance 已包含失败 reverse 的最终值；
    // 全部失败时回退到 balanceBefore（服务端全部 reverse）
    if (serverBalance !== null) {
      userStore.setBalance(serverBalance)
    } else {
      userStore.setBalance(balanceBefore)
    }
    // 最终兜底：再拉一次服务端真值，防止中间环节对不齐
    userStore.fetchCredits(true)

    // 结果提示：全成功 / 全失败 / 部分成功分别给不同反馈
    if (failedCount === 0 && successCount === n) {
      ElMessage.success(n === 1 ? '图片生成成功' : `图片生成成功（${n}/${n}）`)
    } else if (successCount === 0) {
      ElMessage.error(`图片生成失败（0/${n}），可点击每张图上的「重试」`)
    } else {
      ElMessage.warning(
        `部分成功：${successCount}/${n} 已生成，${failedCount} 张失败已退还积分，点击失败格子上的「重试」可单独再试`,
      )
    }

    // 全部并发请求已 settle（成功或失败），写结束时间
    finalizeBatchIfDone()

    isBatchLoading.value = false
  }

  // 失败 slot 单格重试：独立幂等 key / 独立扣费 / 独立计时；批次级 isBatchLoading 仅在重试期间打开
  const retrySlot = async (slot: ResultSlot) => {
    if (isBatchLoading.value) return
    const costPerRequest = currentModelCost.value
    const balanceBefore = userStore.credits.balance

    // 余额预检：单次重试只需 costPerRequest
    if (costPerRequest > 0 && balanceBefore < costPerRequest) {
      ElMessage.error(
        `积分余额不足：本次需 ${costPerRequest} 积分，当前 ${balanceBefore}`,
      )
      return
    }

    // 把 slot 重置为 pending + 启动独立计时
    slot.status = 'pending'
    slot.url = ''
    slot.recordId = ''
    slot.errorMsg = ''
    slot.elapsedSeconds = 0
    slotVisuals.startSlotTimer(slot)
    isBatchLoading.value = true

    // 乐观扣费
    if (costPerRequest > 0) {
      userStore.setBalance(balanceBefore - costPerRequest)
    }

    const idempotencyKey = crypto.randomUUID()
    const fd = buildFormData()
    const result = await fireOneRequest(slot, fd, idempotencyKey)

    if (result.ok) {
      if (typeof result.balanceAfter === 'number') {
        userStore.setBalance(result.balanceAfter)
      } else {
        userStore.fetchCredits(true)
      }
      ElMessage.success('重试成功')
    } else {
      // 失败：服务端 reverse 已完成，前端乐观扣费回退
      userStore.setBalance(balanceBefore)
      userStore.fetchCredits(true)
      // slot 已经被 fireOneRequest 标为 failed + 写入 errorMsg
    }
    // 重试结束 → 重新判断是否所有 slot 收尾，更新 endTime
    finalizeBatchIfDone()
    isBatchLoading.value = false
    // 注意：成功路径下 fireOneRequest 已触发 onSlotSuccess → 自动保存这张
  }

  return {
    btnRef,
    canGenerate,
    concurrencyHint,
    resetResults,
    generateImage,
    retrySlot,
    batchStartAt,
    batchEndAt,
    totalElapsedMs,
    formatBatchDuration,
    finalizeBatchIfDone,
    stopBtnAnim,
  }
}
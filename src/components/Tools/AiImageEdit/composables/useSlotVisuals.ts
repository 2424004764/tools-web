// 每张生成结果格子的独立视觉与计时（timer + canvas 粒子动画）。
// 只自持各自 Map，不依赖组件状态：startSlotTimer(slot) 收一个 slot 对象即可。
import { nextTick } from 'vue'

export type SlotStatus = 'pending' | 'success' | 'failed'

export interface ResultSlot {
  /** 稳定 ID，用于 v-for key / 拖拽 payload 关联 recordId */
  id: string
  status: SlotStatus
  url: string
  recordId: string
  errorMsg: string
  elapsedSeconds: number
  /** 是否勾选「保存到我的创作」（成功格卡片上可单独勾选） */
  saveChecked?: boolean
  /** 自动保存进度：idle 未开始 / saving 保存中 / saved 已保存 / failed 保存失败 */
  saveStatus?: 'idle' | 'saving' | 'saved' | 'failed'
}

interface Particle {
  x: number; y: number; vx: number; vy: number; r: number; hue: number; alpha: number
}

/** 创建一个新的 pending slot（本地临时图片在保存时由后端重排 id） */
const createPendingSlot = (): ResultSlot => ({
  id: crypto.randomUUID(),
  status: 'pending',
  url: '',
  recordId: '',
  errorMsg: '',
  elapsedSeconds: 0,
  saveChecked: true,
  saveStatus: 'idle',
})

const formatElapsed = (s: number) => {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}分${sec}秒` : `${sec}秒`
}

// 生成阶段文案（与旧 canvas 版本一致：分析构思 → 精细渲染 → 即将完成）
const phaseText = (s: number) => {
  if (s < 10) return '分析构思中'
  if (s < 25) return '精细渲染中'
  return '即将完成'
}

export function useSlotVisuals() {
  // 计时器存 Map，避免 Vue 把 setInterval id 视为响应式字段
  const slotTimers = new Map<string, ReturnType<typeof setInterval>>()
  const slotCanvasAnims = new Map<string, number>()
  const slotCanvasResizers = new Map<string, (() => void) | null>()

  // ============ Per-slot canvas 粒子动画 ============
  // 每张 pending slot 跑一个独立 canvas，粒子数 25（N=5 时共 125 个可接受）
  const startSlotCanvas = (slotId: string, canvas: HTMLCanvasElement) => {
    // 已被新一次生成替换过 / 已停止过 → 跳过
    if (slotCanvasAnims.has(slotId)) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const rect = parent.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = rect.width + 'px'
      canvas.style.height = rect.height + 'px'
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    slotCanvasResizers.set(slotId, resize)
    window.addEventListener('resize', resize)

    const W = () => canvas.width / dpr
    const H = () => canvas.height / dpr
    const particles: Particle[] = []
    const count = 25
    const hues = [260, 280, 320, 220, 180] // purple, violet, pink, blue, teal
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * W(),
        y: Math.random() * H(),
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        hue: hues[Math.floor(Math.random() * hues.length)],
        alpha: Math.random() * 0.5 + 0.3,
      })
    }

    let frame = 0
    const draw = () => {
      const w = W(); const h = H()
      ctx.clearRect(0, 0, w, h)
      // Update & draw particles
      for (const p of particles) {
        p.x += p.vx + Math.sin(frame * 0.02 + p.y * 0.01) * 0.15
        p.y += p.vy + Math.cos(frame * 0.02 + p.x * 0.01) * 0.15
        if (p.x < -10) p.x = w + 10
        if (p.x > w + 10) p.x = -10
        if (p.y < -10) p.y = h + 10
        if (p.y > h + 10) p.y = -10
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `hsla(${p.hue}, 70%, 65%, ${p.alpha})`
        ctx.fill()
      }
      // Connections + center attract
      const cx = w / 2; const cy = h / 2
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < 80) {
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            const alpha = (1 - dist / 80) * 0.18
            ctx.strokeStyle = `hsla(${particles[i].hue}, 60%, 65%, ${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
        const adx = cx - particles[i].x
        const ady = cy - particles[i].y
        const adist = Math.sqrt(adx * adx + ady * ady) || 1
        if (adist < 60) {
          particles[i].vx += adx / adist * 0.02
          particles[i].vy += ady / adist * 0.02
        }
      }
      // Center glow
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 50 + Math.sin(frame * 0.03) * 8)
      glow.addColorStop(0, 'rgba(168,85,247,0.15)')
      glow.addColorStop(0.5, 'rgba(99,102,241,0.06)')
      glow.addColorStop(1, 'rgba(0,0,0,0)')
      ctx.fillStyle = glow
      ctx.fillRect(0, 0, w, h)
      frame++
      slotCanvasAnims.set(slotId, requestAnimationFrame(draw))
    }
    draw()
  }

  const stopSlotCanvas = (slotId: string) => {
    const id = slotCanvasAnims.get(slotId)
    if (id) { cancelAnimationFrame(id); slotCanvasAnims.delete(slotId) }
    const resize = slotCanvasResizers.get(slotId)
    if (resize) {
      window.removeEventListener('resize', resize)
      slotCanvasResizers.delete(slotId)
    }
  }

  const stopAllSlotCanvases = () => {
    for (const id of slotCanvasAnims.values()) cancelAnimationFrame(id)
    slotCanvasAnims.clear()
    for (const resize of slotCanvasResizers.values()) {
      if (resize) window.removeEventListener('resize', resize)
    }
    slotCanvasResizers.clear()
  }

  // 完全绕开 Vue 函数 ref 机制：通过 data-slot-canvas 属性找 canvas DOM，
  // 在 nextTick 后启动。Vue re-render 不会再调用 ref 函数把动画杀掉。
  const startSlotCanvasByDataAttr = (slotId: string) => {
    nextTick(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        `canvas[data-slot-canvas="${slotId}"]`,
      )
      if (canvas) startSlotCanvas(slotId, canvas)
    })
  }

  const startSlotTimer = (slot: ResultSlot) => {
    stopSlotTimer(slot)
    slotTimers.set(
      slot.id,
      setInterval(() => {
        slot.elapsedSeconds++
      }, 1000),
    )
    // 启动 canvas 粒子动画（等 Vue 把 DOM 渲染完）
    startSlotCanvasByDataAttr(slot.id)
  }

  const stopSlotTimer = (slot: ResultSlot) => {
    const t = slotTimers.get(slot.id)
    if (t) {
      clearInterval(t)
      slotTimers.delete(slot.id)
    }
    // 计时停了就顺手停 canvas（fireOneRequest 走这条路径级联生效）
    stopSlotCanvas(slot.id)
  }

  const stopAllSlotTimers = () => {
    for (const t of slotTimers.values()) clearInterval(t)
    slotTimers.clear()
  }

  // 同时停掉每格的 canvas 动画（批量结束 / 组件卸载时调用）
  const stopAllSlotVisuals = () => {
    stopAllSlotTimers()
    stopAllSlotCanvases()
  }

  return {
    createPendingSlot,
    formatElapsed,
    phaseText,
    startSlotTimer,
    stopSlotTimer,
    stopAllSlotVisuals,
  }
}
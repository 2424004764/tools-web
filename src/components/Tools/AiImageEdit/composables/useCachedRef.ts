// localStorage 同步 ref 工具
// 用法：直接像普通 ref 用（selectedSize.value / v-model="selectedSize"），
// 初始化时就从 localStorage 读取（合法值校验），任何变化都自动写回。
// 解决了「ref 默认值 → onMounted 异步赋值 → watch 才触发」的中间态：
// 进页面时 <select> 的 v-model 已经指向 cache 值，UI 立即正确显示。
import { ref, watch } from 'vue'

export function useCachedRef<T extends string | number>(
  key: string,
  defaultValue: T,
  validate?: (val: T) => boolean,
) {
  let initial: T = defaultValue
  try {
    const raw = localStorage.getItem(key)
    if (raw !== null) {
      // 数字需要 parseInt；字符串直接用
      const parsed = (typeof defaultValue === 'number'
        ? (parseInt(raw, 10) as unknown as T)
        : (raw as unknown as T))
      if (typeof parsed === 'number' && Number.isNaN(parsed)) {
        // ignore: 解析失败走默认值
      } else if (!validate || validate(parsed)) {
        initial = parsed
      }
    }
  } catch {
    // localStorage 不可用（隐私模式），静默走默认值
  }
  const r = ref(initial)
  watch(r, (val) => {
    try { localStorage.setItem(key, String(val)) } catch { /* 静默忽略 */ }
  })
  return r
}
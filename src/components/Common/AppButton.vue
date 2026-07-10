<script setup lang="ts">
/**
 * AppButton — 全站统一按钮原子件（Phase 3d 引入）
 *
 * 包装 el-button，统一全站按钮视觉：
 *   variant: primary (accent 强调) | secondary (中性) | ghost (透明) | danger (语义)
 *   size:    small | default | large
 *   state:   loading | disabled | block
 *
 * 设计 token：
 *   primary → 走 el-button type="primary"（已映射 --el-color-primary 到 accent）
 *   secondary → el-button type="default" + 类名覆盖
 *   ghost    → el-button type="text" + 类名覆盖
 *   danger   → el-button type="danger"（已映射 --el-color-danger）
 */
type AppButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

withDefaults(defineProps<{
  variant?: AppButtonVariant
  size?: 'small' | 'default' | 'large'
  loading?: boolean
  disabled?: boolean
  block?: boolean
}>(), {
  variant: 'primary',
  size: 'default',
})
</script>

<template>
  <el-button
    :type="(variant === 'secondary' ? 'default' : variant === 'ghost' ? 'text' : variant) as any"
    :size="size"
    :loading="loading"
    :disabled="disabled"
    :block="block"
    :class="[
      'app-btn',
      `app-btn--${variant}`,
    ]"
  >
    <slot />
  </el-button>
</template>

<style scoped>
/* primary 走 EP 的 --el-color-primary token（已映射 accent-500），无需类名覆盖 */

/* secondary：中性白底 */
.app-btn--secondary {
  background-color: rgb(var(--surface-1)) !important;
  border-color: rgb(var(--border-default)) !important;
  color: rgb(var(--ink-900)) !important;
}
.app-btn--secondary:hover {
  background-color: rgb(var(--surface-2)) !important;
  border-color: rgb(var(--border-strong)) !important;
  color: rgb(var(--ink-900)) !important;
}
.app-btn--secondary:active {
  background-color: rgb(var(--surface-3)) !important;
  border-color: rgb(var(--border-strong)) !important;
  color: rgb(var(--ink-900)) !important;
}

/* ghost：透明背景，hover 时显示 accent 微弱底色 */
.app-btn--ghost {
  background-color: transparent !important;
  border-color: transparent !important;
  color: rgb(var(--ink-700)) !important;
}
.app-btn--ghost:hover {
  background-color: rgb(var(--accent-50)) !important;
  border-color: transparent !important;
  color: rgb(var(--accent-700)) !important;
}
.app-btn--ghost:active {
  background-color: rgb(var(--accent-100)) !important;
  border-color: transparent !important;
  color: rgb(var(--accent-700)) !important;
}

/* danger：走 EP --el-color-danger（已映射 danger-500），无需类名覆盖 */
</style>
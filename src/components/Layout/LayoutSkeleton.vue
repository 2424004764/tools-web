<script setup lang="ts">
/**
 * 布局骨架屏：Header / Left / Floor 异步加载时的占位。
 * 纯 div + tailwind，不引入 element-plus，避免增加额外体积。
 * 颜色用项目已有的 warm 色系，保持视觉一致。
 */
defineProps<{
  variant?: 'header' | 'left' | 'floor'
}>()
</script>

<template>
  <!-- Header 骨架：logo + 搜索框 + 右侧按钮 -->
  <div v-if="variant === 'header'" class="h-16 px-4 flex items-center gap-4 border-b border-gray-100 bg-white">
    <div class="skel-block w-28 h-7 rounded"></div>
    <div class="skel-block flex-1 max-w-xl h-9 rounded-lg"></div>
    <div class="skel-block w-20 h-9 rounded-lg"></div>
    <div class="skel-block w-9 h-9 rounded-full"></div>
  </div>

  <!-- Left 骨架：菜单列表，模拟分类 + 工具项 -->
  <div v-else-if="variant === 'left'" class="h-full p-4 space-y-3 bg-white">
    <div v-for="i in 8" :key="i" class="space-y-2">
      <div class="skel-block h-5 w-3/4 rounded"></div>
      <div class="skel-block h-4 w-1/2 rounded ml-3"></div>
    </div>
  </div>

  <!-- Floor 骨架：一行居中文字条 -->
  <div v-else-if="variant === 'floor'" class="w-full p-5 text-center">
    <div class="skel-block h-4 w-2/3 max-w-md mx-auto rounded"></div>
  </div>
</template>

<style scoped>
/* 骨架块统一样式：warm-200 底色 + 横向 shimmer 动画 */
.skel-block {
  background: linear-gradient(
    90deg,
    rgba(229, 222, 211, 0.6) 0%,
    rgba(244, 240, 232, 0.9) 50%,
    rgba(229, 222, 211, 0.6) 100%
  );
  background-size: 200% 100%;
  animation: skel-shimmer 1.4s ease-in-out infinite;
}

@keyframes skel-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
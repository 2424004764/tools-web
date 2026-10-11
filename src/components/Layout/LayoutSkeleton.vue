<script setup lang="ts">
/**
 * 布局骨架屏：Header / Left / Floor 异步加载时的占位。
 * 纯 div + tailwind，不引入 element-plus，避免增加额外体积。
 * 颜色用项目已有的 warm 色系，保持视觉一致。
 */
defineProps<{
  variant?: 'header' | 'left' | 'floor' | 'page'
}>()
</script>

<template>
  <!-- Header 骨架：logo + 搜索框 + 右侧按钮 -->
  <div v-if="variant === 'header'" class="h-16 px-4 flex items-center gap-4 border-b border-border-subtle bg-white dark:bg-surface-0">
    <div class="skel-block w-28 h-7 rounded"></div>
    <div class="skel-block flex-1 max-w-xl h-9 rounded-lg"></div>
    <div class="skel-block w-20 h-9 rounded-lg"></div>
    <div class="skel-block w-9 h-9 rounded-full"></div>
  </div>

  <!-- Left 骨架：菜单列表，模拟分类 + 工具项 -->
  <div v-else-if="variant === 'left'" class="h-full p-4 space-y-3 bg-white dark:bg-surface-0">
    <div v-for="i in 8" :key="i" class="space-y-2">
      <div class="skel-block h-5 w-3/4 rounded"></div>
      <div class="skel-block h-4 w-1/2 rounded ml-3"></div>
    </div>
  </div>

  <!-- Floor 骨架：一行居中文字条 -->
  <div v-else-if="variant === 'floor'" class="w-full p-5 text-center">
    <div class="skel-block h-4 w-2/3 max-w-md mx-auto rounded"></div>
  </div>

  <!-- 主内容区骨架：模拟首页「热门资讯卡 + 工具卡片网格」，路由 chunk 下载期间的占位 -->
  <div v-else-if="variant === 'page'" class="space-y-6" aria-busy="true">
    <div class="rounded-[20px] border border-border-subtle p-6">
      <div class="skel-block h-6 w-44 rounded"></div>
      <div class="mt-5 grid gap-3 grid-cols-1 md:grid-cols-2 2xl:grid-cols-3">
        <div v-for="i in 3" :key="i" class="skel-block h-12 rounded-lg"></div>
      </div>
    </div>
    <div class="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      <div v-for="i in 10" :key="i" class="skel-block h-36 rounded-2xl"></div>
    </div>
  </div>
</template>

<style scoped>
/* 骨架块统一样式：surface-2 底色 + 横向 shimmer 动画 */
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
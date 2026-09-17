<script setup lang="ts">
/**
 * 讨论区合并包装器：把 SimilarRecommend + CommonArea + Comments 合并到一个 chunk，
 * 节省一次 HTTP 请求。三者显示条件一致（都仅在非首页/非特殊页/未隐藏 UI 时显示），
 * 因此包装器被挂载时，子组件都可以无脑渲染（内部自行判断是否可见）。
 */
import SimilarRecommend from './SimilarRecommend/SimilarRecommend.vue'
import CommonArea from './CommonArea/CommonArea.vue'
import Comments from './Comments/Comments.vue'
</script>

<template>
  <SimilarRecommend />
  <CommonArea />
  <Comments />
</template>
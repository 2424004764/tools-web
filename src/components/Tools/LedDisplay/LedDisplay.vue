<script setup lang="ts">
import { ref } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

const title = 'LED 显示屏'
const showPanel = ref(true)
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="title" />

    <div class="p-4 rounded-2xl bg-white">
      <div class="led-screen">
        <div class="led-text">Hello LED</div>
      </div>
    </div>

    <div class="p-4 mt-3 rounded-2xl bg-white">
      <el-button @click="showPanel = !showPanel">
        {{ showPanel ? '隐藏' : '显示' }}配置面板
      </el-button>
      <div v-if="showPanel">配置面板占位</div>
    </div>

    <ToolDetail title="使用说明">
      <el-text>LED 显示屏工具，支持自定义文字、颜色、滚动效果。</el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.led-screen {
  background: #000;
  height: 200px;
  display: flex;
  align-items: center;
  overflow: hidden;
}
.led-text {
  color: #ff0000;
  font-size: 120px;
  font-weight: bold;
  white-space: nowrap;
}
</style>
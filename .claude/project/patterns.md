---
description: 通用模式、SEO 要求与布局组件
---

## SEO 要求

每个工具页面必须包含：
1. 路由 meta 中的 `title`、`keywords`、`description`
2. 页面底部的详细描述（ToolDetail 组件中）
3. 在 `sitemap.xml` 中注册

## 通用模式

### 工具组件结构

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'

// 状态
const input = ref('')
const result = ref('')

// 方法
const handleProcess = () => { /* ... */ }
</script>

<template>
  <div class="flex flex-col mt-3">
    <DetailHeader :title="工具标题" />

    <!-- 主要工具 UI -->
    <div class="p-4 rounded-2xl bg-white">
      <!-- 工具内容 -->
    </div>

    <!-- 使用说明 -->
    <ToolDetail title="使用说明">
      <!-- SEO 详细描述 -->
    </ToolDetail>
  </div>
</template>
```

### 布局组件

- **`DetailHeader`**：页面标题，面包屑式展示
- **`ToolDetail`**：可折叠内容区域（用法、示例、提示）
- **左侧边栏**：响应式——移动端隐藏，小屏幕下为抽屉式

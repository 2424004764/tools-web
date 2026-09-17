<script setup lang="ts">
/**
 * 工具页公共区域：显示在「类似功能推荐」下方、「评论交流」上方，每个工具页都有。
 *
 * 用途：放一些公共的描述信息（公告、说明、活动入口等）。
 * 内容暂时空缺 —— 需要时在下方 commonBlocks 中添加条目即可，卡片会自动出现；
 * commonBlocks 为空时整个区域不渲染，不影响页面。
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { getToolsCate } from '@/components/Tools/tools'
import { rtrim } from '@/utils/string'

interface CommonItem {
  type: 'text' | 'link'
  text: string
  href?: string
}

interface CommonBlock {
  title?: string
  items: CommonItem[]
}

// ★ 公共区域内容统一在这里配置
const commonBlocks: CommonBlock[] = [
  // 示例（取消注释即可生效）：
  // {
  //   title: '📢 公告',
  //   items: [
  //     { type: 'text', text: '这里是一段描述信息' },
  //     { type: 'link', text: '去关于页看看', href: '/about/' },
  //   ],
  // },
]

const route = useRoute()
const cates = getToolsCate()
const currentPath = computed(() => rtrim(route.path, '/'))

// 仅在工具详情页显示（与「类似功能推荐」条件一致）
const isToolPage = computed(() => {
  for (const cate of cates) {
    for (const tool of cate.list) {
      if (rtrim(tool.url, '/') === currentPath.value) {
        return true
      }
    }
  }
  return false
})

const visible = computed(() => isToolPage.value && commonBlocks.length > 0)
</script>

<template>
  <div v-if="visible" class="mt-3 rounded-2xl bg-white border border-border-subtle p-4">
    <div v-for="(block, bi) in commonBlocks" :key="bi" :class="bi > 0 ? 'mt-4 pt-4 border-t border-border-subtle' : ''">
      <div v-if="block.title" class="text-body font-semibold mb-2">{{ block.title }}</div>
      <p v-for="(item, ii) in block.items" :key="ii" class="text-body-sm text-ink-600 leading-6">
        <a
          v-if="item.type === 'link'"
          :href="item.href"
          target="_blank"
          rel="noopener noreferrer"
          class="text-accent-600 hover:underline"
        >{{ item.text }}</a>
        <span v-else>{{ item.text }}</span>
      </p>
    </div>
  </div>
</template>

<style scoped>
</style>

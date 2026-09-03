<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAiCreations, type AiCreationImage } from '@/api/ai-creations'

// 从「我的 AI 创作」里选择图片作为上传素材（复用 fetchAiCreations 数据源）
const emit = defineEmits<{
  (e: 'select', image: AiCreationImage): void
}>()

const visible = ref(false)
const loading = ref(false)
const items = ref<AiCreationImage[]>([])
const page = ref(1)
const hasNext = ref(false)
const PAGE_SIZE = 24

const open = () => {
  visible.value = true
  items.value = []
  page.value = 1
  hasNext.value = false
  void load()
}

const load = async () => {
  if (loading.value) return
  loading.value = true
  try {
    const result = await fetchAiCreations({ page: page.value, pageSize: PAGE_SIZE })
    // 把分组的图片拍平成列表
    const imgs = result.groups.flatMap((g) => g.images || [])
    items.value.push(...imgs)
    hasNext.value = result.pagination.hasNext
  } catch {
    ElMessage.error('加载创作结果失败，请稍后重试')
  } finally {
    loading.value = false
  }
}

const loadMore = () => {
  if (!hasNext.value || loading.value) return
  page.value += 1
  void load()
}

const pick = (img: AiCreationImage) => {
  emit('select', img)
  visible.value = false
}

defineExpose({ open })
</script>

<template>
  <el-dialog
    v-model="visible"
    title="从我的创作选择素材"
    width="860px"
    :close-on-click-modal="true"
    append-to-body
  >
    <div class="flex flex-col">
      <!-- 空状态 -->
      <div v-if="!loading && items.length === 0" class="py-16 text-center text-gray-400 text-sm">
        还没有创作结果，先去生成几张吧
      </div>

      <!-- 图片网格（3 列，缩略图放大些方便看清细节） -->
      <div
        v-else
        class="grid grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto p-1"
        @scroll="(e) => { const el = e.target as HTMLElement; if (el.scrollTop + el.clientHeight >= el.scrollHeight - 40) loadMore() }"
      >
        <div
          v-for="img in items"
          :key="img.id"
          class="relative rounded-lg overflow-hidden border border-gray-200 hover:border-indigo-400 cursor-pointer group bg-gray-50"
          @click="pick(img)"
        >
          <img
            :src="img.thumbnail_url || img.media_url"
            :alt="img.prompt || '创作素材'"
            loading="lazy"
            class="w-full h-56 object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <div
            class="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/10 transition-colors flex items-center justify-center"
          >
            <span
              class="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white bg-indigo-600 px-2 py-1 rounded"
            >选择</span>
          </div>
        </div>

        <!-- 加载中 / 加载更多 -->
        <div v-if="loading" class="col-span-full py-4 text-center text-gray-400 text-sm">
          加载中…
        </div>
        <div v-else-if="hasNext" class="col-span-full py-2 text-center">
          <button class="text-xs text-indigo-600 hover:underline" @click="loadMore">加载更多</button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>
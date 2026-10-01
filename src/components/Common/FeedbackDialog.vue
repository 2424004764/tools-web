<script setup lang="ts">
// 意见反馈弹窗：入口在网站页脚「反馈建议」（Floor.vue）与命令面板快捷操作，
// 弹窗状态放在 componentStore 供多处共用。本组件只负责弹窗本身，不再带悬浮按钮。
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import IconPromotion from '~icons/ep/promotion'
import { useComponentStore } from '@/store/modules/component'
import { useUserStore } from '@/store/modules/user'
import { submitFeedback, type FeedbackType } from '@/api/feedback'

const router = useRouter()
const componentStore = useComponentStore()
const userStore = useUserStore()

const MIN_CONTENT = 5

const dialogVisible = computed({
  get: () => componentStore.feedbackDialogVisible,
  set: (v: boolean) => componentStore.setFeedbackDialogVisible(v),
})

const form = reactive({
  type: 'suggestion' as FeedbackType,
  content: '',
  contact: '',
})

const submitting = ref(false)

const typeOptions: Array<{ value: FeedbackType; label: string }> = [
  { value: 'suggestion', label: '功能建议' },
  { value: 'bug', label: '问题反馈' },
  { value: 'other', label: '其他' },
]

// 打开时重置表单，避免上次的草稿串场
watch(dialogVisible, (opened) => {
  if (opened) {
    form.type = 'suggestion'
    form.content = ''
    form.contact = ''
  }
})

const handleSubmit = async () => {
  const content = form.content.trim()
  if (content.length < MIN_CONTENT) {
    ElMessage.warning(`再多写几个字吧，至少 ${MIN_CONTENT} 个字`)
    return
  }
  submitting.value = true
  try {
    await submitFeedback({
      type: form.type,
      content,
      contact: form.contact.trim(),
      page_url: router.currentRoute.value.fullPath,
    })
    ElMessage.success('感谢反馈！我们会认真查看每一条建议')
    dialogVisible.value = false
  } catch {
    // 错误提示由 functionsRequest 拦截器统一弹出
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="意见反馈"
    width="min(480px, 92vw)"
    :close-on-click-modal="false"
    append-to-body
  >
    <div class="flex flex-col gap-4">
      <div>
        <div class="text-sm text-ink-600 mb-2">反馈类型</div>
        <el-radio-group v-model="form.type">
          <el-radio-button v-for="t in typeOptions" :key="t.value" :value="t.value">
            {{ t.label }}
          </el-radio-button>
        </el-radio-group>
      </div>
      <div>
        <div class="text-sm text-ink-600 mb-2">
          反馈内容
          <span class="text-ink-400 text-xs ml-1">想吐槽或想要什么工具，尽管说</span>
        </div>
        <el-input
          v-model="form.content"
          type="textarea"
          :rows="5"
          maxlength="1000"
          show-word-limit
          placeholder="说说你的想法：想要什么新工具？哪里不好用？遇到了什么问题？（至少 5 个字）"
        />
      </div>
      <div>
        <div class="text-sm text-ink-600 mb-2">
          联系方式
          <span class="text-ink-400 text-xs ml-1">选填</span>
        </div>
        <el-input
          v-model="form.contact"
          maxlength="100"
          placeholder="邮箱 / QQ 等，方便我们回访（选填）"
        />
      </div>
      <p class="text-xs text-ink-400 m-0 flex items-center gap-1">
        <IconPromotion class="w-3.5 h-3.5" aria-hidden="true" />
        {{ userStore.getLoginStatus ? '已自动附带你的账号信息，处理结果更容易通知到你' : '登录后提交会自动附带账号信息，方便回访' }}
      </p>
    </div>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" class="bg-brand-gradient border-none" :loading="submitting" @click="handleSubmit">
        提交反馈
      </el-button>
    </template>
  </el-dialog>
</template>

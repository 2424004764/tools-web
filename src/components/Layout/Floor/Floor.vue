<script setup lang="ts">
import { ref, computed, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus'
import { fetchApprovedFriendLinks, submitFriendLink, type PublicFriendLink } from '@/api/friend-links'
const appDesc = ref(import.meta.env.VITE_APP_DESC || '')
const gitUrl = ref(import.meta.env.VITE_GIT_URL || '')
const siteOrigin = ref(typeof window !== 'undefined' ? window.location.origin : '')

// ===== 构建时间（由 vite build 注入） =====
// dev 模式 __BUILD_TIME__ / __BUILD_TIME_LOCAL__ 为空串
const buildTimeLocal = __BUILD_TIME_LOCAL__
const buildTimeISO = __BUILD_TIME__
const hasBuildTime = computed(() => !!buildTimeLocal)

// 距上次构建多久（每分钟自动刷新一次）
const now = ref(Date.now())
let tickId: number | null = null
const friendLinks = ref<PublicFriendLink[]>([])
const applyVisible = ref(false)
const applying = ref(false)
const applyForm = reactive({
  name: '',
  url: '',
  description: '',
  contact: '',
})

const loadFriendLinks = async () => {
  try {
    friendLinks.value = await fetchApprovedFriendLinks()
  } catch {
    friendLinks.value = []
  }
}

const resetApplyForm = () => {
  applyForm.name = ''
  applyForm.url = ''
  applyForm.description = ''
  applyForm.contact = ''
}

const openApply = () => {
  resetApplyForm()
  applyVisible.value = true
}

const submitApply = async () => {
  const name = applyForm.name.trim()
  const url = applyForm.url.trim()
  if (!name) {
    ElMessage.warning('请填写网站名称')
    return
  }
  if (!url) {
    ElMessage.warning('请填写网站地址')
    return
  }
  applying.value = true
  try {
    const result = await submitFriendLink({
      name,
      url,
      description: applyForm.description.trim(),
      contact: applyForm.contact.trim(),
    })
    ElMessage.success(result.message || '提交成功，审核通过后会显示在页脚')
    applyVisible.value = false
  } catch {
    // 错误提示由 functionsRequest 拦截器处理
  } finally {
    applying.value = false
  }
}

onMounted(() => {
  tickId = window.setInterval(() => { now.value = Date.now() }, 60_000)
  loadFriendLinks()
})
onUnmounted(() => {
  if (tickId !== null) window.clearInterval(tickId)
})

const elapsedText = computed(() => {
  if (!buildTimeISO) return '开发模式'
  const ms = now.value - new Date(buildTimeISO).getTime()
  if (ms < 0) return '刚刚'
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec} 秒前`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  const month = Math.floor(day / 30)
  if (month < 12) return `${month} 个月前`
  return `${Math.floor(month / 12)} 年前`
})
</script>

<template>
    <div class="w-full rounded-2xl z-10 p-5 text-center">
        <div class="copyright text-body-sm text-gray-600 leading-relaxed">
            <div class="mb-3">
                <div class="flex flex-wrap justify-center items-center gap-x-3 gap-y-1 text-caption">
                    <span class="text-ink-400">友情链接</span>
                    <a
                        v-for="item in friendLinks"
                        :key="item.id"
                        :href="item.url"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-ink-700 hover:text-accent-600 transition-colors"
                        :title="item.description || item.name"
                    >{{ item.name }}</a>
                    <span class="text-ink-300">|</span>
                    <button
                        type="button"
                        class="text-accent-600 hover:text-accent-700 transition-colors"
                        @click="openApply"
                    >申请友链</button>
                </div>
            </div>
            <div class="mb-2">
                {{ appDesc }} © 2019 - 2025 BY Bucaicai
            </div>
            <div class="flex flex-col sm:flex-row justify-center items-center gap-2 text-caption">
                <a :href="gitUrl" target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">Tools-Web</a>
                <span class="hidden sm:inline">|</span>
                <a :href="gitUrl + '/issues/new'" target="_blank" class="text-ink-700 hover:text-accent-600 transition-colors">反馈建议</a>
            </div>
            <!-- 构建时间（pnpm build:pro 时由 vite.config.ts 注入） -->
            <div class="mt-2 text-caption text-ink-500">
                <el-tooltip v-if="hasBuildTime" :content="`UTC: ${buildTimeISO}`" placement="top">
                    <span class="cursor-help">
                        上次更新：<span class="font-mono">{{ buildTimeLocal }}</span>
                        <span class="text-ink-400">（{{ elapsedText }}）</span>
                    </span>
                </el-tooltip>
                <span v-else class="font-mono text-ink-400">开发模式（未构建）</span>
            </div>
        </div>

        <el-dialog
            v-model="applyVisible"
            title="申请友情链接"
            width="480px"
            :close-on-click-modal="false"
            append-to-body
        >
            <p class="text-body-sm text-ink-500 mb-4 leading-6">
                请先在贵站添加本站友链，提交后需站长审核才会展示。本站地址：
                <span class="font-mono text-ink-700">{{ siteOrigin }}</span>
            </p>
            <el-form label-width="88px">
                <el-form-item label="网站名称" required>
                    <el-input v-model="applyForm.name" maxlength="40" show-word-limit placeholder="例如：一方工具箱" />
                </el-form-item>
                <el-form-item label="网站地址" required>
                    <el-input v-model="applyForm.url" maxlength="500" placeholder="https://example.com" />
                </el-form-item>
                <el-form-item label="网站简介">
                    <el-input v-model="applyForm.description" maxlength="80" show-word-limit placeholder="一句话介绍，选填" />
                </el-form-item>
                <el-form-item label="联系方式">
                    <el-input v-model="applyForm.contact" maxlength="80" placeholder="微信 / 邮箱，选填" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="applyVisible = false">取消</el-button>
                <el-button type="primary" :loading="applying" @click="submitApply">提交申请</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<style scoped>
</style>
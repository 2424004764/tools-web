<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import {
  getStorageQuota,
  purchaseStorageQuota,
  formatStorageBytes,
  type StorageQuotaInfo,
} from '@/api/storageQuota'

/**
 * 公共：存储额度卡片（无页面包装，可被积分页 / 弹窗复用）
 *
 * 展示当前统一存储额度（quotaBytes/usedBytes/remainingBytes），
 * 并提供「积分购买存储空间」入口（1 积分 = 100MB）。
 * 上传图片 / 音频等都会占用该额度；删除文件会返还。
 */

const userStore = useUserStore()
const { isLoggedIn } = storeToRefs(userStore)

const quota = ref<StorageQuotaInfo | null>(null)
const loading = ref(false)
const purchasing = ref(false)
const units = ref(1)

const usedPercent = computed(() => {
  if (!quota.value || quota.value.quotaBytes <= 0) return 0
  return Math.min(100, Math.round((quota.value.usedBytes / quota.value.quotaBytes) * 100))
})

const load = async () => {
  if (!isLoggedIn.value) return
  loading.value = true
  try {
    quota.value = await getStorageQuota()
  } catch {
    // 静默降级：额度卡片拉取失败不阻塞积分流水展示
  } finally {
    loading.value = false
  }
}

const purchase = async () => {
  if (purchasing.value) return
  purchasing.value = true
  try {
    const result = await purchaseStorageQuota(units.value)
    ElMessage.success(`购买成功：+${formatStorageBytes(result.purchased.bytes)} 存储空间`)
    await userStore.fetchCredits(true) // 余额变了，强制刷新积分
    quota.value = await getStorageQuota()
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || '购买失败，请稍后重试')
  } finally {
    purchasing.value = false
  }
}

watch(isLoggedIn, (v) => {
  if (v) load()
  else quota.value = null
})

onMounted(() => {
  if (isLoggedIn.value) load()
})
</script>

<template>
  <div v-if="isLoggedIn" v-loading="loading" class="rounded-xl border border-border-subtle bg-surface-0 p-4">
    <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
      <span class="text-body-sm font-semibold text-ink-900">存储空间</span>
      <span v-if="quota" class="text-caption text-ink-500">
        已用 {{ formatStorageBytes(quota.usedBytes) }} / {{ formatStorageBytes(quota.quotaBytes) }}
      </span>
    </div>

    <template v-if="quota">
      <div class="h-2 overflow-hidden rounded-full bg-surface-2">
        <div
          class="h-full rounded-full transition-all"
          :class="usedPercent >= 95 ? 'bg-danger-500' : usedPercent >= 75 ? 'bg-warning-500' : 'bg-accent-500'"
          :style="{ width: `${usedPercent}%` }"
        ></div>
      </div>
      <p class="mt-2 text-caption text-ink-500">
        剩余 <strong class="text-ink-800 tabular-nums">{{ formatStorageBytes(quota.remainingBytes) }}</strong>
        <template v-if="quota.pendingBytes > 0">
          （另有 {{ formatStorageBytes(quota.pendingBytes) }} 上传处理中）
        </template>
        · 上传图片 / 音频会占用空间，删除文件会返还
      </p>

      <div class="mt-3 flex flex-wrap items-center gap-2">
        <el-input-number v-model="units" :min="1" :max="100" :step="1" size="small" class="!w-28" />
        <el-button type="primary" size="small" :loading="purchasing" @click="purchase">
          购买空间（{{ units }} 积分 / {{ formatStorageBytes(units * (quota.price.bytes / (quota.price.credits || 1))) }}）
        </el-button>
        <span class="text-caption text-ink-400">1 积分 = {{ formatStorageBytes(quota.price.bytes) }}</span>
      </div>
    </template>

    <p v-else-if="!loading" class="text-caption text-ink-400">暂无存储记录，上传图片 / 音频后开始占用空间</p>
  </div>
</template>

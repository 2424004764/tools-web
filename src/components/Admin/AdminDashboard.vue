<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAdminDashboard } from '@/api/admin/dashboard'
import type { AdminDashboard } from '@/types/admin'
import { ElMessage } from 'element-plus'

const data = ref<AdminDashboard | null>(null)
const loading = ref(false)

const load = async () => {
  loading.value = true
  try {
    data.value = await fetchAdminDashboard()
  } catch (err) {
    console.error(err)
    ElMessage.error('仪表盘数据加载失败')
  } finally {
    loading.value = false
  }
}

const formatTime = (s: string) => {
  if (!s) return '-'
  // D1 返回 "YYYY-MM-DD HH:mm:ss"（UTC）
  const d = new Date(s.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleString('zh-CN', { hour12: false })
}

const fmtAmount = (n: number) => (n > 0 ? `+${n}` : `${n}`)

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <h2 class="text-xl font-semibold mb-4 text-ink-900">仪表盘</h2>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">用户总数</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900">
          {{ data?.totalUsers ?? '-' }}
        </div>
        <div class="text-xs text-ink-400 mt-1">
          今日新增 {{ data?.todayNew ?? 0 }}
        </div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">禁用用户</div>
        <div class="mt-1 text-2xl font-semibold text-danger-600">
          {{ data?.disabledUsers ?? '-' }}
        </div>
        <div class="text-xs text-ink-400 mt-1">无法登录账号</div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">积分总余额</div>
        <div class="mt-1 text-2xl font-semibold text-accent-700">
          {{ data?.totalBalance ?? '-' }}
        </div>
        <div class="text-xs text-ink-400 mt-1">
          累计发放 {{ data?.totalEarned ?? 0 }}
        </div>
      </el-card>
      <el-card shadow="never" class="!rounded-xl">
        <div class="text-sm text-ink-500">工具启用</div>
        <div class="mt-1 text-2xl font-semibold text-ink-900">
          {{ data?.tools.enabled ?? '-' }}
          <span class="text-sm text-ink-400">/ {{ data?.tools.total ?? '-' }}</span>
        </div>
        <div class="text-xs text-ink-400 mt-1">已启用工具数</div>
      </el-card>
    </div>

    <!-- 最近流水 -->
    <el-card shadow="never" class="!rounded-xl">
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium text-ink-900">最近积分流水</span>
          <router-link
            to="/admin/credits"
            class="text-sm text-accent-600 hover:text-accent-700"
          >
            查看全部 →
          </router-link>
        </div>
      </template>

      <el-table
        v-if="data?.recentTransactions?.length"
        :data="data.recentTransactions"
        stripe
        size="small"
        :show-header="true"
      >
        <el-table-column prop="created_at" label="时间" min-width="160">
          <template #default="{ row }">
            <span class="text-xs text-ink-500">{{ formatTime(row.created_at) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="用户" min-width="200">
          <template #default="{ row }">
            <span class="text-ink-900">{{ row.user_name || row.user_email || row.uid }}</span>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="80">
          <template #default="{ row }">
            <el-tag
              :type="row.type === 'grant' ? 'success' : 'danger'"
              size="small"
              effect="plain"
            >
              {{ row.type === 'grant' ? '赠送' : row.type === 'deduct' ? '扣减' : row.type }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="变动" width="100" align="right">
          <template #default="{ row }">
            <span
              :class="row.amount > 0 ? 'text-success-600' : 'text-danger-600'"
              class="font-medium"
            >
              {{ fmtAmount(row.amount) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column label="余额后" width="100" align="right" prop="balance_after" />
        <el-table-column label="操作人" min-width="160">
          <template #default="{ row }">
            <span class="text-ink-700">
              {{ row.operator_uid === 'SYSTEM' ? '系统' : (row.operator_uid.slice(0, 12) + (row.operator_uid.length > 12 ? '…' : '')) }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="备注" min-width="160" show-overflow-tooltip />
      </el-table>
      <el-empty v-else description="暂无流水" :image-size="60" />
    </el-card>
  </div>
</template>
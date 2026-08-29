<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { fetchAdminDashboard } from '@/api/admin/dashboard'
import type { AdminDashboard } from '@/types/admin'
import { ElMessage } from 'element-plus'
import IconUser from '~icons/ep/user'
import IconLock from '~icons/ep/lock'
import IconCoin from '~icons/ep/coin'
import IconSetUp from '~icons/ep/set-up'
import IconHistogram from '~icons/ep/histogram'
import IconDataLine from '~icons/ep/data-line'
import IconTrophy from '~icons/ep/trophy'

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

// 流水来源。迁移前的老数据为 null → 展示"未知"
const sourceLabel = (s: 'system' | 'admin' | 'tool' | null | undefined) => {
  switch (s) {
    case 'system':
      return '系统'
    case 'admin':
      return '管理员'
    case 'tool':
      return '工具'
    default:
      return '未知'
  }
}

const sourceClass = (s: 'system' | 'admin' | 'tool' | null | undefined) => {
  switch (s) {
    case 'system':
      return 'bg-slate-100 text-slate-700'
    case 'admin':
      return 'bg-indigo-100 text-indigo-700'
    case 'tool':
      return 'bg-emerald-100 text-emerald-700'
    default:
      return 'bg-gray-50 text-gray-400'
  }
}

onMounted(load)
</script>

<template>
  <div v-loading="loading">
    <h2 class="text-xl font-semibold mb-4 text-ink-900">仪表盘</h2>

    <!-- 统计卡片 -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">用户总数</div>
            <div class="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">
              {{ data?.totalUsers ?? '-' }}
            </div>
            <div class="text-xs text-ink-400 mt-1.5">
              今日新增 {{ data?.todayNew ?? 0 }}
            </div>
          </div>
          <span class="admin-stat-icon bg-accent-50 text-accent-600" aria-hidden="true">
            <IconUser class="w-4 h-4" />
          </span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">禁用用户</div>
            <div class="mt-1.5 text-2xl font-semibold text-danger-600 tabular-nums">
              {{ data?.disabledUsers ?? '-' }}
            </div>
            <div class="text-xs text-ink-400 mt-1.5">无法登录账号</div>
          </div>
          <span class="admin-stat-icon bg-danger-50 text-danger-600" aria-hidden="true">
            <IconLock class="w-4 h-4" />
          </span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">积分总余额</div>
            <div class="mt-1.5 text-2xl font-semibold text-accent-700 tabular-nums">
              {{ data?.totalBalance ?? '-' }}
            </div>
            <div class="text-xs text-ink-400 mt-1.5">
              累计发放 {{ data?.totalEarned ?? 0 }}
            </div>
          </div>
          <span class="admin-stat-icon bg-amber-50 text-amber-600" aria-hidden="true">
            <IconCoin class="w-4 h-4" />
          </span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">工具启用</div>
            <div class="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">
              {{ data?.tools.enabled ?? '-' }}
              <span class="text-sm font-normal text-ink-400">/ {{ data?.tools.total ?? '-' }}</span>
            </div>
            <div class="text-xs text-ink-400 mt-1.5">已启用工具数</div>
          </div>
          <span class="admin-stat-icon bg-emerald-50 text-emerald-600" aria-hidden="true">
            <IconSetUp class="w-4 h-4" />
          </span>
        </div>
      </div>
    </div>

    <!-- 工具使用统计（来自 tool_usage_records；老版本迁移前为 0） -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">今日工具使用</div>
            <div class="mt-1.5 text-2xl font-semibold text-accent-700 tabular-nums">
              {{ data?.todayToolUsage ?? 0 }}
            </div>
            <div class="text-xs text-ink-400 mt-1.5">登录用户进入工具页次数</div>
          </div>
          <span class="admin-stat-icon bg-accent-50 text-accent-600" aria-hidden="true">
            <IconHistogram class="w-4 h-4" />
          </span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="text-sm text-ink-500">本周工具使用</div>
            <div class="mt-1.5 text-2xl font-semibold text-ink-900 tabular-nums">
              {{ data?.weekToolUsage ?? 0 }}
            </div>
            <div class="text-xs text-ink-400 mt-1.5">本周一至今累计</div>
          </div>
          <span class="admin-stat-icon bg-indigo-50 text-indigo-600" aria-hidden="true">
            <IconDataLine class="w-4 h-4" />
          </span>
        </div>
      </div>
      <div class="admin-stat-card">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0 flex-1">
            <div class="text-sm text-ink-500 mb-2">TOP 5 工具</div>
            <div v-if="data?.topTools?.length" class="space-y-1.5">
              <div
                v-for="(t, i) in data.topTools"
                :key="t.tool_url"
                class="flex items-center gap-2 text-sm"
              >
                <span class="text-ink-400 w-4 text-right tabular-nums">{{ i + 1 }}.</span>
                <span class="text-ink-900 truncate flex-1">{{ t.tool_title }}</span>
                <span class="text-accent-700 font-medium tabular-nums">{{ t.count }}</span>
              </div>
            </div>
            <div v-else class="text-xs text-ink-400">暂无数据</div>
            <div class="text-xs text-ink-400 mt-3">
              <router-link to="/admin/tool-usage" class="text-accent-600 hover:text-accent-700 font-medium">
                查看全部 TOP →
              </router-link>
            </div>
          </div>
          <span class="admin-stat-icon bg-amber-50 text-amber-600" aria-hidden="true">
            <IconTrophy class="w-4 h-4" />
          </span>
        </div>
      </div>
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
            <div class="flex flex-col items-start gap-0.5">
              <el-tag
                :type="row.type === 'grant' ? 'success' : 'danger'"
                size="small"
                effect="plain"
              >
                {{ row.type === 'grant' ? '赠送' : row.type === 'deduct' ? '扣减' : row.type }}
              </el-tag>
              <span
                class="text-[10px] px-1 py-0.5 rounded"
                :class="sourceClass(row.source)"
              >{{ sourceLabel(row.source) }}</span>
            </div>
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
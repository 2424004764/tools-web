<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchAdminSiteConfig, updateAdminSiteConfig, type AdminSiteConfig } from '@/api/admin/site-config'
import { clearSiteConfigCache } from '@/api/site-config'

const loading = ref(false)
const saving = ref(false)
/** 各配置项含义说明（后端元数据返回） */
const remarks = ref<Record<string, string>>({})

const form = reactive<AdminSiteConfig>({
  comment_system: '',
  giscus_repo: '',
  giscus_repo_id: '',
  giscus_category: '',
  giscus_category_id: '',
  giscus_mapping: '',
})

const mappingOptions = [
  { value: 'title', label: '页面标题（title）' },
  { value: 'pathname', label: '页面路径（pathname）' },
  { value: 'url', label: '完整 URL（url）' },
]

const load = async () => {
  loading.value = true
  try {
    const data = await fetchAdminSiteConfig()
    Object.assign(form, data.values)
    remarks.value = data.remarks || {}
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  saving.value = true
  try {
    const data = await updateAdminSiteConfig({ ...form })
    Object.assign(form, data.values)
    remarks.value = data.remarks || {}
    // 立即失效前台缓存，让新配置生效
    clearSiteConfigCache()
    ElMessage.success('设置已保存')
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  load()
})
</script>

<template>
  <div v-loading="loading">
    <h2 class="text-xl font-semibold text-ink-900 mb-4">站点设置</h2>

    <!-- 评论系统 -->
    <div class="rounded-xl border border-border-subtle bg-white dark:bg-surface-1 p-5 mb-4">
      <h3 class="text-body-lg font-semibold text-ink-900 mb-1">评论系统</h3>
      <p class="text-body-sm text-ink-500 mb-4">选择全站工具页底部评论区的实现方式，保存后立即生效。</p>

      <el-radio-group v-model="form.comment_system" class="!items-stretch flex-wrap gap-3 mb-1">
        <el-radio-button value="giscus">GitHub 评论（giscus）</el-radio-button>
        <el-radio-button value="custom">自建评论系统</el-radio-button>
      </el-radio-group>

      <div class="mt-3 text-body-sm text-ink-500">
        <template v-if="form.comment_system === 'giscus'">
          评论数据存储在 GitHub Discussions，评论者需登录 GitHub 账号。
        </template>
        <template v-else-if="form.comment_system === 'custom'">
          游客填写昵称 + 邮箱即可评论，注册用户登录后直接评论；<b class="text-ink-700">所有评论需在「评论管理」中审核通过后才会展示</b>。
        </template>
        <template v-else>请选择一种评论系统。</template>
      </div>

      <!-- giscus 参数 -->
      <template v-if="form.comment_system === 'giscus'">
        <el-divider class="!my-4" />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">仓库</div>
            <el-input v-model="form.giscus_repo" placeholder="owner/repo 或 GitHub 仓库地址，留空使用环境变量 VITE_GIT_URL" clearable />
            <p v-if="remarks.giscus_repo" class="text-caption text-ink-400 mt-1">{{ remarks.giscus_repo }}</p>
          </div>
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">Repo ID</div>
            <el-input v-model="form.giscus_repo_id" placeholder="R_xxxxxxx（giscus.app 配置页生成）" clearable />
            <p v-if="remarks.giscus_repo_id" class="text-caption text-ink-400 mt-1">{{ remarks.giscus_repo_id }}</p>
          </div>
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">分类名（Category）</div>
            <el-input v-model="form.giscus_category" placeholder="如 General" clearable />
            <p v-if="remarks.giscus_category" class="text-caption text-ink-400 mt-1">{{ remarks.giscus_category }}</p>
          </div>
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">分类 ID（Category ID）</div>
            <el-input v-model="form.giscus_category_id" placeholder="DIC_xxxxxxx（giscus.app 配置页生成）" clearable />
            <p v-if="remarks.giscus_category_id" class="text-caption text-ink-400 mt-1">{{ remarks.giscus_category_id }}</p>
          </div>
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">页面映射方式（Mapping）</div>
            <el-select v-model="form.giscus_mapping" class="!w-full">
              <el-option v-for="o in mappingOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
            <p v-if="remarks.giscus_mapping" class="text-caption text-ink-400 mt-1">{{ remarks.giscus_mapping }}</p>
          </div>
        </div>
      </template>
    </div>

    <div class="flex justify-end">
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

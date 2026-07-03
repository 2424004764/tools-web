<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch, nextTick } from 'vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Setting, Folder, Edit, Plus, Connection, Refresh, Key, CircleClose, Coin
} from '@element-plus/icons-vue'
import { useUserStore } from '@/store/modules/user'
import { ossApi, ossStsProvider, type OssConfig } from '@/api/oss'
import ConfigPanel from './ConfigPanel.vue'
import FileBrowser from './FileBrowser.vue'
import EditorPanel from './EditorPanel.vue'

const userStore = useUserStore()

const info = reactive({
  title: '阿里云 OSS 管理器'
})

const activeTab = ref<'config' | 'browser' | 'editor'>('browser')

const configs = ref<OssConfig[]>([])
const currentConfigId = ref<string | null>(null)
const loadingConfigs = ref(false)

const showConfigForm = ref(false)
const editingConfigId = ref<string | null>(null)

const currentConfig = computed(() =>
  configs.value.find(c => c.id === currentConfigId.value) || null
)

const goToLogin = () => {
  window.location.href = `/login?redirect=${encodeURIComponent('/oss-manager/')}`
}

// 加载配置列表
const loadConfigs = async () => {
  if (!userStore.isLoggedIn) return
  loadingConfigs.value = true
  try {
    const res: any = await ossApi.list()
    if (res.status === 200 && res.data?.success) {
      configs.value = res.data.data || []
      // 自动选中默认配置
      if (!currentConfigId.value) {
        const def = configs.value.find(c => c.isDefault === 1)
        currentConfigId.value = def?.id || configs.value[0]?.id || null
      }
      // 校验当前选中是否仍存在
      if (currentConfigId.value && !configs.value.find(c => c.id === currentConfigId.value)) {
        currentConfigId.value = configs.value[0]?.id || null
      }
    }
  } catch (e) {
    console.error(e)
  } finally {
    loadingConfigs.value = false
  }
}

const onSelectConfig = (id: string) => {
  currentConfigId.value = id
}

const onAddConfig = () => {
  editingConfigId.value = null
  showConfigForm.value = true
}

const onEditConfig = (cfg: OssConfig) => {
  editingConfigId.value = cfg.id
  showConfigForm.value = true
}

const onConfigSaved = async () => {
  showConfigForm.value = false
  editingConfigId.value = null
  await loadConfigs()
}

const onConfigDeleted = async (id: string) => {
  await ElMessageBox.confirm('确认删除该 OSS 配置？此操作不可恢复。', '删除配置', {
    type: 'warning',
    confirmButtonText: '删除',
    cancelButtonText: '取消'
  })
  try {
    const res: any = await ossApi.delete(id)
    if (res.data?.success) {
      ElMessage.success('已删除')
      if (currentConfigId.value === id) {
        currentConfigId.value = null
      }
      await loadConfigs()
    } else {
      ElMessage.error(res.data?.error || '删除失败')
    }
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '删除失败')
  }
}

// 登录状态变化时刷新
watch(() => userStore.isLoggedIn, (v) => {
  if (v) loadConfigs()
  else {
    configs.value = []
    currentConfigId.value = null
    // 登出后清空 STS 缓存（避免 STS token 与账号不匹配）
    ossStsProvider.clear()
  }
})

onMounted(() => {
  if (userStore.isLoggedIn) {
    loadConfigs()
  }
})

// 编辑器面板需要接收当前 Bucket 与 OSS Client
const editorKey = ref(0)
const handleEditorRefresh = () => {
  editorKey.value++
}

// 文件浏览器 -> 编辑器 通信（直接走 nextTick 等到 EditorPanel 挂载后调用 openFile）
const editorRef = ref<InstanceType<typeof EditorPanel> | null>(null)

const onOpenInEditor = async (key: string) => {
  activeTab.value = 'editor'
  // 等到 EditorPanel 完成挂载（v-else-if 条件渲染需要一次 tick）
  await nextTick()
  // 再多等一拍，兜住 ref 设置时序
  setTimeout(() => {
    editorRef.value?.openFile(key)
  }, 50)
}
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title" />

    <!-- 未登录提示 -->
    <div v-if="!userStore.isLoggedIn" class="login-banner">
      <div class="banner-icon">
        <el-icon :size="20"><Key /></el-icon>
      </div>
      <div class="banner-text">
        <div class="banner-title">需要登录才能使用</div>
        <div class="banner-desc">阿里云 AccessKey 属于敏感凭证，本工具只对登录用户开放存储与管理功能。</div>
      </div>
      <el-button type="primary" :icon="Connection" @click="goToLogin">前往登录</el-button>
    </div>

    <!-- 已登录主界面 -->
    <div v-else class="oss-container">
      <!-- 配置切换栏 -->
      <div class="config-bar">
        <div class="config-bar-left">
          <span class="bar-label">当前配置</span>
          <el-select
            v-model="currentConfigId"
            placeholder="请选择 OSS 配置"
            @change="onSelectConfig"
            size="default"
            class="config-select"
            :loading="loadingConfigs"
          >
            <el-option
              v-for="c in configs"
              :key="c.id"
              :value="c.id"
              :label="c.name"
            >
              <span style="float:left">{{ c.name }}</span>
              <span style="float:right; font-size:11px; color:#999">
                {{ c.bucket }}@{{ c.region }}
              </span>
            </el-option>
          </el-select>
          <el-tag v-if="currentConfig" size="small" type="info" effect="plain">
            {{ currentConfig.bucket }} / {{ currentConfig.region }}
          </el-tag>
        </div>
        <div class="config-bar-right">
          <el-button :icon="Refresh" @click="loadConfigs" :loading="loadingConfigs" circle plain />
          <el-button :icon="Plus" type="primary" @click="onAddConfig">新建配置</el-button>
        </div>
      </div>

      <!-- 配置列表（如果用户希望管理多个） -->
      <div v-if="configs.length > 0" class="config-list">
        <div
          v-for="c in configs"
          :key="c.id"
          class="config-card"
          :class="{ active: c.id === currentConfigId, default: c.isDefault === 1 }"
          @click="onSelectConfig(c.id)"
        >
          <div class="card-head">
            <el-icon class="card-icon"><Coin /></el-icon>
            <span class="card-name">{{ c.name }}</span>
            <el-tag v-if="c.isDefault === 1" type="warning" size="small" effect="dark">默认</el-tag>
          </div>
          <div class="card-meta">
            <div class="meta-row">
              <span class="meta-key">Bucket</span>
              <span class="meta-val">{{ c.bucket }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">Region</span>
              <span class="meta-val">{{ c.region }}</span>
            </div>
            <div class="meta-row" v-if="c.accessKeyIdMasked">
              <span class="meta-key">AK</span>
              <span class="meta-val mono">{{ c.accessKeyIdMasked }}</span>
            </div>
            <div class="meta-row">
              <span class="meta-key">STS Role</span>
              <span class="meta-val mono" :title="c.roleArn">{{ c.roleArn ? c.roleArn.split('/').pop() : '未配置' }}</span>
            </div>
          </div>
          <div class="card-actions">
            <el-button :icon="Setting" size="small" plain @click.stop="onEditConfig(c)">编辑</el-button>
            <el-button :icon="CircleClose" size="small" type="danger" plain @click.stop="onConfigDeleted(c.id)">删除</el-button>
          </div>
        </div>
        <div v-if="configs.length === 0 && !loadingConfigs" class="empty-config">
          <el-empty description="还没有 OSS 配置，点击右上角“新建配置”开始" />
        </div>
      </div>

      <!-- Tab 切换 -->
      <div v-if="configs.length > 0" class="tabs-bar">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'browser' }"
          @click="activeTab = 'browser'"
        >
          <el-icon><Folder /></el-icon>
          <span>文件浏览</span>
        </button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'editor' }"
          @click="activeTab = 'editor'; handleEditorRefresh()"
        >
          <el-icon><Edit /></el-icon>
          <span>在线编辑器</span>
        </button>
      </div>

      <!-- 内容区 -->
      <div v-if="configs.length > 0" class="tab-content">
        <FileBrowser
          v-if="activeTab === 'browser' && currentConfig"
          :config="currentConfig"
          :key="currentConfig.id"
          @open-editor="onOpenInEditor"
        />
        <EditorPanel
          v-else-if="activeTab === 'editor' && currentConfig"
          ref="editorRef"
          :config="currentConfig"
          :key="'editor-' + currentConfig.id + '-' + editorKey"
        />
        <div v-if="!currentConfig && activeTab" class="need-config-tip">
          请先选择一个 OSS 配置
        </div>
      </div>
    </div>

    <!-- 配置表单弹窗 -->
    <ConfigPanel
      v-model:visible="showConfigForm"
      :editing-id="editingConfigId"
      :configs="configs"
      @saved="onConfigSaved"
    />

    <!-- 描述 -->
    <ToolDetail title="工具说明">
      <el-text>
        <p>在线管理阿里云 OSS 对象存储，支持<strong>多 Bucket 配置、文件浏览/上传/下载/删除</strong>，
        以及<strong>多 Tab 在线编辑器</strong>（HTML/Markdown/JSON/CSS/JS 实时预览）。</p>
        <p>工具提供<strong>两种访问模式</strong>，在「新建配置」时可任选其一：</p>
        <ol style="margin-left:18px; line-height:1.8">
          <li><strong>临时凭证（推荐）</strong>：在阿里云 RAM 控制台创建 RAM 角色并授予 OSS 读写权限，工具用你的 AK/SK 扮演该角色拿到临时凭证（默认 1 小时有效，到期自动续签）。AK/SK 加密保存，更安全。</li>
          <li><strong>直接 AccessKey</strong>：直接用你的 AK/SK 访问 OSS（要求 AK 本身具有 OSS 读写权限）。配置简单，无需创建 RAM 角色，但凭证长期有效，适合个人或小规模使用。</li>
        </ol>
        <p><strong>使用临时凭证模式的前置步骤（阿里云控制台）：</strong></p>
        <ol style="margin-left:18px; line-height:1.8">
          <li>创建 RAM 角色：RAM 控制台 → 角色 → 创建角色 → 信任主体类型选「阿里云账号」→ 允许本账号扮演；权限页选 <code>AliyunOSSFullAccess</code> 或自定义 OSS 读写策略。创建后系统会显示 ARN，形如 <code>acs:ram::123456789012:role/myrole</code>。</li>
          <li>创建 AccessKey：访问控制 → 用户 → 创建 AccessKey，给该 AccessKey 授予 <code>AliyunSTSAssumeRoleAccess</code> 权限。</li>
        </ol>
        <p>无论哪种模式，AK/SK 都<strong>加密保存在 Cloudflare D1</strong> 中，前端只在调用 OSS 时短暂使用。</p>
        <p><strong>Bucket 跨域（CORS）配置：</strong>进入 OSS 控制台 → Bucket → 数据安全 → 跨域设置 →
        创建规则：允许来源 <code>https://tool.fologde.com</code>，
        允许 Methods <code>GET, PUT, POST, DELETE, HEAD</code>，
        允许 Headers <code>*</code>，暴露 Headers <code>ETag, x-oss-request-id</code>。</p>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.login-banner {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px 22px;
  background: linear-gradient(135deg, #fff7ed, #fed7aa);
  border: 1.5px solid #fdba74;
  border-radius: 14px;
  margin-bottom: 16px;
}

.banner-icon {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ea580c;
}

.banner-text {
  flex: 1;
}

.banner-title {
  font-size: 15px;
  font-weight: 600;
  color: #7c2d12;
}

.banner-desc {
  font-size: 13px;
  color: #9a3412;
  margin-top: 2px;
}

.oss-container {
  padding: 16px;
  background: #fff;
  border-radius: 16px;
  border: 1.5px solid #fed7aa;
  min-height: 600px;
}

.config-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  flex-wrap: wrap;
  gap: 10px;
}

.config-bar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bar-label {
  font-size: 13px;
  color: #9a3412;
  font-weight: 500;
}

.config-select {
  width: 240px;
}

.config-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
}

.config-card {
  padding: 12px 14px;
  background: #fffbeb;
  border: 1.5px solid #fdead5;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.config-card:hover {
  border-color: #fdba74;
  background: #fff;
}

.config-card.active {
  border-color: #f97316;
  background: linear-gradient(135deg, #fff7ed, #fff);
  box-shadow: 0 0 0 3px rgba(249, 115, 22, 0.1);
}

.config-card.default::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #f97316, #fb923c);
  border-radius: 12px 12px 0 0;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.card-icon {
  color: #ea580c;
  font-size: 18px;
}

.card-name {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #7c2d12;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.meta-key {
  color: #b45309;
  width: 64px;
  flex-shrink: 0;
}

.meta-val {
  color: #1f2937;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.meta-val.mono {
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
  font-size: 11px;
}

.card-actions {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #fdead5;
}

.tabs-bar {
  display: flex;
  gap: 6px;
  border-bottom: 1.5px solid #fdead5;
  margin-bottom: 16px;
}

.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: #9a3412;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  color: #ea580c;
}

.tab-btn.active {
  color: #f97316;
  border-bottom-color: #f97316;
  font-weight: 600;
}

.tab-content {
  min-height: 400px;
}

.need-config-tip {
  text-align: center;
  padding: 60px 20px;
  color: #b45309;
  font-size: 14px;
}

.empty-config {
  grid-column: 1 / -1;
}

/* 响应式 */
@media (max-width: 768px) {
  .oss-container {
    padding: 12px;
  }
  .config-bar {
    flex-direction: column;
    align-items: stretch;
  }
  .config-select {
    width: 100%;
  }
  .config-list {
    grid-template-columns: 1fr;
  }
}
</style>
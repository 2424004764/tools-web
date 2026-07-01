<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-gray-800">⚙️ 模型配置</h2>
      <button
        @click="showCreateProvider = true"
        class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm"
      >
        ➕ 新建厂商
      </button>
    </div>

    <div class="flex gap-4">
      <!-- 左侧厂商列表 -->
      <div class="w-56 flex-shrink-0">
        <div class="text-xs font-semibold text-gray-500 mb-2 px-2">
          厂商列表 ({{ providers.length }})
        </div>
        <div v-if="loadingProviders" class="text-center py-4 text-gray-400 text-sm">加载中...</div>
        <div v-else-if="providers.length === 0" class="text-center py-4 text-gray-400 text-sm">
          暂无厂商
        </div>
        <div v-else class="space-y-1">
          <button
            v-for="p in providers"
            :key="p.id"
            @click="selectProvider(p)"
            :class="[
              'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
              selectedProvider?.id === p.id
                ? 'bg-blue-500 text-white'
                : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
            ]"
          >
            <span>{{ p.icon || '🔌' }}</span>
            <span class="flex-1 truncate">{{ p.name }}</span>
            <span
              v-if="!p.is_public"
              :class="[
                'text-xs px-1.5 py-0.5 rounded',
                selectedProvider?.id === p.id
                  ? 'bg-white/20 text-white'
                  : 'bg-orange-100 text-orange-600'
              ]"
            >私有</span>
          </button>
        </div>
      </div>

      <!-- 右侧详情 -->
      <div class="flex-1 min-w-0">
        <div v-if="!selectedProvider" class="text-center py-12 text-gray-400 text-sm">
          ← 从左侧选择一个厂商进行配置
        </div>

        <div v-else class="space-y-4">
          <!-- 厂商基本信息编辑 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-gray-800">
                厂商设置
                <span v-if="isReadOnlyProvider" class="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded">系统公开（只读）</span>
                <span v-else-if="selectedProvider.is_public && isAdminUser" class="ml-2 text-xs px-2 py-0.5 bg-blue-100 text-blue-600 rounded">系统公开</span>
              </h3>
              <div class="flex gap-2">
                <button
                  v-if="canEditSelectedProvider"
                  @click="saveProvider"
                  class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >💾 保存</button>
                <button
                  v-if="canEditSelectedProvider && !selectedProvider.is_public"
                  @click="deleteProvider"
                  class="px-3 py-1.5 bg-red-500 text-white rounded text-xs hover:bg-red-600"
                >🗑 删除</button>
              </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-600">名称 *</label>
                <input v-model="providerForm.name" :disabled="isReadOnlyProvider" class="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600">slug *</label>
                <input v-model="providerForm.slug" disabled class="w-full px-3 py-1.5 border rounded text-sm bg-gray-100" />
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">base_url *</label>
                <input v-model="providerForm.base_url" :disabled="isReadOnlyProvider" :placeholder="isReadOnlyProvider ? '系统公开厂商，base_url 已隐藏' : ''" class="w-full px-3 py-1.5 border rounded text-sm font-mono disabled:bg-gray-100" />
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">api_key</label>
                <input v-model="providerForm.api_key" type="password" :disabled="isReadOnlyProvider" :placeholder="isReadOnlyProvider ? '系统公开厂商，api_key 已隐藏' : '公开厂商可由管理员填入，私有厂商必填'" class="w-full px-3 py-1.5 border rounded text-sm font-mono disabled:bg-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600">icon</label>
                <input v-model="providerForm.icon" :disabled="isReadOnlyProvider" placeholder="🤖" class="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100" />
              </div>
              <div v-if="isAdminUser" class="flex items-end flex-col gap-2">
                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input v-model="providerForm.is_public" type="checkbox" class="rounded" />
                  <span>公开给所有登录用户（可见可用）</span>
                </label>
                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input v-model="providerForm.is_open" type="checkbox" class="rounded" />
                  <span>接受游客/普通用户自带 API Key</span>
                </label>
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">描述</label>
                <input v-model="providerForm.description" class="w-full px-3 py-1.5 border rounded text-sm" />
              </div>
            </div>
          </div>

          <!-- 模型列表 -->
          <div class="bg-gray-50 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-gray-800">
                模型 ({{ models.length }})
              </h3>
              <button
                @click="showCreateModel = true"
                class="px-3 py-1.5 bg-green-500 text-white rounded text-xs hover:bg-green-600"
              >➕ 新建模型</button>
            </div>
            <div v-if="models.length === 0" class="text-center py-4 text-gray-400 text-sm">
              该厂商暂无模型
            </div>
            <div v-else class="space-y-2">
              <div
                v-for="m in models"
                :key="m.id"
                :class="[
                  'p-3 rounded-lg border-2 cursor-pointer transition-colors',
                  selectedModel?.id === m.id
                    ? 'border-blue-500 bg-white'
                    : 'border-transparent bg-white hover:border-gray-200'
                ]"
                @click="selectModel(m)"
              >
                <div class="flex items-center justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-sm">{{ m.name }}</span>
                      <span class="text-xs text-gray-400 font-mono">{{ m.model_id }}</span>
                      <span v-if="m.uid === '' && m.is_public" class="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-600 rounded">系统公开</span>
                      <span v-else-if="m.uid === myUid" class="text-xs px-1.5 py-0.5 bg-green-100 text-green-600 rounded">我的</span>
                    </div>
                    <div class="flex gap-1 mt-1">
                      <span
                        v-for="cap in parseArr(m.capabilities)"
                        :key="cap"
                        class="text-xs px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded"
                      >{{ cap }}</span>
                    </div>
                  </div>
                  <button
                    v-if="isAdminUser || (m.uid === myUid)"
                    @click.stop="deleteModel(m)"
                    class="ml-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                    title="删除"
                  >×</button>
                </div>
              </div>
            </div>
          </div>

          <!-- 模型详情编辑 -->
          <div v-if="selectedModel" class="bg-white border-2 border-blue-200 rounded-lg p-4">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-bold text-gray-800">
                模型详情：{{ selectedModel.name }}
                <span v-if="isReadOnlyModel" class="ml-2 text-xs px-2 py-0.5 bg-orange-100 text-orange-600 rounded">系统公开模型（只读）</span>
              </h3>
              <div class="flex gap-2">
                <button
                  v-if="canEditSelectedModel"
                  @click="saveModel"
                  class="px-3 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
                >💾 保存</button>
                <button
                  @click="showTestDialog = true"
                  class="px-3 py-1.5 bg-purple-500 text-white rounded text-xs hover:bg-purple-600"
                >🧪 测试调用</button>
              </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label class="text-xs text-gray-600">名称 *</label>
                <input v-model="modelForm.name" :disabled="isReadOnlyModel" class="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100" />
              </div>
              <div>
                <label class="text-xs text-gray-600">model_id *</label>
                <input v-model="modelForm.model_id" :disabled="isReadOnlyModel" class="w-full px-3 py-1.5 border rounded text-sm font-mono disabled:bg-gray-100" />
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">model_key（不可修改）</label>
                <input :value="selectedModel.model_key" disabled class="w-full px-3 py-1.5 border rounded text-sm bg-gray-100 font-mono" />
              </div>
              <div v-if="isAdminUser" class="md:col-span-2">
                <label class="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    :checked="!!selectedModel.is_public"
                    @change="toggleModelIsPublic($event)"
                    class="rounded"
                  />
                  <span>对外公开（普通用户可见、可用）</span>
                </label>
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">能力（多选）</label>
                <div class="flex flex-wrap gap-2 mt-1">
                  <label
                    v-for="cap in ALL_CAPABILITIES"
                    :key="cap"
                    class="flex items-center gap-1 text-xs px-2 py-1 border rounded cursor-pointer hover:bg-gray-50"
                    :class="[
                      modelForm.capabilities.includes(cap) ? 'bg-blue-50 border-blue-300' : '',
                      isReadOnlyModel ? 'pointer-events-none opacity-60' : ''
                    ]"
                  >
                    <input
                      type="checkbox"
                      :checked="modelForm.capabilities.includes(cap)"
                      @change="toggleCapability(cap)"
                      class="rounded"
                      :disabled="isReadOnlyModel"
                    />
                    {{ cap }}
                  </label>
                </div>
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">描述</label>
                <input v-model="modelForm.description" :disabled="isReadOnlyModel" class="w-full px-3 py-1.5 border rounded text-sm disabled:bg-gray-100" />
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">endpoints (JSON)</label>
                <textarea
                  v-model="modelForm.endpointsText"
                  rows="4"
                  :disabled="isReadOnlyModel"
                  class="w-full px-3 py-1.5 border rounded text-xs font-mono disabled:bg-gray-100"
                  :class="jsonErrors.endpoints ? 'border-red-500' : ''"
                ></textarea>
                <p v-if="jsonErrors.endpoints" class="text-xs text-red-500 mt-1">{{ jsonErrors.endpoints }}</p>
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">input_template (JSON)</label>
                <textarea
                  v-model="modelForm.inputTemplateText"
                  rows="6"
                  :disabled="isReadOnlyModel"
                  class="w-full px-3 py-1.5 border rounded text-xs font-mono disabled:bg-gray-100"
                  :class="jsonErrors.input_template ? 'border-red-500' : ''"
                ></textarea>
                <p v-if="jsonErrors.input_template" class="text-xs text-red-500 mt-1">{{ jsonErrors.input_template }}</p>
              </div>
              <div class="md:col-span-2">
                <label class="text-xs text-gray-600">output_paths (JSON)</label>
                <textarea
                  v-model="modelForm.outputPathsText"
                  rows="4"
                  :disabled="isReadOnlyModel"
                  class="w-full px-3 py-1.5 border rounded text-xs font-mono disabled:bg-gray-100"
                  :class="jsonErrors.output_paths ? 'border-red-500' : ''"
                ></textarea>
                <p v-if="jsonErrors.output_paths" class="text-xs text-red-500 mt-1">{{ jsonErrors.output_paths }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 新建厂商弹窗 -->
    <div v-if="showCreateProvider" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCreateProvider = false">
      <div class="bg-white rounded-2xl p-6 max-w-md w-full" @click.stop>
        <h3 class="font-bold text-lg mb-4">新建厂商</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-600">名称 *</label>
            <input v-model="newProvider.name" placeholder="如 OpenAI" class="w-full px-3 py-1.5 border rounded text-sm" />
          </div>
          <div>
            <label class="text-xs text-gray-600">slug * （唯一标识）</label>
            <input v-model="newProvider.slug" placeholder="如 openai" class="w-full px-3 py-1.5 border rounded text-sm font-mono" />
          </div>
          <div>
            <label class="text-xs text-gray-600">base_url *</label>
            <input v-model="newProvider.base_url" placeholder="https://api.openai.com/v1" class="w-full px-3 py-1.5 border rounded text-sm font-mono" />
          </div>
          <div>
            <label class="text-xs text-gray-600">api_key</label>
            <input v-model="newProvider.api_key" type="password" placeholder="可不填，后续编辑时填入" class="w-full px-3 py-1.5 border rounded text-sm font-mono" />
          </div>
          <label v-if="isAdminUser" class="flex items-center gap-2 text-sm">
            <input v-model="newProvider.is_public" type="checkbox" />
            <span>公开给所有登录用户</span>
          </label>
          <label v-if="isAdminUser" class="flex items-center gap-2 text-sm">
            <input v-model="newProvider.is_open" type="checkbox" />
            <span>接受游客/普通用户自带 API Key</span>
          </label>
        </div>
        <div class="flex gap-2 mt-4">
          <button @click="showCreateProvider = false" class="flex-1 px-3 py-2 bg-gray-200 rounded text-sm">取消</button>
          <button @click="createProvider" class="flex-1 px-3 py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">创建</button>
        </div>
      </div>
    </div>

    <!-- 新建模型弹窗 -->
    <div v-if="showCreateModel" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showCreateModel = false">
      <div class="bg-white rounded-2xl p-6 max-w-md w-full" @click.stop>
        <h3 class="font-bold text-lg mb-4">新建模型</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-600">名称 *</label>
            <input v-model="newModel.name" placeholder="如 GPT-4o" class="w-full px-3 py-1.5 border rounded text-sm" />
          </div>
          <div>
            <label class="text-xs text-gray-600">model_key *（全局唯一，建议格式：provider_slug/model_id）</label>
            <input v-model="newModel.model_key" placeholder="如 openai/gpt-4o" class="w-full px-3 py-1.5 border rounded text-sm font-mono" />
          </div>
          <div>
            <label class="text-xs text-gray-600">model_id *</label>
            <input v-model="newModel.model_id" placeholder="如 gpt-4o" class="w-full px-3 py-1.5 border rounded text-sm font-mono" />
          </div>
          <div>
            <label class="text-xs text-gray-600">能力（多选）</label>
            <div class="flex flex-wrap gap-1 mt-1">
              <label
                v-for="cap in ALL_CAPABILITIES"
                :key="cap"
                class="text-xs px-2 py-1 border rounded cursor-pointer"
                :class="newModel.capabilities.includes(cap) ? 'bg-blue-50 border-blue-300' : ''"
              >
                <input type="checkbox" :checked="newModel.capabilities.includes(cap)" @change="toggleNewCapability(cap)" class="hidden" />
                {{ cap }}
              </label>
            </div>
          </div>
          <p class="text-xs text-gray-500">💡 创建后可在右侧编辑 endpoints/input_template/output_paths</p>
        </div>
        <div class="flex gap-2 mt-4">
          <button @click="showCreateModel = false" class="flex-1 px-3 py-2 bg-gray-200 rounded text-sm">取消</button>
          <button @click="createModel" class="flex-1 px-3 py-2 bg-green-500 text-white rounded text-sm hover:bg-green-600">创建</button>
        </div>
      </div>
    </div>

    <!-- 测试调用弹窗 -->
    <div v-if="showTestDialog" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" @click.self="showTestDialog = false">
      <div class="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto" @click.stop>
        <h3 class="font-bold text-lg mb-4">测试调用 - {{ selectedModel?.name }}</h3>
        <div class="space-y-3">
          <div>
            <label class="text-xs text-gray-600">选择 capability</label>
            <select v-model="testCapability" class="w-full px-3 py-1.5 border rounded text-sm">
              <option v-for="cap in (parseArr(selectedModel.capabilities))" :key="cap" :value="cap">{{ cap }}</option>
            </select>
          </div>
          <div>
            <label class="text-xs text-gray-600">请求参数 (JSON)</label>
            <textarea
              v-model="testParamsText"
              rows="8"
              class="w-full px-3 py-1.5 border rounded text-xs font-mono"
            ></textarea>
          </div>
          <button
            @click="runTest"
            :disabled="testing"
            class="w-full px-4 py-2 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 disabled:bg-gray-300"
          >{{ testing ? '测试中...' : '🚀 发起测试调用' }}</button>
          <div v-if="testResult" class="bg-gray-50 rounded p-3 text-xs">
            <div class="font-semibold mb-1">响应：</div>
            <pre class="whitespace-pre-wrap break-all">{{ testResult }}</pre>
          </div>
          <div v-if="testError" class="bg-red-50 text-red-700 rounded p-3 text-xs">
            <div class="font-semibold mb-1">错误：</div>
            {{ testError }}
          </div>
        </div>
        <div class="flex justify-end mt-4">
          <button @click="showTestDialog = false" class="px-4 py-2 bg-gray-200 rounded text-sm">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useUserStore } from '@/store/modules/user'
import { getLocalToken } from '@/utils/user'
import { invalidateModelCache } from './model-cache'

const userStore = useUserStore()
const isAdminUser = computed(() => userStore.getIsAdmin)

const ALL_CAPABILITIES = ['chat', 'chat_stream', 'image_generation', 'image_edit', 'video_submit', 'video_poll']

// 当前登录用户的 uid（用于 owner 判断）
const myUid = computed(() => userStore.getUserInfo?.uid || '')

// 当前选中的厂商是否可编辑：管理员可编辑任何；用户只能编辑自己的（uid=自己）
const canEditSelectedProvider = computed(() => {
  if (!selectedProvider.value) return false
  if (isAdminUser.value) return true
  return (selectedProvider.value.uid || '') === myUid.value
})

// 当前选中的模型是否可编辑
const canEditSelectedModel = computed(() => {
  if (!selectedModel.value) return false
  if (isAdminUser.value) return true
  return (selectedModel.value.uid || '') === myUid.value
})

// 是否只读模式（不是 owner、不是 admin）
const isReadOnlyProvider = computed(() => !!selectedProvider.value && !canEditSelectedProvider.value)
const isReadOnlyModel = computed(() => !!selectedModel.value && !canEditSelectedModel.value)

// 构造带认证的请求头
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getLocalToken()
  const headers: Record<string, string> = { ...extra }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  return headers
}

// 厂商列表
const providers = ref<any[]>([])
const loadingProviders = ref(false)
const selectedProvider = ref<any>(null)

// 模型列表
const models = ref<any[]>([])
const selectedModel = ref<any>(null)

// 表单
const providerForm = ref({ name: '', slug: '', base_url: '', api_key: '', is_public: false, is_open: false, description: '', icon: '' })
const modelForm = ref({
  name: '',
  model_id: '',
  capabilities: [] as string[],
  description: '',
  endpointsText: '{}',
  inputTemplateText: '{}',
  outputPathsText: '{}',
})
const jsonErrors = ref<Record<string, string>>({})

// 弹窗
const showCreateProvider = ref(false)
const showCreateModel = ref(false)
const showTestDialog = ref(false)

const newProvider = ref({ name: '', slug: '', base_url: '', api_key: '', is_public: false, is_open: false, icon: '🔌', description: '' })
const newModel = ref({ name: '', model_key: '', model_id: '', capabilities: [] as string[], description: '' })

const testCapability = ref('chat')
const testParamsText = ref('{"messages":[{"role":"user","content":"hi"}]}')
const testResult = ref('')
const testError = ref('')
const testing = ref(false)

// ============ 厂商操作 ============
async function loadProviders() {
  loadingProviders.value = true
  try {
    const res = await fetch('/api/ai-providers')
    const json = await res.json()
    if (json.success) {
      providers.value = json.data
    }
  } catch (err) {
    ElMessage.error('加载厂商失败')
  } finally {
    loadingProviders.value = false
  }
}

function selectProvider(p: any) {
  selectedProvider.value = p
  providerForm.value = {
    name: p.name,
    slug: p.slug,
    base_url: p.base_url,
    api_key: p.api_key || '',
    is_public: !!p.is_public,
    is_open: !!p.is_open,
    description: p.description || '',
    icon: p.icon || '',
  }
  loadModels()
}

async function saveProvider() {
  if (!providerForm.value.name || !providerForm.value.base_url) {
    ElMessage.warning('名称和 base_url 必填')
    return
  }
  try {
    const res = await fetch(`/api/ai-providers?id=${selectedProvider.value.id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(providerForm.value),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('保存成功')
      invalidateModelCache()
      await loadProviders()
    } else {
      ElMessage.error(json.error || '保存失败')
    }
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

async function deleteProvider() {
  try {
    await ElMessageBox.confirm('确定删除此厂商及其所有模型？此操作不可撤销', '确认删除', {
      type: 'warning',
    })
  } catch { return }

  try {
    const res = await fetch(`/api/ai-providers?id=${selectedProvider.value.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('已删除')
      selectedProvider.value = null
      selectedModel.value = null
      await loadProviders()
    } else {
      ElMessage.error(json.error || '删除失败')
    }
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

async function createProvider() {
  if (!newProvider.value.name || !newProvider.value.slug || !newProvider.value.base_url) {
    ElMessage.warning('名称、slug、base_url 必填')
    return
  }
  try {
    const res = await fetch('/api/ai-providers', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(newProvider.value),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('创建成功')
      showCreateProvider.value = false
      newProvider.value = { name: '', slug: '', base_url: '', api_key: '', is_public: false, is_open: false, icon: '🔌', description: '' }
      await loadProviders()
    } else {
      ElMessage.error(json.error || '创建失败')
    }
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

// ============ 模型操作 ============
async function loadModels() {
  if (!selectedProvider.value) return
  try {
    const res = await fetch(`/api/ai-models?provider_id=${selectedProvider.value.id}`)
    const json = await res.json()
    if (json.success) {
      models.value = json.data
    }
  } catch (err) {
    ElMessage.error('加载模型失败')
  }
}

function selectModel(m: any) {
  selectedModel.value = m
  modelForm.value = {
    name: m.name,
    model_id: m.model_id,
    capabilities: parseArr(m.capabilities),
    description: m.description || '',
    endpointsText: JSON.stringify(parseObj(m.endpoints), null, 2),
    inputTemplateText: JSON.stringify(parseObj(m.input_template), null, 2),
    outputPathsText: JSON.stringify(parseObj(m.output_paths), null, 2),
  }
  validateAllJson()
}

// 管理员切换"对外公开"
async function toggleModelIsPublic(e: Event) {
  if (!isAdminUser.value || !selectedModel.value) return
  const checked = (e.target as HTMLInputElement).checked
  try {
    const res = await fetch(`/api/ai-models?id=${selectedModel.value.id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ is_public: checked ? 1 : 0 }),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success(checked ? '已对外开放' : '已收回公开')
      await loadModels()
      // 刷新 selectedModel 引用
      const updated = models.value.find(x => x.id === selectedModel.value.id)
      if (updated) selectedModel.value = updated
      invalidateModelCache()
    } else {
      ElMessage.error(json.error || '更新失败')
    }
  } catch {
    ElMessage.error('更新失败')
  }
}

async function saveModel() {
  if (!modelForm.value.name || !modelForm.value.model_id) {
    ElMessage.warning('名称和 model_id 必填')
    return
  }
  if (Object.keys(jsonErrors.value).length > 0) {
    ElMessage.error('JSON 格式错误，请先修正')
    return
  }

  try {
    const res = await fetch(`/api/ai-models?id=${selectedModel.value.id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        name: modelForm.value.name,
        model_id: modelForm.value.model_id,
        capabilities: modelForm.value.capabilities,
        description: modelForm.value.description,
        endpoints: JSON.parse(modelForm.value.endpointsText),
        input_template: JSON.parse(modelForm.value.inputTemplateText),
        output_paths: JSON.parse(modelForm.value.outputPathsText),
      }),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('保存成功')
      invalidateModelCache(selectedModel.value.model_key)
      await loadModels()
    } else {
      ElMessage.error(json.error || '保存失败')
    }
  } catch (err) {
    ElMessage.error('保存失败')
  }
}

async function deleteModel(m: any) {
  try {
    await ElMessageBox.confirm(`确定删除模型「${m.name}」？`, '确认', { type: 'warning' })
  } catch { return }

  try {
    const res = await fetch(`/api/ai-models?id=${m.id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('已删除')
      if (selectedModel.value?.id === m.id) selectedModel.value = null
      invalidateModelCache(m.model_key)
      await loadModels()
    } else {
      ElMessage.error(json.error || '删除失败')
    }
  } catch (err) {
    ElMessage.error('删除失败')
  }
}

async function createModel() {
  if (!newModel.value.name || !newModel.value.model_key || !newModel.value.model_id) {
    ElMessage.warning('名称、model_key、model_id 必填')
    return
  }
  if (newModel.value.capabilities.length === 0) {
    ElMessage.warning('至少选择 1 个能力')
    return
  }
  try {
    const res = await fetch('/api/ai-models', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        provider_id: selectedProvider.value.id,
        name: newModel.value.name,
        model_key: newModel.value.model_key,
        model_id: newModel.value.model_id,
        capabilities: newModel.value.capabilities,
        description: newModel.value.description,
        endpoints: {},
        input_template: {},
        output_paths: {},
      }),
    })
    const json = await res.json()
    if (json.success) {
      ElMessage.success('创建成功，请编辑 endpoints/template')
      showCreateModel.value = false
      newModel.value = { name: '', model_key: '', model_id: '', capabilities: [], description: '' }
      await loadModels()
    } else {
      ElMessage.error(json.error || '创建失败')
    }
  } catch (err) {
    ElMessage.error('创建失败')
  }
}

// ============ 测试调用 ============
async function runTest() {
  testing.value = true
  testResult.value = ''
  testError.value = ''

  let params
  try {
    params = JSON.parse(testParamsText.value)
  } catch (err: any) {
    testError.value = '参数 JSON 解析失败: ' + err.message
    testing.value = false
    return
  }

  try {
    const res = await fetch('/api/ai-proxy', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        capability: testCapability.value,
        model_key: selectedModel.value.model_key,
        params,
      }),
    })
    const json = await res.json()
    if (json.ok) {
      testResult.value = JSON.stringify(json.data, null, 2)
      ElMessage.success('测试成功')
    } else {
      testError.value = json.error || '调用失败'
    }
  } catch (err: any) {
    testError.value = err.message || '网络错误'
  } finally {
    testing.value = false
  }
}

// ============ 工具 ============
function toggleCapability(cap: string) {
  const idx = modelForm.value.capabilities.indexOf(cap)
  if (idx >= 0) modelForm.value.capabilities.splice(idx, 1)
  else modelForm.value.capabilities.push(cap)
}

function toggleNewCapability(cap: string) {
  const idx = newModel.value.capabilities.indexOf(cap)
  if (idx >= 0) newModel.value.capabilities.splice(idx, 1)
  else newModel.value.capabilities.push(cap)
}

function validateAllJson() {
  jsonErrors.value = {}
  for (const [key, text] of [
    ['endpoints', modelForm.value.endpointsText],
    ['input_template', modelForm.value.inputTemplateText],
    ['output_paths', modelForm.value.outputPathsText],
  ] as const) {
    try { JSON.parse(text) } catch (err: any) { jsonErrors.value[key] = err.message }
  }
}

watch([
  () => modelForm.value.endpointsText,
  () => modelForm.value.inputTemplateText,
  () => modelForm.value.outputPathsText,
], () => validateAllJson())

function parseArr(s: any): string[] {
  if (Array.isArray(s)) return s
  if (typeof s === 'string') { try { return JSON.parse(s) } catch { return [] } }
  return []
}

function parseObj(s: any): Record<string, any> {
  if (s && typeof s === 'object' && !Array.isArray(s)) return s
  if (typeof s === 'string') { try { return JSON.parse(s) } catch { return {} } }
  return {}
}

onMounted(() => {
  loadProviders()
})
</script>
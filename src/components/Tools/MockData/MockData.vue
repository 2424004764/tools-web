<script setup lang="ts">
import { reactive, ref, computed, onMounted, watch } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, Edit, CopyDocument, Download, Refresh, FolderOpened, Promotion, Connection, Link } from '@element-plus/icons-vue'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import FieldEditor from './FieldEditor.vue'
import functionsRequest from '@/utils/functionsRequest'
import { useUserStore } from '@/store/modules/user'
import { copy } from '@/utils/string'

interface Field {
  id?: string
  name: string
  type: string
  required?: boolean
  min?: number | null
  max?: number | null
  prefix?: string
  options?: string[]
  // object 类型：子字段
  children?: Field[]
  // array 类型：元素类型（可指向另一个 primitive 类型或 'object'）
  itemType?: string
  // array of object：元素的子字段
  itemChildren?: Field[]
}

interface Recipe {
  id: string
  uid?: string
  name: string
  description: string
  schema: Field[]
  createTime: string
  updateTime: string
}

interface Sample {
  key: string
  name: string
  description: string
  schema: any[]
  sample: any
}

const STORAGE_KEY = 'tools-web-mock-schemas'
const userStore = useUserStore()

// ==================== 字段类型与生成器 ====================

const SURNAMES = ['王', '李', '张', '刘', '陈', '杨', '黄', '赵', '吴', '周', '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗']
const GIVEN_CHARS = '伟芳娜秀英敏静丽强磊军洋勇艳杰娟涛明超秀兰霞平刚桂英文华建国家春哲志强宇浩然子轩思辰雅萱梓涵雨欣诗琪'
const COMPANIES = ['阿里巴巴', '腾讯科技', '字节跳动', '美团', '京东', '百度', '小米科技', '华为技术', '网易', '拼多多', '滴滴出行', '快手', '哔哩哔哩', '新浪', '搜狐']
const CITIES = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京', '苏州', '西安', '重庆', '天津', '长沙', '青岛', '厦门', '宁波']
const PROVINCES = ['北京市', '上海市', '广东省', '江苏省', '浙江省', '四川省', '湖北省', '陕西省', '重庆市', '天津市']
const DISTRICTS = ['朝阳区', '海淀区', '浦东新区', '黄浦区', '天河区', '南山区', '西湖区', '锦江区', '武侯区', '鼓楼区']
const LOREM_WORDS = ['lorem', 'ipsum', 'dolor', 'sit', 'amet', 'consectetur', 'adipiscing', 'elit', 'sed', 'do', 'eiusmod', 'tempor', 'incididunt', 'ut', 'labore', 'magna', 'aliqua']

function randInt(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min }
function randFloat(min: number, max: number, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals))
}
function pick<T>(arr: T[]): T { return arr[randInt(0, arr.length - 1)] }
function uuid() { return uuidv4() }
function pad(n: number, len = 2) { return String(n).padStart(len, '0') }
function randString(len = 6, prefix = '') {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let s = ''
  for (let i = 0; i < len; i++) s += chars[randInt(0, chars.length - 1)]
  return prefix + s
}
function randName() {
  const surname = pick(SURNAMES)
  const len = randInt(1, 2)
  let given = ''
  for (let i = 0; i < len; i++) given += pick(GIVEN_CHARS.split(''))
  return surname + given
}
function randPhone() {
  const prefixes = ['13', '15', '17', '18', '19']
  return pick(prefixes) + randInt(100000000, 999999999).toString().padStart(9, '0')
}
function randEmail() {
  return randString(randInt(5, 8)) + '@' + randString(randInt(4, 7)) + '.' + pick(['com', 'cn', 'org', 'io'])
}
function randDate() {
  const d = new Date(Date.now() - randInt(0, 365) * 86400000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function randDatetime() {
  const d = new Date(Date.now() - randInt(0, 365) * 86400000 - randInt(0, 86400) * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}Z`
}
function randColor() {
  return '#' + randInt(0, 0xFFFFFF).toString(16).padStart(6, '0')
}
function randAvatar() {
  return `https://i.pravatar.cc/300?u=${randInt(1, 10000)}`
}
function randAddress() {
  return pick(PROVINCES) + pick(CITIES) + pick(DISTRICTS) + `${randInt(1, 200)}号`
}
function randCompany() { return pick(COMPANIES) + (Math.random() > 0.5 ? '有限公司' : '集团') }
function randLorem() {
  const sentence: string[] = []
  for (let i = 0; i < randInt(4, 10); i++) sentence.push(pick(LOREM_WORDS))
  return sentence.join(' ') + '.'
}
function randUrl() { return `https://example.com/${randString(8)}` }

// 生成一个 primitive 值（不含 object/array）
function generatePrimitive(type: string, field?: Field): any {
  const min = field?.min ?? 0
  const max = field?.max ?? 100
  let v: any
  switch (type) {
    case 'string': v = randString(randInt(4, 8), field?.prefix || ''); break
    case 'integer': v = randInt(min, max); break
    case 'float': v = randFloat(min, max); break
    case 'boolean': v = Math.random() > 0.5; break
    case 'email': v = randEmail(); break
    case 'name': v = randName(); break
    case 'phone': v = randPhone(); break
    case 'url': v = randUrl(); break
    case 'date': v = randDate(); break
    case 'datetime': v = randDatetime(); break
    case 'color': v = randColor(); break
    case 'avatar': v = randAvatar(); break
    case 'address': v = randAddress(); break
    case 'company': v = randCompany(); break
    case 'lorem': v = randLorem(); break
    case 'id': v = uuid(); break
    default: v = null
  }
  if (type === 'string' && Array.isArray(field?.options) && (field.options?.length ?? 0) > 0) {
    v = pick(field.options as string[])
  }
  return v
}

// 递归生成字段值，支持 object/array 嵌套
function generateFieldValue(field: Field): any {
  if (field.type === 'object') {
    const obj: Record<string, any> = {}
    for (const child of field.children || []) {
      let v = generateFieldValue(child)
      if (child.required && (v === '' || v === null || v === undefined ||
          (Array.isArray(v) && v.length === 0) ||
          (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0))) {
        v = generateFieldValue(child)
      }
      obj[child.name] = v
    }
    return obj
  }
  if (field.type === 'array') {
    const len = randInt(field.min ?? 1, field.max ?? 3)
    const itemType = field.itemType || 'string'
    const arr: any[] = []
    for (let i = 0; i < len; i++) {
      if (itemType === 'object') {
        const obj: Record<string, any> = {}
        for (const child of field.itemChildren || []) {
          obj[child.name] = generateFieldValue(child)
        }
        arr.push(obj)
      } else {
        arr.push(generatePrimitive(itemType, field))
      }
    }
    return arr
  }
  return generatePrimitive(field.type, field)
}

// ==================== 状态 ====================

const info = reactive({ title: 'Mock 数据生成器' })
const goToLogin = () => { window.location.href = '/login?redirect=/mock-data/' }
const useRemote = computed(() => userStore.isLoggedIn)

const fields = ref<Field[]>([])
const recipeMeta = reactive({ name: '', description: '' })
const generated = ref<any>({})
const generatedText = computed(() => JSON.stringify(generated.value, null, 2))

// 上次载入/保存时的基线，用于检测未保存修改
const baselineName = ref('')
const baselineDescription = ref('')
const baselineFields = ref<string>('')
const captureBaseline = () => {
  baselineName.value = recipeMeta.name
  baselineDescription.value = recipeMeta.description
  baselineFields.value = JSON.stringify(fields.value)
}
const isDirty = computed(() => {
  if (recipeMeta.name !== baselineName.value) return true
  if (recipeMeta.description !== baselineDescription.value) return true
  return JSON.stringify(fields.value) !== baselineFields.value
})

const recipes = ref<Recipe[]>([])
const samples = ref<Sample[]>([])
const loadingSamples = ref(false)
const syncing = ref(false)
const saving = ref(false)
const editingRecipeId = ref<string | null>(null)

// ==================== localStorage 工具 ====================

const loadLocal = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    recipes.value = raw ? JSON.parse(raw) : []
  } catch {
    recipes.value = []
  }
}
const saveLocal = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes.value))
}

// ==================== 云端 CRUD ====================

const loadRemote = async () => {
  try {
    const res = await functionsRequest.get('/api/mock-schemas', { params: { page: 1, pageSize: 100 } })
    if (res.status === 200) {
      recipes.value = (res.data.data || []).map((it: any) => ({ ...it, synced: true }))
    }
  } catch (e) {
    console.error('获取云端配方失败:', e)
    recipes.value = []
  }
}

const loadData = () => {
  if (useRemote.value) loadRemote()
  else loadLocal()
}

// 登录后：把本地未同步的配方逐条上传到云端
const syncLocalToRemote = async () => {
  const local = recipes.value.filter(r => !(r as any).synced && !r.uid)
  if (local.length === 0) return
  syncing.value = true
  let ok = 0
  for (const r of local) {
    try {
      const res = await functionsRequest.post('/api/mock-schemas', {
        name: r.name,
        description: r.description,
        schema: r.schema
      })
      if (res.status === 201) ok++
    } catch { /* skip */ }
  }
  if (ok > 0) {
    ElMessage.success(`已将 ${ok} 条本地配方同步到云端`)
    saveLocal() // 同步成功后清掉 localStorage
    localStorage.removeItem(STORAGE_KEY)
  }
  syncing.value = false
}

watch(() => userStore.isLoggedIn, async (loggedIn) => {
  if (loggedIn) await syncLocalToRemote()
  loadData()
})

// ==================== 字段编辑 ====================

const addField = () => {
  fields.value.push({ id: uuid(), name: `field${fields.value.length + 1}`, type: 'string', required: false })
}
const updateField = (idx: number, f: Field) => {
  const arr = [...fields.value]
  arr[idx] = f
  fields.value = arr
}
const removeField = (idx: number) => {
  const arr = [...fields.value]
  arr.splice(idx, 1)
  fields.value = arr
}

// 自动生成下一个可用的默认名称（mock1, mock2, ... 跳过已存在的）
const nextDefaultName = () => {
  const used = new Set(
    recipes.value
      .map(r => /^mock(\d+)$/.exec(r.name)?.[1])
      .filter((n): n is string => !!n)
      .map(n => parseInt(n, 10))
  )
  let n = 1
  while (used.has(n)) n++
  return `mock${n}`
}

const newRecipe = () => {
  editingRecipeId.value = null
  recipeMeta.name = nextDefaultName()
  recipeMeta.description = ''
  fields.value = [
    {
      id: uuid(),
      name: 'data',
      type: 'array',
      min: 2,
      max: 2,
      itemType: 'object',
      itemChildren: [
        { id: uuid(), name: 'id', type: 'id' },
        { id: uuid(), name: 'name', type: 'name' }
      ]
    },
    { id: uuid(), name: 'error', type: 'string' },
    { id: uuid(), name: 'code', type: 'integer', required: true, min: 0, max: 0 }
  ]
  generated.value = {}
  captureBaseline()
}

// ==================== 生成数据 ====================

// 静默重新生成（无消息提示，供 watcher 调用）—— 输出始终是单对象（API 响应根）
const regenerate = () => {
  const validFields = fields.value.filter(f => f.name && f.name.trim())
  if (validFields.length === 0) {
    generated.value = {}
    return
  }
  const obj: Record<string, any> = {}
  for (const f of validFields) {
    let v = generateFieldValue(f)
    if (f.required && (v === '' || v === null || v === undefined ||
        (Array.isArray(v) && v.length === 0) ||
        (typeof v === 'object' && v !== null && !Array.isArray(v) && Object.keys(v).length === 0))) {
      v = generateFieldValue(f)
    }
    obj[f.name] = v
  }
  generated.value = obj
}

// 字段变更时自动重新生成
watch(
  fields,
  () => regenerate(),
  { deep: true }
)

const handleCopy = () => {
  if (!generated.value || Object.keys(generated.value).length === 0) {
    ElMessage.warning('暂无可复制数据')
    return
  }
  copy(generatedText.value)
}

// 当前正在编辑的配方的分享链接
const baseUrl = (import.meta.env.VITE_SITE_URL as string) || (typeof window !== 'undefined' ? window.location.origin : '')
const currentShareUrl = computed(() => {
  if (!editingRecipeId.value) return ''
  const r = recipes.value.find(it => it.id === editingRecipeId.value)
  if (!r) return ''
  // 只要配方有 id，就能生成链接（无论是否登录）
  return `${baseUrl}/api/mock/${r.id}`
})

const recipeShareUrl = (r: Recipe) => (r && r.id ? `${baseUrl}/api/mock/${r.id}` : '')

const handleCopyShareUrl = async (text: string) => {
  if (!text) {
    ElMessage.warning('该配方尚未生成链接，请先保存')
    return
  }
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('链接已复制')
  } catch {
    copy(text)
    ElMessage.success('链接已复制')
  }
}

const handleDownload = () => {
  if (!generated.value || Object.keys(generated.value).length === 0) {
    ElMessage.warning('暂无可下载数据')
    return
  }
  const blob = new Blob([generatedText.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${recipeMeta.name || 'mock-data'}.json`
  a.click()
  URL.revokeObjectURL(url)
}

// ==================== 配方管理 ====================

const handleSaveRecipe = async () => {
  if (fields.value.length === 0) {
    ElMessage.warning('请至少添加一个字段')
    return
  }

  saving.value = true

  const now = new Date().toISOString()
  // 递归压缩字段:去除 id,保留所有业务字段(含 children/itemChildren)
  const cleanField = (f: Field): any => {
    const out: any = {
      name: f.name,
      type: f.type,
      required: !!f.required,
      min: f.min ?? null,
      max: f.max ?? null,
      prefix: f.prefix || '',
      options: Array.isArray(f.options) ? f.options : []
    }
    if (f.type === 'object' && Array.isArray(f.children)) {
      out.children = f.children.map(cleanField)
    }
    if (f.type === 'array') {
      out.itemType = f.itemType || 'string'
      if (f.itemType === 'object' && Array.isArray(f.itemChildren)) {
        out.itemChildren = f.itemChildren.map(cleanField)
      }
    }
    return out
  }

  const payload = {
    name: recipeMeta.name.trim(),
    description: recipeMeta.description.trim(),
    schema: fields.value.map(cleanField)
  }

  // 未登录用户:也保存到云端(匿名配方,uid 为 null)
  try {
    if (editingRecipeId.value) {
      // 更新现有配方:统一调用云端 API
      await functionsRequest.put(`/api/mock-schemas/${editingRecipeId.value}`, payload)
      ElMessage.success('已更新')

      // 更新本地列表中的数据
      const idx = recipes.value.findIndex(r => r.id === editingRecipeId.value)
      if (idx !== -1) {
        recipes.value[idx] = {
          ...recipes.value[idx],
          ...payload,
          updateTime: now
        }
      }
    } else {
      // 创建新配方:登录或未登录都保存到云端
      const res = await functionsRequest.post('/api/mock-schemas', payload)
      if (res.status === 201 && res.data) {
        const newRecipe = res.data
        editingRecipeId.value = newRecipe.id
        recipes.value.unshift(newRecipe)
        ElMessage.success(useRemote.value ? '已保存到云端' : '已保存(登录后可管理)')
      }
    }
    captureBaseline()
  } catch (e) {
    console.error('保存到云端失败:', e)
    // 未登录用户保存失败,降级到 localStorage
    if (!useRemote.value) {
      if (editingRecipeId.value) {
        const idx = recipes.value.findIndex(r => r.id === editingRecipeId.value)
        if (idx !== -1) {
          recipes.value[idx] = {
            ...recipes.value[idx],
            ...payload,
            updateTime: now
          }
        }
        ElMessage.success('已更新')
      } else {
        recipes.value.unshift({
          id: uuid(),
          ...payload,
          createTime: now,
          updateTime: now
        } as Recipe)
        ElMessage.success('已保存到本地')
      }
      saveLocal()
      captureBaseline()
    } else {
      ElMessage.error('保存失败')
    }
  } finally {
    saving.value = false
  }
}

const handleLoadRecipe = async (r: Recipe) => {
  if (isDirty.value) {
    try {
      await ElMessageBox.confirm(
        '当前配方有未保存的修改，是否保存后再载入？',
        '提示',
        {
          confirmButtonText: '保存并载入',
          cancelButtonText: '不保存，直接载入',
          distinguishCancelAndClose: true,
          type: 'warning'
        }
      )
      await handleSaveRecipe()
    } catch (action) {
      if (action === 'close') return
    }
  }
  editingRecipeId.value = r.id
  recipeMeta.name = r.name
  recipeMeta.description = r.description || ''
  fields.value = (r.schema || []).map(f => ({ ...f, id: uuid() }))
  generated.value = {}
  captureBaseline()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const handleDeleteRecipe = async (r: Recipe) => {
  await ElMessageBox.confirm(`确定删除配方「${r.name}」吗？`, '提示', {
    confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning'
  })
  if (useRemote.value && r.uid) {
    try {
      await functionsRequest.delete(`/api/mock-schemas/${r.id}`)
      ElMessage.success('已从云端删除')
      await loadRemote()
    } catch (e) {
      console.error(e)
      ElMessage.error('删除失败')
    }
  } else {
    recipes.value = recipes.value.filter(it => it.id !== r.id)
    saveLocal()
    ElMessage.success('已删除')
  }
  if (editingRecipeId.value === r.id) newRecipe()
}

const handleImportSample = (s: Sample) => {
  editingRecipeId.value = null
  recipeMeta.name = s.name
  recipeMeta.description = s.description
  fields.value = s.schema.map(f => ({ ...f, id: uuid() }))
  generated.value = {}
  ElMessage.success(`已加载示例：${s.name}`)
}

const loadSamples = async () => {
  loadingSamples.value = true
  try {
    const url = (import.meta.env.VITE_SITE_URL || '') + '/api/mock-samples'
    const res = await fetch(url)
    const data = await res.json()
    samples.value = data.samples || []
    ElMessage.success(`已加载 ${samples.value.length} 套示例`)
  } catch (e) {
    console.error('加载示例失败:', e)
    ElMessage.error('加载示例失败')
  } finally {
    loadingSamples.value = false
  }
}

// ==================== 挂载 ====================

onMounted(() => {
  if (recipes.value.length === 0) loadData()
  newRecipe()
})
</script>

<template>
  <div class="flex flex-col mt-3 flex-1">
    <DetailHeader :title="info.title"></DetailHeader>

    <!-- 工具栏 -->
    <div class="p-4 rounded-2xl bg-white mb-4">
      <div class="flex flex-wrap items-center gap-3">
        <el-button type="primary" :icon="FolderOpened" :loading="loadingSamples" @click="loadSamples">
          加载示例
        </el-button>
        <el-button :icon="Plus" @click="newRecipe">新建配方</el-button>
        <div class="flex-1"></div>
        <el-tag v-if="useRemote" type="success" effect="plain">
          <el-icon><Connection /></el-icon> 已登录，可管理所有配方
        </el-tag>
        <el-tag v-else type="info" effect="plain">
          未登录，可创建匿名配方
          <el-link type="primary" :underline="false" class="ml-1" @click="goToLogin">去登录</el-link>
        </el-tag>
        <el-tag v-if="syncing" type="warning" effect="plain">同步中…</el-tag>
      </div>

      <!-- 示例面板 -->
      <div v-if="samples.length > 0" class="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div
          v-for="s in samples"
          :key="s.key"
          class="border border-gray-200 rounded-lg p-3 hover:shadow-md transition cursor-pointer"
          @click="handleImportSample(s)"
        >
          <div class="flex items-center justify-between">
            <div class="font-medium text-gray-800">{{ s.name }}</div>
            <el-tag size="small" type="info">{{ s.schema.length }} 字段</el-tag>
          </div>
          <div class="text-xs text-gray-500 mt-1 line-clamp-2">{{ s.description }}</div>
          <el-button class="mt-2" size="small" type="primary" plain :icon="Promotion" @click.stop="handleImportSample(s)">
            导入此示例
          </el-button>
        </div>
      </div>
    </div>

    <!-- 主体：编辑器 + 预览 -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
      <!-- 左：Schema 编辑器 -->
      <div class="p-4 rounded-2xl bg-white">
        <el-form :inline="false" label-position="top">
          <div class="grid grid-cols-2 gap-3">
            <el-form-item label="配方名称">
              <el-input v-model="recipeMeta.name" placeholder="自动生成，可手动修改" maxlength="50" show-word-limit />
            </el-form-item>
          </div>
          <el-form-item label="描述">
            <el-input v-model="recipeMeta.description" placeholder="可选：配方用途说明" maxlength="200" />
          </el-form-item>
        </el-form>

        <!-- 分享链接（保存后才有） -->
        <div v-if="currentShareUrl" class="mb-3 p-2.5 rounded-lg bg-blue-50 border border-blue-200">
          <div class="flex items-center gap-2 text-xs text-blue-700">
            <el-icon><Link /></el-icon>
            <span class="font-medium">Mock 接口地址</span>
          </div>
          <div class="mt-1.5 flex items-center gap-2">
            <el-input
              :model-value="currentShareUrl"
              readonly
              size="small"
              class="flex-1"
            >
              <template #append>
                <el-button :icon="CopyDocument" size="small" @click="handleCopyShareUrl(currentShareUrl)">复制</el-button>
              </template>
            </el-input>
            <el-button size="small" tag="a" :href="currentShareUrl" target="_blank" :icon="Promotion">打开</el-button>
          </div>
          <div class="mt-1 text-xs text-gray-500">
            每次请求都会按 Schema 重新生成数据，客户端可直接 fetch 该地址使用
          </div>
        </div>

        <div class="flex items-center justify-between mt-2 mb-2">
          <div class="font-medium text-gray-700">字段定义 ({{ fields.length }})</div>
          <el-button size="small" type="primary" :icon="Plus" @click="addField">添加字段</el-button>
        </div>

        <div v-if="fields.length === 0" class="text-center text-gray-400 py-6 text-sm">
          暂无字段，点击下方"添加字段"开始
        </div>

        <div v-else class="space-y-2">
          <FieldEditor
            v-for="(f, idx) in fields"
            :key="f.id"
            :model-value="f"
            :is-root="idx === 0 && f.type !== 'object'"
            @update:model-value="(v: Field) => updateField(idx, v)"
            @remove="removeField(idx)"
          />
        </div>

        <div class="mt-4 flex gap-2">
          <el-button type="primary" :icon="Edit" :loading="saving" @click="handleSaveRecipe">
            {{ editingRecipeId ? '更新配方' : '保存配方' }}
          </el-button>
          <el-button v-if="editingRecipeId" :icon="Refresh" @click="newRecipe">取消编辑</el-button>
        </div>
      </div>

      <!-- 右：结果预览 -->
      <div class="p-4 rounded-2xl bg-white flex flex-col">
        <div class="flex items-center justify-between mb-2">
          <div class="font-medium text-gray-700">
            生成结果
            <span v-if="generated && Object.keys(generated).length > 0" class="text-xs text-gray-400 ml-2">
              单个对象
            </span>
          </div>
          <div class="flex gap-2">
            <el-button size="small" :icon="CopyDocument" @click="handleCopy" :disabled="!generated || Object.keys(generated).length === 0">复制</el-button>
            <el-button size="small" :icon="Download" @click="handleDownload" :disabled="!generated || Object.keys(generated).length === 0">下载</el-button>
          </div>
        </div>
        <pre
          class="flex-1 bg-gray-900 text-green-300 p-3 rounded-lg text-xs overflow-auto max-h-[600px] font-mono whitespace-pre-wrap break-all"
        ><code>{{ generated && Object.keys(generated).length > 0 ? generatedText : '// 左侧定义字段后，结果将自动显示在右侧\n// 或点击上方"加载示例"导入预置 Schema' }}</code></pre>
      </div>
    </div>

    <!-- 配方管理 -->
    <div class="p-4 rounded-2xl bg-white mb-4">
      <div class="flex items-center justify-between mb-3">
        <div class="font-medium text-gray-700">我的配方 ({{ recipes.length }})</div>
      </div>
      <div v-if="recipes.length === 0" class="text-center text-gray-400 py-8 text-sm">
        暂无配方，保存或加载示例后将在此显示
      </div>
      <el-table
        v-else
        :data="recipes"
        stripe
        size="default"
        class="w-full recipe-table"
        :row-class-name="() => 'cursor-pointer'"
        @row-click="(row: Recipe) => handleLoadRecipe(row)"
      >
        <el-table-column prop="name" label="名称" min-width="160" />
        <el-table-column label="字段数" width="80" align="center">
          <template #default="{ row }">
            <el-tag size="small">{{ (row.schema || []).length }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="描述" min-width="180" show-overflow-tooltip />
        <el-table-column label="更新时间" width="180">
          <template #default="{ row }">
            <span class="text-xs text-gray-500">{{ new Date(row.updateTime).toLocaleString() }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.uid" type="success" size="small">云端</el-tag>
            <el-tag v-else type="info" size="small">本地</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="链接" width="120" align="center">
          <template #default="{ row }">
            <el-button
              v-if="recipeShareUrl(row)"
              type="primary"
              link
              size="small"
              :icon="Link"
              @click.stop="handleCopyShareUrl(recipeShareUrl(row))"
            >复制</el-button>
            <el-button
              v-else
              type="info"
              link
              size="small"
              disabled
            >未生成</el-button>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" align="center" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" :icon="Edit" @click.stop="handleLoadRecipe(row)">载入</el-button>
            <el-button type="danger" link size="small" :icon="Delete" @click.stop="handleDeleteRecipe(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- SEO/说明 -->
    <ToolDetail title="使用说明">
      <el-text>
        <p>本工具用于快速生成测试用的假数据（Mock Data），适合接口联调、页面原型、压测等场景。</p>
        <p class="mt-2"><strong>使用方法：</strong></p>
        <ol class="list-decimal list-inside mt-1 space-y-1 text-sm">
          <li>点击"加载示例"可一键导入预置的用户/文章/商品 Schema；</li>
          <li>在左侧编辑字段名、类型、范围（前缀/枚举/最小最大值）；</li>
          <li>右侧实时预览生成的 JSON 数据，无需手动点击，支持复制与下载；</li>
          <li>点击"保存配方"将当前 Schema 持久化（未登录存本地，登录后自动同步至云端）；</li>
          <li>登录后切换设备登录同一账号，可自动拉取云端配方。</li>
        </ol>
        <p class="mt-2 text-gray-500 text-xs">
          支持 16 种字段类型：字符串、整数、小数、布尔、邮箱、中文姓名、手机号、网址、日期、日期时间、颜色、头像、地址、公司名、随机文本、UUID。
        </p>
      </el-text>
    </ToolDetail>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
:deep(.recipe-table .cursor-pointer) {
  cursor: pointer;
}
:deep(.recipe-table .cursor-pointer):hover {
  background-color: #eff6ff !important;
}
</style>

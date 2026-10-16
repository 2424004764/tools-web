<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import Sortable from 'sortablejs'
import IconRank from '~icons/ep/rank'
import IconLink from '~icons/ep/link'
import { fetchAdminSiteConfig, updateAdminSiteConfig, type AdminSiteConfig } from '@/api/admin/site-config'
import { clearSiteConfigCache, fetchProductsConfig } from '@/api/site-config'
import { DEFAULT_PRODUCTS } from '@/components/Layout/Header/products'

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
  products_matrix: '',
  admin_dashboard_layout: '',
})

const mappingOptions = [
  { value: 'title', label: '页面标题（title）' },
  { value: 'pathname', label: '页面路径（pathname）' },
  { value: 'url', label: '完整 URL（url）' },
]

// ============ 「更多产品」可视化编辑 ============
// JSON 只是存储格式（site_config.products_matrix），后台全部通过下面的行卡片编辑。
interface ProductDraft {
  uid: number // 本地稳定标识：v-for key、拖拽重排、行级错误定位都用它，与内容无关
  key: string
  name: string
  desc: string
  url: string
  logo: string
  enabled: boolean
}

let productUidSeed = 0
const nextUid = () => ++productUidSeed

const productsList = ref<ProductDraft[]>([])
/** 行级校验错误：uid → 错误文案（用 uid 定位，行增删/拖拽后不错位） */
const productsErrors = ref<Record<number, string>>({})
/** 已存储的配置解析失败时的提示（此时列表回退内置默认，保存将覆盖） */
const productsParseError = ref('')
/** logo 加载失败的 uid 标记，预览回退占位图 */
const brokenLogos = ref<Record<number, boolean>>({})

const enabledCount = computed(() => productsList.value.filter((p) => p.enabled).length)

function draftFrom(p: any): ProductDraft {
  return {
    uid: nextUid(),
    key: String(p?.key ?? ''),
    name: String(p?.name ?? ''),
    desc: String(p?.desc ?? ''),
    url: String(p?.url ?? ''),
    logo: String(p?.logo ?? ''),
    enabled: p?.enabled !== false,
  }
}

const defaultsDrafts = () => DEFAULT_PRODUCTS.map((p) => draftFrom(p))

/** 后台存储值 → 编辑列表；未配置（空串）时用内置默认产品打底 */
function parseProductsToList(raw: string): { list: ProductDraft[]; error: string } {
  const s = (raw || '').trim()
  if (!s) return { list: defaultsDrafts(), error: '' }
  try {
    const arr = JSON.parse(s)
    if (!Array.isArray(arr)) {
      return { list: defaultsDrafts(), error: '已存储的配置不是 JSON 数组，当前显示内置默认；保存后将覆盖旧配置' }
    }
    return { list: arr.map((p: any) => draftFrom(p)), error: '' }
  } catch {
    return { list: defaultsDrafts(), error: '已存储的配置解析失败，当前显示内置默认；保存后将覆盖旧配置' }
  }
}

const removeProduct = async (uid: number) => {
  const idx = productsList.value.findIndex((p) => p.uid === uid)
  if (idx === -1) return
  const [removed] = productsList.value.splice(idx, 1)
  delete productsErrors.value[uid]
  delete brokenLogos.value[uid]
  if (await saveProductsOnly()) {
    ElMessage.success('产品已删除并生效')
  } else {
    // 保存失败回滚，恢复被删的行
    productsList.value.splice(idx, 0, removed)
  }
}

/** 行内上线/下线：切换即保存，失败回退开关 */
const onProductToggle = async (p: ProductDraft) => {
  if (await saveProductsOnly()) {
    ElMessage.success(p.enabled ? '已上线并生效' : '已下线并生效')
  } else {
    p.enabled = !p.enabled
  }
}

// ============ 产品即时保存 ============
// 后端 PUT /api/admin/site-config 按白名单键逐个 upsert，这里只传 products_matrix，
// 不会动同页的评论系统等未保存草稿。所有产品操作（新增/编辑/删除/开关/拖拽）即时生效，无需点底部「保存设置」。
const savingProducts = ref(false)

/** 校验整个产品列表后仅保存 products_matrix；成功返回 true */
const saveProductsOnly = async (): Promise<boolean> => {
  const compact = validateProductsList()
  if (compact === null) {
    ElMessage.error('产品列表还有不合法的项，请按红色提示点「编辑」修正')
    return false
  }
  savingProducts.value = true
  try {
    const data = await updateAdminSiteConfig({ products_matrix: compact })
    // 只同步存储串与备注，不重建列表（保持 uid 稳定，拖拽/开关状态不闪）
    form.products_matrix = data.values.products_matrix
    remarks.value = data.remarks || remarks.value
    productsParseError.value = ''
    productsErrors.value = {}
    // 失效前台缓存，让「更多产品」矩阵立即生效
    clearSiteConfigCache()
    return true
  } catch (err: any) {
    ElMessage.error(err?.response?.data?.error || err?.message || '产品保存失败')
    return false
  } finally {
    savingProducts.value = false
  }
}

// ============ 新增 / 编辑弹窗 ============
const productDialog = reactive({ visible: false, mode: 'add' as 'add' | 'edit', editUid: 0 })
const draft = reactive({ key: '', name: '', desc: '', url: '', logo: '', enabled: true })
const draftError = ref('')
const draftLogoBroken = ref(false)

const openProductDialog = (mode: 'add' | 'edit', p?: ProductDraft) => {
  productDialog.mode = mode
  productDialog.editUid = p?.uid ?? 0
  Object.assign(draft, {
    key: p?.key ?? '',
    name: p?.name ?? '',
    desc: p?.desc ?? '',
    url: p?.url ?? '',
    logo: p?.logo ?? '',
    enabled: p?.enabled ?? true,
  })
  draftError.value = ''
  draftLogoBroken.value = false
  productDialog.visible = true
}

/** 弹窗确定：单条校验通过后写回列表并即时保存；保存失败回滚并留在弹窗可重试 */
const confirmProductDialog = async () => {
  const msg = validateDraftItem(draft, productsList.value, productDialog.mode === 'edit' ? productDialog.editUid : undefined)
  if (msg) {
    draftError.value = msg
    return
  }
  const normalized = {
    key: draft.key.trim().toLowerCase(),
    name: draft.name.trim(),
    desc: draft.desc.trim(),
    url: draft.url.trim(),
    logo: draft.logo.trim(),
    enabled: draft.enabled,
  }
  let rollback: () => void
  if (productDialog.mode === 'add') {
    const item = { uid: nextUid(), ...normalized }
    productsList.value.push(item)
    rollback = () => {
      const i = productsList.value.findIndex((x) => x.uid === item.uid)
      if (i !== -1) productsList.value.splice(i, 1)
    }
  } else {
    const target = productsList.value.find((x) => x.uid === productDialog.editUid)
    if (!target) {
      productDialog.visible = false
      return
    }
    const snapshot = { ...target }
    Object.assign(target, normalized)
    rollback = () => Object.assign(target, snapshot)
    brokenLogos.value[productDialog.editUid] = false
  }
  if (await saveProductsOnly()) {
    productsErrors.value = {}
    productDialog.visible = false
    ElMessage.success(productDialog.mode === 'add' ? '产品已添加并生效' : '产品已更新并生效')
  } else {
    rollback()
    draftError.value = '保存失败，请重试或点「取消」放弃本次修改'
  }
}

/**
 * 单条产品校验（与后端 admin/site-config 同规则），弹窗确定与整表保存共用。
 * 返回错误文案；合法返回空串。key 重复检查在 all 中排除 selfUid（编辑自身时）。
 */
function validateDraftItem(
  p: { key: string; name: string; desc: string; url: string; logo: string },
  all: ProductDraft[],
  selfUid?: number,
): string {
  const key = p.key.trim().toLowerCase()
  if (!/^[a-z0-9-]{1,40}$/.test(key)) {
    return 'key 只能是小写字母/数字/连字符（1-40 位），如 tiji'
  }
  const dup = all.find((x) => x.uid !== selfUid && x.key.trim().toLowerCase() === key)
  if (dup) return `key「${key}」已被「${dup.name || '未命名产品'}」使用`
  if (!p.name.trim() || p.name.trim().length > 30) return '名称必填且不超过 30 字'
  if (p.desc.trim().length > 60) return '简介不超过 60 字'
  if (!/^https?:\/\/\S+$/i.test(p.url.trim())) return '链接必须是 http(s):// 开头的完整地址'
  if (!/^(https?:\/\/\S+|\/\S+)$/i.test(p.logo.trim())) return 'Logo 必填：站内绝对路径或 http(s) 图片地址'
  return ''
}

/**
 * 校验全部行（弹窗只能放入合法数据，这里主要兜底历史脏数据）。
 * 全部合法返回紧凑 JSON 串（即存储格式）；否则按 uid 填充行错误并返回 null。
 */
function validateProductsList(): string | null {
  const errors: Record<number, string> = {}
  const out: Record<string, unknown>[] = []

  productsList.value.forEach((p) => {
    const msg = validateDraftItem(p, productsList.value, p.uid)
    if (msg) errors[p.uid] = msg
    out.push({
      key: p.key.trim().toLowerCase(),
      name: p.name.trim(),
      desc: p.desc.trim(),
      url: p.url.trim(),
      logo: p.logo.trim(),
      enabled: p.enabled,
    })
  })

  productsErrors.value = errors
  return Object.keys(errors).length ? null : JSON.stringify(out)
}

// 拖拽排序：对列表容器挂 Sortable（与 AdminTools 的 model 表格同一套做法）
const productsListEl = ref<HTMLElement | null>(null)
let productsSortable: Sortable | null = null

const load = async () => {
  loading.value = true
  try {
    const data = await fetchAdminSiteConfig()
    Object.assign(form, data.values)
    remarks.value = data.remarks || {}
    const parsed = parseProductsToList(data.values.products_matrix)
    productsList.value = parsed.list
    productsParseError.value = parsed.error
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

const handleSave = async () => {
  // 先本地校验产品列表（规则与后端一致），避免无效请求
  const compactProducts = validateProductsList()
  if (compactProducts === null) {
    ElMessage.error('「更多产品」还有未填好的项，请按红色提示修正后再保存')
    return
  }
  saving.value = true
  try {
    // 仪表盘卡片布局由仪表盘页面维护，设置页保存时不回写，避免覆盖别处的最新调整
    const { admin_dashboard_layout: _dashboardLayout, ...settingsForm } = form
    const data = await updateAdminSiteConfig({ ...settingsForm, products_matrix: compactProducts })
    Object.assign(form, data.values)
    remarks.value = data.remarks || {}
    // 用后端归一化后的返回值重建编辑列表（key 统一小写等）
    const parsed = parseProductsToList(data.values.products_matrix)
    productsList.value = parsed.list
    productsParseError.value = parsed.error
    productsErrors.value = {}
    // 立即失效前台缓存，让新配置生效（含「更多产品」矩阵缓存）
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
  // 预热：主站头部与后台共用同一份产品配置缓存
  void fetchProductsConfig()
  if (productsListEl.value) {
    productsSortable = Sortable.create(productsListEl.value, {
      handle: '.product-drag-handle',
      animation: 150,
      ghostClass: 'products-ghost',
      onEnd: ({ oldIndex, newIndex }) => {
        if (oldIndex == null || newIndex == null || oldIndex === newIndex) return
        const snapshot = [...productsList.value]
        const moved = productsList.value.splice(oldIndex, 1)[0]
        productsList.value.splice(newIndex, 0, moved)
        // 拖完即保存，失败恢复原顺序
        void saveProductsOnly().then((ok) => {
          if (ok) ElMessage.success('排序已保存并生效')
          else productsList.value = snapshot
        })
      },
    })
  }
})

onBeforeUnmount(() => {
  productsSortable?.destroy()
  productsSortable = null
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
        <el-radio-button value="disabled">关闭评论</el-radio-button>
      </el-radio-group>

      <div class="mt-3 text-body-sm text-ink-500">
        <template v-if="form.comment_system === 'giscus'">
          评论数据存储在 GitHub Discussions，评论者需登录 GitHub 账号。
        </template>
        <template v-else-if="form.comment_system === 'custom'">
          游客填写昵称 + 邮箱即可评论，注册用户登录后直接评论；<b class="text-ink-700">所有评论需在「评论管理」中审核通过后才会展示</b>。
        </template>
        <template v-else-if="form.comment_system === 'disabled'">
          关闭后全站工具页底部不再展示评论区（已有评论数据保留，重新开启后恢复展示）。
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

    <!-- 更多产品：可视化行编辑，JSON 仅作存储格式 -->
    <div class="rounded-xl border border-border-subtle bg-white dark:bg-surface-1 p-5 mb-4">
      <div class="flex items-start justify-between gap-4 flex-wrap mb-2">
        <div class="min-w-0">
          <h3 class="text-body-lg font-semibold text-ink-900 mb-1">更多产品</h3>
          <p class="text-body-sm text-ink-500">
            头部「更多产品」下拉的产品矩阵，拖动
            <span class="inline-flex align-middle text-ink-400"><IconRank class="w-3.5 h-3.5" /></span>
            调整展示顺序；把产品切到「下线」即可隐藏单个产品，<b class="text-ink-700">全部下线后前台不再展示「更多产品」入口</b>。
            所有改动<b class="text-ink-700">自动保存并立即生效</b>，无需点底部「保存设置」。
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <el-button size="small" type="primary" @click="openProductDialog('add')">添加产品</el-button>
        </div>
      </div>

      <p v-if="productsParseError" class="text-body-sm text-amber-600 mt-0 mb-2">{{ productsParseError }}</p>

      <!-- 一行两列卡片网格：展示名称 / key / 简介 / 跳转链接 / 状态，编辑走弹窗 -->
      <div
        ref="productsListEl"
        class="grid grid-cols-1 lg:grid-cols-2 gap-3"
      >
        <div
          v-for="p in productsList"
          :key="p.uid"
          class="rounded-xl border border-border-subtle flex items-center gap-3 flex-wrap px-3 py-2.5"
          :class="productsErrors[p.uid] ? 'bg-rose-50/70 dark:bg-rose-500/10' : ''"
        >
          <span
            class="product-drag-handle w-7 h-7 rounded-lg bg-surface-2 dark:bg-surface-3 text-ink-400 hover:text-accent-600 flex items-center justify-center cursor-move shrink-0"
            title="拖拽排序"
          >
            <IconRank class="w-4 h-4" aria-hidden="true" />
          </span>
          <img
            v-if="p.logo && !brokenLogos[p.uid]"
            :src="p.logo"
            :alt="p.name + '图标'"
            class="w-8 h-8 rounded-lg object-cover shrink-0 bg-surface-1"
            @error="brokenLogos[p.uid] = true"
          />
          <div
            v-else
            class="w-8 h-8 rounded-lg bg-surface-2 dark:bg-surface-3 flex items-center justify-center text-base shrink-0"
            aria-hidden="true"
          >🧩</div>

          <div class="min-w-0 flex-1 flex flex-col gap-0.5">
            <div class="flex items-baseline gap-2 min-w-0">
              <div class="text-body-sm font-medium text-ink-900 truncate">{{ p.name || '未命名产品' }}</div>
              <div class="text-caption text-ink-400 truncate shrink-0">{{ p.key || 'key 未设置' }}</div>
            </div>
            <div class="text-caption text-ink-500 truncate">{{ p.desc || '—' }}</div>
            <a
              v-if="p.url"
              :href="p.url"
              target="_blank"
              rel="noopener"
              class="text-caption text-accent-600 hover:text-accent-700 hover:underline truncate inline-flex items-center gap-1 min-w-0"
              :title="p.url"
            >
              <IconLink class="w-3 h-3 shrink-0" aria-hidden="true" />
              <span class="truncate">{{ p.url }}</span>
            </a>
            <div v-else class="text-caption text-ink-400">链接未设置</div>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <el-switch
              v-model="p.enabled"
              inline-prompt
              active-text="上线"
              inactive-text="下线"
              :disabled="savingProducts"
              @change="onProductToggle(p)"
            />
            <el-button size="small" @click="openProductDialog('edit', p)">编辑</el-button>
            <el-popconfirm title="确定删除该产品？删除后需保存才生效" width="230" @confirm="removeProduct(p.uid)">
              <template #reference>
                <el-button type="danger" text size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </div>

          <p v-if="productsErrors[p.uid]" class="w-full text-caption text-rose-600 !mt-1 mb-0">
            {{ productsErrors[p.uid] }}（点「编辑」修正）
          </p>
        </div>
      </div>

      <div
        v-if="!productsList.length"
        class="rounded-xl border border-dashed border-border-subtle py-10 text-center text-body-sm text-ink-400"
      >
        暂无产品。保存空列表将隐藏前台「更多产品」入口；点右上角「添加产品」新增。
      </div>

      <div class="mt-3 text-caption text-ink-400">
        已启用 {{ enabledCount }} / {{ productsList.length }} 个产品；key 仅限小写字母/数字/连字符，修改 key 后旧的 /app-jump/:key 跳转链接会失效。
      </div>
    </div>

    <!-- 新增 / 编辑产品弹窗 -->
    <el-dialog
      v-model="productDialog.visible"
      :title="productDialog.mode === 'add' ? '添加产品' : '编辑产品'"
      width="560px"
      :close-on-click-modal="false"
    >
      <div class="flex flex-col gap-4">
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">名称</div>
            <el-input v-model="draft.name" placeholder="如：题迹" maxlength="30" clearable />
          </div>
          <div>
            <div class="text-body-sm font-medium text-ink-700 mb-1.5">key（跳转标识）</div>
            <el-input
              v-model="draft.key"
              placeholder="如：tiji"
              maxlength="40"
              clearable
              @input="draft.key = draft.key.toLowerCase()"
            />
          </div>
        </div>

        <div>
          <div class="text-body-sm font-medium text-ink-700 mb-1.5">一句话简介</div>
          <el-input v-model="draft.desc" placeholder="展示在名称下方，如：自建题库 · 在线刷题" maxlength="60" clearable />
        </div>

        <div>
          <div class="text-body-sm font-medium text-ink-700 mb-1.5">Logo 图片</div>
          <div class="flex items-center gap-3">
            <img
              v-if="draft.logo && !draftLogoBroken"
              :src="draft.logo"
              alt="Logo 预览"
              class="w-10 h-10 rounded-xl object-cover shrink-0 bg-surface-1"
              @error="draftLogoBroken = true"
            />
            <div
              v-else
              class="w-10 h-10 rounded-xl bg-surface-2 dark:bg-surface-3 flex items-center justify-center text-lg shrink-0"
              aria-hidden="true"
            >🧩</div>
            <el-input
              v-model="draft.logo"
              class="flex-1"
              placeholder="/images/logo/product-tiji.svg 或 https://…"
              clearable
              @input="draftLogoBroken = false"
            />
          </div>
        </div>

        <div>
          <div class="text-body-sm font-medium text-ink-700 mb-1.5">产品链接</div>
          <el-input v-model="draft.url" placeholder="https://tiji.fologde.com" clearable />
        </div>

        <div class="flex items-center gap-2">
          <el-switch v-model="draft.enabled" inline-prompt active-text="上线" inactive-text="下线" />
          <span class="text-body-sm text-ink-500">
            {{ draft.enabled ? '上线：展示在头部「更多产品」' : '下线：前台隐藏该产品' }}
          </span>
        </div>

        <p v-if="draftError" class="text-body-sm text-rose-600 mb-0">{{ draftError }}</p>
      </div>

      <template #footer>
        <el-button @click="productDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="savingProducts" @click="confirmProductDialog">确定并生效</el-button>
      </template>
    </el-dialog>

    <div class="flex justify-end">
      <el-button type="primary" :loading="saving" @click="handleSave">保存设置</el-button>
    </div>
  </div>
</template>

<style scoped>
/* Sortable 拖拽中的半透明占位（类由 Sortable 运行时添加到行元素上） */
.products-ghost {
  opacity: 0.4;
}
</style>

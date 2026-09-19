<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import { ElMessage, ElMessageBox } from 'element-plus'
import { functionsRequest } from '@/utils/functionsRequest'
import { useUserStore } from '@/store/modules/user'
import { releaseStorageReservation } from '@/api/storageQuota'
import { loadShoppingData, saveShoppingData, type ShoppingData, type ShoppingHistoryEntry, type ShoppingItem, type ShoppingList, type ShoppingTemplate } from '@/utils/shopping-list-storage'
import DetailHeader from '@/components/Layout/DetailHeader/DetailHeader.vue'
import ToolDetail from '@/components/Layout/ToolDetail/ToolDetail.vue'
import Plus from '~icons/ep/plus'
import Delete from '~icons/ep/delete'
import Edit from '~icons/ep/edit'
import Download from '~icons/ep/download'
import Archive from '~icons/ep/folder-checked'
import More from '~icons/ep/more-filled'
import Check from '~icons/ep/check'
import CopyDocument from '~icons/ep/copy-document'
import Clock from '~icons/ep/clock'
import Refresh from '~icons/ep/refresh'
import FullScreen from '~icons/ep/full-screen'
import Star from '~icons/ep/star'
import Picture from '~icons/ep/picture'
const userStore = useUserStore()
const router = useRouter()
const categories = ['蔬菜', '水果', '肉禽', '水产海鲜', '蛋奶乳品', '米面粮油', '调味料', '饮料', '零食', '速冻冷藏', '熟食烘焙', '日用清洁', '纸品', '个护美妆', '家居用品', '宠物用品', '母婴用品', '药品保健', '文具办公', '五金家电', '服饰鞋包', '其他']
const categoryColors = ['#2f8f68', '#d97706', '#c2410c', '#1479a6', '#a16207', '#7c5c24', '#b45309', '#2563a8', '#be4778', '#6366a8', '#b4537a', '#4b7260', '#64748b', '#9b4d8c', '#526f8c', '#6b7280', '#8b5e3c', '#8b5cf6', '#0f766e', '#475569', '#a85569', '#6b7280']
function categoryStyle(category: string) { const index = categories.indexOf(category); const color = categoryColors[index >= 0 ? index : categoryColors.length - 1]; return { color, borderColor: color, backgroundColor: `${color}14` } }
const methods = ['线下采购', '超市', '电商配送', '社区团购', '外卖代购']
const defaultItem = (): ShoppingItem => ({ id: '', name: '', quantity: 1, unit: '件', weight: '', category: '其他', note: '', estimatedPrice: 0, actualPrice: 0, purchased: false, required: true, priority: 2, imageUrl: null })
const makeList = (name: string): ShoppingList => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name, description: '', budget: 0, method: '线下采购', archived: false, updatedAt: new Date().toISOString(), items: [] })
const seed = makeList('本周采购')
const lists = ref<ShoppingList[]>([seed])
const templates = ref<ShoppingTemplate[]>([])
const history = ref<ShoppingHistoryEntry[]>([])
const activeListId = ref(seed.id)
const showArchived = ref(false)
const filter = ref<'all' | 'pending' | 'purchased'>('all')
const sortBy = ref<'manual' | 'priority' | 'category' | 'price'>('manual')
const search = ref('')
const categoryFilter = ref('全部分类')
const itemDialogVisible = ref(false)
const listDialogVisible = ref(false)
const templateDialogVisible = ref(false)
const historyDialogVisible = ref(false)
const editingItem = ref<ShoppingItem>(defaultItem())
const editingList = ref<ShoppingList | null>(null)
const editingListName = ref('')
const editingTemplateName = ref('')
const isEditingItem = ref(false)
const loading = ref(false)
const syncing = ref(false)
const syncError = ref(false)
const offline = ref(typeof navigator !== 'undefined' && !navigator.onLine)
const focusMode = ref(false)
const uploadingImage = ref(false)
const imageDragActive = ref(false)
const exportTarget = ref<HTMLElement | null>(null)
let syncTimer: ReturnType<typeof setTimeout> | undefined

const userId = computed(() => userStore.getUserInfo?.uid || 'anonymous')
const activeList = computed(() => lists.value.find((list) => list.id === activeListId.value) || lists.value[0])
const visibleLists = computed(() => lists.value.filter((list) => showArchived.value || !list.archived))
const pendingItems = computed(() => (activeList.value?.items || []).filter((item) => !item.purchased))
const purchasedItems = computed(() => (activeList.value?.items || []).filter((item) => item.purchased))
const estimatedTotal = computed(() => (activeList.value?.items || []).reduce((sum, item) => sum + Number(item.estimatedPrice || 0) * Number(item.quantity || 0), 0))
const actualTotal = computed(() => (activeList.value?.items || []).reduce((sum, item) => sum + Number(item.actualPrice || 0) * Number(item.quantity || 0), 0))
const progress = computed(() => activeList.value?.items.length ? Math.round(purchasedItems.value.length / activeList.value.items.length * 100) : 0)
const categoryStats = computed(() => categories.map((category) => ({ category, count: (activeList.value?.items || []).filter((item) => item.category === category && !item.purchased).length })).filter((entry) => entry.count))
const recentItems = computed(() => Array.from(new Map(history.value.slice().sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt)).map((entry) => [entry.item.name, entry.item])).values()).slice(0, 6))
const frequentItems = computed(() => { const counts = new Map<string, ShoppingItem>(); history.value.forEach((entry) => { const item = counts.get(entry.item.name); if (item) item.quantity += 1; else counts.set(entry.item.name, { ...entry.item, quantity: 1 }) }); return Array.from(counts.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 6) })
const filteredItems = computed(() => {
  const query = search.value.trim().toLowerCase()
  return (activeList.value?.items || []).filter((item) => {
    const statusOk = filter.value === 'all' || (filter.value === 'pending' && !item.purchased) || (filter.value === 'purchased' && item.purchased)
    const categoryOk = categoryFilter.value === '全部分类' || item.category === categoryFilter.value
    return statusOk && categoryOk && (!query || `${item.name} ${item.note} ${item.category}`.toLowerCase().includes(query))
  }).slice().sort((a, b) => sortBy.value === 'priority' ? b.priority - a.priority : sortBy.value === 'category' ? a.category.localeCompare(b.category, 'zh') : sortBy.value === 'price' ? b.estimatedPrice - a.estimatedPrice : 0)
})
const syncLabel = computed(() => offline.value ? '离线，已保存本地' : syncing.value ? '正在同步' : syncError.value ? '同步失败' : userStore.getLoginStatus ? '已同步账户' : '仅本地保存')

function snapshot(): ShoppingData { return { version: 2, lists: lists.value, templates: templates.value, history: history.value } }
async function persistLocal() { try { await saveShoppingData(userId.value, snapshot()) } catch { ElMessage.warning('本地保存失败，请检查浏览器存储权限') } }
function touch() { if (activeList.value) activeList.value.updatedAt = new Date().toISOString(); void persistLocal(); scheduleSync() }
function scheduleSync() { if (!userStore.getLoginStatus || offline.value) return; if (syncTimer) clearTimeout(syncTimer); syncTimer = setTimeout(() => { void syncRemote() }, 500) }
async function syncRemote() { if (!userStore.getLoginStatus || offline.value) return; syncing.value = true; syncError.value = false; try { await functionsRequest.put('/api/shopping-lists', { lists: lists.value }); syncError.value = false } catch { syncError.value = true } finally { syncing.value = false } }
async function loadData() { loading.value = true; try { const local = await loadShoppingData(userId.value); if (local?.lists?.length) { lists.value = local.lists; templates.value = local.templates || []; history.value = local.history || []; activeListId.value = lists.value.find((list) => !list.archived)?.id || lists.value[0].id } if (userStore.getLoginStatus && !offline.value) { try { const response = await functionsRequest.get<{ lists?: ShoppingList[] }>('/api/shopping-lists'); if (response.data?.lists?.length) { lists.value = response.data.lists; activeListId.value = lists.value[0].id; await persistLocal() } } catch { syncError.value = true } } } finally { loading.value = false } }
function openNewItem(item?: ShoppingItem) { editingItem.value = item ? { ...item, purchased: false } : defaultItem(); isEditingItem.value = Boolean(item); itemDialogVisible.value = true }
function saveItem() { const item = { ...editingItem.value, name: editingItem.value.name.trim() }; if (!item.name) return ElMessage.warning('请填写商品名称'); if (isEditingItem.value) { const index = activeList.value.items.findIndex((entry) => entry.id === item.id); if (index >= 0) activeList.value.items[index] = item } else activeList.value.items.unshift({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }); itemDialogVisible.value = false; touch() }
async function resizeImage(file: File): Promise<Blob> {
  const source = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / Math.max(source.width, source.height))
  const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(source.width * scale)); canvas.height = Math.max(1, Math.round(source.height * scale))
  canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height); source.close()
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片压缩失败')), 'image/webp', 0.82))
}
async function uploadItemImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]; (event.target as HTMLInputElement).value = ''; if (file) await uploadImageFile(file)
}
async function uploadImageFile(file: File) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return ElMessage.warning('请选择 JPG、PNG 或 WebP 图片')
  if (file.size > 5 * 1024 * 1024) return ElMessage.warning('图片不能超过 5MB')
  uploadingImage.value = true
  const previousImageUrl = editingItem.value.imageUrl
  let reservationId = ''
  try {
    const blob = await resizeImage(file)
    const contentType = blob.type || 'image/webp'
    const itemId = editingItem.value.id || crypto.randomUUID()
    const response = await functionsRequest.post<{ uploadUrl: string; publicUrl: string; r2Key: string; reservationId: string }>('/api/shopping-lists/images/sign', { listId: activeList.value.id, itemId, contentType, size: blob.size })
    reservationId = response.data.reservationId
    const upload = await fetch(response.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob })
    if (!upload.ok) throw new Error('图片上传失败')
    // 按 R2 真实大小结算存储额度并释放预留（失败不阻塞，预留超时自动失效）
    void functionsRequest.post('/api/shopping-lists/images/confirm', { r2Key: response.data.r2Key, reservationId: response.data.reservationId }).catch(() => {})
    editingItem.value.imageUrl = response.data.publicUrl
    if (previousImageUrl && previousImageUrl !== response.data.publicUrl) void deleteRemoteImage(previousImageUrl)
    ElMessage.success('商品图片上传成功')
  } catch (error: any) {
    // 上传没成功：释放签名时预扣的存储额度（幂等，失败静默，1 小时后也会自动失效）
    if (reservationId) void releaseStorageReservation(reservationId)
    const message = error?.response?.data?.error || error?.message
    if (typeof message === 'string' && message.includes('存储空间不足')) {
      ElMessageBox.confirm(`${message}`, '存储空间不足', { type: 'warning', confirmButtonText: '去购买', cancelButtonText: '取消' })
        .then(() => { router.push('/me/credits') })
        .catch(() => {})
    } else {
      ElMessage.error(typeof message === 'string' && message.includes('积分') ? message : '图片上传失败，请稍后重试')
    }
  } finally { uploadingImage.value = false }
}
function deleteRemoteImage(url: string) { if (userStore.getLoginStatus && url) void functionsRequest.post('/api/shopping-lists/images/delete', { url }).catch(() => {}) }
function handleImageDrop(event: DragEvent) { imageDragActive.value = false; const file = Array.from(event.dataTransfer?.files || []).find((entry) => entry.type.startsWith('image/')); if (file) void uploadImageFile(file) }
function handleImagePaste(event: ClipboardEvent) { const file = Array.from(event.clipboardData?.files || []).find((entry) => entry.type.startsWith('image/')); if (file) { event.preventDefault(); void uploadImageFile(file) } }
function onPaste(event: ClipboardEvent) { if (itemDialogVisible.value) handleImagePaste(event) }
function removeItemImage() { deleteRemoteImage(editingItem.value.imageUrl || ''); editingItem.value.imageUrl = null }
async function removeItem(item: ShoppingItem) { try { await ElMessageBox.confirm(`确定删除“${item.name}”吗？`, '删除条目', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }); deleteRemoteImage(item.imageUrl || ''); activeList.value.items = activeList.value.items.filter((entry) => entry.id !== item.id); touch() } catch { /* cancelled */ } }
function togglePurchased(item: ShoppingItem) { item.purchased = !item.purchased; if (item.purchased) { const purchasedAt = new Date().toISOString(); item.purchasedAt = purchasedAt; history.value.unshift({ id: `${Date.now()}-${item.id}`, listName: activeList.value.name, item: { ...item }, purchasedAt }) } else item.purchasedAt = undefined; touch() }
function clearPurchased() { if (!purchasedItems.value.length) return ElMessage.info('暂无已购条目'); purchasedItems.value.forEach((item) => deleteRemoteImage(item.imageUrl || '')); activeList.value.items = activeList.value.items.filter((item) => !item.purchased); touch() }
function openNewList() { editingListName.value = ''; editingList.value = null; listDialogVisible.value = true }
function editListDetails() { editingList.value = { ...activeList.value }; listDialogVisible.value = true }
function saveList() { const name = (editingList.value ? editingList.value.name : editingListName.value).trim(); if (editingList.value) { if (!name) return ElMessage.warning('请填写清单名称'); Object.assign(activeList.value, editingList.value, { name }); listDialogVisible.value = false; touch(); return } if (!name) return ElMessage.warning('请填写清单名称'); const list = makeList(name); lists.value.unshift(list); activeListId.value = list.id; listDialogVisible.value = false; touch() }
function copyList() { const copy: ShoppingList = { ...activeList.value, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: `${activeList.value.name}（副本）`, updatedAt: new Date().toISOString(), items: activeList.value.items.map((item) => ({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, purchased: false, purchasedAt: undefined })) }; lists.value.unshift(copy); activeListId.value = copy.id; touch(); ElMessage.success('已复制清单') }
async function deleteList(list: ShoppingList) {
  try {
    await ElMessageBox.confirm(`确定删除“${list.name}”及其全部条目吗？`, '删除清单', { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' })
    if (userStore.getLoginStatus && !offline.value) await functionsRequest.delete(`/api/shopping-lists/${encodeURIComponent(list.id)}`)
    list.items.forEach((item) => deleteRemoteImage(item.imageUrl || ''))
    lists.value = lists.value.filter((entry) => entry.id !== list.id)
    if (!lists.value.length) {
      const replacement = makeList('本周采购')
      lists.value = [replacement]
      activeListId.value = replacement.id
    } else if (activeListId.value === list.id) activeListId.value = lists.value[0].id
    await persistLocal()
    scheduleSync()
    ElMessage.success('清单已删除')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') { syncError.value = true; ElMessage.error('清单删除失败，请稍后重试') }
  }
}
function toggleArchive(list: ShoppingList) { list.archived = !list.archived; if (list.archived && activeListId.value === list.id) activeListId.value = visibleLists.value[0]?.id || lists.value[0].id; touch() }
function saveTemplate() { if (!activeList.value.items.length) return ElMessage.warning('请先添加条目'); const name = editingTemplateName.value.trim() || activeList.value.name; templates.value.unshift({ id: `${Date.now()}`, name, description: activeList.value.description, budget: activeList.value.budget, method: activeList.value.method, items: activeList.value.items.map((item) => ({ ...item })), updatedAt: new Date().toISOString() }); templateDialogVisible.value = false; touch(); ElMessage.success('模板已保存') }
function applyTemplate(template: ShoppingTemplate) { activeList.value.items = template.items.map((item) => ({ ...item, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, purchased: false, purchasedAt: undefined })); activeList.value.description = template.description; activeList.value.budget = template.budget; activeList.value.method = template.method; touch(); ElMessage.success(`已套用“${template.name}”`) }
async function deleteTemplate(template: ShoppingTemplate) { try { await ElMessageBox.confirm(`删除模板“${template.name}”？`, '删除模板', { type: 'warning' }); templates.value = templates.value.filter((entry) => entry.id !== template.id); touch() } catch { /* cancelled */ } }
function addQuickItem(item: ShoppingItem) { openNewItem(item) }
async function retrySync() { await syncRemote() }
async function toggleFocus() { focusMode.value = !focusMode.value; if (focusMode.value && document.documentElement.requestFullscreen) { try { await document.documentElement.requestFullscreen() } catch { /* permission denied */ } } else if (!focusMode.value && document.fullscreenElement) await document.exitFullscreen() }
async function exportImage() { if (!exportTarget.value) return; await nextTick(); try { const canvas = await html2canvas(exportTarget.value, { backgroundColor: '#fff', scale: 2, useCORS: true }); const link = document.createElement('a'); link.download = `${activeList.value.name}-购物清单.png`; link.href = canvas.toDataURL('image/png'); link.click(); ElMessage.success('清单图片已导出') } catch { ElMessage.error('图片导出失败，请稍后重试') } }
function money(value: number) { return Number(value || 0).toFixed(2) }
function onOnline() { offline.value = false; void persistLocal(); void syncRemote() }
function onOffline() { offline.value = true }
onMounted(() => { void loadData(); window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('paste', onPaste) })
onBeforeUnmount(() => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('paste', onPaste); if (syncTimer) clearTimeout(syncTimer) })
watch(() => userStore.getLoginStatus, (loggedIn) => { if (loggedIn) void loadData() })
</script>

<template>
  <div class="shopping-page mx-auto max-w-[1400px] px-3 pb-8 sm:px-5" :class="focusMode ? 'focus-shopping-page' : ''">
    <DetailHeader title="购物清单" />
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2"><div><h2 class="text-h2 font-semibold text-ink-900">把要买的东西，记得清清楚楚</h2><p class="mt-1 text-body-sm text-ink-500">模板、预算、采购进度与离线同步，集中管理每次采购</p></div><div class="flex items-center gap-3 text-caption text-ink-500"><span class="inline-flex items-center gap-1.5"><span class="h-2 w-2 rounded-full" :class="offline || syncError ? 'bg-warning-500' : syncing ? 'bg-accent-500' : 'bg-success-500'"></span>{{ syncLabel }}</span><el-button v-if="syncError && !offline" text size="small" title="重试同步" aria-label="重试同步" @click="retrySync"><el-icon><Refresh /></el-icon></el-button></div></div>
    <div class="grid gap-4 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside class="rounded-2xl border border-border-subtle bg-white p-3 shadow-sm"><div class="mb-2 flex items-center justify-between px-2"><span class="text-body-sm font-semibold text-ink-900">我的清单</span><el-button text circle size="small" title="新建清单" aria-label="新建清单" @click="openNewList"><el-icon><Plus /></el-icon></el-button></div><div class="space-y-1"><button v-for="list in visibleLists" :key="list.id" class="group flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left" :class="activeListId === list.id ? 'bg-accent-50 text-accent-700' : 'text-ink-700 hover:bg-surface-1'" @click="activeListId = list.id"><span class="min-w-0 truncate text-body-sm">{{ list.name }}</span><span class="ml-2 text-caption text-ink-400">{{ list.items.length }}</span></button></div><el-divider class="!my-3" /><button class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-body-sm text-ink-600 hover:bg-surface-1" @click="showArchived = !showArchived"><el-icon><Archive /></el-icon>{{ showArchived ? '隐藏归档清单' : '查看归档清单' }}</button><el-divider class="!my-3" /><div class="px-2"><div class="mb-2 flex items-center justify-between"><span class="text-caption font-semibold text-ink-700">清单模板</span><el-button text size="small" @click="editingTemplateName = activeList.name; templateDialogVisible = true">保存当前</el-button></div><div v-if="!templates.length" class="text-caption text-ink-400">保存常用采购组合</div><div v-for="template in templates" :key="template.id" class="mb-1 flex items-center gap-1"><button class="min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-caption text-ink-600 hover:bg-surface-1" @click="applyTemplate(template)">{{ template.name }}</button><el-button text circle size="small" title="删除模板" aria-label="删除模板" @click="deleteTemplate(template)"><el-icon><Delete /></el-icon></el-button></div></div></aside>
      <main v-if="activeList" class="min-w-0 rounded-2xl border border-border-subtle bg-white shadow-sm"><div class="border-b border-border-subtle p-4 sm:p-5"><div class="flex flex-wrap items-start justify-between gap-3"><div class="min-w-0"><div class="flex items-center gap-2"><h3 class="truncate text-h2 font-semibold text-ink-900">{{ activeList.name }}</h3><el-button text circle size="small" title="编辑清单信息" aria-label="编辑清单信息" @click="editListDetails"><el-icon><Edit /></el-icon></el-button></div><p class="mt-1 text-caption text-ink-500">{{ activeList.description || '暂无描述' }} · {{ activeList.method }} · {{ activeList.items.length }} 项 · 已完成 {{ progress }}%</p></div><div class="flex items-center gap-1"><el-button text circle title="复制清单" aria-label="复制清单" @click="copyList"><el-icon><CopyDocument /></el-icon></el-button><el-button text circle title="采购专注模式" aria-label="采购专注模式" @click="toggleFocus"><el-icon><FullScreen /></el-icon></el-button><el-button text circle title="导出图片" aria-label="导出图片" @click="exportImage"><el-icon><Download /></el-icon></el-button><el-dropdown trigger="click"><el-button text circle title="更多操作" aria-label="更多操作"><el-icon><More /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="toggleArchive(activeList)">{{ activeList.archived ? '取消归档' : '归档清单' }}</el-dropdown-item><el-dropdown-item @click="historyDialogVisible = true"><el-icon><Clock /></el-icon>历史购买</el-dropdown-item><el-dropdown-item divided class="!text-danger-600" @click="deleteList(activeList)">删除清单</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></div><div class="mt-4 h-2 overflow-hidden rounded-full bg-surface-2"><div class="h-full rounded-full bg-success-500 transition-all" :style="{ width: `${progress}%` }"></div></div><div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5"><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">待购买</p><strong class="text-h3 text-ink-900">{{ pendingItems.length }}</strong></div><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">已购买</p><strong class="text-h3 text-success-700">{{ purchasedItems.length }}</strong></div><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">预计花费</p><strong class="text-h3 text-ink-900">¥{{ money(estimatedTotal) }}</strong></div><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">实际花费</p><strong class="text-h3 text-accent-700">¥{{ money(actualTotal) }}</strong></div><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">预算</p><strong class="text-h3" :class="activeList.budget && estimatedTotal > activeList.budget ? 'text-danger-600' : 'text-ink-900'">{{ activeList.budget ? `¥${money(activeList.budget)}` : '未设置' }}</strong></div><div class="rounded-xl bg-surface-1 p-3"><p class="text-caption text-ink-500">分类</p><strong class="text-h3 text-accent-700">{{ categoryStats.length }}</strong></div></div></div>
        <div class="flex flex-col gap-3 border-b border-border-subtle p-4 sm:flex-row sm:items-center sm:p-5"><el-button type="primary" class="!rounded-xl" @click="openNewItem()"><el-icon><Plus /></el-icon>添加条目</el-button><el-input v-model="search" clearable placeholder="搜索商品或备注" class="w-full sm:max-w-xs" /><el-select v-model="categoryFilter" class="w-full sm:w-36"><el-option label="全部分类" value="全部分类" /><el-option v-for="category in categories" :key="category" :label="category" :value="category" /></el-select><el-select v-model="sortBy" class="w-full sm:w-32"><el-option label="手动排序" value="manual" /><el-option label="按优先级" value="priority" /><el-option label="按分类" value="category" /><el-option label="按预计价格" value="price" /></el-select><el-button class="sm:ml-auto" :disabled="!purchasedItems.length" @click="clearPurchased"><el-icon><Delete /></el-icon>清空已购</el-button></div>
        <div class="flex gap-1 overflow-x-auto border-b border-border-subtle px-4 pt-2 sm:px-5"><button v-for="tab in [{ key: 'all', label: '全部' }, { key: 'pending', label: '待购买' }, { key: 'purchased', label: '已购买' }]" :key="tab.key" class="whitespace-nowrap border-b-2 px-2 pb-3 pt-1 text-body-sm" :class="filter === tab.key ? 'border-accent-500 font-semibold text-accent-700' : 'border-transparent text-ink-500 hover:text-ink-800'" @click="filter = tab.key as typeof filter">{{ tab.label }}</button></div>
        <div class="border-b border-border-subtle px-4 py-3 sm:px-5"><div class="mb-2 flex items-center justify-between"><span class="text-caption font-semibold text-ink-700">分类统计</span><span class="text-caption text-ink-400">待购买 {{ pendingItems.length }} 项</span></div><div class="flex flex-wrap gap-2"><button v-for="entry in categoryStats" :key="entry.category" class="rounded-lg border px-2.5 py-1.5 text-caption hover:opacity-80" :style="categoryStyle(entry.category)" @click="categoryFilter = entry.category">{{ entry.category }} {{ entry.count }}</button><span v-if="!categoryStats.length" class="text-caption text-ink-400">暂无待购买分类</span></div></div><div class="border-b border-border-subtle px-4 py-3 sm:px-5"><div class="mb-2 flex items-center justify-between"><span class="text-caption font-semibold text-ink-700">最近/常买</span><el-button text size="small" @click="historyDialogVisible = true">查看历史</el-button></div><div class="flex flex-wrap gap-2"><button v-for="item in [...recentItems, ...frequentItems.filter((entry) => !recentItems.some((recent) => recent.name === entry.name))].slice(0, 8)" :key="item.name" class="rounded-lg border border-border-subtle px-2.5 py-1.5 text-caption text-ink-600 hover:border-accent-300 hover:text-accent-700" @click="addQuickItem(item)">{{ item.name }}</button><span v-if="!recentItems.length && !frequentItems.length" class="text-caption text-ink-400">完成购买后会显示常用商品</span></div></div>
        <div v-loading="loading" class="min-h-[220px] p-4 sm:p-5"><div v-if="!filteredItems.length" class="flex min-h-[180px] flex-col items-center justify-center text-center"><div class="mb-3 rounded-full bg-surface-1 p-4 text-ink-400"><el-icon :size="28"><Check /></el-icon></div><p class="text-body-sm font-medium text-ink-700">{{ activeList.items.length ? '没有符合条件的条目' : '这份清单还是空的' }}</p><el-button v-if="!activeList.items.length" text type="primary" class="mt-2" @click="openNewItem()">添加第一项</el-button></div><div v-else class="space-y-2"><div v-for="item in filteredItems" :key="item.id" class="group flex items-start gap-3 rounded-xl border border-border-subtle p-3 transition-colors hover:border-accent-200 hover:bg-accent-50/30" :class="item.purchased ? 'opacity-65' : ''"><button class="self-center flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2" :class="item.purchased ? 'border-success-500 bg-success-500 text-white' : 'border-ink-300 hover:border-accent-500'" :aria-label="item.purchased ? '标记为待购买' : '标记为已购买'" @click="togglePurchased(item)"><el-icon v-if="item.purchased" :size="14"><Check /></el-icon></button><el-image v-if="item.imageUrl" :src="item.imageUrl" :alt="`${item.name} 参考图`" :preview-src-list="[item.imageUrl]" preview-teleported fit="cover" class="h-14 w-14 shrink-0 cursor-zoom-in rounded-lg border border-border-subtle" loading="lazy" /><div v-else class="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-ink-300" title="暂无参考图"><el-icon><Picture /></el-icon></div><div class="min-w-0 flex-1"><div class="flex flex-wrap items-center gap-x-2 gap-y-1"><span class="text-body font-medium" :class="item.purchased ? 'text-ink-500 line-through' : 'text-ink-900'">{{ item.name }}</span><el-tag size="small" effect="plain" :style="categoryStyle(item.category)">{{ item.category }}</el-tag><el-tag v-if="item.required" size="small" type="danger" effect="plain">必买</el-tag><el-icon v-if="item.priority === 3" class="text-warning-500" title="高优先级"><Star /></el-icon></div><div class="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-500"><span>{{ item.quantity }} {{ item.unit }}</span><span v-if="item.weight">{{ item.weight }}</span><span v-if="item.note" class="max-w-full line-clamp-2">{{ item.note }}</span></div></div><div class="hidden shrink-0 text-right sm:block"><p class="text-caption text-ink-400">实际 / 预计</p><p class="text-body-sm font-medium text-ink-700">¥{{ money(item.actualPrice * item.quantity) }} / ¥{{ money(item.estimatedPrice * item.quantity) }}</p></div><div class="flex shrink-0 gap-0.5"><el-button text circle size="small" title="编辑" aria-label="编辑" @click="openNewItem(item)"><el-icon><Edit /></el-icon></el-button><el-button text circle size="small" title="删除" aria-label="删除" class="!text-danger-500" @click="removeItem(item)"><el-icon><Delete /></el-icon></el-button></div></div></div></div>
      </main>
    </div>
    <ToolDetail title="使用说明"><p class="text-body-sm text-ink-600">清单会按用户分别保存在 IndexedDB，浏览器不支持时自动使用 localStorage。登录后自动同步，断网时可继续编辑并在恢复网络后重试。</p></ToolDetail>
    <div ref="exportTarget" class="shopping-export-image" aria-hidden="true"><div class="shopping-export-brand">一方工具箱 · 购物清单</div><h1>{{ activeList?.name }}</h1><p class="shopping-export-meta">{{ activeList?.description || '采购清单' }} · {{ activeList?.method }} · 共 {{ activeList?.items.length || 0 }} 项 · 已购买 {{ purchasedItems.length }} 项 · 预计 ¥{{ money(estimatedTotal) }}</p><div v-for="item in activeList?.items || []" :key="`export-${item.id}`" class="shopping-export-item"><span class="shopping-export-check">{{ item.purchased ? '✓' : '○' }}</span><div class="shopping-export-main"><strong>{{ item.name }}<small v-if="item.required"> · 必买</small></strong><span>{{ item.quantity }} {{ item.unit }}<template v-if="item.weight"> · {{ item.weight }}</template> · {{ item.category }}</span><small v-if="item.note">备注：{{ item.note }}</small></div><span class="shopping-export-price">¥{{ money(item.purchased ? item.actualPrice * item.quantity : item.estimatedPrice * item.quantity) }}</span></div><div class="shopping-export-footer">导出时间：{{ new Date().toLocaleString('zh-CN') }}</div></div>
    <el-dialog v-model="itemDialogVisible" :title="isEditingItem ? '编辑条目' : '添加条目'" width="min(560px, calc(100vw - 28px))"><el-form label-position="top"><el-form-item label="商品名称" required><el-input v-model="editingItem.name" placeholder="例如：西红柿" maxlength="80" /></el-form-item><div class="grid grid-cols-2 gap-3 sm:grid-cols-4"><el-form-item label="数量"><el-input-number v-model="editingItem.quantity" :min="0.01" :precision="2" class="!w-full" /></el-form-item><el-form-item label="单位"><el-input v-model="editingItem.unit" placeholder="件" /></el-form-item><el-form-item label="重量/规格"><el-input v-model="editingItem.weight" placeholder="500g" /></el-form-item><el-form-item label="分类"><el-select v-model="editingItem.category" class="w-full"><el-option v-for="category in categories" :key="category" :label="category" :value="category" /></el-select></el-form-item></div><div class="grid grid-cols-2 gap-3"><el-form-item label="预计单价"><el-input-number v-model="editingItem.estimatedPrice" :min="0" :precision="2" class="!w-full" /></el-form-item><el-form-item label="实际单价"><el-input-number v-model="editingItem.actualPrice" :min="0" :precision="2" class="!w-full" /></el-form-item><el-form-item label="优先级"><el-select v-model="editingItem.priority" class="w-full"><el-option label="普通" :value="2" /><el-option label="低" :value="1" /><el-option label="高" :value="3" /></el-select></el-form-item><el-form-item label="必买"><el-switch v-model="editingItem.required" /></el-form-item></div><el-form-item label="参考图片"><div class="flex items-center gap-3 rounded-xl border border-dashed p-3 transition-colors" :class="imageDragActive ? 'border-accent-500 bg-accent-50' : 'border-border-subtle'" @dragenter.prevent="imageDragActive = true" @dragover.prevent="imageDragActive = true" @dragleave.prevent="imageDragActive = false" @drop.prevent="handleImageDrop"><el-image v-if="editingItem.imageUrl" :src="editingItem.imageUrl" :alt="`${editingItem.name || '商品'} 参考图`" :preview-src-list="[editingItem.imageUrl]" preview-teleported fit="cover" class="h-20 w-20 cursor-zoom-in rounded-lg border border-border-subtle" /><div v-else class="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-surface-1 text-ink-300"><el-icon :size="24"><Picture /></el-icon></div><div class="flex flex-wrap gap-2"><label class="el-button el-button--small cursor-pointer" :class="uploadingImage ? 'is-disabled' : ''"><el-icon><Picture /></el-icon>{{ uploadingImage ? '上传中…' : editingItem.imageUrl ? '更换图片' : '上传图片' }}<input type="file" accept="image/jpeg,image/png,image/webp" class="hidden" :disabled="uploadingImage" @change="uploadItemImage" /></label><el-button v-if="editingItem.imageUrl" size="small" @click="removeItemImage">移除</el-button><span class="w-full text-caption text-ink-400">支持点击选择、拖拽或直接粘贴（Ctrl/Cmd+V），JPG、PNG、WebP，最大 5MB</span></div></div></el-form-item><el-form-item label="备注"><el-input v-model="editingItem.note" type="textarea" :rows="2" placeholder="品牌、购买地点或其他提醒" maxlength="200" show-word-limit /></el-form-item></el-form><template #footer><el-button @click="itemDialogVisible = false">取消</el-button><el-button type="primary" @click="saveItem">保存条目</el-button></template></el-dialog>
    <el-dialog v-model="listDialogVisible" :title="editingList ? '编辑清单信息' : '新建清单'" width="min(500px, calc(100vw - 28px))"><el-form label-position="top"><el-form-item label="名称"><el-input v-if="editingList" v-model="editingList.name" maxlength="40" /><el-input v-else v-model="editingListName" autofocus maxlength="40" @keyup.enter="saveList" /></el-form-item><template v-if="editingList"><el-form-item label="描述"><el-input v-model="editingList.description" maxlength="120" /></el-form-item><div class="grid grid-cols-2 gap-3"><el-form-item label="预算"><el-input-number v-model="editingList.budget" :min="0" :precision="2" class="!w-full" /></el-form-item><el-form-item label="采购方式"><el-select v-model="editingList.method" class="w-full"><el-option v-for="method in methods" :key="method" :label="method" :value="method" /></el-select></el-form-item></div></template></el-form><template #footer><el-button @click="listDialogVisible = false">取消</el-button><el-button type="primary" @click="saveList">{{ editingList ? '保存' : '创建清单' }}</el-button></template></el-dialog>
    <el-dialog v-model="templateDialogVisible" title="保存清单模板" width="min(420px, calc(100vw - 28px))"><el-input v-model="editingTemplateName" autofocus placeholder="模板名称" maxlength="40" @keyup.enter="saveTemplate" /><template #footer><el-button @click="templateDialogVisible = false">取消</el-button><el-button type="primary" @click="saveTemplate">保存模板</el-button></template></el-dialog>
    <el-dialog v-model="historyDialogVisible" title="历史购买" width="min(620px, calc(100vw - 28px))"><div v-if="!history.length" class="py-8 text-center text-body-sm text-ink-500">还没有购买记录</div><div v-else class="max-h-[55vh] space-y-2 overflow-y-auto"><div v-for="entry in history" :key="entry.id" class="flex items-center justify-between rounded-xl border border-border-subtle p-3"><div><p class="text-body-sm font-medium text-ink-800">{{ entry.item.name }}</p><p class="text-caption text-ink-500">{{ entry.listName }} · {{ entry.item.quantity }} {{ entry.item.unit }} · {{ new Date(entry.purchasedAt).toLocaleString('zh-CN') }}</p></div><el-button size="small" @click="addQuickItem(entry.item)">加入当前清单</el-button></div></div></el-dialog>
  </div>
</template>

<style scoped>
.shopping-export-image { position: fixed; left: -10000px; top: 0; width: 760px; padding: 44px; background: #fff; color: #18212f; font-family: Inter, Arial, sans-serif; }
.shopping-export-brand { color: #e66b2f; font-size: 14px; font-weight: 700; letter-spacing: .04em; }
.shopping-export-image h1 { margin: 12px 0 6px; font-size: 32px; }
.shopping-export-meta, .shopping-export-footer { color: #687386; font-size: 14px; }
.shopping-export-item { display: flex; align-items: flex-start; gap: 14px; padding: 16px 0; border-bottom: 1px solid #e7ebf0; }
.shopping-export-check { width: 24px; color: #27a269; font-size: 22px; }
.shopping-export-main { display: flex; min-width: 0; flex: 1; flex-direction: column; gap: 5px; }
.shopping-export-main strong { font-size: 17px; }
.shopping-export-main span, .shopping-export-main small { color: #687386; font-size: 13px; }
.shopping-export-price { color: #d95c26; font-weight: 700; white-space: nowrap; }
.shopping-export-footer { margin-top: 24px; }
.shopping-page :deep(.el-button:active) { transform: scale(.98); }
.shopping-page :deep(.el-form-item) { margin-bottom: 16px; }
.shopping-page :deep(.el-dialog__body) { padding-top: 8px; }
.focus-shopping-page { max-width: 1600px; }
@media (max-width: 640px) { .shopping-page :deep(.el-dialog) { margin-top: 8vh; } }
</style>
